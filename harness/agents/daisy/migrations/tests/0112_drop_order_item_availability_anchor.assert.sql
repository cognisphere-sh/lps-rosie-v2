DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
      AND table_name='order_items' AND column_name='availability_request_item_id') THEN
    RAISE EXCEPTION 'Order AR pointer still exists';
  END IF;
  IF EXISTS (
    WITH actual AS (
      SELECT 'orders' AS table_name,id,to_jsonb(o) AS contents FROM public.orders o
      UNION ALL SELECT 'order_items',id,to_jsonb(i) FROM public.order_items i
      UNION ALL SELECT 'job_requests',id,to_jsonb(j) FROM public.job_requests j
      UNION ALL SELECT 'job_request_items',id,to_jsonb(j) FROM public.job_request_items j
      UNION ALL SELECT 'availability_requests',id,to_jsonb(a) FROM public.availability_requests a
      UNION ALL SELECT 'availability_request_items',id,to_jsonb(a) FROM public.availability_request_items a
    ) SELECT 1 FROM actual FULL JOIN order_anchor_rows_before b USING(table_name,id)
      WHERE actual.contents IS DISTINCT FROM b.contents
  ) THEN RAISE EXCEPTION 'Retained business data changed'; END IF;
  IF EXISTS ((TABLE public.order_item_job_request_items EXCEPT TABLE order_anchor_allocations_before)
    UNION ALL (TABLE order_anchor_allocations_before EXCEPT TABLE public.order_item_job_request_items))
    OR EXISTS ((TABLE public.availability_request_item_jobs EXCEPT TABLE order_anchor_ar_links_before)
    UNION ALL (TABLE order_anchor_ar_links_before EXCEPT TABLE public.availability_request_item_jobs)) THEN
    RAISE EXCEPTION 'Allocations changed';
  END IF;
  IF EXISTS (SELECT 1 FROM order_anchor_functions_before b JOIN pg_proc p USING(oid)
    WHERE b.proacl IS DISTINCT FROM p.proacl OR b.prosecdef IS DISTINCT FROM p.prosecdef
      OR b.proconfig IS DISTINCT FROM p.proconfig
      OR (b.proname NOT IN ('create_order','create_direct_order','close_orphaned_availability_on_job_delete')
        AND b.prosrc IS DISTINCT FROM p.prosrc)) THEN
    RAISE EXCEPTION 'Unrelated functions or privileges changed';
  END IF;
END $$;

SET ROLE service_role;
DO $$
DECLARE ar_id bigint; ar_item_id bigint; created_id bigint; direct_id bigint;
  before_count bigint; delete_ar_id bigint; alternate_ar bigint; alternate_item bigint;
BEGIN
  INSERT INTO public.job_requests(id,status) VALUES (7000,'quoted'),(7001,'quoted'),(7002,'quoted');
  INSERT INTO public.job_request_items(id,job_request_id,name,demanded_quantity,unit_price,note_for_customer)
    VALUES (7000,7000,'Oak',20,12,'Customer condition'),(7001,7001,'Oak',20,12,NULL),
      (7002,7002,'Pine',5,20,NULL);
  ar_id := public.create_availability_request(1,'[{"name":"Oak","size":"15 G","demanded_quantity":20,"note_for_supplier":"Single trunk","allocations":[{"job_request_item_id":7000,"quantity":10},{"job_request_item_id":7001,"quantity":10}]}]');
  SELECT id INTO ar_item_id FROM public.availability_request_items WHERE availability_request_id=ar_id;
  PERFORM public.answer_availability_request(ar_id,1,ar_item_id,'{"status":"diff_size_qty_sub","available_quantity":"12","unit_price":"13","note_from_supplier":"Twelve ready"}',false);

  PERFORM public.answer_availability_request(ar_id,1,p_submit=>true);
  direct_id := public.create_direct_order(1,'[{"job_request_item_id":7000,"quantity":3},{"job_request_item_id":7001,"quantity":4}]',NULL,NULL,NULL,true);
  -- An order with another supplier consumes customer demand, not APS's supply.
  PERFORM public.create_direct_order(2,'[{"job_request_item_id":7000,"quantity":2}]',NULL,NULL,NULL,true);
  created_id := public.create_order(1,jsonb_build_array(jsonb_build_object('availability_request_item_id',ar_item_id,
    'allocations','[{"job_request_item_id":7000,"quantity":5}]'::jsonb)),NULL,NULL,NULL,true);
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id=created_id
    AND name='Oak' AND quantity=5 AND unit_price=13 AND note_for_supplier='Single trunk'
    AND note_from_supplier='Twelve ready' AND note_for_customer='Customer condition') THEN
    RAISE EXCEPTION 'Order snapshot or directional notes not preserved';
  END IF;
  SELECT count(*) INTO before_count FROM public.orders;
  BEGIN
    PERFORM public.create_order(1,jsonb_build_array(jsonb_build_object('availability_request_item_id',ar_item_id,
      'allocations','[{"job_request_item_id":7001,"quantity":1}]'::jsonb)),NULL,NULL,NULL,true);
    RAISE EXCEPTION 'Expected shared supply limit';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Order exceeds supplier available quantity' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.orders)<>before_count THEN RAISE EXCEPTION 'Failed order was not atomic'; END IF;

  PERFORM public.answer_availability_request(ar_id,1,ar_item_id,'{"available_quantity":"20"}',false);
  BEGIN
    PERFORM public.create_order(1,jsonb_build_array(jsonb_build_object('availability_request_item_id',ar_item_id,
      'allocations','[{"job_request_item_id":7000,"quantity":3}]'::jsonb)),NULL,NULL,NULL,true);
    RAISE EXCEPTION 'Expected supplier/job allocation limit';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Order exceeds remaining availability allocation' THEN RAISE; END IF;
  END;
  -- Another AR for the same supplier/job must count those same commitments.
  alternate_ar := public.create_availability_request(1,'[{"name":"Oak","demanded_quantity":10,"allocations":[{"job_request_item_id":7000,"quantity":10}]}]');
  SELECT id INTO alternate_item FROM public.availability_request_items WHERE availability_request_id=alternate_ar;
  PERFORM public.answer_availability_request(alternate_ar,1,alternate_item,'{"status":"can_order","available_quantity":"0"}',false);
  created_id := public.create_order(1,jsonb_build_array(jsonb_build_object('availability_request_item_id',alternate_item,
    'allocations','[{"job_request_item_id":7000,"quantity":2}]'::jsonb)),NULL,NULL,NULL,true);
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id=created_id AND status='need_to_order') THEN
    RAISE EXCEPTION 'Can Order procurement state changed';
  END IF;
  BEGIN
    PERFORM public.create_direct_order(2,'[{"job_request_item_id":7000,"quantity":9}]',NULL,NULL,NULL,true);
    RAISE EXCEPTION 'Expected global customer demand limit';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Order exceeds remaining customer demand' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.create_order(2,jsonb_build_array(jsonb_build_object('availability_request_item_id',ar_item_id,
      'allocations','[{"job_request_item_id":7001,"quantity":1}]'::jsonb)),NULL,NULL,NULL,true);
    RAISE EXCEPTION 'Expected supplier scope guard';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Availability request is closed or belongs to another supplier' THEN RAISE; END IF;
  END;

  -- Whole-job deletion must work after removing the pointer from its trigger.
  delete_ar_id := public.create_availability_request(1,'[{"name":"Pine","demanded_quantity":5,"allocations":[{"job_request_item_id":7002,"quantity":5}]}]');
  PERFORM public.create_direct_order(1,'[{"job_request_item_id":7002,"quantity":1}]',NULL,NULL,NULL,true);
  DELETE FROM public.job_requests WHERE id=7002;
  IF NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=delete_ar_id AND NOT is_active) THEN
    RAISE EXCEPTION 'Exclusive AR not retired on job deletion';
  END IF;
  DELETE FROM public.job_requests WHERE id=7000;
  IF NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=ar_id AND is_active)
    OR NOT EXISTS (SELECT 1 FROM public.orders WHERE id=direct_id) THEN
    RAISE EXCEPTION 'Shared AR/order removed while another job remains';
  END IF;
END $$;
RESET ROLE;

DO $$
BEGIN
  IF has_function_privilege('anon','public.create_order(bigint,jsonb,text,date,text,boolean,text,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.create_direct_order(bigint,jsonb,text,date,text,boolean,text,text)','EXECUTE') THEN
    RAISE EXCEPTION 'Order creation exposed to public roles';
  END IF;
END $$;
