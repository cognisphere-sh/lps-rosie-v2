-- Run after 0130 and 0131 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0130 body>; <0131 body>; <this file>; ROLLBACK;
DO $$
DECLARE jl public.job_lines;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'job_request_items'
      AND column_name IN ('unit_price', 'total', 'status', 'available_quantity', 'note_for_customer')) THEN
    RAISE EXCEPTION 'deprecated line columns remain'; END IF;
  IF to_regclass('public.job_request_items_pre_0130') IS NULL THEN RAISE EXCEPTION 'backup table dropped'; END IF;
  IF (SELECT count(*) FROM public.job_lines) <> (SELECT count(*) FROM public.job_request_items) THEN
    RAISE EXCEPTION 'job_lines lost lines'; END IF;

  -- A new line still gets its default, and its values still read and write.
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99310, 'Test 0131', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99310, 99310, 'Oak', '5 G', 4);
  PERFORM public.update_job_line(99310, '{"status":"available","unit_price":"25","note_for_customer":"Shade grown"}');
  SELECT * INTO jl FROM public.job_lines WHERE id = 99310;
  IF jl.status <> 'available' OR jl.unit_price <> 25 OR jl.total <> 100 OR jl.available_quantity <> 4
    OR jl.note_for_customer <> 'Shade grown' OR jl.candidate_supplier_id <> 1 THEN
    RAISE EXCEPTION 'job_lines after 0131: %', row_to_json(jl); END IF;
  IF public.delete_job_request_item(99310, 99310) IS NULL THEN RAISE EXCEPTION 'line delete'; END IF;

  RAISE NOTICE '0131 asserts passed';
END $$;
