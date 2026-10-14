-- Run after 0132 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0132 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE def_a bigint; def_b bigint; ar_id bigint;
BEGIN
  -- Backfill.
  IF EXISTS (SELECT 1 FROM public.candidates WHERE is_active AND status IS NULL AND available_quantity IS NOT NULL) THEN
    RAISE EXCEPTION 'pending rows still hold a quantity';
  END IF;
  IF (SELECT note_for_customer FROM public.candidates WHERE id = 1980) IS NOT NULL THEN RAISE EXCEPTION '1980 note kept'; END IF;
  IF NOT (SELECT hide_from_lps FROM public.candidates WHERE id = 1973)
    OR NOT (SELECT hide_from_lps FROM public.candidates WHERE id = 1974) THEN RAISE EXCEPTION 'AR-83 alternatives visible'; END IF;
  IF EXISTS (SELECT 1 FROM public.candidates WHERE id IN (1959, 1970, 1963, 1975, 1968, 1980) AND hide_from_lps) THEN
    RAISE EXCEPTION 'AR-83 hid an original or a substitute'; END IF;

  INSERT INTO public.suppliers(id, name, head_branch_id, is_lps_partner) OVERRIDING SYSTEM VALUE
    VALUES (99320, 'Test Nursery 0132', 99320, false);
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99320, 'Test 0132', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99320, 99320, 'Oak', '5 G', 10), (99321, 99320, 'Elm', '3 G', 5);
  SELECT default_candidate_id INTO def_a FROM public.job_request_items WHERE id = 99320;
  SELECT default_candidate_id INTO def_b FROM public.job_request_items WHERE id = 99321;

  -- 1. Available = demand, then Pending = NA (even with a quantity sent).
  PERFORM public.update_job_line(99320, '{"status":"available"}');
  IF (SELECT available_quantity FROM public.job_lines WHERE id = 99320) <> 10 THEN RAISE EXCEPTION 'available = demand'; END IF;
  PERFORM public.update_job_line(99320, '{"status":"pending"}');
  IF (SELECT available_quantity FROM public.candidates WHERE id = def_a) IS NOT NULL
    OR (SELECT status FROM public.job_lines WHERE id = 99320) <> 'pending' THEN RAISE EXCEPTION 'pending keeps a quantity'; END IF;
  PERFORM public.update_job_line(99320, '{"status":"partial_qty","available_quantity":"4"}');
  PERFORM public.update_job_line(99320, '{"status":"pending","available_quantity":"4"}');
  IF (SELECT available_quantity FROM public.candidates WHERE id = def_a) IS NOT NULL THEN RAISE EXCEPTION 'pending with a quantity'; END IF;
  UPDATE public.candidates SET status = 'unavailable' WHERE id = def_a;
  UPDATE public.candidates SET status = NULL WHERE id = def_a;
  IF (SELECT available_quantity FROM public.candidates WHERE id = def_a) IS NOT NULL THEN RAISE EXCEPTION 'raw pending'; END IF;

  -- 2 and 3: a supplier with an original, a picked sub carrying an intake note,
  -- an asked alternative and an unasked one on line 99320; nothing asked on 99321.
  INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name, size, demanded_quantity, unit_price,
      description, is_original, note_for_customer) OVERRIDING SYSTEM VALUE VALUES
    (99320, 99320, 99320, 'Oak', '5 G', 10, 20, '5 G Oak', true, NULL),
    (99321, 99320, 99320, 'Oak', '15 G', NULL, 60, '15 G Oak', false, '15 G instead of 5 G'),
    (99322, 99320, 99320, 'Oak', '3 G', NULL, 12, '3 G Oak', false, NULL),
    (99323, 99320, 99320, 'Oak', '7 G', NULL, 30, '7 G Oak', false, 'Bigger'),
    (99324, 99320, 99321, 'Elm', '5 G', NULL, 9, '5 G Elm', false, NULL);
  PERFORM public.select_candidate(99320, 99320);
  ar_id := public.create_availability_request(99320, ARRAY[99320, 99322]::bigint[]);
  PERFORM public.send_availability_request(ar_id);
  PERFORM public.answer_availability_request(ar_id, 99320, 99320,
    '{"status":"diff_size_sub","offered_candidate_id":"99321","note_from_supplier":"5 G NA, 15 G only"}');
  -- The reply replaces the intake note; the line shows the reply.
  IF (SELECT note_for_customer FROM public.candidates WHERE id = 99321) IS NOT NULL THEN RAISE EXCEPTION 'reply kept the override'; END IF;
  PERFORM public.answer_availability_request(ar_id, 99320, 99322, '{"status":"available","note_from_supplier":"ok"}');
  PERFORM public.answer_availability_request(ar_id, 99320, p_submit => true);
  IF (SELECT selected_candidate_id FROM public.job_request_items WHERE id = 99320) <> 99321 THEN RAISE EXCEPTION 'switch to sub'; END IF;
  IF (SELECT note_for_customer FROM public.job_lines WHERE id = 99320) <> '5 G NA, 15 G only' THEN RAISE EXCEPTION 'line note'; END IF;
  -- Asked and unasked alternatives hidden; original, substitute, default and the unasked line untouched.
  IF NOT (SELECT hide_from_lps FROM public.candidates WHERE id = 99322)
    OR NOT (SELECT hide_from_lps FROM public.candidates WHERE id = 99323) THEN RAISE EXCEPTION 'alternatives visible'; END IF;
  IF EXISTS (SELECT 1 FROM public.candidates WHERE id IN (99320, 99321, 99324, def_a, def_b) AND hide_from_lps) THEN
    RAISE EXCEPTION 'hid too much'; END IF;
  -- LPS overrides after the reply; a write setting both keeps its own note.
  PERFORM public.update_job_line(99320, '{"note_for_customer":"Larger size, same price"}');
  IF (SELECT note_for_customer FROM public.job_lines WHERE id = 99320) <> 'Larger size, same price' THEN RAISE EXCEPTION 'override'; END IF;
  UPDATE public.candidates SET note_from_supplier = 'x', note_for_customer = 'y' WHERE id = 99323;
  IF (SELECT note_for_customer FROM public.candidates WHERE id = 99323) <> 'y' THEN RAISE EXCEPTION 'same-write note'; END IF;
  RAISE NOTICE '0132 asserts passed';
END $$;
