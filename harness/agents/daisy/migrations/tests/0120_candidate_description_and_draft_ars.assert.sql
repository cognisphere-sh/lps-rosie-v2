DO $$
DECLARE ar1 bigint; ar2 bigint;
BEGIN
  -- Backfill: description from size + name; asked and first unasked are original.
  IF EXISTS (SELECT 1 FROM public.candidates WHERE description IS DISTINCT FROM
      nullif(concat_ws(' ', nullif(btrim(size), ''), btrim(name)), '')) THEN
    RAISE EXCEPTION 'Description backfill wrong'; END IF;
  IF EXISTS (SELECT 1 FROM public.candidates WHERE availability_request_id IS NOT NULL AND NOT is_original)
    OR NOT (SELECT is_original FROM public.candidates WHERE id = 9500)
    OR (SELECT is_original FROM public.candidates WHERE id = 9501) THEN
    RAISE EXCEPTION 'is_original backfill wrong'; END IF;

  -- A new AR is a draft: the supplier cannot answer it and the job has not moved.
  ar1 := public.create_availability_request(1, ARRAY[9500::bigint]);
  IF (SELECT status FROM public.availability_requests WHERE id = ar1) <> 'draft' THEN RAISE EXCEPTION 'Not a draft'; END IF;
  IF (SELECT status FROM public.job_requests WHERE id = 9500) <> 'quoted' THEN RAISE EXCEPTION 'Draft advanced the job'; END IF;
  BEGIN
    PERFORM public.answer_availability_request(ar1, 1, 9500, '{"status":"available"}');
    RAISE EXCEPTION 'answered a draft';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'This request is closed, deleted or unavailable' THEN RAISE; END IF;
  END;
  -- Dragging another candidate joins the draft; LPS edits don't mark it processing.
  IF public.request_candidate_availability(9501) <> ar1 THEN RAISE EXCEPTION 'Did not join the draft'; END IF;
  UPDATE public.candidates SET unit_price = 25 WHERE id = 9501;
  IF (SELECT status FROM public.availability_requests WHERE id = ar1) <> 'draft' THEN RAISE EXCEPTION 'Edit left draft'; END IF;

  -- Send: New, the job advances (Partner), and it can't be sent twice.
  PERFORM public.send_availability_request(ar1);
  IF (SELECT status FROM public.availability_requests WHERE id = ar1) <> 'new' THEN RAISE EXCEPTION 'Not sent'; END IF;
  IF (SELECT status FROM public.job_requests WHERE id = 9500) <> 'availability' THEN RAISE EXCEPTION 'Send did not advance the job'; END IF;
  IF (SELECT public_token FROM public.availability_requests WHERE id = ar1) IS NOT NULL THEN RAISE EXCEPTION 'Partner got a link'; END IF;
  BEGIN
    PERFORM public.send_availability_request(ar1);
    RAISE EXCEPTION 'sent twice';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Only a draft request can be sent' THEN RAISE; END IF;
  END;
  PERFORM public.answer_availability_request(ar1, 1, 9500, '{"status":"available","available_quantity":"4"}');

  -- Non-partner: a draft's link is refused until Send issues one.
  INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name) OVERRIDING SYSTEM VALUE VALUES (9502, 9002, 9500, 'Oak');
  ar2 := public.create_availability_request(9002, ARRAY[9502::bigint], false, '00000000-0000-0000-0000-000000009502');
  BEGIN
    PERFORM public.answer_public_availability('00000000-0000-0000-0000-000000009502', 9502, '{"status":"available"}');
    RAISE EXCEPTION 'public link answered a draft';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'This link is no longer available' THEN RAISE; END IF;
  END;
  UPDATE public.availability_requests SET public_token = NULL WHERE id = ar2;
  PERFORM public.send_availability_request(ar2);
  IF (SELECT public_token FROM public.availability_requests WHERE id = ar2) IS NULL THEN RAISE EXCEPTION 'Non-partner got no link'; END IF;

  -- An empty draft cannot be sent.
  INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name) OVERRIDING SYSTEM VALUE VALUES (9503, 1, 9500, 'Oak');
  ar2 := public.create_availability_request(1, ARRAY[9503::bigint]);
  PERFORM public.delete_candidate(9503);
  BEGIN
    PERFORM public.send_availability_request(ar2);
    RAISE EXCEPTION 'sent an empty draft';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Add at least one candidate before sending' THEN RAISE; END IF;
  END;
END $$;
