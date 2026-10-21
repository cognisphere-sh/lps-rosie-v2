-- Run after 0152 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0152 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE def bigint; alt bigint; c public.candidates;
BEGIN
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99452, 'Test 0152', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99452, 99452, 'Russian Sage', '1 G', 3);
  SELECT default_candidate_id INTO def FROM public.job_request_items WHERE id = 99452;

  -- Diff Sz/Sub on the default original with no substitute is stored as given.
  PERFORM public.update_job_line(99452, '{"status":"available"}');
  PERFORM public.update_job_line(99452, '{"status":"diff_size_sub"}');
  SELECT * INTO c FROM public.candidates WHERE id = def;
  IF c.status IS DISTINCT FROM 'diff_size_sub' OR c.available_quantity IS DISTINCT FROM 3::numeric THEN
    RAISE EXCEPTION 'Diff Sz/Sub not stored on the original: % / %', c.status, c.available_quantity;
  END IF;

  -- Selecting a hidden candidate selects it and unhides it.
  INSERT INTO public.candidates(job_request_item_id, supplier_id, name, size, is_original, hide_from_lps)
    VALUES (99452, 1, 'Russian Sage', '3 G', false, true) RETURNING id INTO alt;
  PERFORM public.select_candidate(99452, alt);
  IF (SELECT selected_candidate_id FROM public.job_request_items WHERE id = 99452) IS DISTINCT FROM alt THEN
    RAISE EXCEPTION 'hidden candidate not selected';
  END IF;
  IF (SELECT hide_from_lps FROM public.candidates WHERE id = alt) THEN RAISE EXCEPTION 'selected candidate still hidden'; END IF;

  -- Selecting the default (never hidden) still works.
  PERFORM public.select_candidate(99452, def);
  IF (SELECT selected_candidate_id FROM public.job_request_items WHERE id = 99452) IS DISTINCT FROM def THEN
    RAISE EXCEPTION 'default not reselected';
  END IF;
  RAISE NOTICE '0152 asserts passed';
END $$;
