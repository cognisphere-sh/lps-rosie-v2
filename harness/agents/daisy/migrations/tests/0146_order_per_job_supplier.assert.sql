-- Run after 0146 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0146 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE l1 bigint := 99461; l2 bigint := 99462; l3 bigint := 99463; l4 bigint := 99464; l5 bigint := 99465;
  sup2 bigint; alt bigint; o1 bigint; o2 bigint; again bigint; row_id bigint; r public.order_items; counts jsonb;
BEGIN
  -- Existing orders kept their rows and each got its job.
  IF EXISTS (SELECT 1 FROM public.orders WHERE job_request_id IS NULL) THEN RAISE EXCEPTION 'order without job'; END IF;
  IF to_regclass('public.order_item_job_request_items') IS NOT NULL THEN RAISE EXCEPTION 'allocation table still there'; END IF;
  IF to_regprocedure('public.create_direct_order(bigint,jsonb,text,date,text,boolean,text)') IS NOT NULL THEN RAISE EXCEPTION 'create_direct_order still there'; END IF;
  IF (SELECT count(*) FROM public.order_item_job_request_items_pre_0146) <> (SELECT count(*) FROM public.order_items) THEN
    RAISE EXCEPTION 'backup and order lines differ';
  END IF;

  SELECT id INTO sup2 FROM public.suppliers WHERE is_active AND id <> 1 ORDER BY id LIMIT 1;
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99460, 'Test 0146', 'availability');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE VALUES
    (l1, 99460, 'Live Oak', '30 G', 5), (l2, 99460, 'Texas Sage', '5 G', 3), (l3, 99460, 'Muhly', '1 G', 10),
    (l4, 99460, 'Cedar Elm', '45 G', 2), (l5, 99460, 'Yaupon', '15 G', NULL);
  PERFORM public.update_job_line(l1, '{"status":"available","unit_price":"185"}');
  UPDATE public.candidates SET note_for_supplier = 'Single trunk', note_from_supplier = 'Tagged and ready'
    WHERE id = (SELECT selected_candidate_id FROM public.job_request_items WHERE id = l1);
  PERFORM public.update_job_line(l2, '{"available_quantity":"2","status":"partial_qty","unit_price":"40"}');

  -- One order, one row per selected candidate, values copied.
  o1 := public.create_order(99460, 1, ARRAY[l1, l2], 'delivery', 'Gate code 1234', NULL);
  IF (SELECT count(*) FROM public.order_items WHERE order_id = o1) <> 2 THEN RAISE EXCEPTION 'expected 2 rows'; END IF;
  IF (SELECT job_request_id FROM public.orders WHERE id = o1) <> 99460 THEN RAISE EXCEPTION 'order job not set'; END IF;
  SELECT * INTO r FROM public.order_items WHERE order_id = o1 AND candidate_id = (SELECT selected_candidate_id FROM public.job_request_items WHERE id = l1);
  IF r.quantity <> 5 OR r.unit_price <> 185 OR r.status <> 'available' OR r.size <> '30 G'
    OR r.note_for_supplier IS DISTINCT FROM 'Single trunk' OR r.note_from_supplier IS DISTINCT FROM 'Tagged and ready'
    OR r.note_for_customer IS DISTINCT FROM 'Tagged and ready' THEN
    RAISE EXCEPTION 'row 1 not copied: % % % % % % %', r.quantity, r.unit_price, r.status, r.size, r.note_for_supplier, r.note_from_supplier, r.note_for_customer;
  END IF;
  SELECT * INTO r FROM public.order_items WHERE order_id = o1 AND candidate_id = (SELECT selected_candidate_id FROM public.job_request_items WHERE id = l2);
  IF r.quantity <> 2 OR r.status <> 'partial_qty' THEN RAISE EXCEPTION 'row 2 not avail qty: % %', r.quantity, r.status; END IF;
  IF (SELECT status FROM public.job_requests WHERE id = 99460) <> 'committed' THEN RAISE EXCEPTION 'job not committed'; END IF;

  -- The same candidate cannot be ordered twice.
  BEGIN
    PERFORM public.create_order(99460, 1, ARRAY[l1]);
    RAISE EXCEPTION 'ordered twice';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '% is already on order O-%' THEN RAISE; END IF;
  END;
  -- An unanswered line orders at its Qty, onto the same open order.
  again := public.create_order(99460, 1, ARRAY[l3]);
  IF again <> o1 THEN RAISE EXCEPTION 'second order opened for the same supplier'; END IF;
  SELECT * INTO r FROM public.order_items WHERE order_id = o1 AND candidate_id = (SELECT selected_candidate_id FROM public.job_request_items WHERE id = l3);
  IF r.quantity <> 10 OR r.status <> 'pending' OR r.unit_price IS NOT NULL THEN RAISE EXCEPTION 'unanswered row wrong: % % %', r.quantity, r.status, r.unit_price; END IF;
  -- No Qty and no avail: refused.
  BEGIN
    PERFORM public.create_order(99460, 1, ARRAY[l5]);
    RAISE EXCEPTION 'ordered with no quantity';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Set a quantity for %' THEN RAISE; END IF;
  END;

  -- Another supplier's selection goes on that supplier's own order.
  INSERT INTO public.candidates(supplier_id, job_request_item_id, name, size, description, is_original)
    VALUES (sup2, l4, 'Cedar Elm', '45 G', '45 G Cedar Elm', false) RETURNING id INTO alt;
  PERFORM public.select_candidate(l4, alt);
  BEGIN
    PERFORM public.create_order(99460, 1, ARRAY[l4]);
    RAISE EXCEPTION 'other supplier accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '% is selected from another supplier' THEN RAISE; END IF;
  END;
  o2 := public.create_order(99460, sup2, ARRAY[l4]);
  IF o2 = o1 THEN RAISE EXCEPTION 'suppliers share an order'; END IF;

  -- Supplier notes on rows and header.
  SELECT id INTO row_id FROM public.order_items WHERE order_id = o1 ORDER BY id LIMIT 1;
  PERFORM public.update_partner_order_item(o1, 1, row_id, 'available', 'ETA Friday');
  IF (SELECT note_from_supplier FROM public.order_items WHERE id = row_id) IS DISTINCT FROM 'ETA Friday' THEN RAISE EXCEPTION 'row reply not saved'; END IF;
  PERFORM public.update_partner_order_item(o1, 1, row_id, 'arriving_soon');
  IF (SELECT note_from_supplier FROM public.order_items WHERE id = row_id) IS DISTINCT FROM 'ETA Friday' THEN RAISE EXCEPTION 'NULL did not keep the reply'; END IF;
  PERFORM public.update_partner_order_item(o1, 1, row_id, 'arriving_soon', '');
  IF (SELECT note_from_supplier FROM public.order_items WHERE id = row_id) IS NOT NULL THEN RAISE EXCEPTION 'blank did not clear the reply'; END IF;
  PERFORM public.update_partner_order(o1, 1, '{"note_from_supplier":"Loading dock B","status":"processing","fulfillment_date":"2026-11-02"}');
  IF (SELECT note_from_supplier FROM public.orders WHERE id = o1) IS DISTINCT FROM 'Loading dock B'
    OR (SELECT note_for_supplier FROM public.orders WHERE id = o1) IS DISTINCT FROM 'Gate code 1234' THEN
    RAISE EXCEPTION 'header notes wrong';
  END IF;

  -- The job closes with its last open order, Won if any order was won.
  PERFORM public.close_order(o1, 'closed_lost');
  IF (SELECT status FROM public.job_requests WHERE id = 99460) <> 'committed' THEN RAISE EXCEPTION 'job closed with an order still open'; END IF;
  PERFORM public.close_order(o2, 'closed_won');
  IF (SELECT status FROM public.job_requests WHERE id = 99460) <> 'closed_won' THEN RAISE EXCEPTION 'job not closed Won'; END IF;
  BEGIN
    PERFORM public.create_order(99460, 1, ARRAY[l5]);
    RAISE EXCEPTION 'closed job accepted an order';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'This job request is closed' THEN RAISE; END IF;
  END;

  -- Deleting the job deletes its orders.
  counts := public.delete_job_request(99460);
  IF (counts->>'orders')::int <> 2 OR (counts->>'orderItems')::int <> 4 THEN RAISE EXCEPTION 'delete counts %', counts; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE id IN (o1, o2)) THEN RAISE EXCEPTION 'orders survived the job'; END IF;
  RAISE NOTICE '0146 asserts passed';
END $$;
