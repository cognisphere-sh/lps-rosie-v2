-- Run with 0127 inside a transaction and roll back. Fixture IDs are reserved here.
DO $test$
DECLARE request_id bigint := 99270; old_token uuid; new_token uuid; current_status text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='availability_requests' AND column_name='is_active') THEN RAISE EXCEPTION 'AR delete flag remains'; END IF;
  INSERT INTO public.suppliers(id,name,head_branch_id,is_lps_partner) OVERRIDING SYSTEM VALUE
    VALUES (99270,'Test AR Retention 0127',99270,false);
  INSERT INTO public.job_requests(id,name,status) OVERRIDING SYSTEM VALUE VALUES (99270,'Test AR 0127','quoted');
  INSERT INTO public.job_request_items(id,job_request_id,name,size,demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99270,99270,'Oak','5 G',10),(99271,99270,'Elm','5 G',5);
  INSERT INTO public.candidates(id,supplier_id,job_request_item_id,name,size,demanded_quantity,is_original)
    OVERRIDING SYSTEM VALUE VALUES (99270,99270,99270,'Oak','5 G',10,true),(99271,99270,99271,'Elm','5 G',5,true);
  INSERT INTO public.availability_requests(id,supplier_id,job_request_id,status) OVERRIDING SYSTEM VALUE
    VALUES (request_id,99270,99270,'draft');
  BEGIN
    PERFORM public.send_availability_request(request_id);
    RAISE EXCEPTION 'Empty AR published';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Add at least one candidate%' THEN RAISE; END IF; END;
  PERFORM public.add_candidates_to_availability_request(request_id,ARRAY[99270::bigint]);
  PERFORM public.edit_availability_request(request_id,99270,99270,'{"status":"available","available_quantity":"10","unit_price":"25"}');
  IF (SELECT status FROM public.availability_requests WHERE id=request_id) <> 'draft' THEN RAISE EXCEPTION 'Draft edit published'; END IF;
  BEGIN
    PERFORM public.answer_availability_request(request_id,99270,99270,'{"unit_price":"30"}');
    RAISE EXCEPTION 'Supplier answered Draft';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'This request is closed%' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.availability_requests SET status='submitted' WHERE id=request_id;
    RAISE EXCEPTION 'Draft submitted without publishing';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Publish the draft%' THEN RAISE; END IF; END;
  PERFORM public.send_availability_request(request_id);
  SELECT public_token INTO old_token FROM public.availability_requests WHERE id=request_id;
  IF old_token IS NULL OR (SELECT status FROM public.availability_requests WHERE id=request_id) <> 'new' THEN RAISE EXCEPTION 'Publish failed'; END IF;
  PERFORM public.answer_public_availability(old_token,99270,'{"unit_price":"31"}');
  IF (SELECT status FROM public.availability_requests WHERE id=request_id) <> 'processing' THEN RAISE EXCEPTION 'Supplier answer not Processing'; END IF;
  PERFORM public.answer_availability_request(request_id,99270,p_submit=>true);
  IF (SELECT status FROM public.availability_requests WHERE id=request_id) <> 'submitted' THEN RAISE EXCEPTION 'Submission reset'; END IF;
  UPDATE public.availability_requests SET status='draft' WHERE id=request_id;
  IF (SELECT public_token FROM public.availability_requests WHERE id=request_id) IS NOT NULL THEN RAISE EXCEPTION 'Draft token retained'; END IF;
  BEGIN
    PERFORM public.answer_public_availability(old_token,99270,'{"unit_price":"32"}');
    RAISE EXCEPTION 'Old link answered Draft';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'This link is no longer available%' THEN RAISE; END IF; END;
  UPDATE public.candidates SET name='Live Oak',note_for_supplier='Keep shaded' WHERE id=99270;
  IF (SELECT status FROM public.availability_requests WHERE id=request_id) <> 'draft' THEN RAISE EXCEPTION 'Draft details published'; END IF;
  PERFORM public.send_availability_request(request_id);
  SELECT public_token INTO new_token FROM public.availability_requests WHERE id=request_id;
  IF new_token IS NULL OR new_token=old_token THEN RAISE EXCEPTION 'Republish reused revoked link'; END IF;
  IF (SELECT unit_price FROM public.candidates WHERE id=99270) <> 31 THEN RAISE EXCEPTION 'Answers lost'; END IF;
  PERFORM public.select_candidate(99270,99270);
  PERFORM public.submit_availability_request_note(request_id,99270,'Ready Friday');
  IF (SELECT status FROM public.availability_requests WHERE id=request_id) <> 'submitted' THEN RAISE EXCEPTION 'Supplier note reset submission'; END IF;
  UPDATE public.candidates SET note_for_supplier='New instruction' WHERE id=99270;
  IF (SELECT status FROM public.availability_requests WHERE id=request_id) <> 'new'
    OR (SELECT submitted_at FROM public.availability_requests WHERE id=request_id) IS NOT NULL THEN RAISE EXCEPTION 'Line note did not reset to New'; END IF;
  UPDATE public.availability_requests SET status='submitted' WHERE id=request_id;
  UPDATE public.availability_requests SET note_for_supplier='New header instruction' WHERE id=request_id;
  IF (SELECT status FROM public.availability_requests WHERE id=request_id) <> 'new' THEN RAISE EXCEPTION 'Header note did not reset'; END IF;
  UPDATE public.availability_requests SET status='submitted' WHERE id=request_id;
  PERFORM public.edit_availability_request(request_id,99270,99270,'{"unit_price":"33"}');
  IF (SELECT status FROM public.availability_requests WHERE id=request_id) <> 'new' THEN RAISE EXCEPTION 'Admin answer did not reset'; END IF;
  UPDATE public.availability_requests SET status='submitted' WHERE id=request_id;
  PERFORM public.add_candidates_to_availability_request(request_id,ARRAY[99271::bigint]);
  IF (SELECT status FROM public.availability_requests WHERE id=request_id) <> 'new' THEN RAISE EXCEPTION 'Added line did not reset'; END IF;
  UPDATE public.availability_requests SET status='submitted' WHERE id=request_id;
  PERFORM public.delete_candidate(99271);
  IF (SELECT status FROM public.availability_requests WHERE id=request_id) <> 'new' THEN RAISE EXCEPTION 'Removed line did not reset'; END IF;
  UPDATE public.availability_requests SET status='submitted' WHERE id=request_id;
  UPDATE public.job_request_items SET unit_price=34 WHERE id=99270;
  IF (SELECT status FROM public.availability_requests WHERE id=request_id) <> 'new' THEN RAISE EXCEPTION 'Selected line edit did not reset'; END IF;
  BEGIN
    DELETE FROM public.availability_requests WHERE id=request_id;
    RAISE EXCEPTION 'AR deleted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Availability requests cannot be deleted%' THEN RAISE; END IF; END;
  DELETE FROM public.job_requests WHERE id=99270;
  IF NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=request_id AND status='closed' AND job_request_id IS NULL)
    OR NOT EXISTS (SELECT 1 FROM public.candidates WHERE id=99270 AND availability_request_id=request_id) THEN RAISE EXCEPTION 'Job deletion lost AR history'; END IF;
  RAISE NOTICE '0127 AR publish and retention assertions passed';
END $test$;
