-- Run after 0121 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0121 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE ar bigint; s public.availability_requests; c public.candidates; ji public.job_request_items;
BEGIN
  INSERT INTO public.suppliers(id, name, head_branch_id) OVERRIDING SYSTEM VALUE VALUES (99000, 'Test Nursery 0121', 99000);
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99000, 'Test 0121', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99000, 99000, 'Oak', '5 G', 10), (99001, 99000, 'Elm', '3 G', 4);
  INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name, size, unit_price, description, is_original)
    OVERRIDING SYSTEM VALUE VALUES
    (99000, 99000, 99000, 'Oak', '5 G', 30, '5 G Oak', true),
    (99001, 99000, 99000, 'Oak', '3 G', 18, '3 G Oak', false),
    (99002, 99000, 99000, 'Oak', '7 G', 45, '7 G Oak', false),
    (99010, 99000, 99001, 'Elm', '3 G', 12, '3 G Elm', true);
  PERFORM public.select_candidate(99000, 99000);
  ar := public.create_availability_request(99000, ARRAY[99000::bigint, 99010::bigint]);
  PERFORM public.send_availability_request(ar);

  -- Partial Qty is its own answer and the line mirrors it.
  PERFORM public.answer_availability_request(ar, 99000, 99000, '{"status":"partial_qty","available_quantity":"6","unit_price":"30"}');
  PERFORM public.answer_availability_request(ar, 99000, NULL, NULL, true);
  -- One transaction: now() doesn't advance, so age the submission like a later session would.
  UPDATE public.availability_requests SET submitted_at = submitted_at - interval '1 minute' WHERE id = ar;
  SELECT * INTO ji FROM public.job_request_items WHERE id = 99000;
  IF ji.status <> 'partial_qty' OR ji.available_quantity <> 6 THEN RAISE EXCEPTION 'partial line: % %', ji.status, ji.available_quantity; END IF;

  -- A size change is no longer a supplier field.
  BEGIN
    PERFORM public.answer_availability_request(ar, 99000, 99000, '{"size":"3 G"}');
    RAISE EXCEPTION 'size accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Invalid answer field' THEN RAISE; END IF;
  END;

  -- Tag offer: Unavailable + another candidate → Diff Sz/Sub; the asked one is 0/0.
  PERFORM public.answer_availability_request(ar, 99000, 99000,
    '{"status":"unavailable","offered_candidate_id":"99001","offer_unit_price":"17","offer_quantity":"10","note_from_supplier":"3 G only"}');
  SELECT * INTO c FROM public.candidates WHERE id = 99000;
  IF c.status <> 'diff_size_qty_sub' OR c.available_quantity <> 0 OR c.unit_price <> 0 OR c.size <> '5 G'
    OR c.offered_candidate_id <> 99001 OR c.offer_unit_price <> 17 THEN RAISE EXCEPTION 'tag offer saved wrong: %', row_to_json(c); END IF;
  IF (SELECT status FROM public.candidates WHERE id = 99001) IS NOT NULL THEN RAISE EXCEPTION 'offer applied before submit'; END IF;
  PERFORM public.answer_availability_request(ar, 99000, NULL, NULL, true);
  -- One transaction: now() doesn't advance, so age the submission like a later session would.
  UPDATE public.availability_requests SET submitted_at = submitted_at - interval '1 minute' WHERE id = ar;
  SELECT * INTO s FROM public.availability_requests WHERE id = ar;
  IF s.status <> 'submitted' THEN RAISE EXCEPTION 'offer reopened the request: %', s.status; END IF;
  SELECT * INTO c FROM public.candidates WHERE id = 99001;
  IF c.status <> 'available' OR c.availability_request_id <> ar OR c.unit_price <> 17 OR c.available_quantity <> 10
    OR c.note_from_supplier <> '3 G only' OR c.note_for_customer <> '3 G only' THEN RAISE EXCEPTION 'offer not applied: %', row_to_json(c); END IF;
  SELECT * INTO ji FROM public.job_request_items WHERE id = 99000;
  -- The asked candidate is 0/0, but a line offered a substitute reads Diff Sz/Sub (JR-90).
  IF ji.status <> 'alternative_proposed' OR ji.unit_price IS NOT NULL OR ji.size <> '5 G' THEN RAISE EXCEPTION 'original line with offer: %', ji.status; END IF;

  -- Selecting the offered (non-original) candidate reads Diff Sz/Sub with its own size/price.
  PERFORM public.select_candidate(99000, 99001);
  SELECT * INTO ji FROM public.job_request_items WHERE id = 99000;
  IF ji.status <> 'alternative_proposed' OR ji.size <> '3 G' OR ji.unit_price <> 17 THEN RAISE EXCEPTION 'alt line: %', row_to_json(ji); END IF;
  -- A non-original that is unanswered stays Pending.
  PERFORM public.select_candidate(99000, 99002);
  IF (SELECT status FROM public.job_request_items WHERE id = 99000) <> 'pending' THEN RAISE EXCEPTION 'unanswered alt not pending'; END IF;

  -- A short offered quantity makes the offered candidate Partial Qty.
  PERFORM public.answer_availability_request(ar, 99000, 99000, '{"offered_candidate_id":"99002","offer_quantity":"4","offer_unit_price":""}');
  PERFORM public.answer_availability_request(ar, 99000, NULL, NULL, true);
  -- One transaction: now() doesn't advance, so age the submission like a later session would.
  UPDATE public.availability_requests SET submitted_at = submitted_at - interval '1 minute' WHERE id = ar;
  SELECT * INTO c FROM public.candidates WHERE id = 99002;
  IF c.status <> 'partial_qty' OR c.available_quantity <> 4 OR c.unit_price <> 45 THEN RAISE EXCEPTION 'short offer: %', row_to_json(c); END IF;
  IF (SELECT status FROM public.job_request_items WHERE id = 99000) <> 'alternative_proposed' THEN RAISE EXCEPTION 'selected offer not re-applied'; END IF;

  -- Diff Sz/Sub itself works with a tag, and needs one.
  PERFORM public.answer_availability_request(ar, 99000, 99000, '{"status":"diff_size_qty_sub","offered_candidate_id":"99001"}');
  IF (SELECT status FROM public.candidates WHERE id = 99000) <> 'diff_size_qty_sub' THEN RAISE EXCEPTION 'diff with tag'; END IF;
  BEGIN
    PERFORM public.answer_availability_request(ar, 99000, 99000, '{"status":"diff_size_qty_sub","offered_candidate_id":"","offer_description":""}');
    RAISE EXCEPTION 'diff without substitute accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Pick or describe the substitute' THEN RAISE; END IF;
  END;

  -- Offers must be another candidate of the same line and supplier.
  BEGIN
    PERFORM public.answer_availability_request(ar, 99000, 99000, '{"status":"unavailable","offered_candidate_id":"99010"}');
    RAISE EXCEPTION 'foreign offer accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Offered candidate must be%' THEN RAISE; END IF;
  END;

  -- Removing the offer (or choosing any other answer) clears it.
  PERFORM public.answer_availability_request(ar, 99000, 99000, '{"status":"unavailable","offered_candidate_id":"","offer_description":""}');
  SELECT * INTO c FROM public.candidates WHERE id = 99000;
  IF c.status <> 'unavailable' OR c.offered_candidate_id IS NOT NULL OR c.offer_quantity IS NOT NULL THEN RAISE EXCEPTION 'offer not cleared'; END IF;
  PERFORM public.answer_availability_request(ar, 99000, 99000, '{"status":"unavailable","offer_description":"Oak 15 G","offer_unit_price":"120"}');
  PERFORM public.answer_availability_request(ar, 99000, 99000, '{"status":"available","available_quantity":"10","unit_price":"30"}');
  SELECT * INTO c FROM public.candidates WHERE id = 99000;
  IF c.status <> 'available' OR c.offer_description IS NOT NULL OR c.offer_unit_price IS NOT NULL THEN RAISE EXCEPTION 'available kept offer'; END IF;

  -- Typed offer waits for Rosie; she creates the candidate and links it.
  PERFORM public.answer_availability_request(ar, 99000, 99000, '{"status":"unavailable","offer_description":"Oak 15 G","offer_unit_price":"120","note_from_supplier":"15 G only"}');
  PERFORM public.answer_availability_request(ar, 99000, NULL, NULL, true);
  -- One transaction: now() doesn't advance, so age the submission like a later session would.
  UPDATE public.availability_requests SET submitted_at = submitted_at - interval '1 minute' WHERE id = ar;
  IF (SELECT status FROM public.candidates WHERE id = 99000) <> 'diff_size_qty_sub' THEN RAISE EXCEPTION 'typed offer not diff'; END IF;
  INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name, size, unit_price, description)
    OVERRIDING SYSTEM VALUE VALUES (99003, 99000, 99000, 'Oak', '15 G', 120, '15 G Oak');
  PERFORM public.link_candidate_offer(99000, 99003);
  SELECT * INTO c FROM public.candidates WHERE id = 99003;
  IF c.status <> 'available' OR c.availability_request_id <> ar OR c.unit_price <> 120 OR c.available_quantity <> 10 THEN
    RAISE EXCEPTION 'linked offer: %', row_to_json(c); END IF;
  IF (SELECT status FROM public.availability_requests WHERE id = ar) <> 'submitted' THEN RAISE EXCEPTION 'link reopened request'; END IF;

  -- Legacy Diff Sz/Sub (no offer) keeps its old meaning.
  SET LOCAL lps.applying_offer = 'on';
  UPDATE public.candidates SET status = 'diff_size_qty_sub', size = '4 G', unit_price = 15, available_quantity = 4 WHERE id = 99010;
  SET LOCAL lps.applying_offer = 'off';
  PERFORM public.select_candidate(99001, 99010);
  IF (SELECT status FROM public.job_request_items WHERE id = 99001) <> 'alternative_proposed' THEN RAISE EXCEPTION 'legacy diff'; END IF;
  PERFORM public.answer_availability_request(ar, 99000, 99010, '{"note_from_supplier":"4 G ok"}');
  IF (SELECT status FROM public.candidates WHERE id = 99010) <> 'diff_size_qty_sub' THEN RAISE EXCEPTION 'note edit changed legacy status'; END IF;

  -- The asked plant under a substitute offer can't be ordered.
  PERFORM public.answer_availability_request(ar, 99000, 99000, '{"status":"unavailable","offered_candidate_id":"99001"}');
  BEGIN
    PERFORM public.create_order(99000, '[{"candidate_id":99000,"allocations":[{"job_request_item_id":99000,"quantity":1}]}]', p_customer_confirmed => true);
    RAISE EXCEPTION 'ordered an offered-away candidate';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'Supplier must answer availability before ordering' THEN RAISE; END IF;
  END;
  RAISE NOTICE '0121 assertions passed';
END $$;
