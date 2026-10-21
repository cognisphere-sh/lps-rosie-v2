-- 0150 — an order's change log is its own column (2026-10-21)
--
-- (Bhoumik 2026-10-21) "Move changelog as a seperate field." 0149's
-- additional_details held the supplier's delivery facts and, under a
-- "**Change log**" heading, the dated material changes. The log moves to
-- orders.change_log: markdown bullets, `- MM/DD: change`, material changes
-- only (plant, size, quantity, price, pickup/delivery, target date).
-- * orders.change_log text. Existing details are split at their
--   "**Change log**" heading: what follows it moves to change_log (old
--   details backed up in orders_pre_0150).
-- * update_partner_order also takes change_log (LPS only; the app refuses it
--   from suppliers, as additional_details).
-- Rollback: put change_log back under the heading in additional_details (or
-- restore orders_pre_0150), drop the column, and re-run 0149's
-- update_partner_order.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE public.orders_pre_0150 AS SELECT id, additional_details FROM public.orders;
ALTER TABLE public.orders_pre_0150 ADD PRIMARY KEY (id);
ALTER TABLE public.orders_pre_0150 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.orders_pre_0150 FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.orders_pre_0150 IS 'orders.additional_details before 0150 moved their change logs to orders.change_log.';

ALTER TABLE public.orders ADD COLUMN change_log text;
COMMENT ON COLUMN public.orders.change_log IS
  'Markdown bullets "- MM/DD: change", newest last: material changes to the order only (plant, size, quantity, price, pickup/delivery, target date), never events.';
COMMENT ON COLUMN public.orders.additional_details IS
  'Markdown the supplier needs to fulfil the order: headerless "| Field | value |" rows (customer, delivery address, delivery and billing contacts, payment method, other delivery facts) where known. Pickup/delivery and the date are the job''s; the change log is change_log.';

UPDATE public.orders SET
  change_log = nullif(btrim(substr(additional_details, strpos(additional_details, '**Change log**') + length('**Change log**')), E' \t\r\n'), ''),
  additional_details = nullif(btrim(left(additional_details, strpos(additional_details, '**Change log**') - 1), E' \t\r\n'), '')
  WHERE strpos(additional_details, '**Change log**') > 0;

CREATE OR REPLACE FUNCTION public.update_partner_order(p_order_id bigint, p_supplier_id bigint, p_patch jsonb)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE current_order public.orders; next_status text; next_details text; next_log text; next_reply text;
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

NOTIFY pgrst, 'reload schema';

COMMIT;
