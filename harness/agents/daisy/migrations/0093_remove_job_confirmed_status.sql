-- Supplier confirmation is an Order status and date, not a separate job stage.
-- Preserve every Order and historical audit row; migrate only the removed job stage.
BEGIN;

ALTER TABLE public.job_requests DROP CONSTRAINT job_requests_status_check;
UPDATE public.job_requests SET status = 'committed' WHERE status = 'confirmed';
ALTER TABLE public.job_requests ADD CONSTRAINT job_requests_status_check CHECK (
  status IN ('quoted', 'availability', 'committed', 'closed_won', 'closed_lost', 'archived')
);
COMMENT ON COLUMN public.job_requests.status IS
  'Quote (quoted, default), Availability, Committed (customer confirmed), Won/Lost. Archived is legacy history. Supplier confirmation is recorded on Orders; 0093 maps former Confirmed jobs to Committed without changing orders, confirmation dates or existing audit history.';

CREATE OR REPLACE FUNCTION public.record_job_workflow_event(p_job_request_id bigint, p_event text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE job public.job_requests; next_status text;
BEGIN
  IF p_event IS NULL OR p_event NOT IN
    ('pricing_fetched', 'availability_sent', 'quote_shared', 'customer_confirmed', 'supplier_confirmed') THEN
    RAISE EXCEPTION 'Unknown job workflow event';
  END IF;
  SELECT * INTO job FROM public.job_requests WHERE id = p_job_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job request not found'; END IF;
  -- Supplier confirmation belongs to Orders. Accept the legacy event without
  -- changing the job stage so older callers and confirm_order remain compatible.
  IF job.is_active AND job.status NOT IN ('closed_won', 'closed_lost', 'archived') THEN
    IF p_event = 'customer_confirmed' AND job.status IN ('quoted', 'availability') THEN
      next_status := 'committed';
    ELSIF p_event = 'availability_sent' AND job.status = 'quoted' THEN
      next_status := 'availability';
    END IF;
    IF next_status IS NOT NULL THEN
      UPDATE public.job_requests SET status = next_status WHERE id = job.id;
      RETURN next_status;
    END IF;
  END IF;
  RETURN job.status;
END $$;

CREATE OR REPLACE FUNCTION public.create_order(p_supplier_id bigint, p_items jsonb,
  p_fulfillment_method text DEFAULT NULL, p_fulfillment_date date DEFAULT NULL,
  p_notes text DEFAULT NULL, p_customer_confirmed boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE line jsonb; allocation jsonb; source public.availability_request_items; ar public.availability_requests;
  job public.job_requests; demand_item public.job_request_items; order_id bigint; line_id bigint;
  demand numeric; allocated numeric; allocation_limit numeric; already_ordered numeric;
BEGIN
  IF p_customer_confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Explicit customer confirmation is required'; END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Order items are required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND is_active) THEN RAISE EXCEPTION 'Active supplier required'; END IF;
  FOR job IN SELECT j.* FROM public.job_requests j WHERE j.id IN (
    SELECT ji.job_request_id FROM public.job_request_items ji WHERE ji.id IN (
      SELECT (a->>'job_request_item_id')::bigint FROM jsonb_array_elements(p_items) l,
        LATERAL jsonb_array_elements(l->'allocations') a
    )) ORDER BY j.id FOR UPDATE LOOP
    IF NOT job.is_active OR job.status IN ('closed_won', 'closed_lost', 'archived') THEN RAISE EXCEPTION 'This job request is closed'; END IF;
  END LOOP;
  -- Serialize repeated/subdivided orders on the source request, then its lines.
  PERFORM 1 FROM public.availability_requests a WHERE a.id IN (
    SELECT ai.availability_request_id FROM public.availability_request_items ai WHERE ai.id IN (
      SELECT (l->>'availability_request_item_id')::bigint FROM jsonb_array_elements(p_items) l
    )) ORDER BY a.id FOR UPDATE;
  INSERT INTO public.orders(supplier_id, fulfillment_method, fulfillment_date, notes)
    VALUES (p_supplier_id, p_fulfillment_method, p_fulfillment_date, p_notes) RETURNING id INTO order_id;
  FOR line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(line->'allocations') IS DISTINCT FROM 'array' OR jsonb_array_length(line->'allocations') = 0 THEN
      RAISE EXCEPTION 'Order allocations are required'; END IF;
    SELECT * INTO source FROM public.availability_request_items WHERE id = (line->>'availability_request_item_id')::bigint AND is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Availability line not found'; END IF;
    SELECT * INTO ar FROM public.availability_requests WHERE id = source.availability_request_id;
    IF ar.supplier_id <> p_supplier_id OR NOT ar.is_active OR ar.status = 'closed' THEN RAISE EXCEPTION 'Availability request is closed or belongs to another supplier'; END IF;
    IF source.status IS NULL OR source.status = 'unavailable' THEN RAISE EXCEPTION 'Supplier must answer availability before ordering'; END IF;
    SELECT sum((a->>'quantity')::numeric) INTO demand FROM jsonb_array_elements(line->'allocations') a;
    IF demand IS NULL OR demand <= 0 OR demand >= 'Infinity'::numeric THEN RAISE EXCEPTION 'Positive finite quantities are required'; END IF;
    SELECT coalesce(sum(oi.quantity), 0) INTO already_ordered FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
      WHERE oi.availability_request_item_id = source.id AND oi.is_active AND o.is_active AND o.status <> 'closed_lost';
    IF source.quantity IS NOT NULL AND demand + already_ordered > source.quantity THEN RAISE EXCEPTION 'Order exceeds remaining requested quantity'; END IF;
    IF source.available_quantity IS NOT NULL AND source.status <> 'can_order' AND demand + already_ordered > source.available_quantity THEN
      RAISE EXCEPTION 'Order exceeds supplier available quantity'; END IF;
    INSERT INTO public.order_items(order_id, availability_request_item_id, name, size, quantity, unit_price, status, notes)
      VALUES (order_id, source.id, source.name, source.size, demand, source.unit_price,
        CASE WHEN source.status = 'can_order' THEN 'need_to_order' ELSE coalesce(source.status, 'pending') END, source.notes)
      RETURNING id INTO line_id;
    FOR allocation IN SELECT * FROM jsonb_array_elements(line->'allocations') LOOP
      allocated := (allocation->>'quantity')::numeric;
      IF allocated IS NULL OR allocated <= 0 OR allocated >= 'Infinity'::numeric THEN RAISE EXCEPTION 'Positive finite allocations are required'; END IF;
      SELECT * INTO demand_item FROM public.job_request_items WHERE id = (allocation->>'job_request_item_id')::bigint AND is_active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Active job line not found'; END IF;
      SELECT quantity INTO allocation_limit FROM public.availability_request_item_jobs
        WHERE availability_request_item_id = source.id AND job_request_item_id = demand_item.id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Job line is not allocated to this availability line'; END IF;
      SELECT coalesce(sum(a.quantity), 0) INTO already_ordered FROM public.order_item_job_request_items a
        JOIN public.order_items oi ON oi.id = a.order_item_id JOIN public.orders o ON o.id = oi.order_id
        WHERE a.job_request_item_id = demand_item.id AND oi.availability_request_item_id = source.id
          AND oi.is_active AND o.is_active AND o.status <> 'closed_lost';
      IF allocation_limit IS NOT NULL AND allocated + already_ordered > allocation_limit THEN RAISE EXCEPTION 'Order exceeds remaining availability allocation'; END IF;
      SELECT coalesce(sum(a.quantity), 0) INTO already_ordered FROM public.order_item_job_request_items a
        JOIN public.order_items oi ON oi.id = a.order_item_id JOIN public.orders o ON o.id = oi.order_id
        WHERE a.job_request_item_id = demand_item.id AND oi.is_active AND o.is_active AND o.status <> 'closed_lost';
      IF demand_item.quantity IS NOT NULL AND allocated + already_ordered > demand_item.quantity THEN RAISE EXCEPTION 'Order exceeds remaining customer demand'; END IF;
      INSERT INTO public.order_item_job_request_items VALUES (line_id, demand_item.id, allocated);
      UPDATE public.job_requests SET status = 'committed' WHERE id = demand_item.job_request_id AND status IN ('quoted', 'availability');
    END LOOP;
  END LOOP;
  RETURN order_id;
END $$;

-- CREATE OR REPLACE preserves grants; keep the intended RPC access explicit.
REVOKE ALL ON FUNCTION public.record_job_workflow_event(bigint,text),
  public.create_order(bigint,jsonb,text,date,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_job_workflow_event(bigint,text),
  public.create_order(bigint,jsonb,text,date,text,boolean) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
