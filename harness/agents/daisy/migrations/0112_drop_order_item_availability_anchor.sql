-- Drop the redundant order-line AR pointer. Order -> job item -> AR item
-- associations are authoritative; supplier scope comes from orders.
-- Requires 0111's directional note columns. Existing snapshots and allocations
-- are unchanged. AR selection remains a transient create_order input only.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid='public.order_items'::regclass
    AND attname='note_for_supplier' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'Apply 0111_directional_notes before 0112_drop_order_item_availability_anchor';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.create_direct_order(p_supplier_id bigint, p_items jsonb, p_fulfillment_method text DEFAULT NULL::text, p_fulfillment_date date DEFAULT NULL::date, p_note_for_supplier text DEFAULT NULL::text, p_customer_confirmed boolean DEFAULT false, p_note_from_customer text DEFAULT NULL::text, p_note_for_customer text DEFAULT NULL::text)
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

  -- Serialize supplier commitments, including direct orders for other jobs on a shared AR.
  PERFORM pg_advisory_xact_lock(hashtextextended('order-supplier:' || p_supplier_id, 0));

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

  INSERT INTO public.orders(supplier_id, fulfillment_method, fulfillment_date, note_for_supplier, note_from_customer, note_for_customer)
    VALUES (p_supplier_id, p_fulfillment_method, p_fulfillment_date, p_note_for_supplier, p_note_from_customer, p_note_for_customer)
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
    INSERT INTO public.order_items(order_id, name, size, quantity, unit_price, status, note_for_customer)
      VALUES (order_id, demand_item.name, demand_item.size, requested, demand_item.unit_price,
        coalesce(demand_item.status, 'pending'), demand_item.note_for_customer)
      RETURNING id INTO line_id;
    INSERT INTO public.order_item_job_request_items(order_item_id, job_request_item_id, quantity)
      VALUES (line_id, demand_item.id, requested);
    UPDATE public.job_requests SET status = 'committed'
      WHERE id = demand_item.job_request_id AND status IN ('quoted', 'availability');
  END LOOP;
  RETURN order_id;
END $function$;

CREATE OR REPLACE FUNCTION public.create_order(p_supplier_id bigint, p_items jsonb, p_fulfillment_method text DEFAULT NULL::text, p_fulfillment_date date DEFAULT NULL::date, p_note_for_supplier text DEFAULT NULL::text, p_customer_confirmed boolean DEFAULT false, p_note_from_customer text DEFAULT NULL::text, p_note_for_customer text DEFAULT NULL::text)
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
    SELECT ai.availability_request_id FROM public.availability_request_items ai WHERE ai.id IN (
      SELECT (l->>'availability_request_item_id')::bigint FROM jsonb_array_elements(p_items) l
    )) ORDER BY a.id FOR UPDATE;
  INSERT INTO public.orders(supplier_id, fulfillment_method, fulfillment_date, note_for_supplier, note_from_customer, note_for_customer)
    VALUES (p_supplier_id, p_fulfillment_method, p_fulfillment_date, p_note_for_supplier, p_note_from_customer, p_note_for_customer) RETURNING id INTO order_id;
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
    -- All commitments to this supplier for the AR's job items consume its
    -- budget, including direct orders and selections from another related AR.
    SELECT coalesce(sum(a.quantity), 0) INTO already_ordered
      FROM public.order_item_job_request_items a
      JOIN public.order_items oi ON oi.id = a.order_item_id
      JOIN public.orders o ON o.id = oi.order_id
      JOIN public.availability_request_item_jobs aj ON aj.job_request_item_id = a.job_request_item_id
      WHERE aj.availability_request_item_id = source.id AND o.supplier_id = p_supplier_id
        AND oi.is_active AND o.is_active AND o.status <> 'closed_lost';
    IF source.demanded_quantity IS NOT NULL AND demand + already_ordered > source.demanded_quantity THEN RAISE EXCEPTION 'Order exceeds remaining requested quantity'; END IF;
    IF source.available_quantity IS NOT NULL AND source.status <> 'can_order' AND demand + already_ordered > source.available_quantity THEN
      RAISE EXCEPTION 'Order exceeds supplier available quantity'; END IF;
    INSERT INTO public.order_items(order_id, name, size, quantity, unit_price, status, note_from_supplier, note_for_supplier, note_for_customer)
      VALUES (order_id, source.name, source.size, demand, source.unit_price,
        CASE WHEN source.status = 'can_order' THEN 'need_to_order' ELSE coalesce(source.status, 'pending') END, source.note_from_supplier, source.note_for_supplier,
        (SELECT string_agg(DISTINCT ji.note_for_customer, E'\n\n' ORDER BY ji.note_for_customer)
          FROM public.job_request_items ji WHERE ji.id IN
            (SELECT (a->>'job_request_item_id')::bigint FROM jsonb_array_elements(line->'allocations') a)))
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
        WHERE a.job_request_item_id = demand_item.id AND o.supplier_id = p_supplier_id
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

ALTER TABLE public.order_items DROP COLUMN IF EXISTS availability_request_item_id RESTRICT;
COMMENT ON TABLE public.order_item_job_request_items IS
  'Order-line allocations to customer job items; related supplier ARs are resolved through availability_request_item_jobs and orders.supplier_id.';

REVOKE ALL ON FUNCTION public.create_direct_order(bigint,jsonb,text,date,text,boolean,text,text),
  public.create_order(bigint,jsonb,text,date,text,boolean,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_direct_order(bigint,jsonb,text,date,text,boolean,text,text),
  public.create_order(bigint,jsonb,text,date,text,boolean,text,text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
