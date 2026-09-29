-- 0120 — candidate descriptions and draft ARs
--
-- candidates
--   + description: what the candidate is, for Chris (e.g. "5 G Shumard Oak");
--     the pill shows it with the price and the customer note
--   + is_original: the line's original request as the customer asked it
-- availability_requests.status gains 'draft': Create AR starts one, candidates
-- are dragged in, and Send (send_availability_request) makes it 'new' — only
-- then does the supplier see it in the portal or through a public link.
BEGIN;
SET LOCAL lock_timeout = '250ms';
SET LOCAL statement_timeout = '5s';

-- 1. Candidate description and original flag ---------------------------------
ALTER TABLE public.candidates
  ADD COLUMN description text,
  ADD COLUMN is_original boolean NOT NULL DEFAULT false;

-- Asked candidates were snapshots of the line as requested; on lines never
-- asked, Rosie created the original request first.
ALTER TABLE public.candidates DISABLE TRIGGER handle_updated_at;
UPDATE public.candidates SET description = nullif(concat_ws(' ', nullif(btrim(size), ''), btrim(name)), '');
UPDATE public.candidates SET is_original = true
  WHERE availability_request_id IS NOT NULL
     OR id IN (SELECT min(c.id) FROM public.candidates c
               WHERE c.availability_request_id IS NULL AND c.job_request_item_id IS NOT NULL
                 AND NOT EXISTS (SELECT 1 FROM public.candidates a WHERE a.job_request_item_id = c.job_request_item_id
                   AND a.availability_request_id IS NOT NULL)
               GROUP BY c.job_request_item_id);
ALTER TABLE public.candidates ENABLE TRIGGER handle_updated_at;

COMMENT ON COLUMN public.candidates.description IS
  'What this candidate is, for Chris (size, plant, variant). The customer-facing text is note_for_customer.';
COMMENT ON COLUMN public.candidates.is_original IS 'The line''s original request as the customer asked it.';

-- 2. Draft ARs -----------------------------------------------------------------
ALTER TABLE public.availability_requests DROP CONSTRAINT availability_requests_status_check;
ALTER TABLE public.availability_requests ADD CONSTRAINT availability_requests_status_check
  CHECK (status = ANY (ARRAY['draft'::text, 'new'::text, 'processing'::text, 'submitted'::text, 'closed'::text]));

-- New ARs start as drafts; the supplier sees nothing until Send.
CREATE OR REPLACE FUNCTION public.create_availability_request(p_supplier_id bigint, p_candidate_ids bigint[],
  p_share_customer_details boolean DEFAULT false, p_public_token uuid DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE request_id bigint; job_id bigint; job_count bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND is_active) THEN
    RAISE EXCEPTION 'Active supplier required';
  END IF;
  SELECT min(ji.job_request_id), count(DISTINCT ji.job_request_id) INTO job_id, job_count
    FROM public.candidates c JOIN public.job_request_items ji ON ji.id = c.job_request_item_id
    WHERE c.id = ANY(p_candidate_ids);
  IF job_count <> 1 THEN RAISE EXCEPTION 'An availability request asks for one job''s candidates'; END IF;
  -- Lock customer demand before the supplier request, the same order as closure.
  PERFORM 1 FROM public.job_requests WHERE id = job_id FOR UPDATE;
  INSERT INTO public.availability_requests(supplier_id, job_request_id, status, share_customer_details, public_token)
    VALUES (p_supplier_id, job_id, 'draft', p_share_customer_details, p_public_token) RETURNING id INTO request_id;
  RETURN public.add_candidates_to_availability_request(request_id, p_candidate_ids);
END $function$;

-- Send: the draft becomes New for the supplier. Non-partners get a public link.
CREATE FUNCTION public.send_availability_request(p_request_id bigint)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests;
BEGIN
  SELECT * INTO ar FROM public.availability_requests WHERE id = p_request_id AND is_active FOR UPDATE;
  IF NOT FOUND OR ar.status <> 'draft' THEN RAISE EXCEPTION 'Only a draft request can be sent'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.candidates WHERE availability_request_id = ar.id AND is_active) THEN
    RAISE EXCEPTION 'Add at least one candidate before sending';
  END IF;
  UPDATE public.availability_requests SET status = 'new',
      public_token = CASE WHEN public_token IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.suppliers WHERE id = ar.supplier_id AND is_lps_partner) THEN gen_random_uuid()
        ELSE public_token END
    WHERE id = ar.id;
  RETURN ar.id;
END $function$;

-- The job's Availability stage starts when a Partner's request is sent.
CREATE OR REPLACE FUNCTION public.advance_linked_job_on_partner_request() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.job_request_id IS NOT NULL AND NEW.is_active AND NEW.status NOT IN ('draft', 'closed')
    AND (TG_OP = 'INSERT' OR OLD.status = 'draft') AND EXISTS (
    SELECT 1 FROM public.suppliers s WHERE s.id = NEW.supplier_id AND s.is_active AND s.is_lps_partner) THEN
    PERFORM public.record_job_workflow_event(NEW.job_request_id, 'availability_sent');
  END IF;
  RETURN NULL;
END $function$;
DROP TRIGGER availability_requests_progress ON public.availability_requests;
CREATE TRIGGER availability_requests_progress AFTER INSERT OR UPDATE OF status ON public.availability_requests
  FOR EACH ROW EXECUTE FUNCTION public.advance_linked_job_on_partner_request();

-- LPS edits to a draft's candidates are not supplier progress.
CREATE OR REPLACE FUNCTION public.process_availability_answer() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  -- Shared note edits may be LPS sourcing instructions, so they do not start
  -- supplier processing. The answer RPC explicitly advances note-only replies.
  IF ROW(NEW.status, NEW.available_quantity, NEW.unit_price)
    IS DISTINCT FROM ROW(OLD.status, OLD.available_quantity, OLD.unit_price) THEN
    UPDATE public.availability_requests SET status = 'processing'
    WHERE id = NEW.availability_request_id AND is_active AND status NOT IN ('closed', 'draft');
  END IF;
  RETURN NULL;
END $function$;

-- Suppliers cannot answer or submit a draft (portal and public link alike).
CREATE OR REPLACE FUNCTION public.answer_availability_request(p_request_id bigint, p_supplier_id bigint,
  p_item_id bigint DEFAULT NULL::bigint, p_changes jsonb DEFAULT NULL::jsonb, p_submit boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests; k text; next_status text;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE id = p_request_id AND supplier_id = p_supplier_id AND is_active AND status NOT IN ('closed', 'draft') FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = ar.supplier_id AND is_active) THEN
    RAISE EXCEPTION 'This request is closed, deleted or unavailable';
  END IF;
  IF p_submit THEN
    UPDATE public.availability_requests SET status = 'submitted', submitted_at = now() WHERE id = ar.id;
  ELSE
    IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb THEN
      RAISE EXCEPTION 'Changes are required';
    END IF;
    FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
      IF k NOT IN ('status', 'available_quantity', 'unit_price', 'size', 'note_from_supplier')
        OR jsonb_typeof(p_changes->k) <> 'string' THEN
        RAISE EXCEPTION 'Invalid answer field';
      END IF;
    END LOOP;
    FOREACH k IN ARRAY ARRAY['available_quantity', 'unit_price'] LOOP
      IF p_changes ? k AND nullif(trim(p_changes->>k), '')::numeric::text IN ('NaN', 'Infinity', '-Infinity') THEN
        RAISE EXCEPTION 'Answer numbers must be finite';
      END IF;
    END LOOP;
    SELECT CASE WHEN p_changes ? 'status' THEN nullif(trim(p_changes->>'status'), '') ELSE status END
      INTO next_status FROM public.candidates
      WHERE id = p_item_id AND availability_request_id = ar.id AND is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Line not found'; END IF;
    UPDATE public.candidates SET
      status = next_status,
      size = CASE WHEN p_changes ? 'size' THEN nullif(trim(p_changes->>'size'), '') ELSE size END,
      available_quantity = CASE WHEN next_status = 'unavailable' THEN 0
        WHEN p_changes ? 'available_quantity' THEN nullif(trim(p_changes->>'available_quantity'), '')::numeric
        ELSE available_quantity END,
      unit_price = CASE WHEN next_status = 'unavailable' THEN 0
        WHEN p_changes ? 'unit_price' THEN nullif(trim(p_changes->>'unit_price'), '')::numeric
        ELSE unit_price END,
      note_from_supplier = CASE WHEN p_changes ? 'note_from_supplier'
        THEN nullif(trim(p_changes->>'note_from_supplier'), '') ELSE note_from_supplier END,
      answered_at = now()
    WHERE id = p_item_id;
    UPDATE public.availability_requests SET status = 'processing' WHERE id = ar.id;
  END IF;
  RETURN ar.id;
END $function$;

CREATE OR REPLACE FUNCTION public.answer_public_availability(p_token uuid, p_item_id bigint DEFAULT NULL::bigint,
  p_changes jsonb DEFAULT NULL::jsonb, p_submit boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE public_token = p_token AND is_active AND status NOT IN ('closed', 'draft') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This link is no longer available'; END IF;
  RETURN public.answer_availability_request(ar.id, ar.supplier_id, p_item_id, p_changes, p_submit);
END $function$;

CREATE OR REPLACE FUNCTION public.submit_public_availability_note(p_token uuid, p_note text)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE public_token = p_token AND is_active AND status NOT IN ('closed', 'draft') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This link is no longer available'; END IF;
  RETURN public.submit_availability_request_note(ar.id, ar.supplier_id, p_note);
END $function$;

-- The drag-to-AR helper joins a draft too.
CREATE OR REPLACE FUNCTION public.request_candidate_availability(p_candidate_id bigint)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE c public.candidates; job_id bigint; request_id bigint;
BEGIN
  SELECT * INTO c FROM public.candidates WHERE id = p_candidate_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Candidate not found'; END IF;
  IF c.availability_request_id IS NOT NULL THEN RETURN c.availability_request_id; END IF;
  SELECT job_request_id INTO job_id FROM public.job_request_items WHERE id = c.job_request_item_id;
  SELECT id INTO request_id FROM public.availability_requests
    WHERE job_request_id = job_id AND supplier_id = c.supplier_id
      AND is_active AND status IN ('draft', 'new', 'processing')
    ORDER BY id DESC LIMIT 1;
  IF request_id IS NOT NULL THEN
    RETURN public.add_candidates_to_availability_request(request_id, ARRAY[p_candidate_id]);
  END IF;
  RETURN public.create_availability_request(c.supplier_id, ARRAY[p_candidate_id], false, NULL);
END $function$;

REVOKE ALL ON FUNCTION public.send_availability_request(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_availability_request(bigint) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
