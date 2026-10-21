-- 0149 — orders read pickup/delivery and the date from their job; the order's
-- note for the supplier becomes its markdown "additional details" (2026-10-21)
--
-- (Bhoumik 2026-10-21) "drop: fulfillment_date, drop it from confirmation
-- pop-up. Confirmation pop-up no input needed. ... fulfillment_method and
-- fulfillment_date should come from job. Note for supplier is a markdown it
-- should include all details supplier need to deliver the order ... rename
-- note_for_supplier to additional_details". Decided with him the same day:
-- drop orders.fulfillment_method too (the job's is the order's) and rename
-- only the header note (order_items.note_for_supplier stays the row's ask).
-- Later the same day: "Drop Note for customer from orders [item and order
-- table]" — orders go to the supplier; customer notes stay on the job.
-- * orders.fulfillment_date and orders.fulfillment_method are dropped (their
--   values backed up in orders_pre_0149). The job's fulfillment_method and
--   expected_install_date are the order's.
-- * orders.note_for_customer and order_items.note_for_customer are dropped
--   (backed up in orders_pre_0149 and order_items_pre_0149).
-- * orders.note_for_supplier is renamed additional_details: markdown with the
--   customer, delivery address and contacts the supplier needs, and a dated
--   change log.
-- * create_order(job, supplier, line ids, additional details) — no method,
--   no customer note.
-- * update_partner_order takes status, additional_details and
--   note_from_supplier. Confirming (New → Processing) and Ready need no date.
-- * confirm_order(order, supplier, confirmation date) — no fulfillment date.
-- Rollback: rename additional_details back, re-add the dropped columns from
-- orders_pre_0149 and order_items_pre_0149, drop the new create_order and confirm_order, and EXECUTE
-- each definition saved in functions_pre_0149.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '30s';

-- The replaced functions, exactly as they were.
CREATE TABLE public.functions_pre_0149 AS
  SELECT p.oid::regprocedure::text AS signature, pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('create_order', 'update_partner_order', 'confirm_order');
ALTER TABLE public.functions_pre_0149 ADD PRIMARY KEY (signature);
ALTER TABLE public.functions_pre_0149 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.functions_pre_0149 FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.functions_pre_0149 IS 'Function definitions 0149 replaced or dropped, for rollback.';

-- The dropped values.
CREATE TABLE public.orders_pre_0149 AS
  SELECT id, fulfillment_method, fulfillment_date, note_for_customer FROM public.orders;
ALTER TABLE public.orders_pre_0149 ADD PRIMARY KEY (id);
ALTER TABLE public.orders_pre_0149 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orders_pre_0149 FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.orders_pre_0149 IS 'orders.fulfillment_method, fulfillment_date and note_for_customer before 0149 dropped them.';
CREATE TABLE public.order_items_pre_0149 AS
  SELECT id, note_for_customer FROM public.order_items;
ALTER TABLE public.order_items_pre_0149 ADD PRIMARY KEY (id);
ALTER TABLE public.order_items_pre_0149 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_items_pre_0149 FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.order_items_pre_0149 IS 'order_items.note_for_customer before 0149 dropped it.';

DROP FUNCTION public.create_order(bigint, bigint, bigint[], text, text, text);
DROP FUNCTION public.confirm_order(bigint, bigint, date, date);

ALTER TABLE public.orders DROP COLUMN fulfillment_date, DROP COLUMN fulfillment_method, DROP COLUMN note_for_customer;
ALTER TABLE public.order_items DROP COLUMN note_for_customer;
ALTER TABLE public.orders RENAME COLUMN note_for_supplier TO additional_details;
COMMENT ON COLUMN public.orders.additional_details IS
  'Markdown the supplier needs to fulfil the order: customer name, delivery address, delivery and billing contacts, payment method and other delivery facts where known, then a change log of "- MM/DD: change" lines. Pickup/delivery and the date are the job''s.';

CREATE FUNCTION public.create_order(p_job_request_id bigint, p_supplier_id bigint, p_job_request_item_ids bigint[],
    p_additional_details text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE job public.job_requests; line public.job_request_items; c public.candidates;
  v_order bigint; v_item bigint; taken bigint; qty numeric;
BEGIN
  IF p_job_request_item_ids IS NULL OR cardinality(p_job_request_item_ids) = 0 THEN
    RAISE EXCEPTION 'Choose at least one job line to order';
  END IF;
  -- The job row lock serialises orders for the job.
  SELECT * INTO job FROM public.job_requests WHERE id = p_job_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job request not found'; END IF;
  IF NOT job.is_active OR job.status IN ('closed_won', 'closed_lost', 'archived') THEN
    RAISE EXCEPTION 'This job request is closed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND is_active) THEN
    RAISE EXCEPTION 'Active supplier required';
  END IF;
  -- One open order per job and supplier: more lines go onto it.
  SELECT id INTO v_order FROM public.orders
    WHERE job_request_id = job.id AND supplier_id = p_supplier_id AND is_active
      AND status IN ('new', 'processing', 'order_ready')
    FOR UPDATE;
  IF v_order IS NULL THEN
    INSERT INTO public.orders(job_request_id, supplier_id, additional_details)
      VALUES (job.id, p_supplier_id, nullif(btrim(p_additional_details), ''))
      RETURNING id INTO v_order;
  END IF;
  FOREACH v_item IN ARRAY (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(p_job_request_item_ids) x) LOOP
    SELECT * INTO line FROM public.job_request_items
      WHERE id = v_item AND job_request_id = job.id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Job line % is not an active line of JR-%', v_item, job.id; END IF;
    SELECT * INTO c FROM public.candidates WHERE id = line.selected_candidate_id FOR UPDATE;
    IF c.supplier_id <> p_supplier_id THEN
      RAISE EXCEPTION '% is selected from another supplier', line.name;
    END IF;
    SELECT oi.order_id INTO taken FROM public.order_items oi WHERE oi.candidate_id = c.id;
    IF FOUND THEN
      RAISE EXCEPTION '% is already on order O-%', coalesce(c.description, c.name), taken;
    END IF;
    -- The quantity the job line shows available, else its Qty.
    qty := coalesce(nullif(least(c.available_quantity, line.demanded_quantity), 0), line.demanded_quantity);
    IF qty IS NULL THEN RAISE EXCEPTION 'Set a quantity for % before ordering', line.name; END IF;
    INSERT INTO public.order_items(order_id, candidate_id, name, size, quantity, unit_price, status,
        note_for_supplier, note_from_supplier)
      VALUES (v_order, c.id, c.name, coalesce(c.size, line.size), qty, c.unit_price,
        CASE WHEN c.status IS NULL THEN 'pending' WHEN c.status = 'can_order' THEN 'need_to_order' ELSE c.status END,
        nullif(btrim(c.note_for_supplier), ''), nullif(btrim(c.note_from_supplier), ''));
  END LOOP;
  UPDATE public.job_requests SET status = 'committed' WHERE id = job.id AND status IN ('quoted', 'availability');
  RETURN v_order;
END $function$;

CREATE OR REPLACE FUNCTION public.update_partner_order(p_order_id bigint, p_supplier_id bigint, p_patch jsonb)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE current_order public.orders; next_status text; next_details text; next_reply text;
BEGIN
  IF jsonb_typeof(p_patch) IS DISTINCT FROM 'object' OR p_patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'Order update is required'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_patch) key
    WHERE key NOT IN ('status', 'additional_details', 'note_from_supplier')) THEN
    RAISE EXCEPTION 'Unsupported order update'; END IF;
  -- Job before order, as create_order and close_order lock.
  PERFORM 1 FROM public.job_requests j JOIN public.orders o ON o.job_request_id = j.id
    WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id FOR UPDATE OF j;
  SELECT o.* INTO current_order FROM public.orders o JOIN public.suppliers s ON s.id = o.supplier_id
    WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id AND o.is_active AND s.is_active FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is unavailable'; END IF;
  IF current_order.status NOT IN ('new', 'processing', 'order_ready') OR NOT EXISTS (
    SELECT 1 FROM public.job_requests j WHERE j.id = current_order.job_request_id AND j.is_active
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
  next_details := current_order.additional_details;
  IF p_patch ? 'additional_details' THEN
    IF jsonb_typeof(p_patch->'additional_details') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'Additional details must be text'; END IF;
    IF length(p_patch->>'additional_details') > 10000 THEN
      RAISE EXCEPTION 'Additional details must be 10000 characters or fewer'; END IF;
    next_details := nullif(btrim(p_patch->>'additional_details'), '');
  END IF;
  next_reply := current_order.note_from_supplier;
  IF p_patch ? 'note_from_supplier' THEN
    IF jsonb_typeof(p_patch->'note_from_supplier') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'Note from supplier must be text'; END IF;
    IF length(p_patch->>'note_from_supplier') > 10000 THEN
      RAISE EXCEPTION 'Note from supplier must be 10000 characters or fewer'; END IF;
    next_reply := nullif(btrim(p_patch->>'note_from_supplier'), '');
  END IF;
  UPDATE public.orders SET status = next_status, additional_details = next_details, note_from_supplier = next_reply,
    confirmation_date = CASE WHEN current_order.status = 'new' AND next_status = 'processing'
      THEN coalesce(current_order.confirmation_date, CURRENT_DATE) ELSE confirmation_date END
    WHERE id = p_order_id;
  RETURN p_order_id;
END $function$;

CREATE FUNCTION public.confirm_order(p_order_id bigint, p_supplier_id bigint, p_confirmation_date date DEFAULT CURRENT_DATE)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  PERFORM public.update_partner_order(p_order_id, p_supplier_id, jsonb_build_object('status', 'processing'));
  IF p_confirmation_date IS NOT NULL THEN
    UPDATE public.orders SET confirmation_date = p_confirmation_date WHERE id = p_order_id;
  END IF;
  RETURN p_order_id;
END $function$;

REVOKE ALL ON FUNCTION public.create_order(bigint, bigint, bigint[], text),
  public.confirm_order(bigint, bigint, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(bigint, bigint, bigint[], text),
  public.confirm_order(bigint, bigint, date) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
