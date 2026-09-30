-- Run after 0122 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0122 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE ar bigint; c public.candidates; ji public.job_request_items;
BEGIN
  INSERT INTO public.suppliers(id, name, head_branch_id) OVERRIDING SYSTEM VALUE VALUES (99100, 'Test Nursery 0122', 99100);
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99100, 'Test 0122', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99100, 99100, 'Oak', '5 G', 10);
  INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name, size, unit_price, description, is_original)
    OVERRIDING SYSTEM VALUE VALUES
    (99100, 99100, 99100, 'Oak', '5 G', 30, '5 G Oak', true),
    (99101, 99100, 99100, 'Oak', '3 G', 18, '3 G Oak', false);
  PERFORM public.select_candidate(99100, 99100);
  ar := public.create_availability_request(99100, ARRAY[99100::bigint]);
  PERFORM public.send_availability_request(ar);

  -- Unavailable: quantity 0, price kept.
  PERFORM public.answer_availability_request(ar, 99100, 99100, '{"status":"unavailable"}');
  SELECT * INTO c FROM public.candidates WHERE id = 99100;
  IF c.status <> 'unavailable' OR c.available_quantity <> 0 OR c.unit_price <> 30 THEN RAISE EXCEPTION 'unavailable: %', row_to_json(c); END IF;
  PERFORM public.answer_availability_request(ar, 99100, NULL, NULL, true);
  SELECT * INTO ji FROM public.job_request_items WHERE id = 99100;
  IF ji.status <> 'unavailable' OR ji.unit_price <> 30 THEN RAISE EXCEPTION 'line: %', row_to_json(ji); END IF;

  -- A substitute keeps the asked candidate's price too.
  PERFORM public.answer_availability_request(ar, 99100, 99100, '{"status":"unavailable","offered_candidate_id":"99101"}');
  SELECT * INTO c FROM public.candidates WHERE id = 99100;
  IF c.status <> 'diff_size_qty_sub' OR c.available_quantity <> 0 OR c.unit_price <> 30 THEN RAISE EXCEPTION 'substitute: %', row_to_json(c); END IF;

  -- An explicit price still saves.
  PERFORM public.answer_availability_request(ar, 99100, 99100, '{"status":"available","available_quantity":"10","unit_price":"28"}');
  IF (SELECT unit_price FROM public.candidates WHERE id = 99100) <> 28 THEN RAISE EXCEPTION 'explicit price'; END IF;
END $$;
