-- Job and availability lifecycle hooks. Stored vocabulary stays compatible:
-- sourcing = New, quoted = In Progress, submitted = Completed.
BEGIN;

ALTER TABLE public.availability_requests ADD COLUMN status_before_close text
  CHECK (status_before_close IN ('new', 'processing', 'submitted'));
ALTER TABLE public.availability_requests ADD COLUMN was_public_before_close boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.availability_requests.status_before_close IS
  'Stage immediately before closure, restored when the job reopens. NULL for historical closed requests whose prior stage was never recorded.';
COMMENT ON COLUMN public.availability_requests.was_public_before_close IS
  'Whether the request had a public link when closed. Job reopening issues a new token; the obsolete URL stays revoked.';

-- Agent calls cover work that need not write a price (including no-match
-- searches) and communication events that the database cannot observe.
CREATE FUNCTION public.record_job_workflow_event(p_job_request_id bigint, p_event text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE job public.job_requests;
BEGIN
  IF p_event IS NULL OR p_event NOT IN
    ('pricing_fetched', 'availability_sent', 'quote_shared', 'customer_confirmed') THEN
    RAISE EXCEPTION 'Unknown job workflow event';
  END IF;
  SELECT * INTO job FROM public.job_requests WHERE id = p_job_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job request not found'; END IF;
  IF job.is_active AND job.status IN ('sourcing', 'quoted') THEN
    IF p_event = 'customer_confirmed' THEN
      UPDATE public.job_requests SET status = 'confirmed' WHERE id = job.id;
      RETURN 'confirmed';
    ELSIF job.status = 'sourcing' THEN
      UPDATE public.job_requests SET status = 'quoted' WHERE id = job.id;
      RETURN 'quoted';
    END IF;
  END IF;
  RETURN job.status;
END $$;
REVOKE ALL ON FUNCTION public.record_job_workflow_event(bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_job_workflow_event(bigint, text) TO service_role;

CREATE FUNCTION public.advance_job_on_item_pricing() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NEW.is_active AND NEW.unit_price IS NOT NULL THEN
    PERFORM public.record_job_workflow_event(NEW.job_request_id, 'pricing_fetched');
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER job_request_items_pricing_progress
  AFTER INSERT OR UPDATE OF unit_price ON public.job_request_items
  FOR EACH ROW EXECUTE FUNCTION public.advance_job_on_item_pricing();

CREATE FUNCTION public.advance_job_on_partner_request() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  -- Partner creation delivers the request to their portal. Non-partner email
  -- delivery is recorded explicitly after the message is actually sent.
  IF NEW.is_active AND NEW.status <> 'closed' AND EXISTS (
    SELECT 1 FROM public.suppliers WHERE id = NEW.supplier_id AND is_active AND is_lps_partner
  ) THEN
    PERFORM public.record_job_workflow_event(NEW.job_request_id, 'availability_sent');
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER availability_requests_job_progress AFTER INSERT ON public.availability_requests
  FOR EACH ROW EXECUTE FUNCTION public.advance_job_on_partner_request();

CREATE OR REPLACE FUNCTION public.guard_ar_public_link() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE job public.job_requests;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.job_request_id IS DISTINCT FROM OLD.job_request_id THEN
    -- Serialize new requests with job closure, including inserts by agents.
    SELECT * INTO job FROM public.job_requests WHERE id = NEW.job_request_id FOR UPDATE;
  ELSE
    SELECT * INTO job FROM public.job_requests WHERE id = NEW.job_request_id;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job request not found'; END IF;
  IF NEW.status <> 'closed' AND
    (NOT job.is_active OR job.status IN ('closed_won', 'closed_lost', 'archived')) THEN
    RAISE EXCEPTION 'This job request is closed';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'closed' AND OLD.status <> 'closed' THEN
    NEW.status_before_close := OLD.status;
    NEW.was_public_before_close := OLD.public_token IS NOT NULL;
  ELSIF NEW.status <> 'closed' THEN
    NEW.status_before_close := NULL;
    NEW.was_public_before_close := false;
  END IF;
  IF NEW.status = 'closed' OR NOT NEW.is_active THEN
    NEW.public_token := NULL;
  ELSIF NEW.public_token IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.suppliers WHERE id = NEW.supplier_id AND is_active
  ) THEN
    RAISE EXCEPTION 'Public requests require an active supplier';
  END IF;
  IF NEW.status = 'submitted' AND
    (TG_OP = 'INSERT' OR (OLD.status <> 'submitted' AND NOT
      (OLD.status = 'closed' AND OLD.status_before_close IS NOT DISTINCT FROM 'submitted'))) THEN
    NEW.submitted_at := now();
  END IF;
  RETURN NEW;
END $$;
COMMENT ON COLUMN public.availability_requests.public_token IS
  'Request-specific public capability for an active supplier, including non-partners. Null = private. Closing or deactivating revokes the link.';

CREATE OR REPLACE FUNCTION public.close_ar_on_job_status_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('closed_won', 'closed_lost', 'archived') OR NOT NEW.is_active THEN
    UPDATE public.availability_requests SET status = 'closed', public_token = NULL
    WHERE job_request_id = NEW.id AND (status <> 'closed' OR public_token IS NOT NULL);
  ELSIF OLD.status IN ('closed_won', 'closed_lost', 'archived') OR NOT OLD.is_active THEN
    UPDATE public.availability_requests ar SET status = ar.status_before_close,
      public_token = CASE WHEN ar.was_public_before_close AND ar.is_active AND EXISTS (
        SELECT 1 FROM public.suppliers s WHERE s.id = ar.supplier_id AND s.is_active
      ) THEN gen_random_uuid() ELSE NULL END
    WHERE ar.job_request_id = NEW.id AND ar.status = 'closed' AND ar.status_before_close IS NOT NULL;
  END IF;
  RETURN NEW;
END $$;

-- The parent row lock is shared by public writes, portal writes and closure.
-- It also protects scripts writing an answer directly, and mapped-item edits.
CREATE FUNCTION public.guard_availability_item_write() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ar public.availability_requests;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE id = NEW.availability_request_id FOR UPDATE;
  IF NOT FOUND OR NOT ar.is_active OR ar.status = 'closed' THEN
    RAISE EXCEPTION 'This request is closed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER availability_request_items_guard
  BEFORE INSERT OR UPDATE OF availability_request_id, name, size, quantity,
    status, available_quantity, unit_price, notes, lps_notes, mapped_inventory_id, is_active
  ON public.availability_request_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_availability_item_write();

CREATE FUNCTION public.process_availability_answer() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- An inserted catalogue price is still an unanswered ask. Saving an answer
  -- (from a portal, public link or an agent entering a supplier reply) starts work.
  IF ROW(NEW.status, NEW.available_quantity, NEW.unit_price, NEW.notes)
    IS DISTINCT FROM ROW(OLD.status, OLD.available_quantity, OLD.unit_price, OLD.notes) THEN
    UPDATE public.availability_requests SET status = 'processing'
    WHERE id = NEW.availability_request_id AND is_active AND status <> 'closed';
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER availability_request_items_processing
  AFTER UPDATE OF status, available_quantity, unit_price, notes ON public.availability_request_items
  FOR EACH ROW EXECUTE FUNCTION public.process_availability_answer();

-- One atomic answer operation for both supplier surfaces. The HTTP server
-- authorizes the supplier ID; only service_role may call these functions.
CREATE FUNCTION public.answer_availability_request(p_request_id bigint, p_supplier_id bigint,
  p_item_id bigint DEFAULT NULL, p_changes jsonb DEFAULT NULL, p_submit boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE ar public.availability_requests; k text;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE id = p_request_id AND supplier_id = p_supplier_id AND is_active AND status <> 'closed' FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = ar.supplier_id AND is_active) THEN
    RAISE EXCEPTION 'This request is closed or unavailable';
  END IF;
  IF p_submit THEN
    UPDATE public.availability_requests SET status = 'submitted', submitted_at = now() WHERE id = ar.id;
  ELSE
    IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb THEN
      RAISE EXCEPTION 'Changes are required';
    END IF;
    FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
      IF k NOT IN ('status', 'available_quantity', 'unit_price', 'notes') OR jsonb_typeof(p_changes->k) <> 'string' THEN
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
      notes = CASE WHEN p_changes ? 'notes' THEN nullif(trim(p_changes->>'notes'), '') ELSE notes END
    WHERE id = p_item_id AND availability_request_id = ar.id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Line not found'; END IF;
    UPDATE public.availability_requests SET status = 'processing' WHERE id = ar.id;
  END IF;
  RETURN ar.id;
END $$;
REVOKE ALL ON FUNCTION public.answer_availability_request(bigint, bigint, bigint, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.answer_availability_request(bigint, bigint, bigint, jsonb, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.answer_public_availability(p_token uuid, p_item_id bigint DEFAULT NULL,
  p_changes jsonb DEFAULT NULL, p_submit boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE ar public.availability_requests;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE public_token = p_token AND is_active AND status <> 'closed' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This link is no longer available'; END IF;
  RETURN public.answer_availability_request(ar.id, ar.supplier_id, p_item_id, p_changes, p_submit);
END $$;

-- Reconcile terminal jobs so pre-existing requests cannot remain editable.
UPDATE public.availability_requests ar SET status = 'closed', public_token = NULL
FROM public.job_requests job WHERE ar.job_request_id = job.id
  AND (NOT job.is_active OR job.status IN ('closed_won', 'closed_lost', 'archived'))
  AND (ar.status <> 'closed' OR ar.public_token IS NOT NULL);

COMMENT ON COLUMN public.availability_requests.status IS
  'new = New; processing = saved supplier answers awaiting submission; submitted = Completed, explicit submission stamped in submitted_at; closed = job closed or request explicitly closed, supplier writes forbidden.';
COMMIT;
