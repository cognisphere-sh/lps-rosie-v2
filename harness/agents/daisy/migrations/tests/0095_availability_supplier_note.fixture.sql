-- Disposable PostgreSQL database only. Uses the production 0088 answer routine.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE public.suppliers(id bigint PRIMARY KEY, is_active boolean NOT NULL DEFAULT true);
CREATE TABLE public.availability_requests(id bigint PRIMARY KEY, supplier_id bigint REFERENCES public.suppliers,
  is_active boolean NOT NULL DEFAULT true, status text NOT NULL DEFAULT 'new', submitted_at timestamptz, public_token uuid UNIQUE);
CREATE TABLE public.availability_request_items(id bigint PRIMARY KEY, availability_request_id bigint REFERENCES public.availability_requests,
  is_active boolean NOT NULL DEFAULT true, status text, available_quantity numeric, unit_price numeric, notes text);
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

INSERT INTO public.suppliers(id) VALUES (7),(8);
INSERT INTO public.availability_requests(id,supplier_id,public_token) VALUES
  (1,7,'00000000-0000-4000-8000-000000000001'),(2,8,'00000000-0000-4000-8000-000000000002');
INSERT INTO public.availability_request_items(id,availability_request_id,notes) VALUES (11,1,'Line-only note');
