-- 0137 — a job line's status is its selected candidate's (2026-10-15), expand
--
-- (Bhoumik 2026-10-15) The job table shows the selected candidate's status as
-- stored. job_lines.status derived it instead, and its "not the original
-- candidate → Diff Sz/Sub" rule mislabelled same-plant picks: JR-111's
-- Yucca rostrata (15 G APS stock, candidate 2107, answered Available) and
-- JR-109's 1 G Berkeley Sedge (asked 1 G) read Diff Sz/Sub. It also read an
-- Unavailable answer offering a substitute as Diff Sz/Sub, and Available
-- below demand as Partial Qty. Expand step, safe for the running app:
-- * job_lines gains candidate_status (candidates.status, NULL = unanswered).
--   Readers name it in the line vocabulary: NULL → pending, can_order →
--   need_to_order, others as stored. job_lines.status stays until 0138 drops it.
-- * create_direct_order takes the order line's status from candidate_status.
-- * Backfill, so the job table keeps showing what it showed where that was
--   true (updated_at kept): 11 selected candidates answered Available whose
--   size differs from the line's requested size become diff_size_sub
--   (lines 896, 897, 900, 1047, 1049, 1174, 1181, 1187, 1189, 1229, 1248);
--   candidate 1288 (line 1170, Available with 1 of 2) becomes partial_qty.
--   The other 14 lines that read Diff Sz/Sub (same size, or no requested
--   size such as line 1342's Yucca) read Available.
BEGIN;
SET LOCAL lock_timeout = '250ms';
SET LOCAL statement_timeout = '5s';

CREATE OR REPLACE VIEW public.job_lines WITH (security_invoker = true) AS
SELECT ji.id, ji.job_request_id, ji.name, ji.size AS requested_size, ji.demanded_quantity,
  ji.note_internal, ji.is_active, ji.created_at, ji.updated_at,
  ji.default_candidate_id, ji.selected_candidate_id,
  coalesce(c.size, ji.size) AS size,
  nullif(c.unit_price, 0) AS unit_price,
  d.demand,
  CASE WHEN c.available_quantity IS NOT NULL THEN least(c.available_quantity, d.demand) END AS available_quantity,
  ji.demanded_quantity * nullif(c.unit_price, 0) AS total,
  CASE WHEN c.note_for_customer IS NOT NULL THEN nullif(btrim(c.note_for_customer), '')
    ELSE nullif(btrim(c.note_from_supplier), '') END AS note_for_customer,
  -- Deprecated; dropped by 0138 once the app and Rosie read candidate_status.
  CASE
    WHEN c.status IS NULL THEN 'pending'
    WHEN c.status = 'can_order' THEN 'need_to_order'
    WHEN c.status IN ('arriving_soon', 'diff_size_sub') THEN c.status
    WHEN c.status = 'unavailable' AND s.id IS NOT NULL THEN 'diff_size_sub'
    WHEN c.status = 'unavailable' THEN 'unavailable'
    WHEN NOT c.is_original THEN 'diff_size_sub'
    WHEN c.available_quantity < d.demand THEN 'partial_qty'
    ELSE c.status END AS status,
  c.description AS candidate_description, c.name AS candidate_name, c.supplier_id AS candidate_supplier_id,
  NOT c.is_original AS is_substitute,
  CASE WHEN c.is_original THEN ji.name ELSE coalesce(c.description, c.name) END AS quote_name,
  c.status AS candidate_status
FROM public.job_request_items ji
JOIN public.candidates c ON c.id = ji.selected_candidate_id
CROSS JOIN LATERAL (SELECT coalesce(c.demanded_quantity, ji.demanded_quantity) AS demand) d
LEFT JOIN public.candidates s ON s.id = c.offered_candidate_id AND s.is_active;
COMMENT ON COLUMN public.job_lines.candidate_status IS
  'The selected candidate''s status as stored (NULL = unanswered); the line''s status. Readers show NULL as pending and can_order as need_to_order.';
COMMENT ON COLUMN public.job_lines.status IS
  'Deprecated (0137): read candidate_status. Dropped by 0138.';

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
    -- customer note), and keeps a link to it (0135). Its status is the
    -- candidate's, named in the line vocabulary (0137).
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
        CASE WHEN quote_line.candidate_status IS NULL THEN 'pending'
          WHEN quote_line.candidate_status = 'can_order' THEN 'need_to_order'
          ELSE quote_line.candidate_status END, quote_line.note_for_customer)
      RETURNING id INTO line_id;
    INSERT INTO public.order_item_job_request_items(order_item_id, job_request_item_id, quantity)
      VALUES (line_id, demand_item.id, requested);
    UPDATE public.job_requests SET status = 'committed'
      WHERE id = demand_item.job_request_id AND status IN ('quoted', 'availability');
  END LOOP;
  RETURN order_id;
END $function$;

-- Backfill (closed ARs included: LPS override).
SELECT set_config('lps.lps_override', 'on', true);
ALTER TABLE public.candidates DISABLE TRIGGER handle_updated_at;
UPDATE public.candidates SET status = 'diff_size_sub'
  WHERE id IN (668, 669, 672, 947, 955, 1297, 1317, 1339, 1347, 1461, 1512) AND status = 'available';
UPDATE public.candidates SET status = 'partial_qty'
  WHERE id = 1288 AND status = 'available' AND available_quantity < 2;
ALTER TABLE public.candidates ENABLE TRIGGER handle_updated_at;
SELECT set_config('lps.lps_override', '', true);
COMMIT;
