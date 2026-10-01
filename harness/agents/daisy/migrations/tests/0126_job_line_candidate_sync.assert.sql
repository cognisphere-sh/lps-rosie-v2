-- Run after 0126 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0126 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE ar bigint; c public.candidates; line public.job_request_items; ar_status text;
BEGIN
  INSERT INTO public.suppliers(id, name, head_branch_id) OVERRIDING SYSTEM VALUE VALUES (99260, 'Test Nursery 0126', 99260);
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99260, 'Test 0126', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99260, 99260, 'Oak', '5 G', 10), (99261, 99260, 'Elm', '5 G', 10);
  INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name, size, unit_price, description, is_original)
    OVERRIDING SYSTEM VALUE VALUES
    (99260, 99260, 99260, 'Oak', '5 G', 30, '5 G Oak', true),
    (99261, 99260, 99260, 'Live Oak', '5 G', 28, '5 G Live Oak', false),
    (99262, 99260, 99261, 'Elm', '5 G', 20, '5 G Elm', true);
  PERFORM public.select_candidate(99260, 99260);
  ar := public.create_availability_request(99260, ARRAY[99260::bigint]);
  PERFORM public.send_availability_request(ar);
  UPDATE public.availability_requests SET status = 'submitted' WHERE id = ar;

  -- Avail below demand: the candidate takes it and the line reads Partial Qty.
  UPDATE public.job_request_items SET status = 'available', available_quantity = 4 WHERE id = 99260;
  SELECT * INTO c FROM public.candidates WHERE id = 99260;
  SELECT * INTO line FROM public.job_request_items WHERE id = 99260;
  IF c.status <> 'available' OR c.available_quantity <> 4 OR line.status <> 'partial_qty' OR line.available_quantity <> 4 THEN
    RAISE EXCEPTION 'partial: % / %', row_to_json(c), row_to_json(line); END IF;
  -- An LPS edit is not a supplier answer: the AR stays submitted.
  SELECT status INTO ar_status FROM public.availability_requests WHERE id = ar;
  IF ar_status <> 'submitted' THEN RAISE EXCEPTION 'AR moved to %', ar_status; END IF;

  -- Meeting demand reads Available.
  UPDATE public.job_request_items SET available_quantity = 10 WHERE id = 99260;
  IF (SELECT status FROM public.job_request_items WHERE id = 99260) <> 'available' THEN RAISE EXCEPTION 'full'; END IF;

  -- Price, note, size write through.
  UPDATE public.job_request_items SET unit_price = 25, note_for_customer = 'Ready Friday', size = '7 G' WHERE id = 99260;
  SELECT * INTO c FROM public.candidates WHERE id = 99260;
  IF c.unit_price <> 25 OR c.note_for_customer <> 'Ready Friday' OR c.size <> '7 G' THEN RAISE EXCEPTION 'fields: %', row_to_json(c); END IF;

  -- Status maps both ways.
  UPDATE public.job_request_items SET status = 'need_to_order' WHERE id = 99260;
  IF (SELECT status FROM public.candidates WHERE id = 99260) <> 'can_order'
    OR (SELECT status FROM public.job_request_items WHERE id = 99260) <> 'need_to_order' THEN RAISE EXCEPTION 'can order'; END IF;
  UPDATE public.job_request_items SET status = 'pending' WHERE id = 99260;
  IF (SELECT status FROM public.candidates WHERE id = 99260) IS NOT NULL THEN RAISE EXCEPTION 'pending'; END IF;

  -- Unavailable zeroes the quantity, and a closed AR does not refuse the edit.
  UPDATE public.availability_requests SET status = 'closed' WHERE id = ar;
  UPDATE public.job_request_items SET status = 'unavailable' WHERE id = 99260;
  SELECT * INTO c FROM public.candidates WHERE id = 99260;
  SELECT * INTO line FROM public.job_request_items WHERE id = 99260;
  IF c.status <> 'unavailable' OR c.available_quantity <> 0 OR line.status <> 'unavailable' OR line.available_quantity <> 0 THEN
    RAISE EXCEPTION 'unavailable: % / %', row_to_json(c), row_to_json(line); END IF;

  -- A substitute that is Available reads Diff Sz/Sub, even when short.
  PERFORM public.select_candidate(99260, 99261);
  UPDATE public.job_request_items SET status = 'available', available_quantity = 3 WHERE id = 99260;
  SELECT * INTO line FROM public.job_request_items WHERE id = 99260;
  IF line.status <> 'alternative_proposed' OR (SELECT status FROM public.candidates WHERE id = 99261) <> 'available' THEN
    RAISE EXCEPTION 'substitute: %', row_to_json(line); END IF;
  -- Picking Diff Sz/Sub on a substitute keeps its answer.
  UPDATE public.job_request_items SET status = 'alternative_proposed' WHERE id = 99260;
  IF (SELECT status FROM public.candidates WHERE id = 99261) <> 'available' THEN RAISE EXCEPTION 'diff keeps answer'; END IF;

  -- A line with no selection keeps its own values.
  UPDATE public.job_request_items SET unit_price = 99, status = 'available' WHERE id = 99261;
  IF (SELECT unit_price FROM public.candidates WHERE id = 99262) <> 20 THEN RAISE EXCEPTION 'unselected touched candidate'; END IF;
  IF (SELECT unit_price FROM public.job_request_items WHERE id = 99261) <> 99 THEN RAISE EXCEPTION 'unselected line'; END IF;

  RAISE NOTICE '0126 asserts passed';
END $$;
