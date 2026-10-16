-- 0143 — a candidate's $0 is a price; NULL is "not priced" (2026-10-15)
--
-- (Bhoumik 2026-10-15) "allow 0 price. a 0$ price is not null." A candidate's
-- unit_price 0 meant "price not found": the database created each line's
-- default at 0, job_lines read it as NULLIF(unit_price, 0), and create_order
-- refused 0. A price typed as 0 therefore read back blank. Now:
-- * create_job_line_default creates the default unpriced (NULL).
-- * job_lines reads the candidate's price and total as stored, so 0 is $0.00.
-- * create_order refuses only an unpriced (NULL) candidate; order_items accepts
--   a $0 line (create_direct_order already refused only NULL).
-- * Backfill: every candidate priced 0 becomes NULL (updated_at kept), backed
--   up in candidates_zero_price_pre_0143. The view showed each of them blank,
--   so no job line reads differently; an answered AR row that showed $0.00
--   now shows no price. update_job_line and answer_availability_request
--   already store 0 as 0 and '' as NULL.
BEGIN;
SET LOCAL lock_timeout = '250ms';
SET LOCAL statement_timeout = '5s';

CREATE OR REPLACE FUNCTION public.create_job_line_default() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  -- Unpriced (NULL) until Rosie prices it; 0 is a $0 price.
  INSERT INTO public.candidates(supplier_id, is_original, job_request_item_id, name, size,
      description, unit_price)
    VALUES (1, true, NEW.id, NEW.name, NEW.size,
      btrim(concat_ws(' ', NEW.size, NEW.name)), NULL)
    RETURNING id INTO NEW.default_candidate_id;
  NEW.selected_candidate_id := coalesce(NEW.selected_candidate_id, NEW.default_candidate_id);
  RETURN NEW;
END $function$;

CREATE OR REPLACE VIEW public.job_lines WITH (security_invoker = true) AS
SELECT ji.id, ji.job_request_id, ji.name, ji.size AS requested_size, ji.demanded_quantity,
  ji.note_internal, ji.is_active, ji.created_at, ji.updated_at,
  ji.default_candidate_id, ji.selected_candidate_id,
  coalesce(c.size, ji.size) AS size,
  c.unit_price,
  d.demand,
  CASE WHEN c.available_quantity IS NOT NULL THEN least(c.available_quantity, d.demand) END AS available_quantity,
  ji.demanded_quantity * c.unit_price AS total,
  CASE WHEN c.note_for_customer IS NOT NULL THEN nullif(btrim(c.note_for_customer), '')
    ELSE nullif(btrim(c.note_from_supplier), '') END AS note_for_customer,
  c.description AS candidate_description, c.name AS candidate_name, c.supplier_id AS candidate_supplier_id,
  NOT c.is_original AS is_substitute,
  CASE WHEN c.is_original THEN ji.name ELSE coalesce(c.description, c.name) END AS quote_name,
  c.status AS candidate_status
FROM public.job_request_items ji
JOIN public.candidates c ON c.id = ji.selected_candidate_id
CROSS JOIN LATERAL (SELECT ji.demanded_quantity AS demand) d;
COMMENT ON COLUMN public.job_lines.unit_price IS 'Selected candidate price; NULL = not priced, 0 = $0.';
COMMENT ON COLUMN public.candidates.unit_price IS 'NULL = not priced (price not found); 0 = a $0 price.';

-- 0140's create_order with only the price guard changed.
CREATE OR REPLACE FUNCTION public.create_order(p_supplier_id bigint, p_items jsonb, p_fulfillment_method text DEFAULT NULL::text, p_fulfillment_date date DEFAULT NULL::date, p_note_for_supplier text DEFAULT NULL::text, p_customer_confirmed boolean DEFAULT false, p_note_for_customer text DEFAULT NULL::text)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
    -- A typed substitute stays unpriced until Rosie enriches it. $0 is a price (0143).
    IF source.unit_price IS NULL THEN RAISE EXCEPTION 'Price this line before ordering'; END IF;
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
    IF source.available_quantity IS NOT NULL AND source.status <> 'can_order' AND demand + already_ordered > source.available_quantity THEN
      RAISE EXCEPTION 'Order exceeds supplier available quantity'; END IF;
    -- The order line is the answered candidate's, and keeps a link to it (0135).
    INSERT INTO public.order_items(order_id, candidate_id, name, size, quantity, unit_price, status, note_for_supplier, note_for_customer)
      VALUES (order_id, source.id, source.name, source.size, demand, source.unit_price,
        -- The candidate's status in the line vocabulary, as job lines read it (0137).
        CASE WHEN source.status = 'can_order' THEN 'need_to_order' ELSE source.status END,
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

-- An order line copies its candidate's price, which may now be $0.
ALTER TABLE public.order_items DROP CONSTRAINT order_items_unit_price_check;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_unit_price_check
  CHECK (unit_price >= 0 AND unit_price < 'Infinity'::numeric);

-- Backfill (closed ARs included: LPS override).
CREATE TABLE public.candidates_zero_price_pre_0143 AS
  SELECT id FROM public.candidates WHERE unit_price = 0;
ALTER TABLE public.candidates_zero_price_pre_0143 ADD PRIMARY KEY (id);
ALTER TABLE public.candidates_zero_price_pre_0143 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.candidates_zero_price_pre_0143 FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.candidates_zero_price_pre_0143 IS
  'Candidates priced 0 ("price not found") before 0143 set them to NULL. Rollback: set these back to 0.';
SELECT set_config('lps.lps_override', 'on', true);
ALTER TABLE public.candidates DISABLE TRIGGER handle_updated_at;
UPDATE public.candidates SET unit_price = NULL WHERE unit_price = 0;
ALTER TABLE public.candidates ENABLE TRIGGER handle_updated_at;
SELECT set_config('lps.lps_override', '', true);
COMMIT;
