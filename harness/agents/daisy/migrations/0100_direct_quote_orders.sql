-- A customer may commit a quoted job straight to a supplier order.  This path
-- deliberately has no availability-request row: it records a quote snapshot,
-- not a supplier response or an implied supplier-facing request.
BEGIN;

CREATE OR REPLACE FUNCTION public.create_direct_order(p_supplier_id bigint, p_items jsonb,
  p_fulfillment_method text DEFAULT NULL, p_fulfillment_date date DEFAULT NULL,
  p_notes text DEFAULT NULL, p_customer_confirmed boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE line jsonb; job public.job_requests; demand_item public.job_request_items;
  order_id bigint; line_id bigint; requested numeric; already_ordered numeric;
BEGIN
  IF p_customer_confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Explicit customer confirmation is required';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order items are required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND is_active) THEN
    RAISE EXCEPTION 'Active supplier required';
  END IF;
  IF p_fulfillment_method IS NOT NULL AND p_fulfillment_method NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'Choose pickup or delivery';
  END IF;

  -- Take job locks before line locks, matching the existing order lifecycle.
  FOR job IN SELECT j.* FROM public.job_requests j WHERE j.id IN (
    SELECT ji.job_request_id FROM public.job_request_items ji WHERE ji.id IN (
      SELECT (line->>'job_request_item_id')::bigint FROM jsonb_array_elements(p_items) line
    )) ORDER BY j.id FOR UPDATE LOOP
    IF NOT job.is_active OR job.status IN ('closed_won', 'closed_lost', 'archived') THEN
      RAISE EXCEPTION 'This job request is closed';
    END IF;
  END LOOP;

  INSERT INTO public.orders(supplier_id, fulfillment_method, fulfillment_date, notes)
    VALUES (p_supplier_id, p_fulfillment_method, p_fulfillment_date, p_notes)
    RETURNING id INTO order_id;
  FOR line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    requested := (line->>'quantity')::numeric;
    IF requested IS NULL OR requested <= 0 OR requested >= 'Infinity'::numeric THEN
      RAISE EXCEPTION 'Positive finite quantities are required';
    END IF;
    SELECT * INTO demand_item FROM public.job_request_items
      WHERE id = (line->>'job_request_item_id')::bigint AND is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Active quoted line not found'; END IF;
    -- Direct and availability-backed orders both consume the same customer demand.
    SELECT coalesce(sum(link.quantity), 0) INTO already_ordered
      FROM public.order_item_job_request_items link
      JOIN public.order_items item ON item.id = link.order_item_id
      JOIN public.orders existing_order ON existing_order.id = item.order_id
      WHERE link.job_request_item_id = demand_item.id AND item.is_active
        AND existing_order.is_active AND existing_order.status <> 'closed_lost';
    IF demand_item.quantity IS NOT NULL AND requested + already_ordered > demand_item.quantity THEN
      RAISE EXCEPTION 'Order exceeds remaining customer demand';
    END IF;
    INSERT INTO public.order_items(order_id, availability_request_item_id, name, size, quantity, unit_price, status, notes)
      VALUES (order_id, NULL, demand_item.name, demand_item.size, requested, demand_item.unit_price,
        coalesce(demand_item.status, 'pending'), demand_item.external_notes)
      RETURNING id INTO line_id;
    INSERT INTO public.order_item_job_request_items(order_item_id, job_request_item_id, quantity)
      VALUES (line_id, demand_item.id, requested);
    UPDATE public.job_requests SET status = 'committed'
      WHERE id = demand_item.job_request_id AND status IN ('quoted', 'availability');
  END LOOP;
  RETURN order_id;
END $$;

COMMENT ON FUNCTION public.create_direct_order(bigint,jsonb,text,date,text,boolean) IS
  'Creates a customer-confirmed supplier order from quoted job lines without an availability request.';
REVOKE ALL ON FUNCTION public.create_direct_order(bigint,jsonb,text,date,text,boolean)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_direct_order(bigint,jsonb,text,date,text,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.update_partner_order_item(p_order_id bigint, p_supplier_id bigint,
  p_order_item_id bigint, p_status text)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN ('pending', 'available', 'unavailable', 'diff_size_qty_sub', 'need_to_order', 'arriving_soon') THEN
    RAISE EXCEPTION 'Choose a valid plant status';
  END IF;
  PERFORM 1 FROM public.orders o JOIN public.suppliers s ON s.id = o.supplier_id
    WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id AND o.is_active AND s.is_active
      AND o.status NOT IN ('closed_won', 'closed_lost') FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is unavailable'; END IF;
  UPDATE public.order_items SET status = p_status WHERE id = p_order_item_id AND order_id = p_order_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order line is unavailable'; END IF;
  RETURN p_order_item_id;
END $$;
REVOKE ALL ON FUNCTION public.update_partner_order_item(bigint,bigint,bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_partner_order_item(bigint,bigint,bigint,text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
