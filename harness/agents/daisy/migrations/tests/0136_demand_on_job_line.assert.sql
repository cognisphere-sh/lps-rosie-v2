-- Run after 0136 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0136 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE def_a bigint; ar_id bigint; s text; q numeric;
BEGIN
  -- Backfill: no candidate on a job line keeps a demand; job-less ones do.
  IF EXISTS (SELECT 1 FROM public.candidates WHERE job_request_item_id IS NOT NULL AND demanded_quantity IS NOT NULL) THEN
    RAISE EXCEPTION 'backfill left a job-line candidate demand';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.candidates WHERE job_request_item_id IS NULL AND demanded_quantity IS NOT NULL) THEN
    RAISE EXCEPTION 'job-less demand lost';
  END IF;

  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99360, 'Test 0136', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99360, 99360, 'Oak', '5 G', 5);
  SELECT default_candidate_id INTO def_a FROM public.job_request_items WHERE id = 99360;
  IF (SELECT demanded_quantity FROM public.candidates WHERE id = def_a) IS NOT NULL THEN RAISE EXCEPTION 'default copied demand'; END IF;
  IF (SELECT demand FROM public.job_lines WHERE id = 99360) IS DISTINCT FROM 5 THEN RAISE EXCEPTION 'view demand'; END IF;

  -- The reported case: Avail 5 -> 3 is Partial; Qty 5 -> 3 makes it Available.
  PERFORM public.update_job_line(99360, '{"status":"available"}');
  PERFORM public.update_job_line(99360, '{"available_quantity":"3"}');
  IF (SELECT status FROM public.job_lines WHERE id = 99360) IS DISTINCT FROM 'partial_qty' THEN RAISE EXCEPTION 'avail cut'; END IF;
  UPDATE public.job_request_items SET demanded_quantity = 3 WHERE id = 99360;
  SELECT status, available_quantity INTO s, q FROM public.job_lines WHERE id = 99360;
  IF s IS DISTINCT FROM 'available' OR q IS DISTINCT FROM 3 THEN RAISE EXCEPTION 'qty cut: % %', s, q; END IF;
  -- Partial again when the Qty rises above Avail on an asked candidate.
  INSERT INTO public.availability_requests(supplier_id, job_request_id, status) VALUES (1, 99360, 'new') RETURNING id INTO ar_id;
  PERFORM public.add_candidates_to_availability_request(ar_id, ARRAY[def_a]);
  IF (SELECT demanded_quantity FROM public.candidates WHERE id = def_a) IS NOT NULL THEN RAISE EXCEPTION 'ask copied demand'; END IF;
  UPDATE public.candidates SET status = 'available' WHERE id = def_a;
  IF (SELECT available_quantity FROM public.candidates WHERE id = def_a) IS DISTINCT FROM 3 THEN RAISE EXCEPTION 'available = line qty'; END IF;
  UPDATE public.availability_requests SET status = 'closed' WHERE id = ar_id;
  UPDATE public.job_request_items SET demanded_quantity = 8 WHERE id = 99360;
  IF (SELECT status FROM public.candidates WHERE id = def_a) IS DISTINCT FROM 'partial_qty' THEN RAISE EXCEPTION 'qty raised on closed AR'; END IF;
  UPDATE public.job_request_items SET demanded_quantity = 2 WHERE id = 99360;
  SELECT status, available_quantity INTO s, q FROM public.candidates WHERE id = def_a;
  IF s IS DISTINCT FROM 'available' OR q IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'qty lowered: % %', s, q; END IF;

  -- A job-line candidate cannot carry its own demand.
  BEGIN
    INSERT INTO public.candidates(supplier_id, job_request_item_id, name, demanded_quantity, is_original)
      VALUES (1, 99360, 'Oak', 4, false);
    RAISE EXCEPTION 'constraint missing';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE NOTICE '0136 asserts passed';
END $$;
