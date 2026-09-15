-- Verify existing history remains untouched and supplier confirmation stays atomic.
DO $$
DECLARE ar_id bigint; source_id bigint; test_order_id bigint; before_order jsonb; bad_patch jsonb; note_text text;
BEGIN
  IF EXISTS (SELECT 1 FROM orders_before_0096 old JOIN public.orders o USING(id)
    WHERE (to_jsonb(o) - 'supplier_notes') IS DISTINCT FROM to_jsonb(old) OR o.supplier_notes IS NOT NULL)
    OR (SELECT count(*) FROM public.orders) <> (SELECT count(*) FROM orders_before_0096) THEN
    RAISE EXCEPTION 'Migration changed existing order history'; END IF;
  IF EXISTS (SELECT * FROM jobs_before_0096 EXCEPT SELECT * FROM public.job_requests)
    OR EXISTS (SELECT * FROM items_before_0096 EXCEPT SELECT * FROM public.order_items)
    OR EXISTS (SELECT * FROM allocations_before_0096 EXCEPT SELECT * FROM public.order_item_job_request_items)
    OR EXISTS (SELECT * FROM availability_before_0096 EXCEPT SELECT * FROM public.availability_requests)
    OR EXISTS (SELECT * FROM availability_items_before_0096 EXCEPT SELECT * FROM public.availability_request_items) THEN
    RAISE EXCEPTION 'Migration changed jobs, availability requests, line snapshots or allocations'; END IF;

  INSERT INTO public.job_requests(id) VALUES (3000);
  INSERT INTO public.job_request_items(id,job_request_id,quantity) VALUES (3000,3000,10);
  ar_id := public.create_availability_request(1,'[{"name":"Oak","quantity":10,"allocations":[{"job_request_item_id":3000,"quantity":10}]}]');
  SELECT id INTO source_id FROM public.availability_request_items WHERE availability_request_id=ar_id;
  UPDATE public.availability_request_items SET status='can_order',unit_price=20,notes='Original availability response' WHERE id=source_id;
  test_order_id := public.create_order(1,jsonb_build_array(jsonb_build_object('availability_request_item_id',source_id,
    'allocations',jsonb_build_array(jsonb_build_object('job_request_item_id',3000,'quantity',10)))),
    p_customer_confirmed=>true);
  UPDATE public.orders SET notes='Original LPS instructions' WHERE id=test_order_id;
  SELECT to_jsonb(o) INTO before_order FROM public.orders o WHERE id=test_order_id;

  -- Invalid notes/date/transitions must not save any part of a confirmation.
  FOR bad_patch IN SELECT value FROM jsonb_array_elements('[
    {"status":"processing","fulfillment_method":"delivery","fulfillment_date":"2026-09-20","supplier_notes":42},
    {"status":"processing","fulfillment_method":"delivery","fulfillment_date":"2026-09-20","supplier_notes":true},
    {"status":"processing","fulfillment_method":"delivery","fulfillment_date":"2026-09-20","supplier_notes":[]},
    {"status":"processing","fulfillment_method":"delivery","fulfillment_date":"2026-09-20","supplier_notes":{}},
    {"status":"processing","fulfillment_method":"delivery","supplier_notes":"No date"},
    {"status":"processing","fulfillment_method":"delivery","fulfillment_date":"2026-02-30","supplier_notes":"Invalid date"},
    {"status":"order_ready","fulfillment_method":"delivery","fulfillment_date":"2026-09-20","supplier_notes":"Skip Processing"},
    {"status":"processing","fulfillment_method":"delivery","fulfillment_date":"2026-09-20","notes":"Replace LPS instructions"}
  ]') UNION ALL SELECT jsonb_build_object('status','processing','fulfillment_method','delivery',
    'fulfillment_date','2026-09-20','supplier_notes',repeat('x',10001)) LOOP
    BEGIN
      PERFORM public.update_partner_order(test_order_id,1,bad_patch);
      RAISE EXCEPTION 'Invalid confirmation was accepted: %', bad_patch;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM LIKE 'Invalid confirmation was accepted:%' THEN RAISE; END IF;
    END;
    IF (SELECT to_jsonb(o) FROM public.orders o WHERE id=test_order_id) IS DISTINCT FROM before_order THEN
      RAISE EXCEPTION 'Rejected confirmation left a partial status, date or note'; END IF;
  END LOOP;

  BEGIN
    PERFORM public.update_partner_order(test_order_id,2,'{"supplier_notes":"Wrong supplier"}');
    RAISE EXCEPTION 'Wrong supplier changed order note';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Wrong supplier changed order note' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.suppliers SET is_active=false WHERE id=1;
    PERFORM public.update_partner_order(test_order_id,1,'{"supplier_notes":"Inactive supplier"}');
    RAISE EXCEPTION 'Inactive supplier changed order note';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Inactive supplier changed order note' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.orders SET is_active=false WHERE id=test_order_id;
    PERFORM public.update_partner_order(test_order_id,1,'{"supplier_notes":"Inactive order"}');
    RAISE EXCEPTION 'Inactive order note changed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Inactive order note changed' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.job_requests SET status='archived' WHERE id=3000;
    PERFORM public.update_partner_order(test_order_id,1,'{"supplier_notes":"Archived job"}');
    RAISE EXCEPTION 'Order with only archived jobs changed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Order with only archived jobs changed' THEN RAISE; END IF; END;

  note_text := E'Supplier delivery instructions\nPlease call on arrival.';
  PERFORM public.update_partner_order(test_order_id,1,jsonb_build_object('status','processing','fulfillment_method','delivery',
    'fulfillment_date','2026-09-20','supplier_notes','  ' || note_text || '  '));
  IF NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id=test_order_id AND o.status='processing'
    AND o.fulfillment_method='delivery' AND o.fulfillment_date='2026-09-20' AND o.confirmation_date=CURRENT_DATE
    AND o.supplier_notes=note_text AND o.notes='Original LPS instructions')
    OR (SELECT status FROM public.job_requests WHERE id=3000)<>'committed'
    OR (SELECT notes FROM public.availability_request_items WHERE id=source_id)<>'Original availability response'
    OR NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id=test_order_id AND oi.status='need_to_order') THEN
    RAISE EXCEPTION 'Confirmation did not save status/date/note together or changed existing evidence'; END IF;

  PERFORM public.update_partner_order(test_order_id,1,'{"status":"order_ready"}');
  IF NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id=test_order_id AND o.status='order_ready'
    AND o.fulfillment_method='delivery' AND o.fulfillment_date='2026-09-20' AND o.supplier_notes=note_text
    AND o.confirmation_date=CURRENT_DATE) THEN
    RAISE EXCEPTION 'Mark Ready failed to preserve omitted confirmation fields'; END IF;
  SELECT to_jsonb(o) INTO before_order FROM public.orders o WHERE id=test_order_id;
  BEGIN
    PERFORM public.update_partner_order(test_order_id,1,'{"status":"processing","supplier_notes":"Regress"}');
    RAISE EXCEPTION 'Ready order regressed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Ready order regressed' THEN RAISE; END IF; END;
  IF (SELECT to_jsonb(o) FROM public.orders o WHERE id=test_order_id) IS DISTINCT FROM before_order THEN
    RAISE EXCEPTION 'Invalid transition changed note'; END IF;

  PERFORM public.update_partner_order(test_order_id,1,jsonb_build_object('supplier_notes',repeat('x',10000)));
  IF (SELECT length(supplier_notes) FROM public.orders WHERE id=test_order_id) <> 10000 THEN
    RAISE EXCEPTION 'Maximum-length note was not retained'; END IF;
  PERFORM public.update_partner_order(test_order_id,1,'{"supplier_notes":"   "}');
  IF (SELECT supplier_notes FROM public.orders WHERE id=test_order_id) IS NOT NULL THEN
    RAISE EXCEPTION 'Blank note was not cleared'; END IF;
  PERFORM public.update_partner_order(test_order_id,1,'{"supplier_notes":"To clear"}');
  PERFORM public.update_partner_order(test_order_id,1,'{"supplier_notes":null}');
  IF (SELECT supplier_notes FROM public.orders WHERE id=test_order_id) IS NOT NULL THEN
    RAISE EXCEPTION 'Null note was not cleared'; END IF;

  PERFORM public.update_partner_order(test_order_id,1,'{"supplier_notes":"Historical supplier note"}');
  PERFORM public.close_order(test_order_id,'closed_won');
  SELECT to_jsonb(o) INTO before_order FROM public.orders o WHERE id=test_order_id;
  BEGIN
    PERFORM public.update_partner_order(test_order_id,1,'{"supplier_notes":"Change closed"}');
    RAISE EXCEPTION 'Closed order note changed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Closed order note changed' THEN RAISE; END IF; END;
  IF (SELECT to_jsonb(o) FROM public.orders o WHERE id=test_order_id) IS DISTINCT FROM before_order THEN
    RAISE EXCEPTION 'Closed order history changed'; END IF;
  IF has_function_privilege('anon','public.update_partner_order(bigint,bigint,jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','public.update_partner_order(bigint,bigint,jsonb)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.update_partner_order(bigint,bigint,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'Supplier confirmation RPC permissions are wrong'; END IF;
END $$;
SELECT 'order supplier confirmation migration checks passed' AS result;
