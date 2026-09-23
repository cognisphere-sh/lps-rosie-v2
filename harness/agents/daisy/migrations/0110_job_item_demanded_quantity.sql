-- Name customer-requested demand explicitly; retain values, totals and allocations.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.job_request_items RENAME COLUMN quantity TO demanded_quantity;
ALTER TABLE public.job_request_items RENAME CONSTRAINT job_request_items_quantity_check
  TO job_request_items_demanded_quantity_check;
COMMENT ON COLUMN public.job_request_items.demanded_quantity IS
  'Quantity requested by the customer for this job line. NULL means unspecified. Available stock remains available_quantity; availability and order allocations retain quantity.';
-- PostgreSQL updates the stored total expression and constraint dependencies
-- with the column rename. Function bodies need explicit replacements.

CREATE OR REPLACE FUNCTION public.create_direct_order(p_supplier_id bigint, p_items jsonb, p_fulfillment_method text DEFAULT NULL::text, p_fulfillment_date date DEFAULT NULL::date, p_notes text DEFAULT NULL::text, p_customer_confirmed boolean DEFAULT false)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
      SELECT (input_line.line->>'job_request_item_id')::bigint
      FROM jsonb_array_elements(p_items) AS input_line(line)
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
    IF demand_item.demanded_quantity IS NOT NULL AND requested + already_ordered > demand_item.demanded_quantity THEN
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
END $function$;

CREATE OR REPLACE FUNCTION public.create_order(p_supplier_id bigint, p_items jsonb, p_fulfillment_method text DEFAULT NULL::text, p_fulfillment_date date DEFAULT NULL::date, p_notes text DEFAULT NULL::text, p_customer_confirmed boolean DEFAULT false)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
    IF source.demanded_quantity IS NOT NULL AND demand + already_ordered > source.demanded_quantity THEN RAISE EXCEPTION 'Order exceeds remaining requested quantity'; END IF;
    IF source.available_quantity IS NOT NULL AND source.status <> 'can_order' AND demand + already_ordered > source.available_quantity THEN
      RAISE EXCEPTION 'Order exceeds supplier available quantity'; END IF;
    INSERT INTO public.order_items(order_id, availability_request_item_id, name, size, quantity, unit_price, status, notes)
      VALUES (order_id, source.id, source.name, source.size, demand, source.unit_price,
        CASE WHEN source.status = 'can_order' THEN 'need_to_order' ELSE coalesce(source.status, 'pending') END, source.supplier_notes)
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
      IF demand_item.demanded_quantity IS NOT NULL AND allocated + already_ordered > demand_item.demanded_quantity THEN RAISE EXCEPTION 'Order exceeds remaining customer demand'; END IF;
      INSERT INTO public.order_item_job_request_items VALUES (line_id, demand_item.id, allocated);
      UPDATE public.job_requests SET status = 'committed' WHERE id = demand_item.job_request_id AND status IN ('quoted', 'availability');
    END LOOP;
  END LOOP;
  RETURN order_id;
END $function$;

CREATE OR REPLACE FUNCTION public.close_order(p_order_id bigint, p_status text)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE job_id bigint; lost boolean;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('closed_won', 'closed_lost') THEN RAISE EXCEPTION 'Choose Won or Lost'; END IF;
  PERFORM 1 FROM public.job_requests j WHERE j.id IN (
    SELECT ji.job_request_id FROM public.order_item_job_request_items a
      JOIN public.job_request_items ji ON ji.id = a.job_request_item_id JOIN public.order_items oi ON oi.id = a.order_item_id
      WHERE oi.order_id = p_order_id
  ) ORDER BY j.id FOR UPDATE;
  UPDATE public.orders SET status = p_status WHERE id = p_order_id AND is_active
    AND (status IN ('new', 'processing', 'order_ready') OR status = p_status);
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is unavailable or already closed with a different outcome'; END IF;
  FOR job_id IN SELECT DISTINCT ji.job_request_id FROM public.order_item_job_request_items a
    JOIN public.job_request_items ji ON ji.id = a.job_request_item_id JOIN public.order_items oi ON oi.id = a.order_item_id
    WHERE oi.order_id = p_order_id LOOP
    IF NOT EXISTS (SELECT 1 FROM public.order_item_job_request_items a JOIN public.job_request_items ji ON ji.id = a.job_request_item_id
      JOIN public.order_items oi ON oi.id = a.order_item_id JOIN public.orders o ON o.id = oi.order_id
      WHERE ji.job_request_id = job_id AND oi.is_active AND o.is_active AND o.status IN ('new', 'processing', 'order_ready'))
      AND NOT EXISTS (SELECT 1 FROM public.job_request_items ji WHERE ji.job_request_id = job_id AND ji.is_active
        AND (ji.demanded_quantity IS NULL OR ji.demanded_quantity > (SELECT coalesce(sum(a.quantity), 0)
          FROM public.order_item_job_request_items a JOIN public.order_items oi ON oi.id = a.order_item_id
          JOIN public.orders o ON o.id = oi.order_id WHERE a.job_request_item_id = ji.id AND oi.is_active AND o.is_active
            AND o.status IN ('closed_won', 'closed_lost')))) THEN
      SELECT EXISTS (SELECT 1 FROM public.order_item_job_request_items a JOIN public.job_request_items ji ON ji.id = a.job_request_item_id
        JOIN public.order_items oi ON oi.id = a.order_item_id JOIN public.orders o ON o.id = oi.order_id
        WHERE ji.job_request_id = job_id AND oi.is_active AND o.is_active AND o.status = 'closed_lost') INTO lost;
      UPDATE public.job_requests SET status = CASE WHEN lost THEN 'closed_lost' ELSE 'closed_won' END
        WHERE id = job_id AND is_active AND status NOT IN ('closed_won', 'closed_lost', 'archived');
    END IF;
  END LOOP;
  RETURN p_order_id;
END $function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
