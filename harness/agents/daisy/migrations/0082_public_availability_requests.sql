BEGIN;
ALTER TABLE public.availability_requests ADD COLUMN public_token uuid UNIQUE;
COMMENT ON COLUMN public.availability_requests.public_token IS
  'Null = private. Set gen_random_uuid() to publish for an active LPS Partner; clearing or closing revokes the link.';

CREATE FUNCTION public.guard_ar_public_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'closed' OR NOT NEW.is_active THEN
    NEW.public_token := NULL;
  ELSIF NEW.public_token IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.suppliers WHERE id = NEW.supplier_id AND is_active AND is_lps_partner
  ) THEN
    RAISE EXCEPTION 'Public requests require an active LPS Partner';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_ar_public_link BEFORE INSERT OR UPDATE ON public.availability_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_ar_public_link();

CREATE FUNCTION public.close_ar_on_job_status_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status OR (OLD.is_active AND NOT NEW.is_active) THEN
    UPDATE public.availability_requests SET status = 'closed', public_token = NULL
    WHERE job_request_id = NEW.id AND is_active AND status <> 'closed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER close_ar_on_job_status_change AFTER UPDATE OF status, is_active ON public.job_requests
  FOR EACH ROW EXECUTE FUNCTION public.close_ar_on_job_status_change();

-- A row lock makes response writes atomic with revocation and job-driven closure.
-- Only the server may invoke this; anonymous callers never get database access.
CREATE FUNCTION public.answer_public_availability(p_token uuid, p_item_id bigint DEFAULT NULL,
  p_changes jsonb DEFAULT NULL, p_submit boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE ar public.availability_requests; k text;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE public_token = p_token AND is_active AND status <> 'closed' FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.suppliers
    WHERE id = ar.supplier_id AND is_active AND is_lps_partner) THEN
    RAISE EXCEPTION 'This link is no longer available';
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
REVOKE ALL ON FUNCTION public.answer_public_availability(uuid, bigint, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.answer_public_availability(uuid, bigint, jsonb, boolean) TO service_role;
COMMIT;
