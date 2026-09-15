-- Supplier confirmation requires a fulfillment date; Chris manages pickup/delivery separately.
BEGIN;

-- Keep existing locks, validation, lifecycle guards, and atomic supplier notes.
CREATE OR REPLACE FUNCTION public.update_partner_order(p_order_id bigint, p_supplier_id bigint, p_patch jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE current_order public.orders; next_status text; next_method text; next_date date; date_text text; next_note text;
BEGIN
  IF jsonb_typeof(p_patch) IS DISTINCT FROM 'object' OR p_patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'Order update is required'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_patch) key
    WHERE key NOT IN ('status', 'fulfillment_method', 'fulfillment_date', 'supplier_notes')) THEN
    RAISE EXCEPTION 'Unsupported order update'; END IF;
  -- Match order creation/closure lock order, including concurrent job archival.
  PERFORM 1 FROM public.job_requests j WHERE j.id IN (
    SELECT ji.job_request_id FROM public.order_item_job_request_items a
      JOIN public.job_request_items ji ON ji.id = a.job_request_item_id
      JOIN public.order_items oi ON oi.id = a.order_item_id
      JOIN public.orders o ON o.id = oi.order_id
      WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id AND oi.is_active
  ) ORDER BY j.id FOR UPDATE;
  SELECT o.* INTO current_order FROM public.orders o JOIN public.suppliers s ON s.id = o.supplier_id
    WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id AND o.is_active AND s.is_active FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is unavailable'; END IF;
  IF current_order.status NOT IN ('new', 'processing', 'order_ready') THEN
    RAISE EXCEPTION 'Closed orders cannot be changed'; END IF;
  IF EXISTS (SELECT 1 FROM public.order_item_job_request_items a JOIN public.order_items oi ON oi.id = a.order_item_id
      WHERE oi.order_id = p_order_id AND oi.is_active)
    AND NOT EXISTS (SELECT 1 FROM public.order_item_job_request_items a
      JOIN public.order_items oi ON oi.id = a.order_item_id
      JOIN public.job_request_items ji ON ji.id = a.job_request_item_id
      JOIN public.job_requests j ON j.id = ji.job_request_id
      WHERE oi.order_id = p_order_id AND oi.is_active AND j.is_active
        AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')) THEN
    RAISE EXCEPTION 'Closed orders cannot be changed'; END IF;
  next_status := current_order.status;
  IF p_patch ? 'status' THEN
    next_status := p_patch->>'status';
    IF next_status IS NULL OR NOT (
      (current_order.status = 'new' AND next_status = 'processing') OR
      (current_order.status = 'processing' AND next_status = 'order_ready')
    ) THEN RAISE EXCEPTION 'Orders move from New to Processing to Order Ready'; END IF;
  END IF;
  next_method := CASE WHEN p_patch ? 'fulfillment_method' THEN p_patch->>'fulfillment_method' ELSE current_order.fulfillment_method END;
  IF next_method IS NOT NULL AND next_method NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'Choose pickup or delivery'; END IF;
  next_date := current_order.fulfillment_date;
  IF p_patch ? 'fulfillment_date' THEN
    date_text := p_patch->>'fulfillment_date';
    IF date_text IS NOT NULL AND date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RAISE EXCEPTION 'Fulfillment date must be a valid date (YYYY-MM-DD)'; END IF;
    next_date := date_text::date;
    IF next_date IS NOT NULL AND to_char(next_date, 'YYYY-MM-DD') <> date_text THEN
      RAISE EXCEPTION 'Fulfillment date must be a valid date (YYYY-MM-DD)'; END IF;
  END IF;
  IF next_status IN ('processing', 'order_ready') AND next_date IS NULL THEN
    RAISE EXCEPTION 'Choose a fulfillment date before confirming the order'; END IF;
  next_note := current_order.supplier_notes;
  IF p_patch ? 'supplier_notes' THEN
    IF jsonb_typeof(p_patch->'supplier_notes') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'Supplier note must be text'; END IF;
    IF length(p_patch->>'supplier_notes') > 10000 THEN
      RAISE EXCEPTION 'Supplier note must be 10000 characters or fewer'; END IF;
    next_note := nullif(btrim(p_patch->>'supplier_notes'), '');
  END IF;
  UPDATE public.orders SET status = next_status, fulfillment_method = next_method, fulfillment_date = next_date,
    supplier_notes = next_note,
    confirmation_date = CASE WHEN current_order.status = 'new' AND next_status = 'processing'
      THEN coalesce(current_order.confirmation_date, CURRENT_DATE) ELSE confirmation_date END
    WHERE id = p_order_id;
  RETURN p_order_id;
END $$;

REVOKE ALL ON FUNCTION public.update_partner_order(bigint,bigint,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_partner_order(bigint,bigint,jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
