-- Disposable PostgreSQL only: preserve Orders/history and exercise the job lifecycle.
DO $$
DECLARE pair text[]; changed boolean; stage text; event text; result text;
  job_a bigint; job_b bigint; ar_id bigint; ar_line bigint; order_a bigint; order_b bigint;
  item_payload jsonb; audit_count bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM jobs_before_0093 old FULL JOIN public.job_requests job USING (id)
    WHERE old.id IS NULL OR job.id IS NULL
      OR (to_jsonb(old) - 'status' - 'updated_at') IS DISTINCT FROM (to_jsonb(job) - 'status' - 'updated_at')
      OR job.status IS DISTINCT FROM CASE old.status WHEN 'confirmed' THEN 'committed' ELSE old.status END
      OR (old.status <> 'confirmed' AND old.updated_at IS DISTINCT FROM job.updated_at)) THEN
    RAISE EXCEPTION 'Migration changed job content beyond the removed stage'; END IF;
  FOREACH pair SLICE 1 IN ARRAY ARRAY[
    ['orders_before_0093','orders'], ['order_items_before_0093','order_items'],
    ['order_allocations_before_0093','order_item_job_request_items'],
    ['availability_before_0093','availability_requests'],
    ['availability_items_before_0093','availability_request_items'],
    ['availability_jobs_before_0093','availability_request_jobs'],
    ['availability_allocations_before_0093','availability_request_item_jobs']
  ] LOOP
    EXECUTE format('SELECT EXISTS ((TABLE %I EXCEPT ALL TABLE public.%I) UNION ALL
      (TABLE public.%I EXCEPT ALL TABLE %I))', pair[1], pair[2], pair[2], pair[1]) INTO changed;
    IF changed THEN RAISE EXCEPTION 'Migration changed %', pair[2]; END IF;
  END LOOP;
  IF EXISTS (TABLE changelog_before_0093 EXCEPT ALL TABLE public.job_request_changelog)
    OR (SELECT count(*) FROM public.job_request_changelog) <> 3
    OR (SELECT count(*) FROM public.job_request_changelog WHERE job_request_id IN (1000,1001)
      AND changes = '{"status":{"old":"confirmed","new":"committed"}}'::jsonb) <> 2 THEN
    RAISE EXCEPTION 'Conversion did not preserve and append to the existing audit history'; END IF;
  IF EXISTS (SELECT 1 FROM workflow_functions_before_0093 old JOIN pg_proc p
    ON p.oid = old.signature::regprocedure
    WHERE old.definition IS DISTINCT FROM pg_get_functiondef(p.oid) OR old.proacl IS DISTINCT FROM p.proacl) THEN
    RAISE EXCEPTION 'Order confirmation/closure functions or grants changed'; END IF;
  IF (SELECT count(*) FROM public.orders WHERE status='confirmed') <> 2
    OR NOT EXISTS (SELECT 1 FROM public.orders WHERE id=1001 AND confirmation_date IS NULL) THEN
    RAISE EXCEPTION 'Order confirmation status was removed or missing dates were invented'; END IF;

  BEGIN
    UPDATE public.job_requests SET status='confirmed' WHERE id=1000;
    RAISE EXCEPTION 'Accepted Confirmed on a job update';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO public.job_requests(status) VALUES ('confirmed');
    RAISE EXCEPTION 'Accepted Confirmed on a job insert';
  EXCEPTION WHEN check_violation THEN NULL; END;
  SELECT count(*) INTO audit_count FROM public.job_request_changelog;
  result := public.record_job_workflow_event(1000,'supplier_confirmed');
  IF result <> 'committed' OR (SELECT count(*) FROM public.job_request_changelog) <> audit_count THEN
    RAISE EXCEPTION 'Stale supplier event changed the job or added false audit history'; END IF;
  result := public.record_job_workflow_event(1001,'supplier_confirmed');
  IF result <> 'committed' OR (SELECT is_active FROM public.job_requests WHERE id=1001) THEN
    RAISE EXCEPTION 'Supplier event reactivated an inactive job'; END IF;
  BEGIN
    PERFORM public.record_job_workflow_event(1000,'unknown_event');
    RAISE EXCEPTION 'Accepted an unknown workflow event';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Accepted an unknown workflow event' THEN RAISE; END IF; END;

  INSERT INTO public.job_requests DEFAULT VALUES RETURNING id INTO job_a;
  INSERT INTO public.job_requests DEFAULT VALUES RETURNING id INTO job_b;
  IF (SELECT status FROM public.job_requests WHERE id=job_a) <> 'quoted' THEN
    RAISE EXCEPTION 'New job does not start at Quote'; END IF;
  FOREACH stage IN ARRAY ARRAY['quoted','availability','committed','closed_won','closed_lost','archived'] LOOP
    UPDATE public.job_requests SET status=stage WHERE id=job_a;
    result := public.record_job_workflow_event(job_a,'supplier_confirmed');
    IF result <> stage THEN RAISE EXCEPTION 'Supplier confirmation changed job stage %', stage; END IF;
  END LOOP;
  UPDATE public.job_requests SET status='quoted' WHERE id=job_a;
  FOREACH event IN ARRAY ARRAY['pricing_fetched','quote_shared'] LOOP
    result := public.record_job_workflow_event(job_a,event);
    IF result <> 'quoted' THEN RAISE EXCEPTION 'Quick quote did not remain Quote'; END IF;
  END LOOP;
  result := public.record_job_workflow_event(job_a,'availability_sent');
  IF result <> 'availability' THEN RAISE EXCEPTION 'Availability event did not advance Quote'; END IF;
  result := public.record_job_workflow_event(job_a,'customer_confirmed');
  IF result <> 'committed' THEN RAISE EXCEPTION 'Customer confirmation did not commit the job'; END IF;
  FOREACH event IN ARRAY ARRAY['pricing_fetched','quote_shared','availability_sent','customer_confirmed','supplier_confirmed'] LOOP
    result := public.record_job_workflow_event(job_a,event);
    IF result <> 'committed' THEN RAISE EXCEPTION 'Repeated event regressed Committed'; END IF;
  END LOOP;

  INSERT INTO public.job_request_items(id,job_request_id,quantity) VALUES (2000,job_a,10),(2001,job_b,4);
  ar_id := public.create_availability_request(1,jsonb_build_array(jsonb_build_object(
    'name','Oak','size','30 G','quantity',14,'unit_price',20,'allocations',jsonb_build_array(
      jsonb_build_object('job_request_item_id',2000,'quantity',10),
      jsonb_build_object('job_request_item_id',2001,'quantity',4)))));
  SELECT id INTO ar_line FROM public.availability_request_items WHERE availability_request_id=ar_id;
  UPDATE public.availability_request_items SET status='can_order' WHERE id=ar_line;
  item_payload := jsonb_build_array(jsonb_build_object('availability_request_item_id',ar_line,
    'allocations',jsonb_build_array(jsonb_build_object('job_request_item_id',2000,'quantity',6),
      jsonb_build_object('job_request_item_id',2001,'quantity',4))));
  BEGIN
    PERFORM public.create_order(1,item_payload);
    RAISE EXCEPTION 'Created order without customer confirmation';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Created order without customer confirmation' THEN RAISE; END IF; END;
  order_a := public.create_order(1,item_payload,'delivery','2026-10-20','First batch',true);
  IF (SELECT count(*) FROM public.job_requests WHERE id IN (job_a,job_b) AND status='committed') <> 2 THEN
    RAISE EXCEPTION 'Order did not commit all represented jobs'; END IF;
  item_payload := jsonb_build_array(jsonb_build_object('availability_request_item_id',ar_line,
    'allocations',jsonb_build_array(jsonb_build_object('job_request_item_id',2000,'quantity',4))));
  order_b := public.create_order(1,item_payload,p_customer_confirmed=>true);
  BEGIN
    PERFORM public.confirm_order(order_a,2);
    RAISE EXCEPTION 'Wrong supplier confirmed the order';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Wrong supplier confirmed the order' THEN RAISE; END IF; END;
  PERFORM public.confirm_order(order_a,1,'2026-09-15','2026-10-19');
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id=order_a AND status='confirmed'
    AND confirmation_date='2026-09-15' AND fulfillment_date='2026-10-19')
    OR (SELECT count(*) FROM public.job_requests WHERE id IN (job_a,job_b) AND status='committed') <> 2 THEN
    RAISE EXCEPTION 'Order confirmation failed or advanced associated jobs'; END IF;
  PERFORM public.confirm_order(order_b,1,'2026-09-16');
  IF (SELECT count(*) FROM public.job_requests WHERE id IN (job_a,job_b) AND status='committed') <> 2
    OR NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id=order_a AND status='need_to_order' AND total=200) THEN
    RAISE EXCEPTION 'Final confirmation advanced a job or replaced procurement status'; END IF;
  PERFORM public.close_order(order_a,'closed_won');
  IF (SELECT status FROM public.job_requests WHERE id=job_a) <> 'committed'
    OR (SELECT status FROM public.job_requests WHERE id=job_b) <> 'closed_won' THEN
    RAISE EXCEPTION 'Partial order closure closed the wrong jobs'; END IF;
  PERFORM public.close_order(order_b,'closed_lost');
  IF (SELECT status FROM public.job_requests WHERE id=job_a) <> 'closed_lost'
    OR (SELECT status FROM public.availability_requests WHERE id=ar_id) <> 'closed' THEN
    RAISE EXCEPTION 'Final order closure did not close job and availability'; END IF;
  result := public.record_job_workflow_event(job_a,'supplier_confirmed');
  IF result <> 'closed_lost' THEN RAISE EXCEPTION 'Late supplier event reopened a closed job'; END IF;

  IF has_function_privilege('anon','public.record_job_workflow_event(bigint,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.create_order(bigint,jsonb,text,date,text,boolean)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.record_job_workflow_event(bigint,text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.confirm_order(bigint,bigint,date,date)','EXECUTE') THEN
    RAISE EXCEPTION 'Workflow RPC privileges are wrong'; END IF;
END $$;
