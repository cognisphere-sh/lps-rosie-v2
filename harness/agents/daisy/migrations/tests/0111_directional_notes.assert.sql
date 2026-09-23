DO $$
DECLARE before_row record; expected jsonb; actual jsonb; old_key text; new_key text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name IN ('job_requests','job_request_items','availability_requests','availability_request_items','orders','order_items')
    AND column_name IN ('customer_notes','sourcing_notes','external_notes','lps_notes','supplier_notes','notes')) THEN
    RAISE EXCEPTION 'Redundant note columns survived';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='order_items'
    AND column_name='note_from_customer') THEN RAISE EXCEPTION 'Order items must not have customer-origin notes'; END IF;
  FOR before_row IN SELECT * FROM note_rows_before LOOP
    expected:=before_row.contents;
    FOREACH old_key IN ARRAY ARRAY['customer_notes','sourcing_notes','external_notes','lps_notes','supplier_notes'] LOOP
      new_key:=CASE old_key WHEN 'customer_notes' THEN 'note_from_customer' WHEN 'sourcing_notes' THEN 'note_internal'
        WHEN 'external_notes' THEN 'note_for_customer' WHEN 'lps_notes' THEN 'note_for_supplier' ELSE 'note_from_supplier' END;
      IF expected ? old_key THEN expected:=(expected-old_key)||jsonb_build_object(new_key,expected->old_key); END IF;
    END LOOP;
    IF before_row.table_name='orders' THEN
      expected:=(expected-'notes')||jsonb_build_object('note_for_supplier',expected->'notes','note_from_customer',NULL,'note_for_customer',NULL);
    ELSIF before_row.table_name='order_items' THEN
      expected:=(expected-'notes')||jsonb_build_object('note_for_supplier',NULL,
        'note_from_supplier',CASE WHEN expected->>'availability_request_item_id' IS NOT NULL THEN expected->'notes' ELSE NULL END,
        'note_for_customer',CASE WHEN expected->>'availability_request_item_id' IS NULL THEN expected->'notes' ELSE NULL END);
    END IF;
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1',before_row.table_name) INTO actual USING before_row.id;
    IF expected IS DISTINCT FROM actual THEN RAISE EXCEPTION 'Data changed for % id %',before_row.table_name,before_row.id; END IF;
  END LOOP;
  IF EXISTS ((SELECT * FROM note_history_before EXCEPT SELECT * FROM public.job_request_changelog)
    UNION ALL (SELECT * FROM public.job_request_changelog EXCEPT SELECT * FROM note_history_before)) THEN
    RAISE EXCEPTION 'Historical audit changed';
  END IF;
  IF EXISTS (SELECT 1 FROM note_functions_before b JOIN pg_proc p ON p.proname=b.proname
    AND p.pronamespace='public'::regnamespace WHERE ROW(b.proacl,b.prosecdef,b.proconfig) IS DISTINCT FROM ROW(p.proacl,p.prosecdef,p.proconfig)) THEN
    RAISE EXCEPTION 'Function privileges or execution context changed';
  END IF;
  IF EXISTS (SELECT 1 FROM note_functions_before b JOIN pg_proc p ON p.proname=b.proname AND p.pronamespace='public'::regnamespace
    WHERE b.proname NOT IN ('create_availability_request','process_availability_answer','answer_availability_request',
      'submit_availability_request_note','update_partner_order','create_direct_order','create_order') AND b.prosrc IS DISTINCT FROM p.prosrc) THEN
    RAISE EXCEPTION 'Unrelated function changed';
  END IF;
END $$;
SET ROLE service_role;
DO $$
DECLARE ids record; ar_id bigint; ar_line bigint; direct_id bigint; backed_id bigint; saved public.order_items;
BEGIN
  SELECT * INTO ids FROM note_test_ids;
  UPDATE public.job_request_items SET note_internal='Updated private progress',note_for_customer='Revised customer update' WHERE id=6000;
  IF NOT EXISTS (SELECT 1 FROM public.job_request_changelog WHERE item_id=6000 AND action='update'
    AND changes ? 'note_internal' AND changes ? 'note_for_customer' AND NOT changes ? 'sourcing_notes') THEN
    RAISE EXCEPTION 'New audit keys are incorrect'; END IF;
  ar_id:=public.create_availability_request(1,'[{"name":"Oak","demanded_quantity":1,"note_for_supplier":"Named variety only","allocations":[{"job_request_item_id":6000,"quantity":1}]}]');
  SELECT id INTO ar_line FROM public.availability_request_items WHERE availability_request_id=ar_id;
  PERFORM public.answer_availability_request(ar_id,1,ar_line,'{"status":"available","note_from_supplier":"White available"}');
  IF NOT EXISTS (SELECT 1 FROM public.availability_request_items WHERE id=ar_line AND note_from_supplier='White available'
    AND note_for_supplier='Named variety only') THEN RAISE EXCEPTION 'AR note ownership changed'; END IF;
  BEGIN
    PERFORM public.answer_availability_request(ar_id,1,ar_line,'{"note_for_supplier":"supplier overwrite"}');
    RAISE EXCEPTION 'Supplier overwrote outgoing note';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Invalid answer field' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.answer_availability_request(ar_id,1,ar_line,'{"supplier_notes":"obsolete"}');
    RAISE EXCEPTION 'Obsolete supplier key accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Invalid answer field' THEN RAISE; END IF; END;
  UPDATE public.availability_requests SET public_token=gen_random_uuid() WHERE id=ar_id;
  PERFORM public.answer_public_availability((SELECT public_token FROM public.availability_requests WHERE id=ar_id),
    ar_line,'{"note_from_supplier":"Updated public response"}');
  PERFORM public.submit_availability_request_note(ar_id,1,'Header supplier response');
  IF NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=ar_id AND status='submitted'
    AND note_from_supplier='Header supplier response') THEN RAISE EXCEPTION 'AR header submission failed'; END IF;
  PERFORM public.answer_availability_request(ar_id,1,ar_line,'{"note_from_supplier":""}');
  IF (SELECT note_from_supplier FROM public.availability_request_items WHERE id=ar_line) IS NOT NULL THEN
    RAISE EXCEPTION 'Blank note did not clear'; END IF;
  direct_id:=public.create_direct_order(1,'[{"job_request_item_id":6000,"quantity":1}]',NULL,NULL,'Direct supplier instruction',true,'Customer header','LPS customer header');
  SELECT * INTO saved FROM public.order_items WHERE order_id=direct_id;
  IF saved.note_for_customer IS DISTINCT FROM 'Revised customer update'
    OR saved.note_from_supplier IS NOT NULL OR saved.note_for_supplier IS NOT NULL THEN RAISE EXCEPTION 'Direct note audience mixed'; END IF;
  backed_id:=public.create_order(1,jsonb_build_array(jsonb_build_object('availability_request_item_id',ids.item_id,
    'allocations',jsonb_build_array(jsonb_build_object('job_request_item_id',6000,'quantity',1),
      jsonb_build_object('job_request_item_id',6001,'quantity',1)))),NULL,NULL,'Backed supplier instruction',true,'Customer header','LPS customer header');
  SELECT * INTO saved FROM public.order_items WHERE order_id=backed_id;
  IF saved.note_from_supplier IS DISTINCT FROM 'Ready Friday' OR saved.note_for_supplier IS DISTINCT FROM 'Please check white flowers'

    OR saved.note_for_customer IS DISTINCT FROM E'Revised customer update\n\nSecond customer update' THEN
    RAISE EXCEPTION 'Combined order note snapshots are incorrect'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id=backed_id AND note_from_customer='Customer header'
    AND note_for_customer='LPS customer header' AND note_for_supplier='Backed supplier instruction') THEN
    RAISE EXCEPTION 'Header note fields lost'; END IF;
  PERFORM public.update_partner_order(backed_id,1,'{"status":"processing","fulfillment_date":"2026-10-01","note_from_supplier":"Supplier commitment"}');
  IF (SELECT note_from_supplier FROM public.orders WHERE id=backed_id) IS DISTINCT FROM 'Supplier commitment' THEN
    RAISE EXCEPTION 'Order supplier response lost'; END IF;
  BEGIN
    PERFORM public.update_partner_order(backed_id,1,'{"note_for_customer":"supplier overwrite"}');
    RAISE EXCEPTION 'Supplier overwrote customer note';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Unsupported order update' THEN RAISE; END IF; END;
  PERFORM public.update_partner_order(backed_id,1,'{"note_from_supplier":null}');
  IF (SELECT note_from_supplier FROM public.orders WHERE id=backed_id) IS NOT NULL THEN RAISE EXCEPTION 'Order note did not clear'; END IF;
END $$;
RESET ROLE;
SELECT 'Directional notes: preservation, audit, permissions, AR/public answers and order snapshots passed' AS result;
