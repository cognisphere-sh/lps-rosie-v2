-- Run after 0145 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0145 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE def bigint; c public.candidates; k text;
BEGIN
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99450, 'Test 0145', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99450, 99450, 'Live Oak', '30 G', 5);
  SELECT default_candidate_id INTO def FROM public.job_request_items WHERE id = 99450;

  -- size and name are refused, alone or mixed with a line value, and nothing is written.
  FOREACH k IN ARRAY ARRAY['{"size":"45 G"}', '{"name":"Quercus virginiana"}', '{"unit_price":"185","size":"45 G"}'] LOOP
    BEGIN
      PERFORM public.update_job_line(99450, k::jsonb);
      RAISE EXCEPTION 'accepted %', k;
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'Size and name are not line values%' THEN RAISE; END IF;
    END;
  END LOOP;
  SELECT * INTO c FROM public.candidates WHERE id = def;
  IF c.size IS DISTINCT FROM '30 G' OR c.name IS DISTINCT FROM 'Live Oak' OR c.unit_price IS NOT NULL THEN
    RAISE EXCEPTION 'candidate written: % / % / %', c.size, c.name, c.unit_price;
  END IF;
  IF (SELECT size FROM public.job_request_items WHERE id = 99450) IS DISTINCT FROM '30 G' THEN RAISE EXCEPTION 'line written'; END IF;

  -- The four line values still work as before (0134 / 0139 / 0143).
  PERFORM public.update_job_line(99450, '{"unit_price":"185","status":"available","note_for_customer":"Full and dense"}');
  SELECT * INTO c FROM public.candidates WHERE id = def;
  IF c.unit_price IS DISTINCT FROM 185::numeric OR c.status IS DISTINCT FROM 'available'
    OR c.available_quantity IS DISTINCT FROM 5::numeric OR c.note_for_customer IS DISTINCT FROM 'Full and dense' THEN
    RAISE EXCEPTION 'line values not written: % / % / % / %', c.unit_price, c.status, c.available_quantity, c.note_for_customer;
  END IF;
  PERFORM public.update_job_line(99450, '{"available_quantity":"3"}');
  IF (SELECT status FROM public.candidates WHERE id = def) IS DISTINCT FROM 'partial_qty' THEN RAISE EXCEPTION 'short avail not Partial Qty'; END IF;
  PERFORM public.update_job_line(99450, '{"status":"need_to_order"}');
  SELECT * INTO c FROM public.candidates WHERE id = def;
  IF c.status IS DISTINCT FROM 'can_order' OR c.available_quantity IS DISTINCT FROM 5::numeric THEN RAISE EXCEPTION 'Need to Order not stored'; END IF;
  PERFORM public.update_job_line(99450, '{"unit_price":"0"}');
  IF (SELECT unit_price FROM public.candidates WHERE id = def) IS DISTINCT FROM 0::numeric THEN RAISE EXCEPTION '$0 not kept'; END IF;
  BEGIN
    PERFORM public.update_job_line(99450, '{"status":"diff_size_sub"}');
    RAISE EXCEPTION 'Diff Sz/Sub accepted on an original with no substitute';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Diff Sz/Sub needs a substitute%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.update_job_line(99450, '{"demanded_quantity":"4"}');
    RAISE EXCEPTION 'demand accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Invalid line field' THEN RAISE; END IF;
  END;
  RAISE NOTICE '0145 asserts passed';
END $$;
