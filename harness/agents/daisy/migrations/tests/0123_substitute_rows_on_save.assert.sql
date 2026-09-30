-- Run after 0123 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0123 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE ar bigint; c public.candidates; typed_id bigint; ji public.job_request_items;
BEGIN
  INSERT INTO public.suppliers(id, name, head_branch_id) OVERRIDING SYSTEM VALUE VALUES (99200, 'Test Nursery 0123', 99200);
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99200, 'Test 0123', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99200, 99200, 'Oak', '5 G', 10);
  INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name, size, unit_price, description, is_original)
    OVERRIDING SYSTEM VALUE VALUES
    (99200, 99200, 99200, 'Oak', '5 G', 30, '5 G Oak', true),
    (99201, 99200, 99200, 'Oak', '3 G', 18, '3 G Oak', false);
  PERFORM public.select_candidate(99200, 99200);
  ar := public.create_availability_request(99200, ARRAY[99200::bigint]);
  PERFORM public.send_availability_request(ar);

  -- Picking a tag on save: asked → Unavailable (qty 0, price kept); tag → Available on the AR.
  PERFORM public.answer_availability_request(ar, 99200, 99200,
    '{"status":"diff_size_qty_sub","offered_candidate_id":"99201","offer_unit_price":"17","offer_quantity":"10","note_from_supplier":"5 G NA, 3 G only"}');
  SELECT * INTO c FROM public.candidates WHERE id = 99200;
  IF c.status <> 'unavailable' OR c.available_quantity <> 0 OR c.unit_price <> 30 OR c.offered_candidate_id <> 99201 THEN
    RAISE EXCEPTION 'asked after tag: %', row_to_json(c); END IF;
  SELECT * INTO c FROM public.candidates WHERE id = 99201;
  IF c.status <> 'available' OR c.availability_request_id <> ar OR c.unit_price <> 17 OR c.available_quantity <> 10 THEN
    RAISE EXCEPTION 'tag not available: %', row_to_json(c); END IF;
  IF (SELECT status FROM public.availability_requests WHERE id = ar) <> 'processing' THEN RAISE EXCEPTION 'request reopened'; END IF;

  -- Switching to a typed substitute: the tag resets; a new candidate row is made.
  PERFORM public.answer_availability_request(ar, 99200, 99200,
    '{"status":"unavailable","offered_candidate_id":"","offer_description":"Oak 15 G","offer_unit_price":"120"}');
  IF (SELECT status FROM public.candidates WHERE id = 99201) IS NOT NULL THEN RAISE EXCEPTION 'old tag not reset'; END IF;
  SELECT offered_candidate_id INTO typed_id FROM public.candidates WHERE id = 99200;
  SELECT * INTO c FROM public.candidates WHERE id = typed_id;
  IF c.name <> 'Oak 15 G' OR c.is_original OR c.size IS NOT NULL OR c.status <> 'available' OR c.availability_request_id <> ar
    OR c.unit_price <> 120 OR c.available_quantity <> 10 OR c.job_request_item_id <> 99200 OR NOT c.is_active THEN
    RAISE EXCEPTION 'typed row: %', row_to_json(c); END IF;

  -- Editing the typed text keeps the same row.
  PERFORM public.answer_availability_request(ar, 99200, 99200, '{"offered_candidate_id":"","offer_description":"Oak 15 G heavy"}');
  IF (SELECT offered_candidate_id FROM public.candidates WHERE id = 99200) <> typed_id
    OR (SELECT name FROM public.candidates WHERE id = typed_id) <> 'Oak 15 G heavy' THEN RAISE EXCEPTION 'typed edit made a new row'; END IF;

  -- The supplier edits the substitute's own row; a later note edit on the asked row leaves it.
  PERFORM public.answer_availability_request(ar, 99200, typed_id, '{"unit_price":"110"}');
  PERFORM public.answer_availability_request(ar, 99200, 99200, '{"note_from_supplier":"15 G only"}');
  IF (SELECT unit_price FROM public.candidates WHERE id = typed_id) <> 110 THEN RAISE EXCEPTION 'note edit re-applied offer'; END IF;

  -- Clearing the substitute retires the typed row.
  PERFORM public.answer_availability_request(ar, 99200, 99200, '{"status":"unavailable","offered_candidate_id":"","offer_description":""}');
  IF (SELECT is_active FROM public.candidates WHERE id = typed_id) THEN RAISE EXCEPTION 'typed row not retired'; END IF;
  IF (SELECT offered_candidate_id FROM public.candidates WHERE id = 99200) IS NOT NULL THEN RAISE EXCEPTION 'offer not cleared'; END IF;

  -- Diff Sz/Sub without a substitute is refused.
  BEGIN
    PERFORM public.answer_availability_request(ar, 99200, 99200, '{"status":"diff_size_qty_sub"}');
    RAISE EXCEPTION 'diff without substitute accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Pick or describe the substitute' THEN RAISE; END IF;
  END;

  -- Submitted with a substitute on offer: the selected original reads Diff Sz/Sub, keeping its price.
  PERFORM public.answer_availability_request(ar, 99200, 99200, '{"status":"unavailable","offered_candidate_id":"99201"}');
  PERFORM public.answer_availability_request(ar, 99200, NULL, NULL, true);
  SELECT * INTO ji FROM public.job_request_items WHERE id = 99200;
  IF ji.status <> 'alternative_proposed' OR ji.unit_price <> 30 THEN RAISE EXCEPTION 'line: %', row_to_json(ji); END IF;
  IF (SELECT status FROM public.availability_requests WHERE id = ar) <> 'submitted' THEN RAISE EXCEPTION 'not submitted'; END IF;
END $$;
