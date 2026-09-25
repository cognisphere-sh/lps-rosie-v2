DO $$
DECLARE b record; actual jsonb; expected jsonb; audience text; old_note text; new_note text;
BEGIN
 FOR b IN SELECT * FROM merged_before LOOP
  expected:=b.row;
  FOREACH audience IN ARRAY ARRAY['customer','supplier'] LOOP
   IF expected ? ('note_from_'||audience) THEN
    old_note:=expected->>('note_from_'||audience);
    new_note:=expected->>('note_for_'||audience);
    new_note:=CASE WHEN nullif(btrim(old_note),'') IS NULL THEN new_note
      WHEN nullif(btrim(new_note),'') IS NULL THEN old_note
      WHEN btrim(old_note)=btrim(new_note) THEN new_note ELSE old_note||E'\n\n'||new_note END;
    expected:=(expected-('note_from_'||audience))||jsonb_build_object('note_for_'||audience,new_note);
   END IF;
  END LOOP;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1',b.tbl) INTO actual USING b.id;
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Data changed unexpectedly: % %',b.tbl,b.id; END IF;
 END LOOP;
 IF EXISTS ((TABLE merged_history EXCEPT TABLE public.job_request_changelog) UNION ALL
  (TABLE public.job_request_changelog EXCEPT TABLE merged_history)) THEN RAISE EXCEPTION 'Audit history changed'; END IF;
 IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace AND prosrc ~ 'note_from_(customer|supplier)') THEN RAISE EXCEPTION 'Stale function reference'; END IF;
END $$;

DO $$
DECLARE request_id bigint; item_id bigint; backed bigint; direct_id bigint;
BEGIN
 request_id:=public.create_availability_request(1,'[{"name":"Oak","demanded_quantity":10,"note_for_supplier":"White flowers only","allocations":[{"job_request_item_id":6000,"quantity":10}]}]');
 SELECT id INTO item_id FROM public.availability_request_items WHERE availability_request_id=request_id;
 UPDATE public.availability_request_items SET note_for_supplier='White flowers only; single trunk' WHERE id=item_id;
 IF (SELECT status FROM public.availability_requests WHERE id=request_id) <> 'new' THEN RAISE EXCEPTION 'LPS note fabricated a response'; END IF;
 PERFORM public.answer_availability_request(request_id,1,item_id,'{"note_for_supplier":"White flowers only; single trunk. Ready Friday."}');
 IF (SELECT status FROM public.availability_requests WHERE id=request_id) <> 'processing' THEN RAISE EXCEPTION 'Note-only supplier reply did not start processing'; END IF;
 PERFORM public.answer_availability_request(request_id,1,item_id,'{"status":"available","available_quantity":"10","unit_price":"10"}');
 PERFORM public.submit_availability_request_note(request_id,1,'Pickup only. Ready Friday.');
 IF NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=request_id AND status='submitted' AND note_for_supplier='Pickup only. Ready Friday.') THEN RAISE EXCEPTION 'Shared header submission failed'; END IF;
 backed:=public.create_order(1,jsonb_build_array(jsonb_build_object('availability_request_item_id',item_id,'allocations',jsonb_build_array(jsonb_build_object('job_request_item_id',6000,'quantity',1)))),p_customer_confirmed=>true,p_note_for_customer=>'Red flowers only',p_note_for_supplier=>'Pickup only');
 IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id=backed AND note_for_supplier='White flowers only; single trunk. Ready Friday.' AND note_for_customer=E'White flowers\n\nCustomer line update') THEN RAISE EXCEPTION 'Order note snapshots failed'; END IF;
 direct_id:=public.create_direct_order(1,'[{"job_request_item_id":6000,"quantity":1}]',p_customer_confirmed=>true,p_note_for_customer=>'Red flowers only');
 IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id=direct_id AND note_for_customer=E'White flowers\n\nCustomer line update') THEN RAISE EXCEPTION 'Direct order snapshot failed'; END IF;
 PERFORM public.update_partner_order(backed,1,'{"status":"processing","fulfillment_date":"2026-10-01","note_for_supplier":"Pickup only; confirmed Thursday"}');
 IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id=backed AND note_for_supplier='Pickup only; confirmed Thursday') THEN RAISE EXCEPTION 'Shared supplier order update failed'; END IF;
 BEGIN
  PERFORM public.answer_availability_request(request_id,1,item_id,'{"note_from_supplier":"obsolete"}');
  RAISE EXCEPTION 'Legacy field accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Invalid answer field' THEN RAISE; END IF;
 END;
END $$;
SELECT 'Merged-note preservation and lifecycle checks passed';
