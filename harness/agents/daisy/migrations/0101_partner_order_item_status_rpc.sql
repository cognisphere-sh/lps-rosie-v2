-- Repair the supplier order-line status RPC in environments where the order
-- creation migration was deployed before this endpoint was introduced.
-- CREATE OR REPLACE is intentionally safe after 0100 as well.
BEGIN;

CREATE OR REPLACE FUNCTION public.update_partner_order_item(p_order_id bigint, p_supplier_id bigint,
  p_order_item_id bigint, p_status text)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_status NOT IN ('pending', 'available', 'unavailable', 'diff_size_qty_sub', 'need_to_order', 'arriving_soon') THEN
    RAISE EXCEPTION 'Choose a valid plant status';
  END IF;
  PERFORM 1 FROM public.orders o JOIN public.suppliers s ON s.id = o.supplier_id
    WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id AND o.is_active AND s.is_active
      AND o.status NOT IN ('closed_won', 'closed_lost') FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is unavailable'; END IF;
  UPDATE public.order_items SET status = p_status
    WHERE id = p_order_item_id AND order_id = p_order_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order line is unavailable'; END IF;
  RETURN p_order_item_id;
END $$;

REVOKE ALL ON FUNCTION public.update_partner_order_item(bigint,bigint,bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_partner_order_item(bigint,bigint,bigint,text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
