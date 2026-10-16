-- Run after 0139 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0139 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE def_a bigint; def_b bigint; ar_id bigint; sub_id bigint; s text; q numeric; ord bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM public.availability_requests WHERE job_request_id IS NULL) THEN RAISE EXCEPTION 'job-less AR left'; END IF;
  IF EXISTS (SELECT 1 FROM public.candidates WHERE job_request_item_id IS NULL) THEN RAISE EXCEPTION 'job-less candidate left'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.availability_requests_pre_0139)
    OR NOT EXISTS (SELECT 1 FROM public.candidates_pre_0139) THEN RAISE EXCEPTION 'backups empty'; END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = 'public.candidates'::regclass
      AND attname = 'demanded_quantity' AND NOT attisdropped) THEN RAISE EXCEPTION 'column still there'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'candidates_guard' AND tgrelid = 'public.candidates'::regclass) THEN
    RAISE EXCEPTION 'candidates_guard missing';
  END IF;

  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99390, 'Test 0139', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99390, 99390, 'Oak', '5 G', 5), (99391, 99390, 'Elm', '15 G', 4);
  SELECT default_candidate_id INTO def_a FROM public.job_request_items WHERE id = 99390;
  IF (SELECT demand FROM public.job_lines WHERE id = 99390) IS DISTINCT FROM 5 THEN RAISE EXCEPTION 'view demand'; END IF;

  -- update_job_line + candidate_status_quantity + the Qty re-check (0136).
  PERFORM public.update_job_line(99390, '{"status":"available"}');
  IF (SELECT available_quantity FROM public.job_lines WHERE id = 99390) IS DISTINCT FROM 5 THEN RAISE EXCEPTION 'available = qty'; END IF;
  PERFORM public.update_job_line(99390, '{"available_quantity":"3"}');
  IF (SELECT candidate_status FROM public.job_lines WHERE id = 99390) IS DISTINCT FROM 'partial_qty' THEN RAISE EXCEPTION 'avail cut'; END IF;
  UPDATE public.job_request_items SET demanded_quantity = 3 WHERE id = 99390;
  SELECT candidate_status, available_quantity INTO s, q FROM public.job_lines WHERE id = 99390;
  IF s IS DISTINCT FROM 'available' OR q IS DISTINCT FROM 3 THEN RAISE EXCEPTION 'qty cut: % %', s, q; END IF;

  -- answer_availability_request: Partial below the line's Qty; a typed
  -- substitute gets the line's Qty (apply_candidate_offer).
  ar_id := public.create_availability_request(1, ARRAY[def_a, (SELECT default_candidate_id FROM public.job_request_items WHERE id = 99391)]);
  UPDATE public.availability_requests SET status = 'new' WHERE id = ar_id;
  PERFORM public.answer_availability_request(ar_id, 1, def_a, '{"status":"available","available_quantity":"2","unit_price":"10"}');
  IF (SELECT status FROM public.candidates WHERE id = def_a) IS DISTINCT FROM 'partial_qty' THEN RAISE EXCEPTION 'answer partial'; END IF;
  PERFORM public.answer_availability_request(ar_id, 1, (SELECT default_candidate_id FROM public.job_request_items WHERE id = 99391),
    '{"status":"unavailable","offer_description":"30 G Elm"}');
  SELECT offered_candidate_id INTO sub_id FROM public.candidates WHERE id = (SELECT default_candidate_id FROM public.job_request_items WHERE id = 99391);
  SELECT status, available_quantity INTO s, q FROM public.candidates WHERE id = sub_id;
  IF s IS DISTINCT FROM 'diff_size_sub' OR q IS DISTINCT FROM 4 THEN RAISE EXCEPTION 'typed sub: % %', s, q; END IF;

  -- create_order: capped by the line's remaining demand.
  ord := public.create_order(1, jsonb_build_array(jsonb_build_object('candidate_id', def_a,
    'allocations', jsonb_build_array(jsonb_build_object('job_request_item_id', 99390, 'quantity', 2)))),
    NULL, NULL, NULL, true);
  IF ord IS NULL THEN RAISE EXCEPTION 'order'; END IF;
  BEGIN
    PERFORM public.create_order(1, jsonb_build_array(jsonb_build_object('candidate_id', def_a,
      'allocations', jsonb_build_array(jsonb_build_object('job_request_item_id', 99390, 'quantity', 2)))),
      NULL, NULL, NULL, true);
    RAISE EXCEPTION 'over-order allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'over-order allowed' THEN RAISE; END IF;
  END;

  -- A candidate needs a job line.
  BEGIN
    INSERT INTO public.candidates(supplier_id, name, is_original) VALUES (1, 'Loose', false);
    RAISE EXCEPTION 'job-less candidate allowed';
  EXCEPTION WHEN not_null_violation THEN NULL;
  END;

  -- A deleted line takes its asked candidates; the AR stays.
  SELECT default_candidate_id INTO def_b FROM public.job_request_items WHERE id = 99391;
  PERFORM public.delete_job_request_item(99390, 99391);
  IF EXISTS (SELECT 1 FROM public.candidates WHERE id IN (def_b, sub_id)) THEN RAISE EXCEPTION 'line delete kept candidates'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id = ar_id) THEN RAISE EXCEPTION 'line delete took the AR'; END IF;
  -- An AR alone still can't be deleted.
  BEGIN
    DELETE FROM public.availability_requests WHERE id = ar_id;
    RAISE EXCEPTION 'AR delete allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'AR delete allowed' THEN RAISE; END IF;
  END;
  -- A deleted job takes its ARs and their lines.
  PERFORM public.delete_job_request(99390);
  IF EXISTS (SELECT 1 FROM public.availability_requests WHERE id = ar_id)
    OR EXISTS (SELECT 1 FROM public.candidates WHERE id = def_a) THEN RAISE EXCEPTION 'job delete kept its AR'; END IF;
  IF (SELECT (deleted_counts->>'availabilityRequests')::int FROM public.deleted_job_threads
      WHERE agent = 'rosie' AND thread_id = 'jr-99390') IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'AR count'; END IF;
  RAISE NOTICE '0139 asserts passed';
END $$;
