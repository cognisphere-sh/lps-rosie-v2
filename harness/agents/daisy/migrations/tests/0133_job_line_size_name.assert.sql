-- Run after 0133 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0133 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE def_a bigint; def_b bigint; def_c bigint; ar_id bigint; c public.candidates;
  ji public.job_request_items; jl public.job_lines;
BEGIN
  INSERT INTO public.suppliers(id, name, head_branch_id, is_lps_partner) OVERRIDING SYSTEM VALUE
    VALUES (99330, 'Test Nursery 0133', 99330, false);
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99330, 'Test 0133', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99330, 99330, 'Oak', '5 G', 10), (99331, 99330, 'Elm', '3 G', 5),
      (99332, 99330, 'Ash', '3 G', 2), (99333, 99330, 'Yew', '1 G', 1);
  SELECT default_candidate_id INTO def_a FROM public.job_request_items WHERE id = 99330;
  SELECT default_candidate_id INTO def_b FROM public.job_request_items WHERE id = 99331;
  SELECT default_candidate_id INTO def_c FROM public.job_request_items WHERE id = 99332;

  -- 1. Original, unasked default: line, candidate and job_lines change; a
  --    generated description (any case) is regenerated.
  UPDATE public.candidates SET description = '5 g OAK' WHERE id = def_a;
  PERFORM public.update_job_line(99330, '{"size":" 7 G ","name":"Live Oak"}');
  SELECT * INTO ji FROM public.job_request_items WHERE id = 99330;
  SELECT * INTO c FROM public.candidates WHERE id = def_a;
  SELECT * INTO jl FROM public.job_lines WHERE id = 99330;
  IF ji.size IS DISTINCT FROM '7 G' OR ji.name IS DISTINCT FROM 'Live Oak' THEN RAISE EXCEPTION 'original line: %', row_to_json(ji); END IF;
  IF c.size IS DISTINCT FROM '7 G' OR c.name IS DISTINCT FROM 'Live Oak' OR c.description IS DISTINCT FROM '7 G Live Oak' OR NOT c.is_original THEN
    RAISE EXCEPTION 'original candidate: %', row_to_json(c); END IF;
  IF jl.size IS DISTINCT FROM '7 G' OR jl.requested_size IS DISTINCT FROM '7 G' OR jl.name IS DISTINCT FROM 'Live Oak' THEN RAISE EXCEPTION 'original job_lines: %', row_to_json(jl); END IF;
  -- A blank size is NULL.
  PERFORM public.update_job_line(99330, '{"size":"  "}');
  SELECT * INTO c FROM public.candidates WHERE id = def_a;
  IF (SELECT size FROM public.job_request_items WHERE id = 99330) IS NOT NULL OR c.size IS NOT NULL
    OR c.description IS DISTINCT FROM 'Live Oak' OR (SELECT size FROM public.job_lines WHERE id = 99330) IS NOT NULL THEN
    RAISE EXCEPTION 'blank size: %', row_to_json(c); END IF;
  -- An empty or null name is refused.
  BEGIN
    PERFORM public.update_job_line(99330, '{"name":"  "}');
    RAISE EXCEPTION 'empty name accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM IS DISTINCT FROM 'Plant name is required' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.update_job_line(99330, '{"name":null}');
    RAISE EXCEPTION 'null name accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM IS DISTINCT FROM 'Plant name is required' THEN RAISE; END IF; END;

  -- 2. Asked default on a published AR: candidate written by update_job_line
  --    (the sync trigger skips asked defaults); not an answer, AR stays New.
  ar_id := public.create_availability_request(1, ARRAY[def_b]::bigint[]);
  PERFORM public.send_availability_request(ar_id);
  PERFORM public.update_job_line(99331, '{"size":"5 G"}');
  SELECT * INTO c FROM public.candidates WHERE id = def_b;
  IF c.size IS DISTINCT FROM '5 G' OR c.description IS DISTINCT FROM '5 G Elm' OR c.answered_at IS NOT NULL OR NOT c.is_original
    OR (SELECT size FROM public.job_request_items WHERE id = 99331) IS DISTINCT FROM '5 G'
    OR (SELECT size FROM public.job_lines WHERE id = 99331) IS DISTINCT FROM '5 G' THEN RAISE EXCEPTION 'asked default: %', row_to_json(c); END IF;
  IF (SELECT status FROM public.availability_requests WHERE id = ar_id) IS DISTINCT FROM 'new' THEN RAISE EXCEPTION 'AR moved'; END IF;
  -- Closed AR allowed, combined with a status.
  UPDATE public.availability_requests SET status = 'closed' WHERE id = ar_id;
  PERFORM public.update_job_line(99331, '{"name":"Red Elm","status":"available"}');
  SELECT * INTO c FROM public.candidates WHERE id = def_b;
  SELECT * INTO jl FROM public.job_lines WHERE id = 99331;
  IF c.name IS DISTINCT FROM 'Red Elm' OR c.description IS DISTINCT FROM '5 G Red Elm' OR c.answered_at IS NOT NULL
    OR jl.name IS DISTINCT FROM 'Red Elm' OR jl.status IS DISTINCT FROM 'available' OR jl.available_quantity IS DISTINCT FROM 5 THEN
    RAISE EXCEPTION 'closed AR + status: % %', row_to_json(c), row_to_json(jl); END IF;
  IF (SELECT status FROM public.availability_requests WHERE id = ar_id) IS DISTINCT FROM 'closed' THEN RAISE EXCEPTION 'closed AR moved'; END IF;

  -- 3. Substitute: only the candidate changes; the line keeps its ask.
  INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name, size, unit_price, description, is_original)
    OVERRIDING SYSTEM VALUE VALUES
    (99330, 99330, 99332, 'Ash', '15 G', 40, '15 G Ash', false),
    (99331, 99330, 99333, 'Yew', '5 G', 12, 'Taxus baccata 5 gal', false);
  PERFORM public.select_candidate(99332, 99330);
  PERFORM public.update_job_line(99332, '{"size":"10 G","name":"White Ash"}');
  SELECT * INTO c FROM public.candidates WHERE id = 99330;
  SELECT * INTO ji FROM public.job_request_items WHERE id = 99332;
  SELECT * INTO jl FROM public.job_lines WHERE id = 99332;
  IF c.size IS DISTINCT FROM '10 G' OR c.name IS DISTINCT FROM 'White Ash' OR c.description IS DISTINCT FROM '10 G White Ash' OR c.is_original THEN
    RAISE EXCEPTION 'substitute candidate: %', row_to_json(c); END IF;
  IF ji.size IS DISTINCT FROM '3 G' OR ji.name IS DISTINCT FROM 'Ash' THEN RAISE EXCEPTION 'substitute line ask: %', row_to_json(ji); END IF;
  IF jl.size IS DISTINCT FROM '10 G' OR jl.requested_size IS DISTINCT FROM '3 G' OR jl.name IS DISTINCT FROM 'Ash' OR jl.candidate_name IS DISTINCT FROM 'White Ash'
    OR NOT jl.is_substitute THEN RAISE EXCEPTION 'substitute job_lines: %', row_to_json(jl); END IF;
  SELECT * INTO c FROM public.candidates WHERE id = def_c;
  IF c.size IS DISTINCT FROM '3 G' OR c.name IS DISTINCT FROM 'Ash' THEN RAISE EXCEPTION 'substitute moved the default: %', row_to_json(c); END IF;
  -- A custom description is kept.
  PERFORM public.select_candidate(99333, 99331);
  PERFORM public.update_job_line(99333, '{"size":"7 G"}');
  SELECT * INTO c FROM public.candidates WHERE id = 99331;
  IF c.size IS DISTINCT FROM '7 G' OR c.description IS DISTINCT FROM 'Taxus baccata 5 gal'
    OR (SELECT size FROM public.job_request_items WHERE id = 99333) IS DISTINCT FROM '1 G' THEN
    RAISE EXCEPTION 'custom description: %', row_to_json(c); END IF;
  -- A "<size> <own text>" description swaps its size, and the quote prints
  --    it; a name edit rebuilds it from size and name.
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99334, 99330, 'Palm', '30 G', 1);
  INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name, size, unit_price, description, is_original)
    OVERRIDING SYSTEM VALUE VALUES
    (99332, 99330, 99334, 'Mediterranean Fan Palm | Chamaerops humilis', '30 G', 300, '30 g Mediterranean Fan Palm', false);
  PERFORM public.select_candidate(99334, 99332);
  PERFORM public.update_job_line(99334, '{"size":"24\" Box"}');
  SELECT * INTO jl FROM public.job_lines WHERE id = 99334;
  IF jl.size IS DISTINCT FROM '24" Box' OR jl.quote_name IS DISTINCT FROM '24" Box Mediterranean Fan Palm' THEN
    RAISE EXCEPTION 'sized description: %', row_to_json(jl); END IF;
  PERFORM public.update_job_line(99334, '{"name":"European Fan Palm"}');
  IF (SELECT quote_name FROM public.job_lines WHERE id = 99334) IS DISTINCT FROM '24" Box European Fan Palm' THEN
    RAISE EXCEPTION 'substitute rename: %', (SELECT quote_name FROM public.job_lines WHERE id = 99334); END IF;
  -- A typed substitute (name = description = "15 G Oak", no size) given a size is not doubled.
  INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name, size, unit_price, description, is_original)
    OVERRIDING SYSTEM VALUE VALUES (99339, 99330, 99334, '15 G Oak', NULL, 0, '15 G Oak', false);
  PERFORM public.select_candidate(99334, 99339);
  PERFORM public.update_job_line(99334, '{"size":"15 G"}');
  IF (SELECT description FROM public.candidates WHERE id = 99339) IS DISTINCT FROM '15 G Oak' THEN
    RAISE EXCEPTION 'typed size doubled: %', (SELECT description FROM public.candidates WHERE id = 99339); END IF;

  -- 4. Another supplier's original selected: the line's ask changes and the
  --    unasked default follows, its description too (generated or sized).
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99335, 99330, 'Pine', '5 G', 3), (99336, 99330, 'Stemodia', '3 G', 3);
  INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name, size, unit_price, description, is_original)
    OVERRIDING SYSTEM VALUE VALUES
    (99333, 99330, 99335, 'Pine', '5 G', 20, '5 G Pine', true),
    (99334, 99330, 99336, 'Stemodia', '3 G', 9, 'Stemodia lanata', true);
  PERFORM public.select_candidate(99335, 99333);
  PERFORM public.update_job_line(99335, '{"size":"7 G","name":"Pinyon Pine"}');
  SELECT * INTO c FROM public.candidates WHERE id = (SELECT default_candidate_id FROM public.job_request_items WHERE id = 99335);
  IF c.size IS DISTINCT FROM '7 G' OR c.name IS DISTINCT FROM 'Pinyon Pine' OR c.description IS DISTINCT FROM '7 G Pinyon Pine'
    OR (SELECT description FROM public.candidates WHERE id = 99333) IS DISTINCT FROM '7 G Pinyon Pine'
    OR (SELECT size FROM public.job_request_items WHERE id = 99335) IS DISTINCT FROM '7 G' THEN
    RAISE EXCEPTION 'non-default original, generated default: %', row_to_json(c); END IF;
  UPDATE public.candidates SET description = '3 G Wooly Stemodia'
    WHERE id = (SELECT default_candidate_id FROM public.job_request_items WHERE id = 99336);
  PERFORM public.select_candidate(99336, 99334);
  PERFORM public.update_job_line(99336, '{"size":"1 G"}');
  SELECT * INTO c FROM public.candidates WHERE id = (SELECT default_candidate_id FROM public.job_request_items WHERE id = 99336);
  IF c.size IS DISTINCT FROM '1 G' OR c.description IS DISTINCT FROM '1 G Wooly Stemodia'
    OR (SELECT description FROM public.candidates WHERE id = 99334) IS DISTINCT FROM 'Stemodia lanata' THEN
    RAISE EXCEPTION 'non-default original, sized default: %', row_to_json(c); END IF;
  -- The default written by update_job_line itself is not swapped twice.
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99337, 99330, 'Sage', '5', 2);
  UPDATE public.candidates SET description = '5 Russian Sage'
    WHERE id = (SELECT default_candidate_id FROM public.job_request_items WHERE id = 99337);
  PERFORM public.update_job_line(99337, '{"size":"5 G"}');
  IF (SELECT description FROM public.candidates WHERE id = (SELECT default_candidate_id FROM public.job_request_items WHERE id = 99337))
    IS DISTINCT FROM '5 G Russian Sage' THEN RAISE EXCEPTION 'default swapped twice'; END IF;
  -- A demand-only line edit leaves the description as written.
  UPDATE public.candidates SET description = 'live OAK' WHERE id = def_a;
  UPDATE public.job_request_items SET demanded_quantity = 12 WHERE id = 99330;
  SELECT * INTO c FROM public.candidates WHERE id = def_a;
  IF c.description IS DISTINCT FROM 'live OAK' OR c.demanded_quantity IS DISTINCT FROM 12 THEN
    RAISE EXCEPTION 'demand edit moved the description: %', row_to_json(c); END IF;

  -- Demand is still a line edit, not an update_job_line key.
  BEGIN
    PERFORM public.update_job_line(99330, '{"demanded_quantity":"3"}');
    RAISE EXCEPTION 'demand accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM IS DISTINCT FROM 'Invalid line field' THEN RAISE; END IF; END;
  RAISE NOTICE '0133 asserts passed';
END $$;
