-- Run after 0144 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0144 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE def bigint; alt bigint; c public.candidates; before_ctid tid;
BEGIN
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99440, 'Test 0144', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99440, 99440, 'Live Oak', '30 G', 5);
  SELECT default_candidate_id INTO def FROM public.job_request_items WHERE id = 99440;
  -- Rosie prices and maps the unasked default.
  UPDATE public.candidates SET unit_price = 185, description = '30 G Live Oak', status = 'available' WHERE id = def;
  SELECT ctid INTO before_ctid FROM public.candidates WHERE id = def;

  -- A name or size edit changes the line only; the default is not even rewritten.
  UPDATE public.job_request_items SET size = '45 G', name = 'Quercus virginiana' WHERE id = 99440;
  SELECT * INTO c FROM public.candidates WHERE id = def;
  IF c.size IS DISTINCT FROM '30 G' OR c.name IS DISTINCT FROM 'Live Oak' OR c.description IS DISTINCT FROM '30 G Live Oak'
    OR c.unit_price IS DISTINCT FROM 185::numeric THEN
    RAISE EXCEPTION 'default changed: % / % / % / %', c.size, c.name, c.description, c.unit_price;
  END IF;
  IF (SELECT ctid FROM public.candidates WHERE id = def) <> before_ctid THEN RAISE EXCEPTION 'default was rewritten'; END IF;
  IF (SELECT size FROM public.job_request_items WHERE id = 99440) IS DISTINCT FROM '45 G' THEN RAISE EXCEPTION 'line size not saved'; END IF;

  -- Demand rules are unchanged (0136). An unasked Available default keeps quantity = demand.
  UPDATE public.job_request_items SET demanded_quantity = 8 WHERE id = 99440;
  IF (SELECT available_quantity FROM public.candidates WHERE id = def) IS DISTINCT FROM 8::numeric THEN
    RAISE EXCEPTION 'Available default did not follow demand';
  END IF;
  -- An alternative with Avail 4 reads Partial Qty above it and Available again at it.
  INSERT INTO public.candidates(supplier_id, job_request_item_id, name, size, description, is_original)
    VALUES (1, 99440, 'Live Oak', '30 G', '30 G Live Oak', false) RETURNING id INTO alt;
  UPDATE public.candidates SET status = 'available' WHERE id = alt;
  UPDATE public.candidates SET available_quantity = 4 WHERE id = alt;
  UPDATE public.job_request_items SET demanded_quantity = 6 WHERE id = 99440;
  IF (SELECT status FROM public.candidates WHERE id = alt) IS DISTINCT FROM 'partial_qty' THEN RAISE EXCEPTION 'alternative not Partial Qty'; END IF;
  IF (SELECT available_quantity FROM public.candidates WHERE id = def) IS DISTINCT FROM 6::numeric THEN RAISE EXCEPTION 'default lost demand'; END IF;
  UPDATE public.job_request_items SET demanded_quantity = 4 WHERE id = 99440;
  IF (SELECT status FROM public.candidates WHERE id = alt) IS DISTINCT FROM 'available' THEN RAISE EXCEPTION 'alternative not Available at demand'; END IF;
  RAISE NOTICE '0144 asserts passed';
END $$;
