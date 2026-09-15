-- Partner-owned order fulfillment: New -> Processing -> Order Ready.
-- Keep historical outcomes and existing capacity accounting; jobs stay Committed.
BEGIN;

ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
UPDATE public.orders SET status = CASE status WHEN 'committed' THEN 'new' ELSE 'processing' END
  WHERE status IN ('committed', 'confirmed');
ALTER TABLE public.orders ALTER COLUMN status SET DEFAULT 'new';
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (
  status IN ('new', 'processing', 'order_ready', 'closed_won', 'closed_lost')
);
COMMENT ON COLUMN public.orders.status IS
  'Partner lifecycle: New, Processing (partner confirmed), Order Ready. Former Committed orders become New and Confirmed orders become Processing; Won/Lost remain historical outcomes.';
COMMENT ON COLUMN public.orders.fulfillment_date IS 'EDD: expected pickup or delivery date, required when the partner confirms an order.';

-- One lock covers validation, fulfillment edits and the forward transition.
-- The app supplies a supplier ID authorized for the signed-in partner.
CREATE OR REPLACE FUNCTION public.update_partner_order(p_order_id bigint, p_supplier_id bigint, p_patch jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE current_order public.orders; next_status text; next_method text; next_date date; date_text text;
BEGIN
  IF jsonb_typeof(p_patch) IS DISTINCT FROM 'object' OR p_patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'Order update is required'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_patch) key
    WHERE key NOT IN ('status', 'fulfillment_method', 'fulfillment_date')) THEN
    RAISE EXCEPTION 'Unsupported order update'; END IF;
  -- Match order creation/closure lock order, including concurrent job archival.
  PERFORM 1 FROM public.job_requests j WHERE j.id IN (
    SELECT ji.job_request_id FROM public.order_item_job_request_items a
      JOIN public.job_request_items ji ON ji.id = a.job_request_item_id
      JOIN public.order_items oi ON oi.id = a.order_item_id
      JOIN public.orders o ON o.id = oi.order_id
      WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id AND oi.is_active
  ) ORDER BY j.id FOR UPDATE;
  SELECT o.* INTO current_order FROM public.orders o JOIN public.suppliers s ON s.id = o.supplier_id
    WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id AND o.is_active AND s.is_active FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is unavailable'; END IF;
  IF current_order.status NOT IN ('new', 'processing', 'order_ready') THEN
    RAISE EXCEPTION 'Closed orders cannot be changed'; END IF;
  IF EXISTS (SELECT 1 FROM public.order_item_job_request_items a JOIN public.order_items oi ON oi.id = a.order_item_id
      WHERE oi.order_id = p_order_id AND oi.is_active)
    AND NOT EXISTS (SELECT 1 FROM public.order_item_job_request_items a
      JOIN public.order_items oi ON oi.id = a.order_item_id
      JOIN public.job_request_items ji ON ji.id = a.job_request_item_id
      JOIN public.job_requests j ON j.id = ji.job_request_id
      WHERE oi.order_id = p_order_id AND oi.is_active AND j.is_active
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
  next_method := CASE WHEN p_patch ? 'fulfillment_method' THEN p_patch->>'fulfillment_method' ELSE current_order.fulfillment_method END;
  IF next_method IS NOT NULL AND next_method NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'Choose pickup or delivery'; END IF;
  next_date := current_order.fulfillment_date;
  IF p_patch ? 'fulfillment_date' THEN
    date_text := p_patch->>'fulfillment_date';
    IF date_text IS NOT NULL AND date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RAISE EXCEPTION 'EDD must be a valid date (YYYY-MM-DD)'; END IF;
    next_date := date_text::date;
    IF next_date IS NOT NULL AND to_char(next_date, 'YYYY-MM-DD') <> date_text THEN
      RAISE EXCEPTION 'EDD must be a valid date (YYYY-MM-DD)'; END IF;
  END IF;
  IF next_status IN ('processing', 'order_ready') AND (next_method IS NULL OR next_date IS NULL) THEN
    RAISE EXCEPTION 'Choose pickup or delivery and an EDD before confirming the order'; END IF;
  UPDATE public.orders SET status = next_status, fulfillment_method = next_method, fulfillment_date = next_date,
    confirmation_date = CASE WHEN current_order.status = 'new' AND next_status = 'processing'
      THEN coalesce(current_order.confirmation_date, CURRENT_DATE) ELSE confirmation_date END
    WHERE id = p_order_id;
  RETURN p_order_id;
END $$;

-- Older trusted callers obey the same transition and fulfillment requirements.
CREATE OR REPLACE FUNCTION public.confirm_order(p_order_id bigint, p_supplier_id bigint,
  p_confirmation_date date DEFAULT CURRENT_DATE, p_fulfillment_date date DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  PERFORM public.update_partner_order(p_order_id, p_supplier_id,
    jsonb_build_object('status', 'processing') || CASE WHEN p_fulfillment_date IS NULL THEN '{}'::jsonb
      ELSE jsonb_build_object('fulfillment_date', p_fulfillment_date) END);
  IF p_confirmation_date IS NOT NULL THEN
    UPDATE public.orders SET confirmation_date = p_confirmation_date WHERE id = p_order_id;
  END IF;
  RETURN p_order_id;
END $$;

-- Retain the service-only historical accounting operation; no app route exposes it.
CREATE OR REPLACE FUNCTION public.close_order(p_order_id bigint, p_status text)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
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
        AND (ji.quantity IS NULL OR ji.quantity > (SELECT coalesce(sum(a.quantity), 0)
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
END $$;

REVOKE ALL ON FUNCTION public.update_partner_order(bigint,bigint,jsonb),
  public.confirm_order(bigint,bigint,date,date), public.close_order(bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_partner_order(bigint,bigint,jsonb),
  public.confirm_order(bigint,bigint,date,date), public.close_order(bigint,text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
