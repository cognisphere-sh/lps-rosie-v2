-- Hidden requests remain admin-visible and require explicit reopening.
BEGIN;
ALTER TABLE public.availability_requests DROP CONSTRAINT availability_requests_status_check;
ALTER TABLE public.availability_requests ADD CONSTRAINT availability_requests_status_check
  CHECK (status IN ('new', 'processing', 'submitted', 'closed', 'hidden'));
ALTER TABLE public.availability_requests DROP CONSTRAINT availability_requests_status_before_close_check;
ALTER TABLE public.availability_requests ADD CONSTRAINT availability_requests_status_before_close_check
  CHECK (status_before_close IN ('new', 'processing', 'submitted', 'hidden'));
COMMENT ON COLUMN public.availability_requests.status IS
  'new = New; processing = answers in progress; submitted = Completed; closed = closed; hidden = admin-only, supplier access forbidden until explicitly reopened.';

CREATE OR REPLACE FUNCTION public.guard_ar_public_link() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.job_request_id IS NOT NULL THEN
    PERFORM 1 FROM public.job_requests WHERE id = NEW.job_request_id AND is_active
      AND status NOT IN ('closed_won', 'closed_lost', 'archived') FOR UPDATE;
    IF NOT FOUND AND NEW.status NOT IN ('closed', 'hidden') THEN RAISE EXCEPTION 'This job request is closed'; END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status NOT IN ('closed', 'hidden') AND NOT EXISTS (
    SELECT 1 FROM public.job_requests j WHERE j.is_active AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')
      AND (j.id = NEW.job_request_id OR EXISTS (SELECT 1 FROM public.availability_request_jobs l
        WHERE l.availability_request_id = NEW.id AND l.job_request_id = j.id))
  ) THEN RAISE EXCEPTION 'All linked job requests are closed';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'closed' AND OLD.status <> 'closed' THEN
    NEW.status_before_close := OLD.status;
    NEW.was_public_before_close := OLD.public_token IS NOT NULL;
  ELSIF NEW.status NOT IN ('closed', 'hidden') THEN
    NEW.status_before_close := NULL;
    NEW.was_public_before_close := false;
  END IF;
  IF NEW.status IN ('closed', 'hidden') OR NOT NEW.is_active THEN
    NEW.public_token := NULL;
  ELSIF NEW.public_token IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.suppliers WHERE id = NEW.supplier_id AND is_active
  ) THEN RAISE EXCEPTION 'Public requests require an active supplier';
  END IF;
  IF NEW.status = 'submitted' AND
    (TG_OP = 'INSERT' OR (OLD.status <> 'submitted' AND NOT
      (OLD.status = 'closed' AND OLD.status_before_close IS NOT DISTINCT FROM 'submitted'))) THEN
    NEW.submitted_at := now();
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.close_ar_on_job_status_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ar public.availability_requests;
BEGIN
  FOR ar IN SELECT a.* FROM public.availability_requests a WHERE a.job_request_id = NEW.id
    OR EXISTS (SELECT 1 FROM public.availability_request_jobs l WHERE l.availability_request_id = a.id AND l.job_request_id = NEW.id)
    ORDER BY a.id FOR UPDATE LOOP
    IF NEW.status IN ('closed_won', 'closed_lost', 'archived') OR NOT NEW.is_active THEN
      IF NOT EXISTS (SELECT 1 FROM public.availability_request_jobs l JOIN public.job_requests j ON j.id = l.job_request_id
        WHERE l.availability_request_id = ar.id AND j.is_active AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')) THEN
        UPDATE public.availability_requests SET status = 'closed', public_token = NULL
          WHERE id = ar.id AND status <> 'hidden' AND (status <> 'closed' OR public_token IS NOT NULL);
      END IF;
    ELSIF (OLD.status IN ('closed_won', 'closed_lost', 'archived') OR NOT OLD.is_active)
      AND ar.status = 'closed' AND ar.status_before_close IS NOT NULL THEN
      UPDATE public.availability_requests SET status = ar.status_before_close,
        public_token = CASE WHEN ar.was_public_before_close AND ar.is_active AND EXISTS (
          SELECT 1 FROM public.suppliers s WHERE s.id = ar.supplier_id AND s.is_active
        ) THEN gen_random_uuid() ELSE NULL END WHERE id = ar.id;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_availability_item_write() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ar public.availability_requests;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE id = NEW.availability_request_id FOR UPDATE;
  IF NOT FOUND OR NOT ar.is_active OR ar.status IN ('closed', 'hidden') THEN
    RAISE EXCEPTION 'This request is closed or hidden';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.process_availability_answer() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- An inserted catalogue price is still an unanswered ask. Saving an answer
  -- (from a portal, public link or an agent entering a supplier reply) starts work.
  IF ROW(NEW.status, NEW.available_quantity, NEW.unit_price, NEW.notes)
    IS DISTINCT FROM ROW(OLD.status, OLD.available_quantity, OLD.unit_price, OLD.notes) THEN
    UPDATE public.availability_requests SET status = 'processing'
    WHERE id = NEW.availability_request_id AND is_active AND status NOT IN ('closed', 'hidden');
  END IF;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.answer_availability_request(p_request_id bigint, p_supplier_id bigint,
  p_item_id bigint DEFAULT NULL, p_changes jsonb DEFAULT NULL, p_submit boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE ar public.availability_requests; k text;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE id = p_request_id AND supplier_id = p_supplier_id AND is_active AND status NOT IN ('closed', 'hidden') FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = ar.supplier_id AND is_active) THEN
    RAISE EXCEPTION 'This request is closed or hidden or unavailable';
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

NOTIFY pgrst, 'reload schema';
COMMIT;
