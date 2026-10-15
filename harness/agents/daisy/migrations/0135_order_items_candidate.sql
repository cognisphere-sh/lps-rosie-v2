-- 0135 — order lines link to the candidate they were ordered from (2026-10-15)
--
-- (Bhoumik 2026-10-15) Each order line now records its candidate:
-- order_items.candidate_id. A job line maps to its selected candidate; an
-- order line maps to the candidate it was placed for.
-- * create_order (from a supplier's answer): the answered candidate ticked in
--   the order dialog (p_items.candidate_id), as before the only source of the
--   line's name, size, price, status and notes.
-- * create_direct_order (from quoted job lines): the line's selected
--   candidate. Its name is now that candidate's (job_lines.candidate_name), not
--   quote_name (the line's name on an original, a substitute's description);
--   size, price, status and customer note were already the candidate's. The
--   job table shows the customer's ask instead, and its Size / Name edits no
--   longer write the candidate (app change, same day).
-- The order line stays a snapshot: later candidate edits do not change it, and
-- deleting the candidate (a job line or job delete) sets the link NULL rather
-- than losing the order line. Nullable, for that reason.
-- Backfill (2026-10-15 rehearsal: all 56 live order lines, all resolved to the
-- line's current selected candidate with size and price matching): each
-- existing line takes the same-supplier candidate on its one linked job line
-- that matches its name, size and price; else size and price; ties go to the
-- line's selected candidate, then an active one, then the lowest id. updated_at
-- is kept. Lines with no same-supplier candidate stay NULL.
BEGIN;
SET LOCAL lock_timeout = '250ms';
SET LOCAL statement_timeout = '5s';
SET LOCAL app.actor = 'migration 0135';

ALTER TABLE public.order_items
  ADD COLUMN candidate_id bigint REFERENCES public.candidates(id) ON DELETE SET NULL;
CREATE INDEX order_items_candidate_idx ON public.order_items(candidate_id);
COMMENT ON COLUMN public.order_items.candidate_id IS
  'The candidate this order line was placed for: the answered candidate (create_order) or the job line''s selected candidate (create_direct_order). NULL once that candidate is deleted. The line''s values are a snapshot of it at creation.';

ALTER TABLE public.order_items DISABLE TRIGGER handle_updated_at;
UPDATE public.order_items oi SET candidate_id = pick.candidate_id
FROM (
  SELECT DISTINCT ON (i.id) i.id AS order_item_id, c.id AS candidate_id
  FROM public.order_items i
  JOIN public.orders o ON o.id = i.order_id
  JOIN public.order_item_job_request_items l ON l.order_item_id = i.id
  JOIN public.job_request_items ji ON ji.id = l.job_request_item_id
  JOIN public.candidates c ON c.job_request_item_id = ji.id AND c.supplier_id = o.supplier_id
  ORDER BY i.id,
    (c.size IS NOT DISTINCT FROM i.size AND c.unit_price = i.unit_price
      AND lower(btrim(c.name)) = lower(btrim(i.name))) DESC,
    (c.size IS NOT DISTINCT FROM i.size AND c.unit_price = i.unit_price) DESC,
    (c.id = ji.selected_candidate_id) DESC, c.is_active DESC, c.id
) pick
WHERE oi.id = pick.order_item_id AND oi.candidate_id IS NULL;
ALTER TABLE public.order_items ENABLE TRIGGER handle_updated_at;

CREATE OR REPLACE FUNCTION public.create_order(p_supplier_id bigint, p_items jsonb, p_fulfillment_method text DEFAULT NULL::text, p_fulfillment_date date DEFAULT NULL::date, p_note_for_supplier text DEFAULT NULL::text, p_customer_confirmed boolean DEFAULT false, p_note_for_customer text DEFAULT NULL::text)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE line jsonb; allocation jsonb; source public.candidates; ar public.availability_requests;
  job public.job_requests; demand_item public.job_request_items; order_id bigint; line_id bigint;
  demand numeric; allocated numeric; already_ordered numeric;
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
    SELECT c.availability_request_id FROM public.candidates c WHERE c.id IN (
      SELECT (l->>'candidate_id')::bigint FROM jsonb_array_elements(p_items) l
    )) ORDER BY a.id FOR UPDATE;
  INSERT INTO public.orders(supplier_id, fulfillment_method, fulfillment_date, note_for_supplier, note_for_customer)
    VALUES (p_supplier_id, p_fulfillment_method, p_fulfillment_date, p_note_for_supplier, p_note_for_customer) RETURNING id INTO order_id;
  FOR line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(line->'allocations') IS DISTINCT FROM 'array' OR jsonb_array_length(line->'allocations') = 0 THEN
      RAISE EXCEPTION 'Order allocations are required'; END IF;
    SELECT * INTO source FROM public.candidates WHERE id = (line->>'candidate_id')::bigint AND is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Availability line not found'; END IF;
    SELECT * INTO ar FROM public.availability_requests WHERE id = source.availability_request_id;
    IF NOT FOUND OR ar.supplier_id <> p_supplier_id OR ar.status = 'closed' THEN RAISE EXCEPTION 'Availability request is closed or belongs to another supplier'; END IF;
    -- An asked row with a substitute is Unavailable: the substitute is what is ordered.
    IF source.status IS NULL OR source.status = 'unavailable' THEN RAISE EXCEPTION 'Supplier must answer availability before ordering'; END IF;
    -- A typed substitute stays unpriced until Rosie enriches it.
    IF coalesce(source.unit_price, 0) = 0 THEN RAISE EXCEPTION 'Price this line before ordering'; END IF;
    SELECT sum((a->>'quantity')::numeric) INTO demand FROM jsonb_array_elements(line->'allocations') a;
    IF demand IS NULL OR demand <= 0 OR demand >= 'Infinity'::numeric THEN RAISE EXCEPTION 'Positive finite quantities are required'; END IF;
    -- All commitments to this supplier for the candidate's job line consume its
    -- budget, including direct orders and selections from another related AR.
    SELECT coalesce(sum(a.quantity), 0) INTO already_ordered
      FROM public.order_item_job_request_items a
      JOIN public.order_items oi ON oi.id = a.order_item_id
      JOIN public.orders o ON o.id = oi.order_id
      WHERE a.job_request_item_id = source.job_request_item_id AND o.supplier_id = p_supplier_id
        AND oi.is_active AND o.is_active AND o.status <> 'closed_lost';
    IF source.demanded_quantity IS NOT NULL AND demand + already_ordered > source.demanded_quantity THEN RAISE EXCEPTION 'Order exceeds remaining requested quantity'; END IF;
    IF source.available_quantity IS NOT NULL AND source.status <> 'can_order' AND demand + already_ordered > source.available_quantity THEN
      RAISE EXCEPTION 'Order exceeds supplier available quantity'; END IF;
    -- The order line is the answered candidate's, and keeps a link to it (0135).
    INSERT INTO public.order_items(order_id, candidate_id, name, size, quantity, unit_price, status, note_for_supplier, note_for_customer)
      VALUES (order_id, source.id, source.name, source.size, demand, source.unit_price,
        -- As job_lines reads it: an answered substitute is Diff Sz/Sub.
        CASE WHEN source.status = 'can_order' THEN 'need_to_order'
          WHEN source.status IN ('available', 'partial_qty') AND NOT source.is_original THEN 'diff_size_sub'
          ELSE source.status END,
        nullif(concat_ws(E'\n\n', nullif(btrim(source.note_for_supplier), ''), nullif(btrim(source.note_from_supplier), '')), ''),
        CASE WHEN source.note_for_customer IS NOT NULL THEN nullif(btrim(source.note_for_customer), '')
          ELSE nullif(btrim(source.note_from_supplier), '') END)
      RETURNING id INTO line_id;
    FOR allocation IN SELECT * FROM jsonb_array_elements(line->'allocations') LOOP
      allocated := (allocation->>'quantity')::numeric;
      IF allocated IS NULL OR allocated <= 0 OR allocated >= 'Infinity'::numeric THEN RAISE EXCEPTION 'Positive finite allocations are required'; END IF;
      SELECT * INTO demand_item FROM public.job_request_items WHERE id = (allocation->>'job_request_item_id')::bigint AND is_active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Active job line not found'; END IF;
      IF demand_item.id IS DISTINCT FROM source.job_request_item_id THEN RAISE EXCEPTION 'Job line is not allocated to this availability line'; END IF;
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

CREATE OR REPLACE FUNCTION public.create_direct_order(p_supplier_id bigint, p_items jsonb, p_fulfillment_method text DEFAULT NULL::text, p_fulfillment_date date DEFAULT NULL::date, p_note_for_supplier text DEFAULT NULL::text, p_customer_confirmed boolean DEFAULT false, p_note_for_customer text DEFAULT NULL::text)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE line jsonb; job public.job_requests; demand_item public.job_request_items; quote_line public.job_lines;
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

  INSERT INTO public.orders(supplier_id, fulfillment_method, fulfillment_date, note_for_supplier, note_for_customer)
    VALUES (p_supplier_id, p_fulfillment_method, p_fulfillment_date, p_note_for_supplier, p_note_for_customer)
    RETURNING id INTO order_id;
  FOR line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    requested := (line->>'quantity')::numeric;
    IF requested IS NULL OR requested <= 0 OR requested >= 'Infinity'::numeric THEN
      RAISE EXCEPTION 'Positive finite quantities are required';
    END IF;
    SELECT * INTO demand_item FROM public.job_request_items
      WHERE id = (line->>'job_request_item_id')::bigint AND is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Active quoted line not found'; END IF;
    -- The order line is the selected candidate's (name, size, price, status,
    -- customer note), and keeps a link to it (0135).
    SELECT * INTO quote_line FROM public.job_lines WHERE id = demand_item.id;
    IF quote_line.unit_price IS NULL THEN RAISE EXCEPTION 'Price this line before ordering'; END IF;
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
    INSERT INTO public.order_items(order_id, candidate_id, name, size, quantity, unit_price, status, note_for_customer)
      VALUES (order_id, demand_item.selected_candidate_id, quote_line.candidate_name, quote_line.size, requested, quote_line.unit_price,
        quote_line.status, quote_line.note_for_customer)
      RETURNING id INTO line_id;
    INSERT INTO public.order_item_job_request_items(order_item_id, job_request_item_id, quantity)
      VALUES (line_id, demand_item.id, requested);
    UPDATE public.job_requests SET status = 'committed'
      WHERE id = demand_item.job_request_id AND status IN ('quoted', 'availability');
  END LOOP;
  RETURN order_id;
END $function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
