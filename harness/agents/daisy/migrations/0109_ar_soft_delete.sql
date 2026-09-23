-- Separate AR deletion from its workflow and public-link setting.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
LOCK TABLE public.job_requests, public.job_request_items, public.availability_requests,
  public.availability_request_jobs, public.availability_request_items, public.availability_request_item_jobs
  IN ACCESS EXCLUSIVE MODE;

CREATE OR REPLACE FUNCTION public.guard_ar_public_link() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Soft deletion only changes visibility. Retain the saved workflow state,
  -- submission date and public token, even if the supplier/jobs are closed.
  IF NOT NEW.is_active THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.status <> 'closed' AND NOT EXISTS (
    SELECT 1 FROM public.availability_request_jobs l JOIN public.job_requests j ON j.id = l.job_request_id
    WHERE l.availability_request_id = NEW.id AND j.is_active
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
END $$;

CREATE OR REPLACE FUNCTION public.close_ar_on_job_status_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ar public.availability_requests;
BEGIN
  -- Job reopening never restores ARs. Deleted ARs retain their saved state.
  IF NEW.is_active AND NEW.status NOT IN ('closed_won', 'closed_lost', 'archived') THEN RETURN NEW; END IF;
  FOR ar IN SELECT a.* FROM public.availability_requests a WHERE a.is_active AND EXISTS (
    SELECT 1 FROM public.availability_request_jobs l WHERE l.availability_request_id=a.id AND l.job_request_id=NEW.id
  ) ORDER BY a.id FOR UPDATE LOOP
    IF NOT EXISTS (SELECT 1 FROM public.availability_request_jobs l JOIN public.job_requests j ON j.id=l.job_request_id
      WHERE l.availability_request_id=ar.id AND j.is_active AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')) THEN
      UPDATE public.availability_requests SET status='closed',public_token=NULL
        WHERE id=ar.id AND is_active AND (status<>'closed' OR public_token IS NOT NULL);
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_availability_item_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE ar public.availability_requests;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE id = NEW.availability_request_id FOR UPDATE;
  IF NOT FOUND OR NOT ar.is_active OR ar.status = 'closed' THEN
    RAISE EXCEPTION 'This request is closed or deleted';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.process_availability_answer()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- An inserted catalogue price is still an unanswered ask. Saving an answer
  -- (from a portal, public link or an agent entering a supplier reply) starts work.
  IF ROW(NEW.status, NEW.available_quantity, NEW.unit_price, NEW.supplier_notes)
    IS DISTINCT FROM ROW(OLD.status, OLD.available_quantity, OLD.unit_price, OLD.supplier_notes) THEN
    UPDATE public.availability_requests SET status = 'processing'
    WHERE id = NEW.availability_request_id AND is_active AND status <> 'closed';
  END IF;
  RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION public.answer_availability_request(p_request_id bigint, p_supplier_id bigint, p_item_id bigint DEFAULT NULL::bigint, p_changes jsonb DEFAULT NULL::jsonb, p_submit boolean DEFAULT false)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE ar public.availability_requests; k text;
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
      IF k NOT IN ('status', 'available_quantity', 'unit_price', 'supplier_notes') OR jsonb_typeof(p_changes->k) <> 'string' THEN
        RAISE EXCEPTION 'Invalid answer field';
      END IF;
    END LOOP;
    FOREACH k IN ARRAY ARRAY['available_quantity', 'unit_price'] LOOP
      IF p_changes ? k AND nullif(trim(p_changes->>k), '')::numeric::text IN ('NaN', 'Infinity', '-Infinity') THEN
        RAISE EXCEPTION 'Answer numbers must be finite';
      END IF;
    END LOOP;
    UPDATE public.availability_request_items SET
      status = CASE WHEN p_changes ? 'status' THEN nullif(trim(p_changes->>'status'), '') ELSE status END,
      available_quantity = CASE WHEN p_changes ? 'available_quantity' THEN nullif(trim(p_changes->>'available_quantity'), '')::numeric ELSE available_quantity END,
      unit_price = CASE WHEN p_changes ? 'unit_price' THEN nullif(trim(p_changes->>'unit_price'), '')::numeric ELSE unit_price END,
      supplier_notes = CASE WHEN p_changes ? 'supplier_notes' THEN nullif(trim(p_changes->>'supplier_notes'), '') ELSE supplier_notes END
    WHERE id = p_item_id AND availability_request_id = ar.id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Line not found'; END IF;
    UPDATE public.availability_requests SET status = 'processing' WHERE id = ar.id;
  END IF;
  RETURN ar.id;
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
  FOR row_id IN SELECT ar.id FROM public.availability_requests ar WHERE EXISTS (SELECT 1 FROM public.availability_request_jobs l WHERE l.availability_request_id=ar.id AND l.job_request_id=OLD.id)
    OR EXISTS (SELECT 1 FROM public.availability_request_items ai
      JOIN public.availability_request_item_jobs l ON l.availability_request_item_id=ai.id
      JOIN public.job_request_items ji ON ji.id=l.job_request_item_id
      WHERE ai.availability_request_id=ar.id AND ji.job_request_id=OLD.id)
    ORDER BY ar.id FOR UPDATE LOOP
    IF NOT EXISTS (SELECT 1 FROM public.availability_request_jobs l WHERE l.availability_request_id=row_id AND l.job_request_id<>OLD.id)
      AND NOT EXISTS (SELECT 1 FROM public.availability_request_items ai
        JOIN public.availability_request_item_jobs l ON l.availability_request_item_id=ai.id
        JOIN public.job_request_items ji ON ji.id=l.job_request_item_id
        WHERE ai.availability_request_id=row_id AND ji.job_request_id<>OLD.id)
      AND NOT EXISTS (SELECT 1 FROM public.order_items oi JOIN public.availability_request_items ai ON ai.id=oi.availability_request_item_id
        JOIN public.order_item_job_request_items l ON l.order_item_id=oi.id
        JOIN public.job_request_items ji ON ji.id=l.job_request_item_id
        WHERE ai.availability_request_id=row_id AND ji.job_request_id<>OLD.id) THEN
      ar_ids := array_append(ar_ids,row_id);
    ELSIF NOT EXISTS (SELECT 1 FROM public.availability_request_jobs l
      JOIN public.job_requests j ON j.id=l.job_request_id
      WHERE l.availability_request_id=row_id AND j.id<>OLD.id AND j.is_active
        AND j.status NOT IN ('closed_won','closed_lost','archived')) THEN
      -- Preserve other jobs' history while respecting the existing AR guard.
      UPDATE public.availability_requests SET status='closed',public_token=NULL WHERE id=row_id AND is_active;
    END IF;
  END LOOP;
  SELECT count(*) INTO item_count FROM public.job_request_items WHERE job_request_id=OLD.id;
  SELECT count(*) INTO history_count FROM public.job_request_changelog WHERE job_request_id=OLD.id;
  SELECT count(*) INTO order_items_count FROM public.order_items WHERE order_id=ANY(order_ids);
  SELECT count(*) INTO thread_count FROM public.threads WHERE agent='rosie' AND thread_id='jr-'||OLD.id;
  DELETE FROM public.orders WHERE id=ANY(order_ids);
  GET DIAGNOSTICS order_count=ROW_COUNT;
  -- Job deletion retires its exclusive AR headers and keeps supplier snapshots.
  -- The header/item junctions lose only the deleted job's relationships by FK.
  UPDATE public.availability_requests SET is_active=false WHERE id=ANY(ar_ids) AND is_active;
  GET DIAGNOSTICS ar_count=ROW_COUNT;
  INSERT INTO public.deleted_job_threads(agent,thread_id,job_request_id,deleted_counts)
    VALUES ('rosie','jr-'||OLD.id,OLD.id,jsonb_build_object('items',item_count,'changelog',history_count,
      'availabilityRequests',ar_count,'availabilityRequestItems',ar_items,'orders',order_count,
      'orderItems',order_items_count,'threads',thread_count,'answers',0));
  RETURN OLD;
END $function$;

-- Hidden had no recoverable prior workflow state. Retain any legacy records
-- as deleted, closed history; do not guess whether a supplier had submitted.
UPDATE public.availability_requests SET is_active=false,status='closed' WHERE status='hidden';
ALTER TABLE public.availability_requests DROP CONSTRAINT availability_requests_status_check;
ALTER TABLE public.availability_requests ADD CONSTRAINT availability_requests_status_check
  CHECK (status IN ('new','processing','submitted','closed'));
ALTER TABLE public.availability_requests
  DROP COLUMN status_before_close RESTRICT,
  DROP COLUMN was_public_before_close RESTRICT;
COMMENT ON COLUMN public.availability_requests.is_active IS
  'False means soft-deleted: excluded from app views and supplier access, while saved status, submitted_at and public_token are retained. Reopening a job never restores the AR.';
COMMENT ON COLUMN public.availability_requests.status IS
  'new = waiting on supplier; processing = answers in progress; submitted = Completed; closed = supplier edits blocked. AR reopening is explicit; deletion is separate via is_active=false.';
COMMENT ON COLUMN public.availability_requests.public_token IS
  'Request-specific public capability. NULL means private. Inactive requests retain the token but cannot be accessed; closing an active request or explicitly making it private revokes it.';

REVOKE ALL ON FUNCTION public.answer_availability_request(bigint,bigint,bigint,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.answer_availability_request(bigint,bigint,bigint,jsonb,boolean) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
