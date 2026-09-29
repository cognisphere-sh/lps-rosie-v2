-- 0119 — job line candidates
--
-- AR lines become candidates: each supplier/plant/size option for one job
-- line, whether or not it has been asked on an AR yet. Price lists are only
-- indicative, so Rosie records the original request plus the listed
-- alternatives as candidates; Chris drags one onto the line (selection) or
-- onto the supplier's AR (asking).
--
--   availability_request_items → candidates
--     + supplier_id (NOT NULL; backfilled from the AR)
--     + job_request_item_id (replaces availability_request_item_jobs; live
--       data has no line linked to more than one job line)
--     + note_from_supplier (split back out of note_for_supplier: answered
--       lines' existing note moves here)
--     + note_for_customer (the line's customer note for this candidate: a short
--       substitute description like "3 G NA, only 5 G", replaced by the
--       supplier's reply on submission, kept in step with the selected line)
--     + answered_at (last supplier answer; drives resync on submission)
--     availability_request_id becomes nullable; unit_price may be 0
--   job_request_items.selected_availability_request_item_id → selected_candidate_id
--   availability_request_jobs → availability_requests.job_request_id: one AR
--     per job (no live AR spans two jobs); a candidate joins only its job's AR
--
-- New RPCs: select_candidate, delete_candidate, request_candidate_availability,
-- add_candidates_to_availability_request. create_availability_request now
-- takes candidate ids. Submitting an AR re-applies candidates answered since
-- the previous submission to the open job lines selecting them, and editing a
-- line's customer note writes it back to its selected candidate.
BEGIN;
SET LOCAL lock_timeout = '250ms';
SET LOCAL statement_timeout = '5s';

-- 1. Rename the table and its objects -------------------------------------
DROP TRIGGER availability_request_items_guard ON public.availability_request_items;
DROP TRIGGER availability_request_items_processing ON public.availability_request_items;
DROP TRIGGER availability_request_items_quantity_allocations ON public.availability_request_items;
DROP TRIGGER availability_request_items_reopen ON public.availability_request_items;
DROP FUNCTION public.guard_availability_item_write();
DROP FUNCTION public.sync_availability_quantity_allocation();

ALTER TABLE public.availability_request_items RENAME TO candidates;
ALTER SEQUENCE public.availability_request_items_id_seq RENAME TO candidates_id_seq;
ALTER TABLE public.candidates RENAME CONSTRAINT availability_request_items_pkey TO candidates_pkey;
ALTER TABLE public.candidates RENAME CONSTRAINT availability_request_items_availability_request_id_fkey TO candidates_availability_request_id_fkey;
ALTER TABLE public.candidates RENAME CONSTRAINT availability_request_items_mapped_inventory_id_fkey TO candidates_mapped_inventory_id_fkey;
ALTER TABLE public.candidates RENAME CONSTRAINT availability_request_items_available_quantity_check TO candidates_available_quantity_check;
ALTER TABLE public.candidates RENAME CONSTRAINT availability_request_items_demanded_quantity_check TO candidates_demanded_quantity_check;
ALTER TABLE public.candidates RENAME CONSTRAINT availability_request_items_status_check TO candidates_status_check;
ALTER TABLE public.candidates DROP CONSTRAINT availability_request_items_unit_price_check;
ALTER TABLE public.candidates ADD CONSTRAINT candidates_unit_price_check CHECK (unit_price IS NULL OR unit_price >= 0);
ALTER INDEX public.availability_request_items_request_idx RENAME TO candidates_request_idx;
ALTER INDEX public.availability_request_items_mapped_inventory_idx RENAME TO candidates_mapped_inventory_idx;

-- 2. New columns and backfill ----------------------------------------------
ALTER TABLE public.candidates
  ADD COLUMN supplier_id bigint REFERENCES public.suppliers(id),
  ADD COLUMN job_request_item_id bigint REFERENCES public.job_request_items(id) ON DELETE SET NULL,
  ADD COLUMN note_from_supplier text,
  ADD COLUMN note_for_customer text,
  ADD COLUMN answered_at timestamptz,
  ALTER COLUMN availability_request_id DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.availability_request_item_jobs
    GROUP BY availability_request_item_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'An AR line is linked to several job lines; candidates need one';
  END IF;
END $$;

-- Backfill keeps each line's real updated_at; answered lines take it as answered_at.
ALTER TABLE public.candidates DISABLE TRIGGER handle_updated_at;
UPDATE public.candidates c SET supplier_id = ar.supplier_id
  FROM public.availability_requests ar WHERE ar.id = c.availability_request_id;
UPDATE public.candidates c SET job_request_item_id = l.job_request_item_id
  FROM public.availability_request_item_jobs l WHERE l.availability_request_item_id = c.id;
UPDATE public.candidates SET note_from_supplier = note_for_supplier, note_for_customer = btrim(note_for_supplier),
    note_for_supplier = NULL
  WHERE status IS NOT NULL AND nullif(btrim(note_for_supplier), '') IS NOT NULL;
UPDATE public.candidates SET answered_at = updated_at WHERE status IS NOT NULL;
ALTER TABLE public.candidates ENABLE TRIGGER handle_updated_at;

ALTER TABLE public.candidates ALTER COLUMN supplier_id SET NOT NULL;
CREATE INDEX candidates_job_item_idx ON public.candidates (job_request_item_id) WHERE job_request_item_id IS NOT NULL;

DROP TABLE public.availability_request_item_jobs;
DROP FUNCTION public.link_availability_item_job();

ALTER TABLE public.job_request_items RENAME COLUMN selected_availability_request_item_id TO selected_candidate_id;
ALTER TABLE public.job_request_items RENAME CONSTRAINT job_request_items_selected_availability_request_item_id_fkey
  TO job_request_items_selected_candidate_id_fkey;

-- One AR per job: the header link table becomes a column. Backfill keeps each
-- AR's updated_at and skips the job-open guard (closed jobs' ARs keep history).
ALTER TABLE public.availability_requests
  ADD COLUMN job_request_id bigint REFERENCES public.job_requests(id) ON DELETE SET NULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.availability_request_jobs
    GROUP BY availability_request_id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'An AR is linked to several jobs; one AR per job is required';
  END IF;
END $$;
ALTER TABLE public.availability_requests DISABLE TRIGGER guard_ar_public_link;
ALTER TABLE public.availability_requests DISABLE TRIGGER handle_updated_at;
UPDATE public.availability_requests ar SET job_request_id = l.job_request_id
  FROM public.availability_request_jobs l WHERE l.availability_request_id = ar.id;
ALTER TABLE public.availability_requests ENABLE TRIGGER guard_ar_public_link;
ALTER TABLE public.availability_requests ENABLE TRIGGER handle_updated_at;
CREATE INDEX availability_requests_job_idx ON public.availability_requests (job_request_id) WHERE job_request_id IS NOT NULL;
DROP TABLE public.availability_request_jobs;
COMMENT ON COLUMN public.availability_requests.job_request_id IS
  'The job this request asks for. NULL only for history kept after its job was deleted.';

COMMENT ON TABLE public.candidates IS
  'Supplier/plant/size options for one job line. availability_request_id is set once the candidate is asked on an AR.';
COMMENT ON COLUMN public.candidates.note_for_supplier IS 'LPS ask to the supplier about this candidate.';
COMMENT ON COLUMN public.candidates.note_from_supplier IS 'Supplier reply about this candidate.';
COMMENT ON COLUMN public.candidates.note_for_customer IS
  'The job line''s customer note for this candidate (e.g. "3 G NA, only 5 G"); replaced by the supplier reply on submission and kept in step with the selecting line.';
COMMENT ON COLUMN public.candidates.answered_at IS 'When the supplier last saved an answer to this candidate.';
COMMENT ON COLUMN public.job_request_items.selected_candidate_id IS
  'Candidate whose size, price, quantity, status and note fill this line.';

-- 3. Candidate triggers -----------------------------------------------------
CREATE FUNCTION public.guard_candidate_write() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests;
BEGIN
  IF NEW.availability_request_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO ar FROM public.availability_requests
    WHERE id = NEW.availability_request_id FOR UPDATE;
  IF NOT FOUND OR NOT ar.is_active OR ar.status = 'closed' THEN
    RAISE EXCEPTION 'This request is closed or deleted';
  END IF;
  IF ar.supplier_id <> NEW.supplier_id THEN
    RAISE EXCEPTION 'Candidate supplier must match the request supplier';
  END IF;
  IF NEW.job_request_item_id IS NOT NULL AND ar.job_request_id IS DISTINCT FROM
    (SELECT job_request_id FROM public.job_request_items WHERE id = NEW.job_request_item_id) THEN
    RAISE EXCEPTION 'Candidate must be asked on its own job''s request';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.availability_request_reopen_on_new_line() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.availability_request_id IS NULL OR (TG_OP = 'UPDATE'
    AND NEW.availability_request_id IS NOT DISTINCT FROM OLD.availability_request_id) THEN
    RETURN NULL;
  END IF;
  UPDATE public.availability_requests SET status = 'new'
    WHERE id = NEW.availability_request_id AND is_active AND status IN ('processing', 'submitted');
  RETURN NULL;
END $function$;

CREATE TRIGGER candidates_guard BEFORE INSERT OR UPDATE OF availability_request_id, supplier_id, name, size,
  demanded_quantity, status, available_quantity, unit_price, note_for_supplier, note_from_supplier,
  mapped_inventory_id, is_active
  ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.guard_candidate_write();
CREATE TRIGGER candidates_processing AFTER UPDATE OF status, available_quantity, unit_price
  ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.process_availability_answer();
CREATE TRIGGER candidates_reopen AFTER INSERT OR UPDATE OF availability_request_id
  ON public.candidates FOR EACH ROW EXECUTE FUNCTION public.availability_request_reopen_on_new_line();

-- AR ↔ job triggers, from the dropped link table to the column.
CREATE OR REPLACE FUNCTION public.advance_linked_job_on_partner_request() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.job_request_id IS NOT NULL AND NEW.is_active AND NEW.status <> 'closed' AND EXISTS (
    SELECT 1 FROM public.suppliers s WHERE s.id = NEW.supplier_id AND s.is_active AND s.is_lps_partner) THEN
    PERFORM public.record_job_workflow_event(NEW.job_request_id, 'availability_sent');
  END IF;
  RETURN NULL;
END $function$;
CREATE TRIGGER availability_requests_progress AFTER INSERT ON public.availability_requests
  FOR EACH ROW EXECUTE FUNCTION public.advance_linked_job_on_partner_request();

CREATE OR REPLACE FUNCTION public.guard_ar_public_link() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  -- Soft deletion only changes visibility. Retain the saved workflow state,
  -- submission date and public token, even if the supplier/jobs are closed.
  IF NOT NEW.is_active THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.status <> 'closed' AND NOT EXISTS (
    SELECT 1 FROM public.job_requests j WHERE j.id = NEW.job_request_id AND j.is_active
      AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')
  ) THEN RAISE EXCEPTION 'All linked job requests are closed'; END IF;
  IF NEW.status = 'closed' THEN
    NEW.public_token := NULL;
  ELSIF NEW.public_token IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.suppliers WHERE id = NEW.supplier_id AND is_active
  ) THEN RAISE EXCEPTION 'Public requests require an active supplier'; END IF;
  -- Reopening an AR is explicit. Entering Submitted is a new submission.
  IF NEW.status = 'submitted' AND (TG_OP = 'INSERT' OR OLD.status <> 'submitted') THEN
    NEW.submitted_at := now();
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.close_ar_on_job_status_change() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  -- Job reopening never restores ARs. Deleted ARs retain their saved state.
  IF NEW.is_active AND NEW.status NOT IN ('closed_won', 'closed_lost', 'archived') THEN RETURN NEW; END IF;
  UPDATE public.availability_requests SET status = 'closed', public_token = NULL
    WHERE job_request_id = NEW.id AND is_active AND (status <> 'closed' OR public_token IS NOT NULL);
  RETURN NEW;
END $function$;

-- 4. Selection ----------------------------------------------------------------
-- Copies the selected candidate onto its job line. A zero candidate price is
-- "no price found" (or unavailable), which the line keeps blank, never $0.
CREATE FUNCTION public.apply_candidate_to_job_item(p_job_request_item_id bigint)
RETURNS void LANGUAGE sql SET search_path TO 'public' AS $function$
  UPDATE public.job_request_items ji SET
    size = c.size,
    unit_price = nullif(c.unit_price, 0),
    available_quantity = least(c.available_quantity, coalesce(c.demanded_quantity, ji.demanded_quantity)),
    status = CASE c.status
      WHEN 'available' THEN 'available' WHEN 'unavailable' THEN 'unavailable'
      WHEN 'diff_size_qty_sub' THEN 'alternative_proposed' WHEN 'can_order' THEN 'need_to_order'
      WHEN 'arriving_soon' THEN 'arriving_soon' ELSE 'pending' END,
    note_for_customer = nullif(btrim(c.note_for_customer), '')
  FROM public.candidates c
  WHERE ji.id = p_job_request_item_id AND c.id = ji.selected_candidate_id;
$function$;

CREATE FUNCTION public.select_candidate(p_job_request_item_id bigint, p_candidate_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  PERFORM 1 FROM public.job_request_items ji JOIN public.job_requests j ON j.id = ji.job_request_id
    WHERE ji.id = p_job_request_item_id AND ji.is_active AND j.is_active
      AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')
    FOR UPDATE OF ji;
  IF NOT FOUND THEN RAISE EXCEPTION 'Open job line not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.candidates
    WHERE id = p_candidate_id AND job_request_item_id = p_job_request_item_id AND is_active) THEN
    RAISE EXCEPTION 'Candidate not found for this line';
  END IF;
  UPDATE public.job_request_items SET selected_candidate_id = p_candidate_id WHERE id = p_job_request_item_id;
  PERFORM public.apply_candidate_to_job_item(p_job_request_item_id);
END $function$;

-- Soft delete. A deleted candidate on an AR also leaves the supplier's view;
-- a selected one is unselected, and the line keeps its values.
CREATE FUNCTION public.delete_candidate(p_candidate_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  UPDATE public.candidates SET is_active = false WHERE id = p_candidate_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Candidate not found'; END IF;
  UPDATE public.job_request_items SET selected_candidate_id = NULL WHERE selected_candidate_id = p_candidate_id;
END $function$;

CREATE FUNCTION public.apply_submitted_candidates() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  -- Only candidates answered since the previous submission. A supplier reply
  -- becomes the candidate's customer note, then selecting open lines follow.
  UPDATE public.candidates SET note_for_customer = btrim(note_from_supplier)
    WHERE availability_request_id = NEW.id AND is_active
      AND answered_at > coalesce(OLD.submitted_at, '-infinity'::timestamptz)
      AND nullif(btrim(note_from_supplier), '') IS NOT NULL;
  PERFORM public.apply_candidate_to_job_item(ji.id)
    FROM public.job_request_items ji
    JOIN public.candidates c ON c.id = ji.selected_candidate_id
    JOIN public.job_requests j ON j.id = ji.job_request_id
    WHERE c.availability_request_id = NEW.id AND c.is_active AND ji.is_active
      AND j.is_active AND j.status IN ('quoted', 'availability')
      AND c.answered_at > coalesce(OLD.submitted_at, '-infinity'::timestamptz);
  RETURN NULL;
END $function$;

-- Editing the selected line's customer note edits the candidate's too.
CREATE FUNCTION public.sync_selected_candidate_note() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  UPDATE public.candidates SET note_for_customer = NEW.note_for_customer
    WHERE id = NEW.selected_candidate_id AND note_for_customer IS DISTINCT FROM NEW.note_for_customer;
  RETURN NULL;
END $function$;

CREATE TRIGGER job_request_items_candidate_note AFTER UPDATE OF note_for_customer ON public.job_request_items
  FOR EACH ROW WHEN (NEW.selected_candidate_id IS NOT NULL AND NEW.note_for_customer IS DISTINCT FROM OLD.note_for_customer)
  EXECUTE FUNCTION public.sync_selected_candidate_note();

CREATE TRIGGER availability_requests_apply_selected AFTER UPDATE OF status ON public.availability_requests
  FOR EACH ROW WHEN (NEW.status = 'submitted' AND NEW.is_active)
  EXECUTE FUNCTION public.apply_submitted_candidates();

-- 5. Asking candidates on ARs -------------------------------------------------
CREATE FUNCTION public.add_candidates_to_availability_request(p_request_id bigint, p_candidate_ids bigint[])
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests; attached bigint;
BEGIN
  IF coalesce(cardinality(p_candidate_ids), 0) = 0 THEN RAISE EXCEPTION 'Candidates are required'; END IF;
  SELECT * INTO ar FROM public.availability_requests WHERE id = p_request_id AND is_active AND status <> 'closed' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This request is closed or deleted'; END IF;
  UPDATE public.candidates c SET availability_request_id = ar.id,
      demanded_quantity = coalesce(c.demanded_quantity, ji.demanded_quantity)
    FROM public.job_request_items ji JOIN public.job_requests j ON j.id = ji.job_request_id
    WHERE c.id = ANY(p_candidate_ids) AND c.is_active AND c.availability_request_id IS NULL
      AND c.supplier_id = ar.supplier_id AND ji.id = c.job_request_item_id AND ji.is_active
      AND ji.job_request_id = ar.job_request_id
      AND j.is_active AND j.status NOT IN ('closed_won', 'closed_lost', 'archived');
  GET DIAGNOSTICS attached = ROW_COUNT;
  IF attached <> cardinality(ARRAY(SELECT DISTINCT unnest(p_candidate_ids))) THEN
    RAISE EXCEPTION 'Each candidate must be active, unasked, on an open line of this request''s job and for its supplier';
  END IF;
  RETURN ar.id;
END $function$;

DROP FUNCTION public.create_availability_request(bigint, jsonb, boolean, uuid);
CREATE FUNCTION public.create_availability_request(p_supplier_id bigint, p_candidate_ids bigint[],
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
  INSERT INTO public.availability_requests(supplier_id, job_request_id, share_customer_details, public_token)
    VALUES (p_supplier_id, job_id, p_share_customer_details, p_public_token) RETURNING id INTO request_id;
  RETURN public.add_candidates_to_availability_request(request_id, p_candidate_ids);
END $function$;

-- The job card's drag onto an AR: join the supplier's open AR for this job,
-- or start one (a public link for non-partner suppliers).
CREATE FUNCTION public.request_candidate_availability(p_candidate_id bigint)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE c public.candidates; job_id bigint; request_id bigint;
BEGIN
  SELECT * INTO c FROM public.candidates WHERE id = p_candidate_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Candidate not found'; END IF;
  IF c.availability_request_id IS NOT NULL THEN RETURN c.availability_request_id; END IF;
  SELECT job_request_id INTO job_id FROM public.job_request_items WHERE id = c.job_request_item_id;
  SELECT id INTO request_id FROM public.availability_requests
    WHERE job_request_id = job_id AND supplier_id = c.supplier_id
      AND is_active AND status IN ('new', 'processing')
    ORDER BY id DESC LIMIT 1;
  IF request_id IS NOT NULL THEN
    RETURN public.add_candidates_to_availability_request(request_id, ARRAY[p_candidate_id]);
  END IF;
  RETURN public.create_availability_request(c.supplier_id, ARRAY[p_candidate_id], false,
    CASE WHEN EXISTS (SELECT 1 FROM public.suppliers WHERE id = c.supplier_id AND is_lps_partner)
      THEN NULL ELSE gen_random_uuid() END);
END $function$;

-- 6. Supplier answers: size is editable; unavailable zeroes quantity and price.
CREATE OR REPLACE FUNCTION public.answer_availability_request(p_request_id bigint, p_supplier_id bigint,
  p_item_id bigint DEFAULT NULL::bigint, p_changes jsonb DEFAULT NULL::jsonb, p_submit boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests; k text; next_status text;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE id = p_request_id AND supplier_id = p_supplier_id AND is_active AND status <> 'closed' FOR UPDATE;
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

-- 7. Deletion and orders, from the link table to the candidate's own column --
CREATE OR REPLACE FUNCTION public.delete_job_request_item(p_job_request_id bigint, p_job_request_item_id bigint)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE found_item bigint; ar_item_count bigint := 0; history_count bigint := 0;
BEGIN
  SELECT id INTO found_item FROM public.job_request_items
    WHERE id = p_job_request_item_id AND job_request_id = p_job_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*) INTO history_count FROM public.job_request_changelog WHERE item_id = p_job_request_item_id;
  SELECT count(*) FILTER (WHERE availability_request_id IS NOT NULL) INTO ar_item_count
    FROM public.candidates WHERE job_request_item_id = p_job_request_item_id;
  UPDATE public.job_request_items SET selected_candidate_id = NULL WHERE id = p_job_request_item_id;
  DELETE FROM public.candidates WHERE job_request_item_id = p_job_request_item_id;
  DELETE FROM public.job_request_items WHERE id = p_job_request_item_id;
  RETURN jsonb_build_object('items', 1, 'availabilityRequests', 0,
    'availabilityRequestItems', ar_item_count, 'changelog', history_count, 'answers', 0);
END $function$;

CREATE OR REPLACE FUNCTION public.close_orphaned_availability_on_job_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  ar_ids bigint[] := '{}'; order_ids bigint[] := '{}';
  ar_count bigint := 0; ar_items bigint := 0; order_count bigint := 0; order_items_count bigint := 0;
  item_count bigint; history_count bigint; thread_count bigint; row_id bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('deleted-job:jr-' || OLD.id, 0));
  -- Lock candidate parent rows before examining their associations. This also
  -- serializes against order/AR creation and attachment through foreign keys.
  FOR row_id IN SELECT o.id FROM public.orders o WHERE EXISTS (
    SELECT 1 FROM public.order_items oi JOIN public.order_item_job_request_items l ON l.order_item_id=oi.id
      JOIN public.job_request_items ji ON ji.id=l.job_request_item_id
      WHERE oi.order_id=o.id AND ji.job_request_id=OLD.id
  ) ORDER BY o.id FOR UPDATE LOOP
    IF NOT EXISTS (SELECT 1 FROM public.order_items oi
      JOIN public.order_item_job_request_items l ON l.order_item_id=oi.id
      JOIN public.job_request_items ji ON ji.id=l.job_request_item_id
      WHERE oi.order_id=row_id AND ji.job_request_id<>OLD.id) THEN
      order_ids := array_append(order_ids,row_id);
    END IF;
  END LOOP;
  FOR row_id IN SELECT id FROM public.availability_requests WHERE job_request_id=OLD.id ORDER BY id FOR UPDATE LOOP
    ar_ids := array_append(ar_ids,row_id);
  END LOOP;
  SELECT count(*) INTO item_count FROM public.job_request_items WHERE job_request_id=OLD.id;
  SELECT count(*) INTO history_count FROM public.job_request_changelog WHERE job_request_id=OLD.id;
  SELECT count(*) INTO order_items_count FROM public.order_items WHERE order_id=ANY(order_ids);
  SELECT count(*) INTO thread_count FROM public.threads WHERE agent='rosie' AND thread_id='jr-'||OLD.id;
  DELETE FROM public.orders WHERE id=ANY(order_ids);
  GET DIAGNOSTICS order_count=ROW_COUNT;
  -- Job deletion retires its ARs and keeps their supplier snapshots.
  -- Candidates never asked on an AR go with the job.
  UPDATE public.availability_requests SET is_active=false WHERE id=ANY(ar_ids) AND is_active;
  GET DIAGNOSTICS ar_count=ROW_COUNT;
  DELETE FROM public.candidates c USING public.job_request_items ji
    WHERE ji.id=c.job_request_item_id AND ji.job_request_id=OLD.id AND c.availability_request_id IS NULL;
  INSERT INTO public.deleted_job_threads(agent,thread_id,job_request_id,deleted_counts)
    VALUES ('rosie','jr-'||OLD.id,OLD.id,jsonb_build_object('items',item_count,'changelog',history_count,
      'availabilityRequests',ar_count,'availabilityRequestItems',ar_items,'orders',order_count,
      'orderItems',order_items_count,'threads',thread_count,'answers',0));
  RETURN OLD;
END $function$;

CREATE OR REPLACE FUNCTION public.create_order(p_supplier_id bigint, p_items jsonb, p_fulfillment_method text DEFAULT NULL::text, p_fulfillment_date date DEFAULT NULL::date, p_note_for_supplier text DEFAULT NULL::text, p_customer_confirmed boolean DEFAULT false, p_note_for_customer text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE line jsonb; allocation jsonb; source public.candidates; ar public.availability_requests;
  job public.job_requests; demand_item public.job_request_items; order_id bigint; line_id bigint;
  demand numeric; allocated numeric; already_ordered numeric;
BEGIN
  IF p_customer_confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Explicit customer confirmation is required'; END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Order items are required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND is_active) THEN RAISE EXCEPTION 'Active supplier required'; END IF;
  -- Serialize supplier commitments, including direct orders for other jobs on a shared AR.
  PERFORM pg_advisory_xact_lock(hashtextextended('order-supplier:' || p_supplier_id, 0));
  FOR job IN SELECT j.* FROM public.job_requests j WHERE j.id IN (
    SELECT ji.job_request_id FROM public.job_request_items ji WHERE ji.id IN (
      SELECT (a->>'job_request_item_id')::bigint FROM jsonb_array_elements(p_items) l,
        LATERAL jsonb_array_elements(l->'allocations') a
    )) ORDER BY j.id FOR UPDATE LOOP
    IF NOT job.is_active OR job.status IN ('closed_won', 'closed_lost', 'archived') THEN RAISE EXCEPTION 'This job request is closed'; END IF;
  END LOOP;
  -- Serialize repeated/subdivided orders on the source request, then its lines.
  PERFORM 1 FROM public.availability_requests a WHERE a.id IN (
    SELECT c.availability_request_id FROM public.candidates c WHERE c.id IN (
      SELECT (l->>'candidate_id')::bigint FROM jsonb_array_elements(p_items) l
    )) ORDER BY a.id FOR UPDATE;
  INSERT INTO public.orders(supplier_id, fulfillment_method, fulfillment_date, note_for_supplier, note_for_customer)
    VALUES (p_supplier_id, p_fulfillment_method, p_fulfillment_date, p_note_for_supplier, p_note_for_customer) RETURNING id INTO order_id;
  FOR line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(line->'allocations') IS DISTINCT FROM 'array' OR jsonb_array_length(line->'allocations') = 0 THEN
      RAISE EXCEPTION 'Order allocations are required'; END IF;
    SELECT * INTO source FROM public.candidates WHERE id = (line->>'candidate_id')::bigint AND is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Availability line not found'; END IF;
    SELECT * INTO ar FROM public.availability_requests WHERE id = source.availability_request_id;
    IF NOT FOUND OR ar.supplier_id <> p_supplier_id OR NOT ar.is_active OR ar.status = 'closed' THEN RAISE EXCEPTION 'Availability request is closed or belongs to another supplier'; END IF;
    IF source.status IS NULL OR source.status = 'unavailable' THEN RAISE EXCEPTION 'Supplier must answer availability before ordering'; END IF;
    SELECT sum((a->>'quantity')::numeric) INTO demand FROM jsonb_array_elements(line->'allocations') a;
    IF demand IS NULL OR demand <= 0 OR demand >= 'Infinity'::numeric THEN RAISE EXCEPTION 'Positive finite quantities are required'; END IF;
    -- All commitments to this supplier for the candidate's job line consume its
    -- budget, including direct orders and selections from another related AR.
    SELECT coalesce(sum(a.quantity), 0) INTO already_ordered
      FROM public.order_item_job_request_items a
      JOIN public.order_items oi ON oi.id = a.order_item_id
      JOIN public.orders o ON o.id = oi.order_id
      WHERE a.job_request_item_id = source.job_request_item_id AND o.supplier_id = p_supplier_id
        AND oi.is_active AND o.is_active AND o.status <> 'closed_lost';
    IF source.demanded_quantity IS NOT NULL AND demand + already_ordered > source.demanded_quantity THEN RAISE EXCEPTION 'Order exceeds remaining requested quantity'; END IF;
    IF source.available_quantity IS NOT NULL AND source.status <> 'can_order' AND demand + already_ordered > source.available_quantity THEN
      RAISE EXCEPTION 'Order exceeds supplier available quantity'; END IF;
    INSERT INTO public.order_items(order_id, name, size, quantity, unit_price, status, note_for_supplier, note_for_customer)
      VALUES (order_id, source.name, source.size, demand, source.unit_price,
        CASE WHEN source.status = 'can_order' THEN 'need_to_order' ELSE coalesce(source.status, 'pending') END,
        nullif(concat_ws(E'\n\n', nullif(btrim(source.note_for_supplier), ''), nullif(btrim(source.note_from_supplier), '')), ''),
        (SELECT string_agg(DISTINCT ji.note_for_customer, E'\n\n' ORDER BY ji.note_for_customer)
          FROM public.job_request_items ji WHERE ji.id IN
            (SELECT (a->>'job_request_item_id')::bigint FROM jsonb_array_elements(line->'allocations') a)))
      RETURNING id INTO line_id;
    FOR allocation IN SELECT * FROM jsonb_array_elements(line->'allocations') LOOP
      allocated := (allocation->>'quantity')::numeric;
      IF allocated IS NULL OR allocated <= 0 OR allocated >= 'Infinity'::numeric THEN RAISE EXCEPTION 'Positive finite allocations are required'; END IF;
      SELECT * INTO demand_item FROM public.job_request_items WHERE id = (allocation->>'job_request_item_id')::bigint AND is_active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Active job line not found'; END IF;
      IF demand_item.id IS DISTINCT FROM source.job_request_item_id THEN RAISE EXCEPTION 'Job line is not allocated to this availability line'; END IF;
      SELECT coalesce(sum(a.quantity), 0) INTO already_ordered FROM public.order_item_job_request_items a
        JOIN public.order_items oi ON oi.id = a.order_item_id JOIN public.orders o ON o.id = oi.order_id
        WHERE a.job_request_item_id = demand_item.id AND oi.is_active AND o.is_active AND o.status <> 'closed_lost';
      IF demand_item.demanded_quantity IS NOT NULL AND allocated + already_ordered > demand_item.demanded_quantity THEN RAISE EXCEPTION 'Order exceeds remaining customer demand'; END IF;
      INSERT INTO public.order_item_job_request_items VALUES (line_id, demand_item.id, allocated);
      UPDATE public.job_requests SET status = 'committed' WHERE id = demand_item.job_request_id AND status IN ('quoted', 'availability');
    END LOOP;
  END LOOP;
  RETURN order_id;
END $function$;

-- 8. Grants: RPCs are service-role only, like the rest of the AR surface. ----
REVOKE ALL ON FUNCTION public.select_candidate(bigint, bigint), public.delete_candidate(bigint),
  public.request_candidate_availability(bigint), public.add_candidates_to_availability_request(bigint, bigint[]),
  public.create_availability_request(bigint, bigint[], boolean, uuid),
  public.apply_candidate_to_job_item(bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.select_candidate(bigint, bigint), public.delete_candidate(bigint),
  public.request_candidate_availability(bigint), public.add_candidates_to_availability_request(bigint, bigint[]),
  public.create_availability_request(bigint, bigint[], boolean, uuid)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
