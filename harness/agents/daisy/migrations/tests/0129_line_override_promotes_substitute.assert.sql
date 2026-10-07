-- Run after 0129 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0129 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE c public.candidates; line public.job_request_items;
BEGIN
  INSERT INTO public.suppliers(id, name, head_branch_id) OVERRIDING SYSTEM VALUE VALUES
    (99290, 'Test Nursery 0129', 99290), (99291, 'Other Nursery 0129', 99291);
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99290, 'Test 0129', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99290, 99290, 'Top soil', NULL, 3);
  INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name, unit_price, description, is_original,
      status, available_quantity)
    OVERRIDING SYSTEM VALUE VALUES
    (99290, 99290, 99290, 'Top soil', 8, '40 lb Top soil', true, NULL, NULL),
    (99291, 99290, 99290, 'Top soil', 9, 'Bag of Top Soil', false, 'available', 3),
    (99292, 99291, 99290, 'Top soil', 7, '40 lb Top soil', true, NULL, NULL);

  -- The substitute, selected, reads Diff Sz/Sub.
  PERFORM public.select_candidate(99290, 99291);
  IF (SELECT status FROM public.job_request_items WHERE id = 99290) <> 'alternative_proposed' THEN
    RAISE EXCEPTION 'substitute not Diff Sz/Sub'; END IF;

  -- Overriding to Available sticks: the substitute becomes the original.
  UPDATE public.job_request_items SET status = 'available' WHERE id = 99290;
  SELECT * INTO line FROM public.job_request_items WHERE id = 99290;
  SELECT * INTO c FROM public.candidates WHERE id = 99291;
  IF line.status <> 'available' OR NOT c.is_original OR c.status <> 'available' THEN
    RAISE EXCEPTION 'promote: % / %', row_to_json(line), row_to_json(c); END IF;
  -- The supplier's old original reads Diff Sz/Sub (Unavailable offering the promoted one), price kept.
  SELECT * INTO c FROM public.candidates WHERE id = 99290;
  IF c.is_original OR c.status <> 'unavailable' OR c.available_quantity <> 0 OR c.offered_candidate_id <> 99291
    OR c.unit_price <> 8 THEN RAISE EXCEPTION 'demote: %', row_to_json(c); END IF;
  -- Another supplier's original is untouched.
  SELECT * INTO c FROM public.candidates WHERE id = 99292;
  IF NOT c.is_original OR c.status IS NOT NULL OR c.offered_candidate_id IS NOT NULL THEN
    RAISE EXCEPTION 'other supplier: %', row_to_json(c); END IF;

  -- Diff Sz/Sub on the now-original maps as an original does.
  UPDATE public.job_request_items SET status = 'alternative_proposed' WHERE id = 99290;
  IF (SELECT status FROM public.candidates WHERE id = 99291) <> 'diff_size_qty_sub' THEN RAISE EXCEPTION 'diff on original'; END IF;

  RAISE NOTICE '0129 asserts passed';
END $$;
