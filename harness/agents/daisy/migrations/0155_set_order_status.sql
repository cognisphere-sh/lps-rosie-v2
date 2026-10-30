-- 0155 — Chris sets any order status from the job's Orders tab (2026-10-30)
--
-- (Bhoumik 2026-10-30) "Also allow chris to change order status from orders
-- tab" — a free status dropdown: any of the six statuses, backwards too, and
-- reopening a closed order.
-- * set_order_status(order, status): admin only (service role, like
--   close_order). Unlike update_partner_order it allows any move; unlike
--   close_order it can change a closed outcome or reopen.
-- * The job follows: opening an order of a Won/Lost job puts the job back to
--   Committed (its thread reopens; its ARs stay closed, as on any reopen);
--   closing its last open order closes the job Won if any order is Won,
--   else Lost (close_order's rule, re-applied when an outcome changes).
-- * Reopening is refused while the job already has another open order with
--   that supplier (orders_one_open_per_job_supplier).
-- * Back to New clears the acknowledged date; New → any later open status
--   stamps it when missing.
-- Rollback: DROP FUNCTION public.set_order_status(bigint, text);
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '30s';

CREATE FUNCTION public.set_order_status(p_order_id bigint, p_status text)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE job public.job_requests; current_order public.orders;
  open_statuses text[] := ARRAY['new', 'processing', 'order_ready', 'completed'];
BEGIN
  IF p_status IS NULL OR NOT (p_status = ANY (open_statuses || ARRAY['closed_won', 'closed_lost'])) THEN
    RAISE EXCEPTION 'Choose an order status'; END IF;
  -- Job before order, as the other order functions lock.
  SELECT j.* INTO job FROM public.job_requests j JOIN public.orders o ON o.job_request_id = j.id
    WHERE o.id = p_order_id FOR UPDATE OF j;
  SELECT * INTO current_order FROM public.orders WHERE id = p_order_id AND is_active FOR UPDATE;
  IF NOT FOUND OR job.id IS NULL THEN RAISE EXCEPTION 'Order is unavailable'; END IF;
  IF NOT job.is_active OR job.status = 'archived' THEN RAISE EXCEPTION 'This job is archived'; END IF;
  IF current_order.status = p_status THEN RETURN p_order_id; END IF;
  IF p_status = ANY (open_statuses) AND NOT (current_order.status = ANY (open_statuses)) AND EXISTS (
    SELECT 1 FROM public.orders WHERE job_request_id = job.id AND supplier_id = current_order.supplier_id
      AND is_active AND id <> p_order_id AND status = ANY (open_statuses)) THEN
    RAISE EXCEPTION 'This job already has an open order with this supplier'; END IF;
  UPDATE public.orders SET status = p_status,
    confirmation_date = CASE WHEN p_status = 'new' THEN NULL
      WHEN p_status = ANY (open_statuses) THEN coalesce(confirmation_date, CURRENT_DATE)
      ELSE confirmation_date END
    WHERE id = p_order_id;
  IF p_status = ANY (open_statuses) THEN
    UPDATE public.job_requests SET status = 'committed' WHERE id = job.id AND status IN ('closed_won', 'closed_lost');
  ELSIF NOT EXISTS (SELECT 1 FROM public.orders WHERE job_request_id = job.id AND is_active
      AND status = ANY (open_statuses)) THEN
    UPDATE public.job_requests SET status = CASE WHEN EXISTS (SELECT 1 FROM public.orders
        WHERE job_request_id = job.id AND is_active AND status = 'closed_won') THEN 'closed_won' ELSE 'closed_lost' END
      WHERE id = job.id;
  END IF;
  RETURN p_order_id;
END $function$;

REVOKE ALL ON FUNCTION public.set_order_status(bigint, text) FROM PUBLIC, anon, authenticated;

COMMIT;
