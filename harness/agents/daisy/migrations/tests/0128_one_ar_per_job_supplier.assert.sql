-- Run with 0128 inside a transaction and roll back. Fixture IDs are reserved here.
DO $test$
DECLARE first_ar bigint; other_ar bigint;
BEGIN
  INSERT INTO public.suppliers(id,name,head_branch_id,is_lps_partner) OVERRIDING SYSTEM VALUE
    VALUES (99280,'Test One AR 0128',99280,false),(99281,'Test Other AR 0128',99281,false);
  INSERT INTO public.job_requests(id,name,status) OVERRIDING SYSTEM VALUE
    VALUES (99280,'Test AR 0128','quoted'),(99281,'Test AR 0128 b','quoted');
  INSERT INTO public.job_request_items(id,job_request_id,name,size,demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99280,99280,'Oak','5 G',10),(99281,99280,'Elm','5 G',5),(99282,99281,'Ash','5 G',3);
  INSERT INTO public.candidates(id,supplier_id,job_request_item_id,name,size,demanded_quantity,is_original)
    OVERRIDING SYSTEM VALUE VALUES (99280,99280,99280,'Oak','5 G',10,true),(99281,99280,99281,'Elm','5 G',5,true),
      (99282,99281,99280,'Oak','5 G',10,false),(99283,99280,99282,'Ash','5 G',3,true);
  first_ar := public.create_availability_request(99280,ARRAY[99280::bigint]);
  BEGIN
    PERFORM public.create_availability_request(99280,ARRAY[99281::bigint]);
    RAISE EXCEPTION 'Second AR created for the same job and supplier';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE format('JR-99280 already has AR-%s%%', first_ar) THEN RAISE; END IF;
  END;
  -- Further asks go onto the existing AR.
  PERFORM public.add_candidates_to_availability_request(first_ar,ARRAY[99281::bigint]);
  IF (SELECT count(*) FROM public.candidates WHERE availability_request_id=first_ar) <> 2 THEN
    RAISE EXCEPTION 'Candidate not added to the existing AR'; END IF;
  -- Closing does not free the slot.
  UPDATE public.availability_requests SET status='closed' WHERE id=first_ar;
  BEGIN
    PERFORM public.create_availability_request(99280,ARRAY[99281::bigint]);
    RAISE EXCEPTION 'Closed AR allowed a second AR';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'JR-99280 already has AR-%' THEN RAISE; END IF; END;
  -- Other suppliers on the job, and the same supplier on another job, are unaffected.
  other_ar := public.create_availability_request(99281,ARRAY[99282::bigint]);
  PERFORM public.create_availability_request(99280,ARRAY[99283::bigint]);
  IF other_ar IS NULL THEN RAISE EXCEPTION 'Other supplier AR not created'; END IF;
  RAISE NOTICE '0128 one AR per job and supplier assertions passed';
END $test$;
