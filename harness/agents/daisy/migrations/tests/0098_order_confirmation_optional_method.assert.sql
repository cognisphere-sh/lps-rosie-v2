-- No existing data changes; a supplier can commit a date without choosing a method.
DO $$
DECLARE snapshot record; relation_rows jsonb; ar_id bigint; source_id bigint; test_order_id bigint;
  before_order jsonb; bad_patch jsonb; existing_method text; method_order_id bigint;
BEGIN
  FOR snapshot IN SELECT * FROM rows_before_0098 LOOP
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), ''[]''::jsonb) FROM public.%I t', snapshot.relation_name)
      INTO relation_rows;
    IF relation_rows IS DISTINCT FROM snapshot.rows THEN
      RAISE EXCEPTION 'Migration changed existing % rows', snapshot.relation_name; END IF;
  END LOOP;

  INSERT INTO public.job_requests(id) VALUES (4000);
  INSERT INTO public.job_request_items(id,job_request_id,quantity) VALUES (4000,4000,10);
  ar_id := public.create_availability_request(1,'[{"name":"Oak","quantity":10,"allocations":[{"job_request_item_id":4000,"quantity":10}]}]');
  SELECT id INTO source_id FROM public.availability_request_items WHERE availability_request_id=ar_id;
  UPDATE public.availability_request_items SET status='can_order',unit_price=20 WHERE id=source_id;
  test_order_id := public.create_order(1,jsonb_build_array(jsonb_build_object('availability_request_item_id',source_id,
    'allocations',jsonb_build_array(jsonb_build_object('job_request_item_id',4000,'quantity',10)))),
    p_customer_confirmed=>true);
  UPDATE public.orders SET notes='Chris instructions' WHERE id=test_order_id;
  SELECT to_jsonb(o) INTO before_order FROM public.orders o WHERE id=test_order_id;
  IF before_order->>'fulfillment_method' IS NOT NULL THEN
    RAISE EXCEPTION 'Fixture must start without a method'; END IF;
  BEGIN
    PERFORM public.update_partner_order(test_order_id,1,'{"status":"processing","supplier_notes":"Missing date"}');
    RAISE EXCEPTION 'Confirmation without a date succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Choose a fulfillment date before confirming the order' THEN RAISE; END IF;
  END;

  FOR bad_patch IN SELECT value FROM jsonb_array_elements('[
    {"status":"processing","supplier_notes":"Missing date"},
    {"status":"processing","fulfillment_date":null,"supplier_notes":"Null date"},
    {"status":"processing","fulfillment_date":"2026-02-30","supplier_notes":"Invalid date"},
    {"status":"order_ready","fulfillment_date":"2026-09-20","supplier_notes":"Skip processing"},
    {"status":"processing","fulfillment_date":"2026-09-20","fulfillment_method":"shipping"},
    {"status":"processing","fulfillment_date":"2026-09-20","fulfillment_method":false},
    {"status":"processing","fulfillment_date":"2026-09-20","supplier_notes":42},
    {"status":"processing","fulfillment_date":"2026-09-20","notes":"Overwrite Chris instructions"}
  ]') LOOP
    BEGIN
      PERFORM public.update_partner_order(test_order_id,1,bad_patch);
      RAISE EXCEPTION 'Invalid confirmation was accepted: %', bad_patch;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE 'Invalid confirmation was accepted:%' THEN RAISE; END IF;
    END;
    IF (SELECT to_jsonb(o) FROM public.orders o WHERE id=test_order_id) IS DISTINCT FROM before_order THEN
      RAISE EXCEPTION 'Rejected confirmation saved a partial change'; END IF;
  END LOOP;

  -- Unchanged supplier scope, active-record, and archived-job guards.
  BEGIN
    PERFORM public.update_partner_order(test_order_id,2,'{"status":"processing","fulfillment_date":"2026-09-20"}');
    RAISE EXCEPTION 'Wrong supplier confirmed order';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Order is unavailable' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.suppliers SET is_active=false WHERE id=1;
    PERFORM public.update_partner_order(test_order_id,1,'{"supplier_notes":"Inactive supplier"}');
    RAISE EXCEPTION 'Inactive supplier changed order';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Order is unavailable' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.orders SET is_active=false WHERE id=test_order_id;
    PERFORM public.update_partner_order(test_order_id,1,'{"supplier_notes":"Inactive order"}');
    RAISE EXCEPTION 'Inactive order changed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Order is unavailable' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.job_requests SET status='archived' WHERE id=4000;
    PERFORM public.update_partner_order(test_order_id,1,'{"supplier_notes":"Archived job"}');
    RAISE EXCEPTION 'Archived order changed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Closed orders cannot be changed' THEN RAISE; END IF; END;

  PERFORM public.update_partner_order(test_order_id,1,
    '{"status":"processing","fulfillment_date":"2026-09-20","supplier_notes":"  Ready by September 20  "}');
  IF NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id=test_order_id AND o.status='processing'
    AND o.fulfillment_date='2026-09-20' AND o.fulfillment_method IS NULL AND o.confirmation_date=CURRENT_DATE
    AND o.supplier_notes='Ready by September 20' AND o.notes='Chris instructions') THEN
    RAISE EXCEPTION 'Date-only confirmation did not save status/date/note atomically'; END IF;

  -- Method patches are permitted by this service-role RPC; the API restricts them to admin.
  PERFORM public.update_partner_order(test_order_id,1,'{"fulfillment_method":"delivery"}');
  PERFORM public.update_partner_order(test_order_id,1,'{"supplier_notes":"Method stays"}');
  IF (SELECT fulfillment_method FROM public.orders WHERE id=test_order_id) IS DISTINCT FROM 'delivery' THEN
    RAISE EXCEPTION 'Omitted method was not preserved'; END IF;
  PERFORM public.update_partner_order(test_order_id,1,'{"fulfillment_method":null}');
  PERFORM public.update_partner_order(test_order_id,1,'{"status":"order_ready"}');
  IF NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id=test_order_id AND o.status='order_ready'
    AND o.fulfillment_method IS NULL AND o.fulfillment_date='2026-09-20'
    AND o.supplier_notes='Method stays' AND o.confirmation_date=CURRENT_DATE) THEN
    RAISE EXCEPTION 'Clearing method or marking ready without method failed'; END IF;
  PERFORM public.update_partner_order(test_order_id,1,'{"fulfillment_method":"pickup"}');
  PERFORM public.update_partner_order(test_order_id,1,'{"fulfillment_method":null}');
  IF (SELECT fulfillment_method FROM public.orders WHERE id=test_order_id) IS NOT NULL THEN
    RAISE EXCEPTION 'Ready order method could not be cleared'; END IF;
  SELECT to_jsonb(o) INTO before_order FROM public.orders o WHERE id=test_order_id;
  BEGIN
    PERFORM public.update_partner_order(test_order_id,1,'{"fulfillment_date":null,"supplier_notes":"Clear date"}');
    RAISE EXCEPTION 'Ready order lost required date';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Choose a fulfillment date before confirming the order' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.update_partner_order(test_order_id,1,'{"status":"processing","supplier_notes":"Regress"}');
    RAISE EXCEPTION 'Ready order regressed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Orders move from New to Processing to Order Ready' THEN RAISE; END IF;
  END;
  IF (SELECT to_jsonb(o) FROM public.orders o WHERE id=test_order_id) IS DISTINCT FROM before_order THEN
    RAISE EXCEPTION 'Invalid ready-order update saved a partial change'; END IF;

  PERFORM public.close_order(test_order_id,'closed_won');
  SELECT to_jsonb(o) INTO before_order FROM public.orders o WHERE id=test_order_id;
  BEGIN
    PERFORM public.update_partner_order(test_order_id,1,'{"supplier_notes":"Change closed"}');
    RAISE EXCEPTION 'Closed order changed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Closed orders cannot be changed' THEN RAISE; END IF; END;
  IF (SELECT to_jsonb(o) FROM public.orders o WHERE id=test_order_id) IS DISTINCT FROM before_order THEN
    RAISE EXCEPTION 'Closed order history changed'; END IF;
  IF has_function_privilege('anon','public.update_partner_order(bigint,bigint,jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','public.update_partner_order(bigint,bigint,jsonb)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.update_partner_order(bigint,bigint,jsonb)','EXECUTE')
    OR (SELECT prosecdef FROM pg_proc WHERE oid='public.update_partner_order(bigint,bigint,jsonb)'::regprocedure) THEN
    RAISE EXCEPTION 'RPC service-role-only permissions or invoker security changed'; END IF;

  FOREACH existing_method IN ARRAY ARRAY['pickup', 'delivery'] LOOP
    INSERT INTO public.orders(supplier_id,fulfillment_method) VALUES (1,existing_method) RETURNING id INTO method_order_id;
    PERFORM public.update_partner_order(method_order_id,1,'{"status":"processing","fulfillment_date":"2026-09-21"}');
    PERFORM public.update_partner_order(method_order_id,1,'{"status":"order_ready"}');
    IF NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id=method_order_id AND o.status='order_ready'
      AND o.fulfillment_method=existing_method AND o.fulfillment_date='2026-09-21') THEN
      RAISE EXCEPTION 'Confirmation or Ready overwrote the existing method'; END IF;
  END LOOP;
END $$;

-- Repeat application must also preserve orders with saved dates and notes.
CREATE TEMP TABLE orders_before_0098_repeat AS SELECT * FROM public.orders;
\ir ../0098_order_confirmation_optional_method.sql
DO $$
BEGIN
  IF EXISTS (SELECT * FROM orders_before_0098_repeat EXCEPT SELECT * FROM public.orders)
    OR EXISTS (SELECT * FROM public.orders EXCEPT SELECT * FROM orders_before_0098_repeat) THEN
    RAISE EXCEPTION 'Repeat migration changed order history'; END IF;
END $$;
SELECT 'order optional confirmation method migration checks passed' AS result;
