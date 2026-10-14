-- Run after 0134 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0134 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE def_a bigint; q numeric;
BEGIN
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99340, 'Test 0134', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99340, 99340, 'Oak', '5 G', 10);
  SELECT default_candidate_id INTO def_a FROM public.job_request_items WHERE id = 99340;

  -- Can Order, Arriving Soon, Available: avail = demand.
  PERFORM public.update_job_line(99340, '{"status":"partial_qty","available_quantity":"4"}');
  PERFORM public.update_job_line(99340, '{"status":"need_to_order"}');
  SELECT available_quantity INTO q FROM public.candidates WHERE id = def_a;
  IF q IS DISTINCT FROM 10 THEN RAISE EXCEPTION 'can order: %', q; END IF;
  PERFORM public.update_job_line(99340, '{"status":"partial_qty","available_quantity":"4"}');
  PERFORM public.update_job_line(99340, '{"status":"arriving_soon"}');
  SELECT available_quantity INTO q FROM public.candidates WHERE id = def_a;
  IF q IS DISTINCT FROM 10 THEN RAISE EXCEPTION 'arriving soon: %', q; END IF;
  PERFORM public.update_job_line(99340, '{"status":"partial_qty","available_quantity":"4"}');
  PERFORM public.update_job_line(99340, '{"status":"available"}');
  IF (SELECT available_quantity FROM public.job_lines WHERE id = 99340) IS DISTINCT FROM 10 THEN RAISE EXCEPTION 'available'; END IF;
  -- Partial Qty keeps its quantity; Unavailable = 0; Pending = blank.
  PERFORM public.update_job_line(99340, '{"available_quantity":"6"}');
  PERFORM public.update_job_line(99340, '{"status":"partial_qty"}');
  SELECT available_quantity INTO q FROM public.candidates WHERE id = def_a;
  IF q IS DISTINCT FROM 6 THEN RAISE EXCEPTION 'partial kept: %', q; END IF;
  PERFORM public.update_job_line(99340, '{"status":"unavailable"}');
  IF (SELECT available_quantity FROM public.candidates WHERE id = def_a) IS DISTINCT FROM 0 THEN RAISE EXCEPTION 'unavailable'; END IF;
  PERFORM public.update_job_line(99340, '{"status":"pending","available_quantity":"3"}');
  IF (SELECT available_quantity FROM public.candidates WHERE id = def_a) IS NOT NULL THEN RAISE EXCEPTION 'pending'; END IF;
  -- A quantity sent with the status wins.
  PERFORM public.update_job_line(99340, '{"status":"need_to_order","available_quantity":"7"}');
  IF (SELECT available_quantity FROM public.candidates WHERE id = def_a) IS DISTINCT FROM 7 THEN RAISE EXCEPTION 'given qty'; END IF;
  PERFORM public.update_job_line(99340, '{"status":"available","available_quantity":"3"}');
  IF (SELECT status FROM public.candidates WHERE id = def_a) IS DISTINCT FROM 'partial_qty' THEN RAISE EXCEPTION 'available below demand'; END IF;
  -- A substitute set to Diff Sz/Sub: demand.
  INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name, size, unit_price, description, is_original)
    OVERRIDING SYSTEM VALUE VALUES (99340, 1, 99340, 'Oak', '7 G', 30, '7 G Oak', false);
  UPDATE public.candidates SET status = 'partial_qty', available_quantity = 2 WHERE id = 99340;
  PERFORM public.select_candidate(99340, 99340);
  PERFORM public.update_job_line(99340, '{"status":"diff_size_sub"}');
  IF (SELECT available_quantity FROM public.candidates WHERE id = 99340) IS DISTINCT FROM 10 THEN RAISE EXCEPTION 'diff sz/sub'; END IF;
  RAISE NOTICE '0134 asserts passed';
END $$;
