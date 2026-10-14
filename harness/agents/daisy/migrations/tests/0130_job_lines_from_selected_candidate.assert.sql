-- Run after 0130 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0130 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE c public.candidates; jl public.job_lines; line public.job_request_items; ar public.availability_requests;
  oi public.order_items; ar_id bigint; aps_ar bigint; def_a bigint; def_b bigint; def_c bigint; def_d bigint;
  ph bigint; ord bigint; first_submit timestamptz; res jsonb;
BEGIN
  INSERT INTO public.suppliers(id, name, head_branch_id, is_lps_partner) OVERRIDING SYSTEM VALUE
    VALUES (99300, 'Test Nursery 0130', 99300, false);
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE
    VALUES (99300, 'Test 0130', 'quoted'), (99301, 'Test 0130 delete', 'quoted');

  -- Inserting a line creates its APS default and selects it.
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99300, 99300, 'Oak', '5 G', 10), (99301, 99300, 'Elm', '3 G', 5), (99302, 99300, 'Ash', NULL, 2),
      (99303, 99301, 'Yew', '1 G', 1);
  SELECT * INTO line FROM public.job_request_items WHERE id = 99300;
  SELECT * INTO c FROM public.candidates WHERE id = line.default_candidate_id;
  IF line.selected_candidate_id IS DISTINCT FROM c.id OR c.supplier_id <> 1 OR NOT c.is_original
    OR c.job_request_item_id <> 99300 OR c.name <> 'Oak' OR c.size <> '5 G' OR c.demanded_quantity <> 10
    OR c.description <> '5 G Oak' OR c.unit_price <> 0 OR c.availability_request_id IS NOT NULL OR c.status IS NOT NULL THEN
    RAISE EXCEPTION 'default on insert: % / %', row_to_json(line), row_to_json(c); END IF;
  def_a := c.id;
  SELECT default_candidate_id INTO def_b FROM public.job_request_items WHERE id = 99301;
  SELECT default_candidate_id INTO def_c FROM public.job_request_items WHERE id = 99302;
  SELECT default_candidate_id INTO def_d FROM public.job_request_items WHERE id = 99303;
  IF (SELECT description FROM public.candidates WHERE id = def_c) <> 'Ash' THEN RAISE EXCEPTION 'default description without size'; END IF;
  SELECT * INTO jl FROM public.job_lines WHERE id = 99300;
  IF jl.status <> 'pending' OR jl.unit_price IS NOT NULL OR jl.total IS NOT NULL OR jl.size <> '5 G'
    OR jl.requested_size <> '5 G' OR jl.demand <> 10 OR jl.quote_name <> 'Oak' OR jl.is_substitute
    OR jl.candidate_supplier_id <> 1 OR jl.available_quantity IS NOT NULL THEN
    RAISE EXCEPTION 'job_lines default: %', row_to_json(jl); END IF;

  -- An unasked default follows the line's ask.
  UPDATE public.job_request_items SET name = 'Live Oak', demanded_quantity = 12 WHERE id = 99300;
  SELECT * INTO c FROM public.candidates WHERE id = def_a;
  IF c.name <> 'Live Oak' OR c.demanded_quantity <> 12 OR c.size <> '5 G' THEN RAISE EXCEPTION 'default sync: %', row_to_json(c); END IF;

  -- The default stays the line's active, visible APS original.
  BEGIN
    UPDATE public.candidates SET hide_from_lps = true WHERE id = def_a;
    RAISE EXCEPTION 'default hidden';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The line''s default candidate%' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.candidates SET is_active = false WHERE id = def_a;
    RAISE EXCEPTION 'default deactivated';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The line''s default candidate%' THEN RAISE; END IF; END;
  BEGIN
    UPDATE public.candidates SET is_original = false WHERE id = def_a;
    RAISE EXCEPTION 'default demoted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The line''s default candidate%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.delete_candidate(def_a);
    RAISE EXCEPTION 'default deleted by RPC';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The line''s default candidate can''t be deleted%' THEN RAISE; END IF; END;
  BEGIN
    DELETE FROM public.candidates WHERE id = def_a;
    RAISE EXCEPTION 'default deleted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The line''s default candidate can''t be deleted%' THEN RAISE; END IF; END;

  INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name, size, demanded_quantity, unit_price,
      description, is_original) OVERRIDING SYSTEM VALUE VALUES
    (99300, 99300, 99300, 'Live Oak', '5 G', 12, 20, '5 G Live Oak', true),
    (99301, 99300, 99300, 'Live Oak', '7 G', NULL, 30, '7 G Live Oak', false),
    (99302, 99300, 99300, 'Live Oak', '3 G', NULL, 15, '3 G Live Oak', false),
    (99303, 1, 99300, 'Live Oak', '15 G', NULL, 50, '15 G Live Oak', false),
    (99310, 99300, 99301, 'Elm', '3 G', 5, 8, '3 G Elm', true),
    (99311, 99300, 99301, 'Elm', '5 G', NULL, 9, '5 G Elm', false),
    (99312, 99300, 99301, 'Elm', '1 G', NULL, 4, '1 G Elm', false),
    (99313, 99300, 99301, 'Elm', '7 G', NULL, 12, '7 G Elm', false),
    (99314, 1, 99301, 'Elm', '15 G', NULL, 40, '15 G Elm', false),
    (99320, 99300, 99302, 'Ash', NULL, 2, 6, 'Ash', true),
    (99330, 99300, 99303, 'Yew', '1 G', 1, 3, '1 G Yew', true);

  -- Selecting only points the line at a candidate; unselect and deactivation return to the default.
  PERFORM public.select_candidate(99300, 99303);
  SELECT * INTO jl FROM public.job_lines WHERE id = 99300;
  IF jl.selected_candidate_id <> 99303 OR NOT jl.is_substitute OR jl.quote_name <> '15 G Live Oak' OR jl.size <> '15 G'
    OR jl.requested_size <> '5 G' OR jl.unit_price <> 50 OR jl.status <> 'pending' THEN
    RAISE EXCEPTION 'select: %', row_to_json(jl); END IF;
  PERFORM public.unselect_candidate(99300);
  IF (SELECT selected_candidate_id FROM public.job_request_items WHERE id = 99300) <> def_a THEN RAISE EXCEPTION 'unselect'; END IF;
  PERFORM public.unselect_candidate(99300);
  PERFORM public.select_candidate(99300, 99303);
  PERFORM public.delete_candidate(99303);
  IF (SELECT selected_candidate_id FROM public.job_request_items WHERE id = 99300) <> def_a THEN RAISE EXCEPTION 'deactivation fallback'; END IF;
  UPDATE public.candidates SET hide_from_lps = true WHERE id = 99302;
  BEGIN
    PERFORM public.select_candidate(99300, 99302);
    RAISE EXCEPTION 'hidden candidate selected';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Candidate is hidden%' THEN RAISE; END IF; END;
  UPDATE public.candidates SET hide_from_lps = false WHERE id = 99302;

  -- update_job_line writes the selected candidate; status sets the quantity.
  PERFORM public.update_job_line(99300, '{"status":"available","unit_price":"25"}');
  SELECT * INTO c FROM public.candidates WHERE id = def_a;
  SELECT * INTO jl FROM public.job_lines WHERE id = 99300;
  IF c.status <> 'available' OR c.available_quantity <> 12 OR c.unit_price <> 25 OR c.answered_at IS NOT NULL
    OR jl.status <> 'available' OR jl.available_quantity <> 12 OR jl.total <> 300 THEN
    RAISE EXCEPTION 'line available: % / %', row_to_json(c), row_to_json(jl); END IF;
  PERFORM public.update_job_line(99300, '{"available_quantity":"5"}');
  SELECT * INTO jl FROM public.job_lines WHERE id = 99300;
  IF (SELECT status FROM public.candidates WHERE id = def_a) <> 'partial_qty' OR jl.status <> 'partial_qty'
    OR jl.available_quantity <> 5 THEN RAISE EXCEPTION 'available below demand: %', row_to_json(jl); END IF;
  -- A note-only edit keeps the quantity.
  PERFORM public.update_job_line(99300, '{"note_for_customer":"Shade grown"}');
  UPDATE public.candidates SET note_from_supplier = 'Supplier reply' WHERE id = def_a;
  SELECT * INTO jl FROM public.job_lines WHERE id = 99300;
  IF jl.available_quantity <> 5 OR jl.note_for_customer <> 'Shade grown' THEN RAISE EXCEPTION 'note override: %', row_to_json(jl); END IF;
  PERFORM public.update_job_line(99300, '{"note_for_customer":""}');
  IF (SELECT note_for_customer FROM public.job_lines WHERE id = 99300) IS NOT NULL THEN RAISE EXCEPTION 'blank note override'; END IF;
  PERFORM public.update_job_line(99300, '{"note_for_customer":null}');
  IF (SELECT note_for_customer FROM public.job_lines WHERE id = 99300) IS DISTINCT FROM 'Supplier reply'
    OR (SELECT note_for_customer FROM public.candidates WHERE id = def_a) IS NOT NULL THEN RAISE EXCEPTION 'note follows supplier'; END IF;
  PERFORM public.update_job_line(99300, '{"status":"partial_qty","available_quantity":"12"}');
  SELECT * INTO c FROM public.candidates WHERE id = def_a;
  IF c.status <> 'available' OR c.available_quantity <> 12 THEN RAISE EXCEPTION 'partial at demand: %', row_to_json(c); END IF;
  PERFORM public.update_job_line(99300, '{"status":"unavailable"}');
  SELECT * INTO jl FROM public.job_lines WHERE id = 99300;
  IF jl.status <> 'unavailable' OR jl.available_quantity <> 0 THEN RAISE EXCEPTION 'line unavailable: %', row_to_json(jl); END IF;
  PERFORM public.update_job_line(99300, '{"status":"need_to_order"}');
  SELECT * INTO jl FROM public.job_lines WHERE id = 99300;
  IF jl.status <> 'need_to_order' OR (SELECT status FROM public.candidates WHERE id = def_a) <> 'can_order' THEN
    RAISE EXCEPTION 'need to order: %', row_to_json(jl); END IF;
  PERFORM public.update_job_line(99300, '{"status":"pending","unit_price":"0"}');
  SELECT * INTO jl FROM public.job_lines WHERE id = 99300;
  IF jl.status <> 'pending' OR jl.unit_price IS NOT NULL OR jl.total IS NOT NULL THEN RAISE EXCEPTION 'pending: %', row_to_json(jl); END IF;
  BEGIN
    PERFORM public.update_job_line(99300, '{"status":"diff_size_sub"}');
    RAISE EXCEPTION 'Diff Sz/Sub without a substitute';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Diff Sz/Sub needs a substitute%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.update_job_line(99300, '{"status":"alternative_proposed"}');
    RAISE EXCEPTION 'retired status accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Choose a valid line status%' THEN RAISE; END IF; END;

  -- Every writer: available = demand (the line's when the candidate has none), unavailable = 0,
  -- a substitute = demand unless given; only a status change acts.
  UPDATE public.candidates SET status = 'available' WHERE id = 99302;
  IF (SELECT available_quantity FROM public.candidates WHERE id = 99302) <> 12 THEN RAISE EXCEPTION 'available = line demand'; END IF;
  UPDATE public.candidates SET status = 'unavailable' WHERE id = 99302;
  IF (SELECT available_quantity FROM public.candidates WHERE id = 99302) <> 0 THEN RAISE EXCEPTION 'unavailable = 0'; END IF;
  UPDATE public.candidates SET status = 'diff_size_sub', available_quantity = NULL WHERE id = 99302;
  IF (SELECT available_quantity FROM public.candidates WHERE id = 99302) <> 12 THEN RAISE EXCEPTION 'sub = demand'; END IF;
  UPDATE public.candidates SET status = 'partial_qty', available_quantity = 4 WHERE id = 99302;
  UPDATE public.candidates SET status = 'partial_qty', note_from_supplier = 'four' WHERE id = 99302;
  IF (SELECT available_quantity FROM public.candidates WHERE id = 99302) <> 4 THEN RAISE EXCEPTION 'unchanged status reset quantity'; END IF;
  -- A selected substitute answered Available reads Diff Sz/Sub.
  UPDATE public.candidates SET status = 'available' WHERE id = 99302;
  PERFORM public.select_candidate(99300, 99302);
  SELECT * INTO jl FROM public.job_lines WHERE id = 99300;
  IF jl.status <> 'diff_size_sub' OR jl.quote_name <> '3 G Live Oak' OR jl.note_for_customer <> 'four' THEN
    RAISE EXCEPTION 'substitute line: %', row_to_json(jl); END IF;
  PERFORM public.unselect_candidate(99300);
  UPDATE public.candidates SET status = NULL, available_quantity = NULL, note_from_supplier = NULL WHERE id = 99302;

  -- Asking: a draft AR, then published.
  ar_id := public.create_availability_request(99300, ARRAY[99300, 99302, 99310, 99312]::bigint[]);
  PERFORM public.send_availability_request(ar_id);

  -- Supplier answers. Available = demand, and the AR moves to Processing.
  PERFORM public.answer_availability_request(ar_id, 99300, 99300, '{"status":"available"}');
  SELECT * INTO c FROM public.candidates WHERE id = 99300;
  IF c.status <> 'available' OR c.available_quantity <> 12 OR c.answered_at IS NULL
    OR (SELECT status FROM public.availability_requests WHERE id = ar_id) <> 'processing' THEN
    RAISE EXCEPTION 'answer available: %', row_to_json(c); END IF;
  PERFORM public.answer_availability_request(ar_id, 99300, 99300, '{"status":"partial_qty","available_quantity":"4"}');
  SELECT * INTO c FROM public.candidates WHERE id = 99300;
  IF c.status <> 'partial_qty' OR c.available_quantity <> 4 THEN RAISE EXCEPTION 'answer partial: %', row_to_json(c); END IF;
  PERFORM public.answer_availability_request(ar_id, 99300, 99300, '{"status":"available","available_quantity":"3"}');
  SELECT * INTO c FROM public.candidates WHERE id = 99300;
  IF c.status <> 'partial_qty' OR c.available_quantity <> 3 THEN RAISE EXCEPTION 'answer available below demand: %', row_to_json(c); END IF;
  PERFORM public.answer_availability_request(ar_id, 99300, 99300, '{"status":"partial_qty","available_quantity":"12"}');
  SELECT * INTO c FROM public.candidates WHERE id = 99300;
  IF c.status <> 'available' OR c.available_quantity <> 12 THEN RAISE EXCEPTION 'answer partial at demand: %', row_to_json(c); END IF;
  PERFORM public.answer_availability_request(ar_id, 99300, 99300,
    '{"status":"unavailable","offered_candidate_id":"","offer_description":""}');
  SELECT * INTO c FROM public.candidates WHERE id = 99300;
  IF c.status <> 'unavailable' OR c.available_quantity <> 0 OR c.offered_candidate_id IS NOT NULL THEN
    RAISE EXCEPTION 'answer no sub: %', row_to_json(c); END IF;
  BEGIN
    PERFORM public.answer_availability_request(ar_id, 99300, 99300, '{"status":"diff_size_sub"}');
    RAISE EXCEPTION 'Diff Sz/Sub answered without a substitute';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Pick or describe the substitute%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.answer_availability_request(ar_id, 99300, 99300, '{"status":"diff_size_sub","offered_candidate_id":"99302"}');
    RAISE EXCEPTION 'asked row picked as a substitute';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'That candidate is asked on this request%' THEN RAISE; END IF; END;

  -- Picked substitute: the asked row is Unavailable offering it; it is Diff Sz/Sub at demand on the AR.
  PERFORM public.answer_availability_request(ar_id, 99300, 99300,
    '{"status":"diff_size_sub","offered_candidate_id":"99301","note_from_supplier":"7 G instead","offer_unit_price":"","offer_quantity":""}');
  SELECT * INTO c FROM public.candidates WHERE id = 99300;
  IF c.status <> 'unavailable' OR c.available_quantity <> 0 OR c.offered_candidate_id <> 99301
    OR c.offer_description IS NOT NULL OR c.note_from_supplier IS NOT NULL OR c.unit_price <> 20 THEN
    RAISE EXCEPTION 'picked asker: %', row_to_json(c); END IF;
  SELECT * INTO c FROM public.candidates WHERE id = 99301;
  IF c.status <> 'diff_size_sub' OR c.available_quantity <> 12 OR c.availability_request_id IS DISTINCT FROM ar_id
    OR c.hide_from_lps OR c.note_from_supplier <> '7 G instead' OR c.answered_at IS NULL OR c.unit_price <> 30 THEN
    RAISE EXCEPTION 'picked sub: %', row_to_json(c); END IF;
  PERFORM public.select_candidate(99300, 99300);
  IF (SELECT status FROM public.job_lines WHERE id = 99300) <> 'diff_size_sub' THEN RAISE EXCEPTION 'asker with sub reads Diff Sz/Sub'; END IF;
  -- Price, quantity and note edits on the asked row go to the substitute.
  PERFORM public.answer_availability_request(ar_id, 99300, 99300,
    '{"unit_price":"33","available_quantity":"6","note_from_supplier":"only 6"}');
  SELECT * INTO c FROM public.candidates WHERE id = 99301;
  IF c.unit_price <> 33 OR c.available_quantity <> 6 OR c.note_from_supplier <> 'only 6' OR c.status <> 'diff_size_sub' THEN
    RAISE EXCEPTION 'redirect to sub: %', row_to_json(c); END IF;
  SELECT * INTO c FROM public.candidates WHERE id = 99300;
  IF c.unit_price <> 20 OR c.available_quantity <> 0 OR c.status <> 'unavailable' OR c.note_from_supplier IS NOT NULL THEN
    RAISE EXCEPTION 'redirect left asker: %', row_to_json(c); END IF;
  -- Unavailable alone keeps the substitute and its quantity.
  PERFORM public.answer_availability_request(ar_id, 99300, 99300, '{"status":"unavailable"}');
  IF (SELECT offered_candidate_id FROM public.candidates WHERE id = 99300) IS DISTINCT FROM 99301
    OR (SELECT available_quantity FROM public.candidates WHERE id = 99301) <> 6 THEN RAISE EXCEPTION 'unavailable kept sub'; END IF;
  BEGIN
    PERFORM public.answer_availability_request(ar_id, 99300, 99301, '{"unit_price":"1"}');
    RAISE EXCEPTION 'substitute answered directly';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'This is a substitute%' THEN RAISE; END IF; END;

  -- A typed substitute replaces the picked one: the picked one is reset and leaves the AR.
  PERFORM public.answer_availability_request(ar_id, 99300, 99300,
    '{"status":"diff_size_sub","offered_candidate_id":"","offer_description":"Live Oak 10 G","note_from_supplier":"10 G ok"}');
  SELECT offered_candidate_id INTO ph FROM public.candidates WHERE id = 99300;
  SELECT * INTO c FROM public.candidates WHERE id = ph;
  IF c.name <> 'Live Oak 10 G' OR c.description <> 'Live Oak 10 G' OR c.is_original OR c.status <> 'diff_size_sub'
    OR c.available_quantity <> 12 OR c.unit_price IS NOT NULL OR c.note_from_supplier <> '10 G ok'
    OR c.availability_request_id IS DISTINCT FROM ar_id OR c.job_request_item_id <> 99300 OR c.supplier_id <> 99300 THEN
    RAISE EXCEPTION 'typed placeholder: %', row_to_json(c); END IF;
  SELECT * INTO c FROM public.candidates WHERE id = 99301;
  IF c.status IS NOT NULL OR c.available_quantity IS NOT NULL OR c.note_from_supplier IS NOT NULL
    OR c.availability_request_id IS NOT NULL OR c.answered_at IS NOT NULL THEN RAISE EXCEPTION 'replaced sub reset: %', row_to_json(c); END IF;
  IF (SELECT offer_description FROM public.candidates WHERE id = 99300) <> 'Live Oak 10 G'
    OR (SELECT status FROM public.availability_requests WHERE id = ar_id) <> 'processing' THEN RAISE EXCEPTION 'typed asker'; END IF;
  PERFORM public.select_candidate(99300, ph);
  SELECT * INTO jl FROM public.job_lines WHERE id = 99300;
  IF jl.status <> 'diff_size_sub' OR jl.unit_price IS NOT NULL OR jl.quote_name <> 'Live Oak 10 G' OR NOT jl.is_substitute THEN
    RAISE EXCEPTION 'placeholder line: %', row_to_json(jl); END IF;
  -- Clearing a typed substitute retires it; the line falls back to its default.
  PERFORM public.answer_availability_request(ar_id, 99300, 99300,
    '{"status":"unavailable","offered_candidate_id":"","offer_description":""}');
  IF (SELECT is_active FROM public.candidates WHERE id = ph)
    OR (SELECT selected_candidate_id FROM public.job_request_items WHERE id = 99300) <> def_a
    OR (SELECT offered_candidate_id FROM public.candidates WHERE id = 99300) IS NOT NULL THEN RAISE EXCEPTION 'typed sub cleared'; END IF;
  -- An LPS edit keeps the AR's status.
  PERFORM public.edit_availability_request(ar_id, 99300, 99300, '{"unit_price":"21"}');
  IF (SELECT status FROM public.availability_requests WHERE id = ar_id) <> 'processing'
    OR (SELECT unit_price FROM public.candidates WHERE id = 99300) <> 21 THEN RAISE EXCEPTION 'admin edit status'; END IF;

  -- Submission: a selected asked row with a substitute switches the line to it; this AR's
  -- other alternatives are hidden, except the line's selection, originals and their substitutes.
  PERFORM public.select_candidate(99301, 99310);
  PERFORM public.answer_availability_request(ar_id, 99300, 99310,
    '{"status":"unavailable","offered_candidate_id":"99311","note_from_supplier":"5 G only"}');
  PERFORM public.answer_availability_request(ar_id, 99300, 99312, '{"status":"available","unit_price":"4"}');
  PERFORM public.answer_availability_request(ar_id, 99300, 99302, '{"status":"available"}');
  PERFORM public.select_candidate(99300, 99302);
  PERFORM public.answer_availability_request(ar_id, 99300, p_submit => true);
  SELECT * INTO ar FROM public.availability_requests WHERE id = ar_id;
  first_submit := ar.submitted_at;
  IF ar.status <> 'submitted' OR first_submit IS NULL THEN RAISE EXCEPTION 'submit: %', row_to_json(ar); END IF;
  IF (SELECT selected_candidate_id FROM public.job_request_items WHERE id = 99301) <> 99311 THEN RAISE EXCEPTION 'switch to sub'; END IF;
  IF NOT (SELECT hide_from_lps FROM public.candidates WHERE id = 99312) THEN RAISE EXCEPTION 'asked alternative not hidden'; END IF;
  IF EXISTS (SELECT 1 FROM public.candidates WHERE id IN (99300, 99301, 99302, 99310, 99311, 99313, 99314, def_a, def_b)
    AND hide_from_lps) THEN RAISE EXCEPTION 'hidden too much'; END IF;

  -- Nothing returns the AR to New by itself.
  PERFORM public.edit_availability_request(ar_id, 99300, 99312, '{"unit_price":"5"}');
  UPDATE public.candidates SET note_for_supplier = 'Keep shaded' WHERE id = 99310;
  UPDATE public.candidates SET hide_from_lps = false WHERE id = 99312;
  INSERT INTO public.job_request_items(id, job_request_id, name) OVERRIDING SYSTEM VALUE VALUES (99304, 99300, 'New item');
  IF (SELECT status FROM public.availability_requests WHERE id = ar_id) <> 'submitted' THEN RAISE EXCEPTION 'automatic New'; END IF;
  -- Asking more of it needs an explicit reopen.
  BEGIN
    PERFORM public.add_candidates_to_availability_request(ar_id, ARRAY[99313]::bigint[]);
    RAISE EXCEPTION 'added to a submitted AR';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'AR-% is submitted: reopen it%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.create_availability_request(99300, ARRAY[99313]::bigint[]);
    RAISE EXCEPTION 'second AR for the job and supplier';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%reopen it first if it is submitted%' THEN RAISE; END IF; END;
  PERFORM public.reopen_availability_request(ar_id);
  SELECT * INTO ar FROM public.availability_requests WHERE id = ar_id;
  IF ar.status <> 'new' OR ar.submitted_at IS DISTINCT FROM first_submit OR ar.public_token IS NULL THEN
    RAISE EXCEPTION 'reopen: %', row_to_json(ar); END IF;
  BEGIN
    PERFORM public.reopen_availability_request(ar_id);
    RAISE EXCEPTION 'reopened a New AR';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only a submitted, processing or closed request%' THEN RAISE; END IF; END;
  aps_ar := public.create_availability_request(1, ARRAY[def_b]::bigint[]);
  BEGIN
    PERFORM public.reopen_availability_request(aps_ar);
    RAISE EXCEPTION 'reopened a draft';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only a submitted, processing or closed request%' THEN RAISE; END IF; END;

  -- Attaching clears an earlier supplier answer, not values LPS set by hand.
  INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name, size, status, answered_at, is_original)
    OVERRIDING SYSTEM VALUE VALUES
    (99315, 99300, 99301, 'Elm', '10 G', 'available', now(), false),
    (99316, 99300, 99301, 'Elm', '15 G', 'unavailable', NULL, false);
  PERFORM public.add_candidates_to_availability_request(ar_id, ARRAY[99313, 99315, 99316]::bigint[]);
  SELECT * INTO c FROM public.candidates WHERE id = 99315;
  IF c.status IS NOT NULL OR c.available_quantity IS NOT NULL OR c.answered_at IS NOT NULL THEN RAISE EXCEPTION 'attach clears answer: %', row_to_json(c); END IF;
  SELECT * INTO c FROM public.candidates WHERE id = 99316;
  IF c.status <> 'unavailable' OR c.available_quantity <> 0 THEN RAISE EXCEPTION 'attach kept LPS value: %', row_to_json(c); END IF;
  IF (SELECT status FROM public.availability_requests WHERE id = ar_id) <> 'new' THEN RAISE EXCEPTION 'attach moved the AR'; END IF;

  -- Submitting again does not re-switch a line LPS moved back (no newer answer).
  PERFORM public.select_candidate(99301, 99310);
  PERFORM public.answer_availability_request(ar_id, 99300, p_submit => true);
  IF (SELECT selected_candidate_id FROM public.job_request_items WHERE id = 99301) <> 99310 THEN RAISE EXCEPTION 're-switched'; END IF;

  -- Orders: answered, priced sources only; a substitute orders as Diff Sz/Sub with its effective note.
  BEGIN
    PERFORM public.create_order(99300, '[{"candidate_id":99310,"allocations":[{"job_request_item_id":99301,"quantity":1}]}]',
      p_customer_confirmed => true);
    RAISE EXCEPTION 'ordered an Unavailable answer';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Supplier must answer%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.create_order(99300, '[{"candidate_id":99313,"allocations":[{"job_request_item_id":99301,"quantity":1}]}]',
      p_customer_confirmed => true);
    RAISE EXCEPTION 'ordered an unanswered line';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Supplier must answer%' THEN RAISE; END IF; END;
  PERFORM public.edit_availability_request(ar_id, 99300, 99300,
    '{"status":"diff_size_sub","offered_candidate_id":"","offer_description":"Oak 10 G"}');
  SELECT offered_candidate_id INTO ph FROM public.candidates WHERE id = 99300;
  IF (SELECT status FROM public.availability_requests WHERE id = ar_id) <> 'submitted' THEN RAISE EXCEPTION 'admin sub moved the AR'; END IF;
  BEGIN
    PERFORM public.create_order(99300, format('[{"candidate_id":%s,"allocations":[{"job_request_item_id":99300,"quantity":1}]}]', ph)::jsonb,
      p_customer_confirmed => true);
    RAISE EXCEPTION 'ordered an unpriced placeholder';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Price this line before ordering%' THEN RAISE; END IF; END;
  ord := public.create_order(99300,
    '[{"candidate_id":99311,"allocations":[{"job_request_item_id":99301,"quantity":2}]},
      {"candidate_id":99302,"allocations":[{"job_request_item_id":99300,"quantity":1}]}]', p_customer_confirmed => true);
  SELECT * INTO oi FROM public.order_items WHERE order_items.order_id = ord AND unit_price = 9;
  IF oi.status <> 'diff_size_sub' OR oi.note_for_customer IS DISTINCT FROM '5 G only' OR oi.quantity <> 2 THEN
    RAISE EXCEPTION 'order substitute: %', row_to_json(oi); END IF;
  SELECT * INTO oi FROM public.order_items WHERE order_items.order_id = ord AND unit_price = 15;
  IF oi.status <> 'diff_size_sub' THEN RAISE EXCEPTION 'order available alternative: %', row_to_json(oi); END IF;
  -- An old partner client's status maps to the new name; the old name is gone from the data.
  PERFORM public.update_partner_order_item(ord, 99300, oi.id, 'arriving_soon');
  PERFORM public.update_partner_order_item(ord, 99300, oi.id, 'diff_size_qty_sub');
  IF (SELECT status FROM public.order_items WHERE id = oi.id) <> 'diff_size_sub' THEN RAISE EXCEPTION 'legacy order status'; END IF;
  BEGIN
    UPDATE public.candidates SET status = 'diff_size_qty_sub' WHERE id = 99313;
    RAISE EXCEPTION 'old status stored';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- Direct orders take the quoted line from job_lines; an unpriced line is refused.
  ord := public.create_direct_order(99300, '[{"job_request_item_id":99300,"quantity":1}]', p_customer_confirmed => true);
  SELECT * INTO oi FROM public.order_items WHERE order_items.order_id = ord;
  IF oi.name <> '3 G Live Oak' OR oi.size <> '3 G' OR oi.unit_price <> 15 OR oi.status <> 'diff_size_sub' THEN
    RAISE EXCEPTION 'direct order: %', row_to_json(oi); END IF;
  BEGIN
    PERFORM public.create_direct_order(99300, '[{"job_request_item_id":99302,"quantity":1}]', p_customer_confirmed => true);
    RAISE EXCEPTION 'direct-ordered an unpriced line';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Price this line before ordering%' THEN RAISE; END IF; END;

  -- On a line showing an answer with a substitute, Diff Sz/Sub keeps it; leaving Unavailable retires it.
  PERFORM public.select_candidate(99300, 99300);
  PERFORM public.update_job_line(99300, '{"status":"diff_size_sub"}');
  SELECT * INTO c FROM public.candidates WHERE id = 99300;
  IF c.status <> 'unavailable' OR c.offered_candidate_id IS DISTINCT FROM ph THEN RAISE EXCEPTION 'line diff keeps sub: %', row_to_json(c); END IF;
  -- Only leaving Unavailable releases it: a note edit on a row that is not Unavailable leaves any offer alone.
  UPDATE public.candidates SET status = 'available' WHERE id = 99300;
  PERFORM public.update_job_line(99300, '{"note_for_customer":"x"}');
  IF NOT (SELECT is_active FROM public.candidates WHERE id = ph)
    OR (SELECT offered_candidate_id FROM public.candidates WHERE id = 99300) IS DISTINCT FROM ph THEN
    RAISE EXCEPTION 'note edit released the substitute'; END IF;
  UPDATE public.candidates SET status = 'unavailable' WHERE id = 99300;
  PERFORM public.update_job_line(99300, '{"status":"available"}');
  SELECT * INTO c FROM public.candidates WHERE id = 99300;
  IF c.status <> 'available' OR c.available_quantity <> 12 OR c.offered_candidate_id IS NOT NULL OR c.answered_at IS NULL
    OR (SELECT is_active FROM public.candidates WHERE id = ph)
    OR (SELECT status FROM public.availability_requests WHERE id = ar_id) <> 'submitted' THEN
    RAISE EXCEPTION 'line leaves unavailable: %', row_to_json(c); END IF;

  -- On a closed AR, LPS still edits the line's values; other writes are refused.
  UPDATE public.availability_requests SET status = 'closed' WHERE id = ar_id;
  PERFORM public.update_job_line(99300, '{"unit_price":"22"}');
  IF (SELECT unit_price FROM public.job_lines WHERE id = 99300) <> 22 THEN RAISE EXCEPTION 'closed AR override'; END IF;
  BEGIN
    UPDATE public.candidates SET unit_price = 23 WHERE id = 99300;
    RAISE EXCEPTION 'closed AR written';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'This request is closed%' THEN RAISE; END IF; END;
  -- A closed AR on an open job reopens with a fresh link.
  PERFORM public.reopen_availability_request(ar_id);
  SELECT * INTO ar FROM public.availability_requests WHERE id = ar_id;
  IF ar.status <> 'new' OR ar.public_token IS NULL THEN RAISE EXCEPTION 'reopen closed: %', row_to_json(ar); END IF;

  -- Deleting a line removes it and its unasked candidates; asked ones stay on the AR without a line.
  PERFORM public.add_candidates_to_availability_request(ar_id, ARRAY[99320]::bigint[]);
  res := public.delete_job_request_item(99300, 99302);
  IF res->>'availabilityRequestItems' <> '1' OR EXISTS (SELECT 1 FROM public.job_request_items WHERE id = 99302)
    OR EXISTS (SELECT 1 FROM public.candidates WHERE id = def_c)
    OR NOT EXISTS (SELECT 1 FROM public.candidates WHERE id = 99320 AND job_request_item_id IS NULL AND availability_request_id = ar_id) THEN
    RAISE EXCEPTION 'delete line: %', res; END IF;
  -- Deleting a job deletes its lines before their unasked candidates.
  PERFORM public.delete_job_request(99301);
  IF EXISTS (SELECT 1 FROM public.job_request_items WHERE id = 99303)
    OR EXISTS (SELECT 1 FROM public.candidates WHERE id IN (99330, def_d)) THEN RAISE EXCEPTION 'delete job'; END IF;

  RAISE NOTICE '0130 asserts passed';
END $$;
