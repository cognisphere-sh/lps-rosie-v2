DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='availability_request_items' AND column_name IN ('quantity','notes','job_request_item_id')) THEN
    RAISE EXCEPTION 'Old availability item columns survived';
  END IF;
  IF EXISTS (SELECT 1 FROM availability_items_before_0107 old
    FULL JOIN public.availability_request_items ai USING(id)
    WHERE old.contents IS DISTINCT FROM (to_jsonb(ai)-'demanded_quantity'-'supplier_notes'
      || jsonb_build_object('quantity',ai.demanded_quantity,'notes',ai.supplier_notes))) THEN
    RAISE EXCEPTION 'Column rename changed existing data';
  END IF;
  IF EXISTS ((SELECT * FROM availability_allocations_before_0107 EXCEPT SELECT * FROM public.availability_request_item_jobs)
    UNION ALL (SELECT * FROM public.availability_request_item_jobs EXCEPT SELECT * FROM availability_allocations_before_0107)) THEN
    RAISE EXCEPTION 'Per-job allocation quantities changed';
  END IF;
END $$;

SET ROLE service_role;
DO $$
DECLARE request_id bigint; line_id bigint; shared_id bigint; created_order_id bigint; token uuid:=gen_random_uuid();
BEGIN
  request_id:=public.create_availability_request(1,
    '[{"name":"Oak","demanded_quantity":6,"lps_notes":"Named variety; single trunk only.","allocations":[{"job_request_item_id":3000,"quantity":6}]}]',false,token);
  SELECT id INTO line_id FROM public.availability_request_items WHERE availability_request_id=request_id;
  IF NOT EXISTS (SELECT 1 FROM public.availability_request_items WHERE id=line_id
    AND demanded_quantity=6 AND supplier_notes IS NULL AND lps_notes='Named variety; single trunk only.') THEN
    RAISE EXCEPTION 'Creation mixed demand or note ownership';
  END IF;
  UPDATE public.availability_request_items SET lps_notes='Customer requests named variety; deliver Friday.' WHERE id=line_id;
  IF (SELECT status FROM public.availability_requests WHERE id=request_id)<>'new' THEN
    RAISE EXCEPTION 'LPS instructions were treated as a supplier answer';
  END IF;
  UPDATE public.availability_request_items SET demanded_quantity=5 WHERE id=line_id;
  IF (SELECT quantity FROM public.availability_request_item_jobs WHERE availability_request_item_id=line_id)<>5 THEN
    RAISE EXCEPTION 'Demand correction failed to sync the sole allocation';
  END IF;
  PERFORM public.answer_public_availability(token,line_id,
    '{"supplier_notes":"Ready Friday; single trunk confirmed.","status":"available","available_quantity":"5","unit_price":"12.50"}');
  IF NOT EXISTS (SELECT 1 FROM public.availability_request_items WHERE id=line_id
    AND demanded_quantity=5 AND supplier_notes='Ready Friday; single trunk confirmed.'
    AND lps_notes='Customer requests named variety; deliver Friday.')
    OR (SELECT status FROM public.availability_requests WHERE id=request_id)<>'processing' THEN
    RAISE EXCEPTION 'Public supplier response lost or overwrote LPS instructions';
  END IF;
  BEGIN
    PERFORM public.answer_availability_request(request_id,1,line_id,'{"lps_notes":"Overwrite Chris"}');
    RAISE EXCEPTION 'Supplier changed LPS instructions';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Invalid answer field' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.answer_availability_request(request_id,1,line_id,'{"notes":"Legacy field"}');
    RAISE EXCEPTION 'Ambiguous old note key accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Invalid answer field' THEN RAISE; END IF;
  END;
  PERFORM public.answer_availability_request(request_id,1,NULL,NULL,true);
  UPDATE public.availability_request_items SET supplier_notes='Ready Friday; call before pickup.' WHERE id=line_id;
  IF (SELECT status FROM public.availability_requests WHERE id=request_id)<>'processing' THEN
    RAISE EXCEPTION 'Supplier-note correction did not require resubmission';
  END IF;
  created_order_id:=public.create_order(1,jsonb_build_array(jsonb_build_object('availability_request_item_id',line_id,
    'allocations',jsonb_build_array(jsonb_build_object('job_request_item_id',3000,'quantity',2)))),NULL,NULL,NULL,true);
  IF NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id=created_order_id
    AND oi.notes='Ready Friday; call before pickup.' AND oi.quantity=2) THEN
    RAISE EXCEPTION 'Order did not preserve supplier response notes';
  END IF;
  BEGIN
    PERFORM public.create_order(1,jsonb_build_array(jsonb_build_object('availability_request_item_id',line_id,
      'allocations',jsonb_build_array(jsonb_build_object('job_request_item_id',3000,'quantity',4)))),NULL,NULL,NULL,true);
    RAISE EXCEPTION 'Order exceeded remaining demanded quantity';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Order exceeds remaining requested quantity' THEN RAISE; END IF;
  END;
  PERFORM public.answer_availability_request(request_id,1,line_id,'{"supplier_notes":" "}');
  IF (SELECT supplier_notes FROM public.availability_request_items WHERE id=line_id) IS NOT NULL THEN
    RAISE EXCEPTION 'Clearing a supplier note failed';
  END IF;
  shared_id:=public.create_availability_request(1,
    '[{"name":"Shared oak","demanded_quantity":10,"allocations":[{"job_request_item_id":3000,"quantity":6},{"job_request_item_id":3001,"quantity":4}]}]');
  BEGIN
    UPDATE public.availability_request_items SET demanded_quantity=11 WHERE availability_request_id=shared_id;
    RAISE EXCEPTION 'Shared demand changed without allocation edits';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Combined request quantities require explicit allocation edits%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.create_availability_request(1,
      '[{"name":"Invalid","demanded_quantity":7,"allocations":[{"job_request_item_id":3000,"quantity":6}]}]');
    RAISE EXCEPTION 'Request accepted mismatched demanded quantity';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Allocations must equal requested quantity' THEN RAISE; END IF;
  END;
  PERFORM public.create_availability_request(1,
    '[{"name":"Unknown","demanded_quantity":null,"allocations":[{"job_request_item_id":3003,"quantity":null}]}]');
  UPDATE public.availability_requests SET status='hidden' WHERE id=request_id;
  BEGIN
    PERFORM public.answer_availability_request(request_id,1,line_id,'{"supplier_notes":"Hidden edit"}');
    RAISE EXCEPTION 'Hidden request accepted a supplier note';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'This request is closed or hidden or unavailable' THEN RAISE; END IF;
  END;
END $$;
RESET ROLE;
SELECT 'availability demand and note ownership checks passed' AS result;
