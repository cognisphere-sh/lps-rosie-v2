-- Run after 0124 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0124 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE ar bigint; c public.candidates;
BEGIN
  IF EXISTS (SELECT 1 FROM public.candidates WHERE hide_from_lps) THEN
    RAISE EXCEPTION 'existing candidates must stay visible'; END IF;

  INSERT INTO public.suppliers(id, name, head_branch_id) OVERRIDING SYSTEM VALUE VALUES (99240, 'Test Nursery 0124', 99240);
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99240, 'Test 0124', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99240, 99240, 'Oak', '5 G', 10);
  INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name, size, unit_price, description, is_original, hide_from_lps)
    OVERRIDING SYSTEM VALUE VALUES
    (99240, 99240, 99240, 'Oak', '5 G', 30, '5 G Oak', true, false),
    (99241, 99240, 99240, 'Live Oak', '5 G', 28, '5 G Live Oak', false, true);
  PERFORM public.select_candidate(99240, 99240);
  ar := public.create_availability_request(99240, ARRAY[99240::bigint]);
  PERFORM public.send_availability_request(ar);

  -- The hidden candidate is a substitute tag: picking it makes it Available on the AR.
  PERFORM public.answer_availability_request(ar, 99240, 99240,
    '{"status":"unavailable","offered_candidate_id":"99241","offer_unit_price":"","offer_quantity":"","note_from_supplier":"5 G Oak NA"}');
  SELECT * INTO c FROM public.candidates WHERE id = 99241;
  IF c.status <> 'available' OR c.availability_request_id <> ar OR c.unit_price <> 28 OR c.available_quantity <> 10
    OR c.hide_from_lps THEN
    RAISE EXCEPTION 'hidden tag not applied or still hidden: %', row_to_json(c); END IF;
  SELECT * INTO c FROM public.candidates WHERE id = 99240;
  IF c.status <> 'unavailable' OR c.offered_candidate_id <> 99241 THEN
    RAISE EXCEPTION 'asked row: %', row_to_json(c); END IF;

  -- A typed substitute is a normal, visible candidate.
  PERFORM public.answer_availability_request(ar, 99240, 99240,
    '{"status":"unavailable","offered_candidate_id":"","offer_description":"Bur Oak 5 G"}');
  SELECT * INTO c FROM public.candidates WHERE id = (SELECT offered_candidate_id FROM public.candidates WHERE id = 99240);
  IF c.hide_from_lps OR c.status <> 'available' THEN RAISE EXCEPTION 'typed row: %', row_to_json(c); END IF;
  -- The old tag went back to unanswered but stays visible: a supplier picked it once.
  SELECT * INTO c FROM public.candidates WHERE id = 99241;
  IF c.status IS NOT NULL OR c.hide_from_lps OR c.availability_request_id IS NOT NULL THEN
    RAISE EXCEPTION 'old tag not reset off the AR: %', row_to_json(c); END IF;
  -- A hidden candidate nobody picked stays hidden.
  INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name, size, unit_price, description, is_original, hide_from_lps)
    OVERRIDING SYSTEM VALUE VALUES (99242, 99240, 99240, 'Red Oak', '5 G', 26, '5 G Red Oak', false, true);
  IF NOT (SELECT hide_from_lps FROM public.candidates WHERE id = 99242) THEN RAISE EXCEPTION 'unpicked became visible'; END IF;

  RAISE NOTICE '0124 asserts passed';
END $$;
