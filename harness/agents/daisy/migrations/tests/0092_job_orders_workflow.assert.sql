-- Disposable PostgreSQL only. Exercise real constraints, triggers and RPC rollback.
DO $$
DECLARE ar_id bigint; ar_line bigint; other_ar bigint; order_a bigint; order_b bigint;
  result text; public_link uuid := gen_random_uuid(); item_payload jsonb; before_count bigint; job_a bigint; job_b bigint; partial_job bigint; partial_order bigint; first_line bigint; second_line bigint; merged_order bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM workflow_history_before_0092 old JOIN public.job_requests j USING(id)
    WHERE j.status <> CASE old.status WHEN 'sourcing' THEN 'quoted' WHEN 'confirmed' THEN 'committed' ELSE old.status END) THEN
    RAISE EXCEPTION 'Migration did not preserve the meaning of historical stages'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.availability_request_jobs WHERE availability_request_id=100 AND job_request_id=100)
    OR NOT EXISTS (SELECT 1 FROM public.availability_request_item_jobs WHERE availability_request_item_id=100 AND job_request_item_id=100 AND quantity=5) THEN
    RAISE EXCEPTION 'Legacy associations were not backfilled'; END IF;
  INSERT INTO public.job_requests DEFAULT VALUES RETURNING id INTO job_a;
  INSERT INTO public.job_requests DEFAULT VALUES RETURNING id INTO job_b;
  IF (SELECT status FROM public.job_requests WHERE id=job_a) <> 'quoted' THEN RAISE EXCEPTION 'Quote must be default'; END IF;
  BEGIN
    UPDATE public.job_requests SET status='sourcing' WHERE id=job_a;
    RAISE EXCEPTION 'Active was accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  result := public.record_job_workflow_event(job_a,'customer_confirmed');
  IF result<>'committed' THEN RAISE EXCEPTION 'Customer confirmation must mean Committed'; END IF;
  result := public.record_job_workflow_event(job_a,'supplier_confirmed');
  IF result<>'confirmed' THEN RAISE EXCEPTION 'Supplier confirmation must mean Confirmed'; END IF;
  UPDATE public.job_requests SET status='quoted' WHERE id=job_a;
  UPDATE public.job_requests SET expected_install_date='2026-10-20', fulfillment_method='delivery' WHERE id=job_a;
  INSERT INTO public.job_request_items(id,job_request_id,quantity) VALUES (201,job_a,6),(202,job_b,4);
  other_ar := public.create_availability_request(1,'[{"name":"Oak","quantity":null,"allocations":[{"job_request_item_id":201,"quantity":null}]}]');
  IF NOT EXISTS (SELECT 1 FROM public.availability_request_items WHERE availability_request_id=other_ar AND quantity IS NULL) THEN
    RAISE EXCEPTION 'Unspecified demand was invented or rejected'; END IF;
  UPDATE public.availability_request_items SET quantity=6 WHERE availability_request_id=other_ar;
  IF NOT EXISTS (SELECT 1 FROM public.availability_request_item_jobs link JOIN public.availability_request_items ai
    ON ai.id=link.availability_request_item_id WHERE ai.availability_request_id=other_ar AND link.quantity=6) THEN
    RAISE EXCEPTION 'Single-job quantity edit did not update its allocation'; END IF;
  UPDATE public.availability_request_items SET quantity=NULL WHERE availability_request_id=other_ar;
  IF NOT EXISTS (SELECT 1 FROM public.availability_request_item_jobs link JOIN public.availability_request_items ai
    ON ai.id=link.availability_request_item_id WHERE ai.availability_request_id=other_ar AND link.quantity IS NULL) THEN
    RAISE EXCEPTION 'Clearing a single-job quantity did not clear its allocation'; END IF;
  item_payload := jsonb_build_array(jsonb_build_object('name','Oak','size','30 G','quantity',10,'unit_price',50,
    'allocations',jsonb_build_array(jsonb_build_object('job_request_item_id',201,'quantity',6),jsonb_build_object('job_request_item_id',202,'quantity',4))));
  ar_id := public.create_availability_request(1,item_payload,false,public_link);
  SELECT id INTO ar_line FROM public.availability_request_items WHERE availability_request_id=ar_id;
  IF (SELECT count(*) FROM public.availability_request_jobs WHERE availability_request_id=ar_id) <> 2
    OR (SELECT count(*) FROM public.availability_request_item_jobs WHERE availability_request_item_id=ar_line) <> 2
    OR (SELECT count(*) FROM public.job_requests WHERE id IN (job_a,job_b) AND status='availability') <> 2 THEN
    RAISE EXCEPTION 'Combined ask did not map or advance both jobs'; END IF;
  BEGIN
    UPDATE public.availability_request_items SET quantity=11 WHERE id=ar_line;
    RAISE EXCEPTION 'Combined quantity was changed without explicit allocations';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='Combined quantity was changed without explicit allocations' THEN RAISE; END IF;
  END;
  IF (SELECT quantity FROM public.availability_request_items WHERE id=ar_line)<>10
    OR (SELECT sum(quantity) FROM public.availability_request_item_jobs WHERE availability_request_item_id=ar_line)<>10 THEN
    RAISE EXCEPTION 'Failed combined edit changed quantities'; END IF;
  -- Explicit distribution changes and their corrected total belong to one transaction.
  UPDATE public.availability_request_item_jobs SET quantity=7
    WHERE availability_request_item_id=ar_line AND job_request_item_id=201;
  UPDATE public.availability_request_items SET quantity=11 WHERE id=ar_line;
  IF (SELECT quantity FROM public.availability_request_items WHERE id=ar_line)<>11
    OR (SELECT sum(quantity) FROM public.availability_request_item_jobs WHERE availability_request_item_id=ar_line)<>11 THEN
    RAISE EXCEPTION 'Explicit combined allocation edit did not permit its matching total'; END IF;
  UPDATE public.availability_request_item_jobs SET quantity=NULL WHERE availability_request_item_id=ar_line;
  UPDATE public.availability_request_items SET quantity=NULL WHERE id=ar_line;
  IF (SELECT quantity FROM public.availability_request_items WHERE id=ar_line) IS NOT NULL THEN
    RAISE EXCEPTION 'Explicit all-unknown allocations did not permit an unknown total'; END IF;
  UPDATE public.availability_request_item_jobs SET quantity=CASE job_request_item_id WHEN 201 THEN 6 ELSE 4 END
    WHERE availability_request_item_id=ar_line;
  UPDATE public.availability_request_items SET quantity=10 WHERE id=ar_line;
  SELECT count(*) INTO before_count FROM public.availability_requests;
  BEGIN
    PERFORM public.create_availability_request(1,jsonb_set(item_payload,'{0,quantity}','11'));
    RAISE EXCEPTION 'Accepted mismatched allocations';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Accepted mismatched allocations' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.availability_requests) <> before_count THEN RAISE EXCEPTION 'Failed creation left a partial request'; END IF;
  UPDATE public.availability_request_items SET status='can_order',available_quantity=0 WHERE id=ar_line;
  IF EXISTS (SELECT 1 FROM public.job_request_items WHERE id IN (201,202) AND status<>'pending') THEN
    RAISE EXCEPTION 'Supplier answer was applied without Chris approval'; END IF;
  UPDATE public.job_requests SET status='closed_lost' WHERE id=job_a;
  IF (SELECT status FROM public.availability_requests WHERE id=ar_id)='closed' THEN RAISE EXCEPTION 'One job closed a shared ask'; END IF;
  PERFORM public.answer_public_availability(public_link,ar_line,'{"notes":"Grower can supply"}');
  UPDATE public.job_requests SET status='closed_lost' WHERE id=job_b;
  IF NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=ar_id AND status='closed' AND public_token IS NULL) THEN
    RAISE EXCEPTION 'All closed jobs failed to close/revoke shared ask'; END IF;
  UPDATE public.job_requests SET status='availability' WHERE id=job_a;
  IF NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=ar_id AND status='processing'
    AND public_token IS NOT NULL AND public_token<>public_link) THEN RAISE EXCEPTION 'Reopening failed to restore and rotate shared ask'; END IF;
  UPDATE public.job_requests SET status='availability' WHERE id=job_b;
  item_payload := jsonb_build_array(jsonb_build_object('availability_request_item_id',ar_line,
    'allocations',jsonb_build_array(jsonb_build_object('job_request_item_id',201,'quantity',3),jsonb_build_object('job_request_item_id',202,'quantity',4))));
  SELECT count(*) INTO before_count FROM public.orders;
  BEGIN
    PERFORM public.create_order(1,item_payload);
    RAISE EXCEPTION 'Created order without explicit customer confirmation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='Created order without explicit customer confirmation' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.create_order(2,item_payload,p_customer_confirmed=>true);
    RAISE EXCEPTION 'Created order for wrong supplier';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='Created order for wrong supplier' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.orders)<>before_count THEN RAISE EXCEPTION 'Failed order left partial header'; END IF;
  order_a := public.create_order(1,item_payload,'delivery','2026-10-18','First batch',true);
  IF (SELECT count(*) FROM public.job_requests WHERE id IN (job_a,job_b) AND status='committed')<>2
    OR NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id=order_a AND status='need_to_order' AND quantity=7 AND total=350) THEN
    RAISE EXCEPTION 'Order did not commit jobs, snapshot total or translate Need to Order'; END IF;
  item_payload := jsonb_build_array(jsonb_build_object('availability_request_item_id',ar_line,
    'allocations',jsonb_build_array(jsonb_build_object('job_request_item_id',201,'quantity',3))));
  order_b := public.create_order(1,item_payload,p_customer_confirmed=>true);
  BEGIN
    PERFORM public.create_order(1,item_payload,p_customer_confirmed=>true);
    RAISE EXCEPTION 'Ordered same demand twice';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Ordered same demand twice' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.confirm_order(order_a,2);
    RAISE EXCEPTION 'Wrong supplier confirmed order';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Wrong supplier confirmed order' THEN RAISE; END IF; END;
  PERFORM public.confirm_order(order_a,1,'2026-09-15','2026-10-19');
  IF (SELECT status FROM public.job_requests WHERE id=job_a)<>'committed'
    OR (SELECT status FROM public.job_requests WHERE id=job_b)<>'confirmed' THEN
    RAISE EXCEPTION 'Partial supplier confirmation advanced wrong jobs'; END IF;
  PERFORM public.confirm_order(order_b,1,'2026-09-16');
  IF (SELECT status FROM public.job_requests WHERE id=job_a)<>'confirmed' THEN RAISE EXCEPTION 'Final order confirmation failed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id=order_a AND confirmation_date='2026-09-15' AND fulfillment_date='2026-10-19') THEN
    RAISE EXCEPTION 'Order dates were not saved'; END IF;
  result := public.record_job_workflow_event(job_a,'availability_sent');
  IF result<>'confirmed' THEN RAISE EXCEPTION 'Repeated work regressed Confirmed'; END IF;
  PERFORM public.close_order(order_a,'closed_won');
  IF (SELECT status FROM public.job_requests WHERE id=job_a)<>'confirmed'
    OR (SELECT status FROM public.job_requests WHERE id=job_b)<>'closed_won' THEN
    RAISE EXCEPTION 'Partial order closure closed wrong jobs'; END IF;
  PERFORM public.close_order(order_b,'closed_lost');
  IF (SELECT status FROM public.job_requests WHERE id=job_a)<>'closed_lost'
    OR (SELECT status FROM public.availability_requests WHERE id=ar_id)<>'closed' THEN RAISE EXCEPTION 'Final closure did not close job/ask'; END IF;
  BEGIN
    PERFORM public.close_order(order_a,'closed_lost');
    RAISE EXCEPTION 'Terminal order outcome was reclassified';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM='Terminal order outcome was reclassified' THEN RAISE; END IF; END;
  INSERT INTO public.job_requests DEFAULT VALUES RETURNING id INTO partial_job;
  INSERT INTO public.job_request_items(id,job_request_id,quantity) VALUES (203,partial_job,10);
  other_ar := public.create_availability_request(1,'[{"name":"Oak","quantity":4,"allocations":[{"job_request_item_id":203,"quantity":4}]}]');
  SELECT id INTO ar_line FROM public.availability_request_items WHERE availability_request_id=other_ar;
  UPDATE public.availability_request_items SET status='available',available_quantity=4 WHERE id=ar_line;
  partial_order := public.create_order(1,jsonb_build_array(jsonb_build_object('availability_request_item_id',ar_line,
    'allocations','[{"job_request_item_id":203,"quantity":4}]'::jsonb)),p_customer_confirmed=>true);
  PERFORM public.confirm_order(partial_order,1);
  PERFORM public.close_order(partial_order,'closed_won');
  IF (SELECT status FROM public.job_requests WHERE id=partial_job)<>'confirmed' THEN
    RAISE EXCEPTION 'Closing a partial order also closed unallocated demand'; END IF;
  -- Fulfil the remaining demand using rows from two separate availability asks.
  other_ar := public.create_availability_request(1,'[{"name":"Oak","quantity":3,"allocations":[{"job_request_item_id":203,"quantity":3}]}]');
  SELECT id INTO first_line FROM public.availability_request_items WHERE availability_request_id=other_ar;
  other_ar := public.create_availability_request(1,'[{"name":"Oak","quantity":3,"allocations":[{"job_request_item_id":203,"quantity":3}]}]');
  SELECT id INTO second_line FROM public.availability_request_items WHERE availability_request_id=other_ar;
  UPDATE public.availability_request_items SET status='can_order' WHERE id IN (first_line,second_line);
  merged_order := public.create_order(1,jsonb_build_array(
    jsonb_build_object('availability_request_item_id',first_line,'allocations','[{"job_request_item_id":203,"quantity":3}]'::jsonb),
    jsonb_build_object('availability_request_item_id',second_line,'allocations','[{"job_request_item_id":203,"quantity":3}]'::jsonb)),p_customer_confirmed=>true);
  IF (SELECT count(*) FROM public.order_items WHERE order_id=merged_order)<>2
    OR (SELECT status FROM public.job_requests WHERE id=partial_job)<>'committed' THEN
    RAISE EXCEPTION 'One order failed to combine multiple availability requests'; END IF;
  PERFORM public.confirm_order(merged_order,1);
  PERFORM public.close_order(merged_order,'closed_won');
  IF (SELECT status FROM public.job_requests WHERE id=partial_job)<>'closed_won' THEN
    RAISE EXCEPTION 'Completing remaining demand did not close the job'; END IF;
  SELECT id INTO ar_line FROM public.availability_request_items WHERE availability_request_id=ar_id;
  -- Deleting the compatibility anchor preserves the other job's request,
  -- answer and order evidence. Deleting the last job revokes any public link.
  UPDATE public.job_requests SET status='availability' WHERE id IN (job_a,job_b);
  DELETE FROM public.job_requests WHERE id=job_a;
  IF NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=ar_id AND status<>'closed' AND job_request_id IS NULL)
    OR NOT EXISTS (SELECT 1 FROM public.availability_request_item_jobs WHERE availability_request_item_id=ar_line AND job_request_item_id=202)
    OR NOT EXISTS (SELECT 1 FROM public.order_item_job_request_items a JOIN public.order_items oi ON oi.id=a.order_item_id WHERE oi.order_id=order_a AND a.job_request_item_id=202) THEN
    RAISE EXCEPTION 'Deleting one job destroyed shared evidence'; END IF;
  DELETE FROM public.job_requests WHERE id=job_b;
  IF NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=ar_id AND status='closed' AND public_token IS NULL)
    OR NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id=order_a AND quantity=7) THEN
    RAISE EXCEPTION 'Last job deletion failed to revoke link or preserve order snapshot'; END IF;
  IF has_function_privilege('anon','public.create_order(bigint,jsonb,text,date,text,boolean)','EXECUTE')
    OR has_function_privilege('authenticated','public.confirm_order(bigint,bigint,date,date)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.create_availability_request(bigint,jsonb,boolean,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Workflow RPC permissions are wrong'; END IF;
  IF (SELECT count(*) FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename IN
    ('availability_request_jobs','availability_request_item_jobs','orders','order_items','order_item_job_request_items'))<>5 THEN
    RAISE EXCEPTION 'Workflow tables missing from Realtime publication'; END IF;
END $$;
DROP TABLE workflow_history_before_0092;
