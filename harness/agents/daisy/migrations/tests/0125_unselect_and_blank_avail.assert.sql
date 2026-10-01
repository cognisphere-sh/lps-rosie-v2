-- Run after 0125 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0125 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE line public.job_request_items;
BEGIN
  IF EXISTS (SELECT 1 FROM public.job_request_items ji JOIN public.candidates c ON c.id = ji.selected_candidate_id
      JOIN public.job_requests j ON j.id = ji.job_request_id
      WHERE ji.is_active AND j.is_active AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')
        AND c.available_quantity IS NULL AND ji.available_quantity = coalesce(c.demanded_quantity, ji.demanded_quantity)) THEN
    RAISE EXCEPTION 'backfill left demand as Avail'; END IF;

  INSERT INTO public.suppliers(id, name, head_branch_id) OVERRIDING SYSTEM VALUE VALUES (99250, 'Test Nursery 0125', 99250);
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99250, 'Test 0125', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99250, 99250, 'Oak', '5 G', 10);
  INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name, size, unit_price, description, is_original,
      status, available_quantity)
    OVERRIDING SYSTEM VALUE VALUES
    (99250, 99250, 99250, 'Oak', '5 G', 30, '5 G Oak', true, NULL, NULL),
    (99251, 99250, 99250, 'Oak', '5 G', 30, '5 G Oak', false, 'unavailable', 0),
    (99252, 99250, 99250, 'Oak', '5 G', 30, '5 G Oak', false, 'available', 4),
    (99253, 99250, 99250, 'Oak', '5 G', 30, '5 G Oak', false, 'available', 40);

  -- Not checked: blank, not the demand.
  PERFORM public.select_candidate(99250, 99250);
  SELECT * INTO line FROM public.job_request_items WHERE id = 99250;
  IF line.available_quantity IS NOT NULL THEN RAISE EXCEPTION 'unchecked avail: %', line.available_quantity; END IF;
  -- Unavailable: 0. Available: the candidate's quantity, capped at demand.
  PERFORM public.select_candidate(99250, 99251);
  IF (SELECT available_quantity FROM public.job_request_items WHERE id = 99250) IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'unavailable avail'; END IF;
  PERFORM public.select_candidate(99250, 99252);
  IF (SELECT available_quantity FROM public.job_request_items WHERE id = 99250) IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'available avail'; END IF;
  PERFORM public.select_candidate(99250, 99253);
  IF (SELECT available_quantity FROM public.job_request_items WHERE id = 99250) IS DISTINCT FROM 10 THEN
    RAISE EXCEPTION 'capped avail'; END IF;

  -- Unselect clears the selection and keeps the line's values.
  PERFORM public.unselect_candidate(99250);
  SELECT * INTO line FROM public.job_request_items WHERE id = 99250;
  IF line.selected_candidate_id IS NOT NULL OR line.available_quantity IS DISTINCT FROM 10 THEN
    RAISE EXCEPTION 'unselect: %', row_to_json(line); END IF;

  -- A closed job refuses.
  UPDATE public.job_requests SET status = 'closed_lost' WHERE id = 99250;
  BEGIN
    PERFORM public.unselect_candidate(99250);
    RAISE EXCEPTION 'closed job unselected';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Open job line not found' THEN RAISE; END IF;
  END;

  RAISE NOTICE '0125 asserts passed';
END $$;
