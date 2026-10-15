-- Run after 0137 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0137 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE sup bigint; alt bigint; ord bigint; n bigint; got text;
BEGIN
  -- candidate_status is the selected candidate's status, on every line.
  SELECT count(*) INTO n FROM public.job_lines jl JOIN public.candidates c ON c.id = jl.selected_candidate_id
    WHERE jl.candidate_status IS DISTINCT FROM c.status;
  IF n <> 0 THEN RAISE EXCEPTION '% lines differ from their candidate', n; END IF;

  -- Backfill: size swaps read Diff Sz/Sub, 1288 Partial Qty; same-plant picks stay Available.
  SELECT count(*) INTO n FROM public.candidates
    WHERE id IN (668, 669, 672, 947, 955, 1297, 1317, 1339, 1347, 1461, 1512) AND status = 'diff_size_sub';
  IF n <> 11 THEN RAISE EXCEPTION 'diff_size_sub backfill: %', n; END IF;
  IF (SELECT status FROM public.candidates WHERE id = 1288) IS DISTINCT FROM 'partial_qty' THEN RAISE EXCEPTION '1288'; END IF;
  SELECT candidate_status INTO got FROM public.job_lines WHERE id = 1342;
  IF got IS DISTINCT FROM 'available' THEN RAISE EXCEPTION 'JR-111 Yucca: %', got; END IF;
  SELECT candidate_status INTO got FROM public.job_lines WHERE id = 1254;
  IF got IS DISTINCT FROM 'available' THEN RAISE EXCEPTION 'JR-109 Berkeley Sedge: %', got; END IF;
  -- Quantities kept, updated_at kept.
  IF (SELECT available_quantity FROM public.candidates WHERE id = 1461) IS DISTINCT FROM 12 THEN RAISE EXCEPTION '1461 qty'; END IF;
  IF (SELECT available_quantity FROM public.candidates WHERE id = 1288) IS DISTINCT FROM 1 THEN RAISE EXCEPTION '1288 qty'; END IF;
  SELECT count(*) INTO n FROM public.candidates WHERE id IN (668, 1288, 1461) AND updated_at >= now();
  IF n <> 0 THEN RAISE EXCEPTION 'updated_at moved on % rows', n; END IF;
  -- The deprecated status column is still there for the running app.
  IF (SELECT status FROM public.job_lines WHERE id = 896) IS DISTINCT FROM 'diff_size_sub' THEN RAISE EXCEPTION 'old status'; END IF;

  -- Direct order: the order line takes the candidate's status, not the original flag.
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99370, 'Test 0137', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99370, 99370, 'Yucca rostrata', NULL, 10);
  SELECT supplier_id INTO sup FROM public.candidates WHERE id = (SELECT default_candidate_id FROM public.job_request_items WHERE id = 99370);
  INSERT INTO public.candidates(supplier_id, job_request_item_id, name, size, description, unit_price, is_original)
    VALUES (sup, 99370, 'Yucca rostrata', '15 G', '15 G Yucca rostrata', 250, false) RETURNING id INTO alt;
  PERFORM public.select_candidate(99370, alt);
  UPDATE public.candidates SET status = 'available' WHERE id = alt;
  IF (SELECT candidate_status FROM public.job_lines WHERE id = 99370) IS DISTINCT FROM 'available' THEN RAISE EXCEPTION 'line'; END IF;
  ord := public.create_direct_order(sup, '[{"job_request_item_id":99370,"quantity":4}]'::jsonb, NULL, NULL, NULL, true, NULL);
  SELECT status INTO got FROM public.order_items WHERE order_id = ord;
  IF got IS DISTINCT FROM 'available' THEN RAISE EXCEPTION 'direct order available: %', got; END IF;
  UPDATE public.candidates SET status = 'can_order' WHERE id = alt;
  ord := public.create_direct_order(sup, '[{"job_request_item_id":99370,"quantity":4}]'::jsonb, NULL, NULL, NULL, true, NULL);
  SELECT status INTO got FROM public.order_items WHERE order_id = ord;
  IF got IS DISTINCT FROM 'need_to_order' THEN RAISE EXCEPTION 'direct order can order: %', got; END IF;
  RAISE NOTICE '0137 asserts passed';
END $$;
