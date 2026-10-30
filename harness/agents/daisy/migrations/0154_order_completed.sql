-- 0154 — orders gain a Completed status after Ready (2026-10-30)
--
-- (Bhoumik 2026-10-30) "In order status: Add completed as one more lifecycle
-- status. Post ready supplier will mark it as completed [with second
-- confirmation pop-up]. IN header also add completed after ready."
-- * orders.status allows 'completed'. The supplier moves an order
--   new → processing → order_ready → completed; nothing moves it back.
-- * Completed is still open: LPS closes it Won/Lost with close_order, its job
--   stays open while it is, and it keeps the one-open-order-per-job-and-
--   supplier slot (more lines for that job and supplier go onto it).
-- Rollback (only while no order is completed): restore the constraint and
-- index without 'completed', and the three functions from 0151
-- (update_partner_order), 0151 (create_order) and 0146 (close_order).
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check
  CHECK (status = ANY (ARRAY['new'::text, 'processing'::text, 'order_ready'::text, 'completed'::text, 'closed_won'::text, 'closed_lost'::text]));

DROP INDEX public.orders_one_open_per_job_supplier;
CREATE UNIQUE INDEX orders_one_open_per_job_supplier ON public.orders USING btree (job_request_id, supplier_id)
  WHERE (is_active AND (status = ANY (ARRAY['new'::text, 'processing'::text, 'order_ready'::text, 'completed'::text])));

CREATE OR REPLACE FUNCTION public.update_partner_order(p_order_id bigint, p_supplier_id bigint, p_patch jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE current_order public.orders; next_status text; next_details jsonb; next_log text; next_reply text;
BEGIN
  IF jsonb_typeof(p_patch) IS DISTINCT FROM 'object' OR p_patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'Order update is required'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_patch) key
    WHERE key NOT IN ('status', 'additional_details', 'change_log', 'note_from_supplier')) THEN
    RAISE EXCEPTION 'Unsupported order update'; END IF;
  -- Job before order, as create_order and close_order lock.
  PERFORM 1 FROM public.job_requests j JOIN public.orders o ON o.job_request_id = j.id
    WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id FOR UPDATE OF j;
  SELECT o.* INTO current_order FROM public.orders o JOIN public.suppliers s ON s.id = o.supplier_id
    WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id AND o.is_active AND s.is_active FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is unavailable'; END IF;
  IF current_order.status NOT IN ('new', 'processing', 'order_ready', 'completed') OR NOT EXISTS (
    SELECT 1 FROM public.job_requests j WHERE j.id = current_order.job_request_id AND j.is_active
      AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')) THEN
    RAISE EXCEPTION 'Closed orders cannot be changed'; END IF;
  next_status := current_order.status;
  IF p_patch ? 'status' THEN
    next_status := p_patch->>'status';
    IF next_status IS NULL OR NOT (
      (current_order.status = 'new' AND next_status = 'processing') OR
      (current_order.status = 'processing' AND next_status = 'order_ready') OR
      (current_order.status = 'order_ready' AND next_status = 'completed')
    ) THEN RAISE EXCEPTION 'Orders move from New to Processing to Order Ready to Completed'; END IF;
  END IF;
  next_details := current_order.additional_details;
  IF p_patch ? 'additional_details' THEN
    next_details := nullif(nullif(p_patch->'additional_details', 'null'::jsonb), '[]'::jsonb);
    IF NOT public.is_order_details(next_details) THEN
      RAISE EXCEPTION 'Additional details must be a list of {"field", "value"} texts'; END IF;
  END IF;
  next_log := current_order.change_log;
  IF p_patch ? 'change_log' THEN
    IF jsonb_typeof(p_patch->'change_log') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'Change log must be text'; END IF;
    IF length(p_patch->>'change_log') > 10000 THEN
      RAISE EXCEPTION 'Change log must be 10000 characters or fewer'; END IF;
    next_log := nullif(btrim(p_patch->>'change_log'), '');
  END IF;
  next_reply := current_order.note_from_supplier;
  IF p_patch ? 'note_from_supplier' THEN
    IF jsonb_typeof(p_patch->'note_from_supplier') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'Note from supplier must be text'; END IF;
    IF length(p_patch->>'note_from_supplier') > 10000 THEN
      RAISE EXCEPTION 'Note from supplier must be 10000 characters or fewer'; END IF;
    next_reply := nullif(btrim(p_patch->>'note_from_supplier'), '');
  END IF;
  UPDATE public.orders SET status = next_status, additional_details = next_details, change_log = next_log,
    note_from_supplier = next_reply,
    confirmation_date = CASE WHEN current_order.status = 'new' AND next_status = 'processing'
      THEN coalesce(current_order.confirmation_date, CURRENT_DATE) ELSE confirmation_date END
    WHERE id = p_order_id;
  RETURN p_order_id;
END $function$;

CREATE OR REPLACE FUNCTION public.create_order(p_job_request_id bigint, p_supplier_id bigint, p_job_request_item_ids bigint[], p_additional_details jsonb DEFAULT NULL::jsonb)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE job public.job_requests; line public.job_request_items; c public.candidates;
  v_order bigint; v_item bigint; taken bigint; qty numeric;
  details jsonb := nullif(nullif(p_additional_details, 'null'::jsonb), '[]'::jsonb);
BEGIN
  IF p_job_request_item_ids IS NULL OR cardinality(p_job_request_item_ids) = 0 THEN
    RAISE EXCEPTION 'Choose at least one job line to order';
  END IF;
  IF NOT public.is_order_details(details) THEN
    RAISE EXCEPTION 'Additional details must be a list of {"field", "value"} texts';
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
      AND status IN ('new', 'processing', 'order_ready', 'completed')
    FOR UPDATE;
  IF v_order IS NULL THEN
    INSERT INTO public.orders(job_request_id, supplier_id, additional_details)
      VALUES (job.id, p_supplier_id, details)
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

CREATE OR REPLACE FUNCTION public.close_order(p_order_id bigint, p_status text)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE job_id bigint;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('closed_won', 'closed_lost') THEN RAISE EXCEPTION 'Choose Won or Lost'; END IF;
  SELECT o.job_request_id INTO job_id FROM public.orders o WHERE o.id = p_order_id;
  PERFORM 1 FROM public.job_requests WHERE id = job_id FOR UPDATE;
  UPDATE public.orders SET status = p_status WHERE id = p_order_id AND is_active
    AND (status IN ('new', 'processing', 'order_ready', 'completed') OR status = p_status);
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is unavailable or already closed with a different outcome'; END IF;
  -- The job closes with its last open order: Won if any of its orders was won.
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE job_request_id = job_id AND is_active
      AND status IN ('new', 'processing', 'order_ready', 'completed')) THEN
    UPDATE public.job_requests SET status = CASE WHEN EXISTS (SELECT 1 FROM public.orders
        WHERE job_request_id = job_id AND is_active AND status = 'closed_won') THEN 'closed_won' ELSE 'closed_lost' END
      WHERE id = job_id AND is_active AND status NOT IN ('closed_won', 'closed_lost', 'archived');
  END IF;
  RETURN p_order_id;
END $function$;

COMMIT;
