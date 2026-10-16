-- Run after 0143 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0143 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE def bigint; sup bigint; ar_id bigint; alt bigint; ord bigint; got numeric; total numeric;
BEGIN
  IF EXISTS (SELECT 1 FROM public.candidates WHERE unit_price = 0) THEN RAISE EXCEPTION 'a 0 placeholder was left'; END IF;
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99430, 'Test 0143', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99430, 99430, 'Shrub Live Oak', '45 G', 23);
  SELECT default_candidate_id INTO def FROM public.job_request_items WHERE id = 99430;
  SELECT supplier_id INTO sup FROM public.candidates WHERE id = def;

  -- A new line's default is unpriced.
  IF (SELECT unit_price FROM public.candidates WHERE id = def) IS NOT NULL THEN RAISE EXCEPTION 'default created priced'; END IF;
  IF (SELECT unit_price FROM public.job_lines WHERE id = 99430) IS NOT NULL THEN RAISE EXCEPTION 'unpriced line reads a price'; END IF;

  -- $0 reads back as $0 with a $0 total.
  PERFORM public.update_job_line(99430, '{"unit_price":"0","status":"available"}');
  SELECT unit_price, j.total INTO got, total FROM public.job_lines j WHERE id = 99430;
  IF got IS DISTINCT FROM 0::numeric OR total IS DISTINCT FROM 0::numeric THEN RAISE EXCEPTION '$0 read as % / %', got, total; END IF;

  -- A $0 line orders directly at $0.
  ord := public.create_direct_order(sup, '[{"job_request_item_id":99430,"quantity":1}]', NULL, NULL, NULL, true);
  IF (SELECT unit_price FROM public.order_items WHERE order_id = ord) IS DISTINCT FROM 0::numeric THEN RAISE EXCEPTION 'direct order not $0'; END IF;

  -- Blank clears to unpriced, which still cannot be ordered.
  PERFORM public.update_job_line(99430, '{"unit_price":""}');
  IF (SELECT unit_price FROM public.job_lines WHERE id = 99430) IS NOT NULL THEN RAISE EXCEPTION 'blank did not clear'; END IF;
  BEGIN
    PERFORM public.create_direct_order(sup, '[{"job_request_item_id":99430,"quantity":1}]', NULL, NULL, NULL, true);
    RAISE EXCEPTION 'unpriced direct order accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Price this line before ordering' THEN RAISE; END IF;
  END;

  -- An answered $0 candidate orders through its AR; an unpriced one does not.
  INSERT INTO public.availability_requests(supplier_id, job_request_id) VALUES (sup, 99430) RETURNING id INTO ar_id;
  INSERT INTO public.candidates(supplier_id, job_request_item_id, availability_request_id, name, size, description,
      available_quantity, unit_price, status, is_original)
    VALUES (sup, 99430, ar_id, 'Shrub Live Oak', '30 G', '30 G Shrub Live Oak', 5, 0, 'available', false)
    RETURNING id INTO alt;
  ord := public.create_order(sup, jsonb_build_array(jsonb_build_object('candidate_id', alt,
    'allocations', '[{"job_request_item_id":99430,"quantity":2}]'::jsonb)), NULL, NULL, NULL, true, NULL);
  IF (SELECT unit_price FROM public.order_items WHERE order_id = ord) IS DISTINCT FROM 0::numeric THEN RAISE EXCEPTION 'AR order not $0'; END IF;
  UPDATE public.candidates SET unit_price = NULL WHERE id = alt;
  BEGIN
    PERFORM public.create_order(sup, jsonb_build_array(jsonb_build_object('candidate_id', alt,
      'allocations', '[{"job_request_item_id":99430,"quantity":1}]'::jsonb)), NULL, NULL, NULL, true, NULL);
    RAISE EXCEPTION 'unpriced AR order accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Price this line before ordering' THEN RAISE; END IF;
  END;
  RAISE NOTICE '0143 asserts passed';
END $$;
