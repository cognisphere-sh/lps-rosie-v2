-- Exercise the real default, status migration, atomic transition RPC and rollback.
DO $$
DECLARE ar_id bigint; source_id bigint; order_a bigint; order_b bigint; payload jsonb;
  before_order jsonb; bad_patch jsonb; before_count bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM orders_before_0094 old JOIN public.orders o USING(id)
    WHERE o.status <> CASE old.status WHEN 'committed' THEN 'new' WHEN 'confirmed' THEN 'processing' ELSE old.status END
      OR (to_jsonb(o) - 'status' - 'updated_at') IS DISTINCT FROM (to_jsonb(old) - 'status' - 'updated_at')) THEN
    RAISE EXCEPTION 'Migration changed historical order evidence or mapped the wrong stage'; END IF;
  IF EXISTS (SELECT 1 FROM jobs_before_0094 old JOIN public.job_requests j USING(id) WHERE to_jsonb(old) <> to_jsonb(j))
    OR EXISTS (SELECT * FROM items_before_0094 EXCEPT SELECT * FROM public.order_items)
    OR EXISTS (SELECT * FROM allocations_before_0094 EXCEPT SELECT * FROM public.order_item_job_request_items) THEN
    RAISE EXCEPTION 'Order migration changed jobs, line snapshots or allocations'; END IF;
  INSERT INTO public.job_requests(id) VALUES (2000);
  INSERT INTO public.job_request_items(id,job_request_id,quantity) VALUES (2000,2000,10);
  ar_id := public.create_availability_request(1,'[{"name":"Oak","quantity":10,"allocations":[{"job_request_item_id":2000,"quantity":10}]}]');
  SELECT id INTO source_id FROM public.availability_request_items WHERE availability_request_id=ar_id;
  UPDATE public.availability_request_items SET status='can_order',available_quantity=0,unit_price=20 WHERE id=source_id;
  payload := jsonb_build_array(jsonb_build_object('availability_request_item_id',source_id,
    'allocations',jsonb_build_array(jsonb_build_object('job_request_item_id',2000,'quantity',4))));
  order_a := public.create_order(1,payload,p_customer_confirmed=>true);
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id=order_a AND status='new' AND confirmation_date IS NULL)
    OR NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id=order_a AND status='need_to_order' AND quantity=4 AND total=80)
    OR (SELECT status FROM public.job_requests WHERE id=2000)<>'committed'
    OR (SELECT status FROM public.availability_request_items WHERE id=source_id)<>'can_order' THEN
    RAISE EXCEPTION 'New order did not preserve Can Order as a Need to Order snapshot and commit the job'; END IF;
  SELECT to_jsonb(o) INTO before_order FROM public.orders o WHERE id=order_a;
  FOR bad_patch IN SELECT value FROM jsonb_array_elements('[{},null,[],{"status":"order_ready"},{"status":"new"},
    {"status":"closed_won"},{"status":null},{"status":"processing"},
    {"status":"processing","fulfillment_method":"delivery"},
    {"status":"processing","fulfillment_date":"2026-09-20"},
    {"fulfillment_method":"truck"},{"fulfillment_date":"2026-02-30"},
    {"fulfillment_date":"infinity"},{"fulfillment_date":"2026-09-20T00:00:00Z"},{"notes":"edit"}]') LOOP
    BEGIN
      PERFORM public.update_partner_order(order_a,1,bad_patch);
      RAISE EXCEPTION 'Invalid patch was accepted: %', bad_patch;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE 'Invalid patch was accepted:%' THEN RAISE; END IF;
    END;
    IF (SELECT to_jsonb(o) FROM public.orders o WHERE id=order_a) IS DISTINCT FROM before_order THEN
      RAISE EXCEPTION 'Failed patch left partial fulfillment edits'; END IF;
  END LOOP;
  BEGIN
    PERFORM public.update_partner_order(order_a,2,'{"fulfillment_method":"pickup"}');
    RAISE EXCEPTION 'Wrong supplier updated order';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Wrong supplier updated order' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.suppliers SET is_active=false WHERE id=1;
    PERFORM public.update_partner_order(order_a,1,'{"fulfillment_method":"pickup"}');
    RAISE EXCEPTION 'Inactive supplier updated order';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Inactive supplier updated order' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.orders SET is_active=false WHERE id=order_a;
    PERFORM public.update_partner_order(order_a,1,'{"fulfillment_method":"pickup"}');
    RAISE EXCEPTION 'Inactive order was updated';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Inactive order was updated' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.job_requests SET status='archived' WHERE id=2000;
    PERFORM public.update_partner_order(order_a,1,'{"fulfillment_method":"pickup"}');
    RAISE EXCEPTION 'Order with only archived jobs was updated';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Order with only archived jobs was updated' THEN RAISE; END IF; END;
  PERFORM public.update_partner_order(order_a,1,'{"fulfillment_method":"delivery","fulfillment_date":"2026-09-20"}');
  IF (SELECT status FROM public.orders WHERE id=order_a)<>'new' THEN RAISE EXCEPTION 'Fulfillment edit confirmed order'; END IF;
  PERFORM public.update_partner_order(order_a,1,'{"status":"processing"}');
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id=order_a AND status='processing' AND confirmation_date=CURRENT_DATE)
    OR (SELECT status FROM public.job_requests WHERE id=2000)<>'committed' THEN
    RAISE EXCEPTION 'Partner confirmation failed or advanced the job'; END IF;
  SELECT to_jsonb(o) INTO before_order FROM public.orders o WHERE id=order_a;
  FOR bad_patch IN SELECT value FROM jsonb_array_elements('[{"status":"processing"},{"status":"new"},{"fulfillment_date":null},
    {"fulfillment_method":null},{"status":"order_ready","fulfillment_date":null}]') LOOP
    BEGIN
      PERFORM public.update_partner_order(order_a,1,bad_patch);
      RAISE EXCEPTION 'Invalid processing patch accepted';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM='Invalid processing patch accepted' THEN RAISE; END IF; END;
    IF (SELECT to_jsonb(o) FROM public.orders o WHERE id=order_a) IS DISTINCT FROM before_order THEN
      RAISE EXCEPTION 'Rejected processing patch changed order'; END IF;
  END LOOP;
  PERFORM public.update_partner_order(order_a,1,'{"status":"order_ready","fulfillment_date":"2026-09-21"}');
  PERFORM public.update_partner_order(order_a,1,'{"fulfillment_method":"pickup"}');
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id=order_a AND status='order_ready'
    AND fulfillment_method='pickup' AND fulfillment_date='2026-09-21' AND confirmation_date=CURRENT_DATE)
    OR NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id=order_a AND status='need_to_order') THEN
    RAISE EXCEPTION 'Readiness or fulfillment edit lost order/line evidence'; END IF;
  BEGIN
    PERFORM public.confirm_order(order_a,1);
    RAISE EXCEPTION 'Legacy confirmation regressed a ready order';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Legacy confirmation regressed a ready order' THEN RAISE; END IF; END;
  payload := jsonb_set(payload,'{0,allocations,0,quantity}','6');
  order_b := public.create_order(1,payload,'delivery','2026-09-22',p_customer_confirmed=>true);
  SELECT count(*) INTO before_count FROM public.orders;
  BEGIN
    PERFORM public.create_order(1,payload,p_customer_confirmed=>true);
    RAISE EXCEPTION 'New/ready orders did not consume existing capacity';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='New/ready orders did not consume existing capacity' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM public.orders)<>before_count THEN RAISE EXCEPTION 'Over-order left a partial header'; END IF;
  PERFORM public.confirm_order(order_b,1,'2026-09-15');
  IF (SELECT status FROM public.orders WHERE id=order_b)<>'processing' THEN RAISE EXCEPTION 'Legacy confirmation bypassed Processing'; END IF;
  -- Historical close accounting must count all current active stages.
  PERFORM public.close_order(order_a,'closed_won');
  IF (SELECT status FROM public.job_requests WHERE id=2000)<>'committed' THEN RAISE EXCEPTION 'Partial historical closure closed the job'; END IF;
  PERFORM public.close_order(order_b,'closed_won');
  IF (SELECT status FROM public.job_requests WHERE id=2000)<>'closed_won' THEN RAISE EXCEPTION 'Historical complete closure lost accounting'; END IF;
  BEGIN
    PERFORM public.update_partner_order(order_a,1,'{"fulfillment_date":"2026-10-20"}');
    RAISE EXCEPTION 'Partner edited a historical closed order';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Partner edited a historical closed order' THEN RAISE; END IF; END;
  IF has_function_privilege('anon','public.update_partner_order(bigint,bigint,jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','public.update_partner_order(bigint,bigint,jsonb)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.update_partner_order(bigint,bigint,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Partner lifecycle RPC permissions are wrong'; END IF;
END $$;
