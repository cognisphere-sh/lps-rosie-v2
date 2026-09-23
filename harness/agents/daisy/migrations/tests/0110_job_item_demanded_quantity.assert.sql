DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='job_request_items' AND column_name='quantity') THEN
    RAISE EXCEPTION 'Obsolete job demand column survived';
  END IF;
  IF EXISTS (SELECT 1 FROM job_items_before_0110 old FULL JOIN public.job_request_items ji USING(id)
    WHERE old.contents IS DISTINCT FROM to_jsonb(ji)) THEN
    RAISE EXCEPTION 'Rename changed saved values, including totals or null demand';
  END IF;
  IF EXISTS ((SELECT * FROM history_before_0110 EXCEPT SELECT * FROM public.job_request_changelog)
    UNION ALL (SELECT * FROM public.job_request_changelog EXCEPT SELECT * FROM history_before_0110)) THEN
    RAISE EXCEPTION 'Rename changed historical audit records';
  END IF;
  IF EXISTS (SELECT 1 FROM access_before_0110 old JOIN pg_proc p USING(oid)
    WHERE ROW(old.proacl,old.prosecdef,old.proconfig) IS DISTINCT FROM ROW(p.proacl,p.prosecdef,p.proconfig)) THEN
    RAISE EXCEPTION 'Function privileges or execution context changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.job_request_items'::regclass
    AND conname='job_request_items_demanded_quantity_check') THEN
    RAISE EXCEPTION 'Demand constraint not renamed';
  END IF;
END $$;

SET ROLE service_role;
SET app.actor='demand-rename-test';
DO $$
DECLARE direct_id bigint; request_id bigint; ar_item_id bigint; backed_id bigint; line_id bigint;
BEGIN
  UPDATE public.job_request_items SET demanded_quantity=12 WHERE id=5000;
  IF (SELECT total FROM public.job_request_items WHERE id=5000) IS DISTINCT FROM 150 THEN
    RAISE EXCEPTION 'Generated total did not follow demand edit';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.job_request_changelog WHERE item_id=5000 AND action='update'
    AND changes->'demanded_quantity'='{"old":10,"new":12}'::jsonb AND NOT changes ? 'quantity') THEN
    RAISE EXCEPTION 'New demand edits use the wrong audit key';
  END IF;
  BEGIN
    UPDATE public.job_request_items SET demanded_quantity=0 WHERE id=5000;
    RAISE EXCEPTION 'Zero customer demand accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE public.job_request_items SET demanded_quantity=-1 WHERE id=5000;
    RAISE EXCEPTION 'Negative customer demand accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE public.job_request_items SET demanded_quantity=NULL WHERE id=5001;
  IF (SELECT total FROM public.job_request_items WHERE id=5001) IS NOT NULL THEN
    RAISE EXCEPTION 'Unknown demand acquired a total';
  END IF;

  -- Both order paths consume the same job demand even when supply differs.
  direct_id:=public.create_direct_order(1,'[{"job_request_item_id":5000,"quantity":5}]',NULL,NULL,NULL,true);
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id=direct_id AND quantity=5
    AND total=62.50 AND notes='Single trunk') THEN
    RAISE EXCEPTION 'Direct order lost quantity, price or customer instructions';
  END IF;
  BEGIN
    PERFORM public.create_direct_order(1,'[{"job_request_item_id":5000,"quantity":8}]',NULL,NULL,NULL,true);
    RAISE EXCEPTION 'Direct order exceeded remaining customer demand';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Order exceeds remaining customer demand' THEN RAISE; END IF;
  END;
  request_id:=public.create_availability_request(1,
    '[{"name":"Oak","demanded_quantity":20,"allocations":[{"job_request_item_id":5000,"quantity":20}]}]');
  SELECT id INTO ar_item_id FROM public.availability_request_items WHERE availability_request_id=request_id;
  PERFORM public.answer_availability_request(request_id,1,ar_item_id,'{"status":"can_order","unit_price":"12.50"}');
  BEGIN
    PERFORM public.create_order(1,jsonb_build_array(jsonb_build_object('availability_request_item_id',ar_item_id,
      'allocations',jsonb_build_array(jsonb_build_object('job_request_item_id',5000,'quantity',8)))),NULL,NULL,NULL,true);
    RAISE EXCEPTION 'Availability-backed order exceeded remaining customer demand';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Order exceeds remaining customer demand' THEN RAISE; END IF;
  END;
  backed_id:=public.create_order(1,jsonb_build_array(jsonb_build_object('availability_request_item_id',ar_item_id,
    'allocations',jsonb_build_array(jsonb_build_object('job_request_item_id',5000,'quantity',7)))),NULL,NULL,NULL,true);
  PERFORM public.close_order(direct_id,'closed_won');
  IF (SELECT status FROM public.job_requests WHERE id=5000) <> 'committed' THEN
    RAISE EXCEPTION 'Job closed with an outstanding order';
  END IF;
  PERFORM public.close_order(backed_id,'closed_won');
  IF (SELECT status FROM public.job_requests WHERE id=5000) <> 'closed_won' THEN
    RAISE EXCEPTION 'Fully covered job did not close';
  END IF;
  direct_id:=public.create_direct_order(1,'[{"job_request_item_id":5001,"quantity":1}]',NULL,NULL,NULL,true);
  PERFORM public.close_order(direct_id,'closed_won');
  IF (SELECT status FROM public.job_requests WHERE id=5001) <> 'committed' THEN
    RAISE EXCEPTION 'Job with unknown demand closed as fully covered';
  END IF;
  direct_id:=public.create_direct_order(1,'[{"job_request_item_id":5002,"quantity":2.5}]',NULL,NULL,NULL,true);
  PERFORM public.close_order(direct_id,'closed_lost');
  IF (SELECT status FROM public.job_requests WHERE id=5002) <> 'closed_lost' THEN
    RAISE EXCEPTION 'Fractional demand or lost-order closure changed';
  END IF;
END $$;
RESET ROLE;
SELECT 'job demand rename, totals, audit, order limits and closure checks passed' AS result;
