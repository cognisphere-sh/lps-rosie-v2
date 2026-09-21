-- Deleting a job line removes the matching supplier ask.  Shared supplier
-- asks keep their other job allocations; deleting an order line removes its
-- allocations and an order that no longer has any lines.
BEGIN;

CREATE OR REPLACE FUNCTION public.delete_job_request_item(
  p_job_request_id bigint,
  p_job_request_item_id bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  found_item bigint;
  ar_item_count bigint := 0;
  history_count bigint := 0;
BEGIN
  SELECT id INTO found_item FROM public.job_request_items
    WHERE id = p_job_request_item_id AND job_request_id = p_job_request_id
    FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Delete every AR snapshot whose demand belongs only to this line. Combined
  -- requests keep their other demand links; their source anchor is moved to a
  -- surviving line before this line's allocation cascades away.
  SELECT count(*) INTO ar_item_count FROM public.availability_request_items ai
    WHERE ai.job_request_item_id = p_job_request_item_id
      AND NOT EXISTS (SELECT 1 FROM public.availability_request_item_jobs link
        WHERE link.availability_request_item_id = ai.id
          AND link.job_request_item_id <> p_job_request_item_id);
  SELECT count(*) INTO history_count FROM public.job_request_changelog
    WHERE item_id = p_job_request_item_id;
  UPDATE public.availability_request_items ai
    SET job_request_item_id = (SELECT link.job_request_item_id
      FROM public.availability_request_item_jobs link
      WHERE link.availability_request_item_id = ai.id
        AND link.job_request_item_id <> p_job_request_item_id
      ORDER BY link.job_request_item_id LIMIT 1)
    WHERE ai.job_request_item_id = p_job_request_item_id
      AND EXISTS (SELECT 1 FROM public.availability_request_item_jobs link
        WHERE link.availability_request_item_id = ai.id
          AND link.job_request_item_id <> p_job_request_item_id);
  DELETE FROM public.availability_request_items ai
    WHERE ai.job_request_item_id = p_job_request_item_id;
  DELETE FROM public.job_request_items WHERE id = p_job_request_item_id;

  RETURN jsonb_build_object(
    'items', 1,
    'availabilityRequests', 0,
    'availabilityRequestItems', ar_item_count,
    'changelog', history_count,
    'answers', 0
  );
END $$;
REVOKE ALL ON FUNCTION public.delete_job_request_item(bigint,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_job_request_item(bigint,bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_order_item(p_order_id bigint, p_order_item_id bigint)
RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  removed bigint;
BEGIN
  PERFORM 1 FROM public.orders
    WHERE id = p_order_id AND is_active AND status NOT IN ('closed_won', 'closed_lost')
    FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  DELETE FROM public.order_items WHERE id = p_order_item_id AND order_id = p_order_id;
  GET DIAGNOSTICS removed = ROW_COUNT;
  IF removed = 0 THEN RETURN false; END IF;
  -- An empty order is not useful operational history.  Its line allocations
  -- have already cascaded with the deleted order item.
  DELETE FROM public.orders WHERE id = p_order_id
    AND NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_order_id);
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.delete_order_item(bigint,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_order_item(bigint,bigint) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
