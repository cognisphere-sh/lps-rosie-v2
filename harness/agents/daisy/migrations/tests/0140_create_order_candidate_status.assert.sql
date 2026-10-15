-- Run after 0140 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0140 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE sup bigint; ar_id bigint; alt bigint; ord bigint; got text;
BEGIN
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99400, 'Test 0140', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99400, 99400, 'Yucca rostrata', '30 G', 6);
  SELECT supplier_id INTO sup FROM public.candidates
    WHERE id = (SELECT default_candidate_id FROM public.job_request_items WHERE id = 99400);
  INSERT INTO public.availability_requests(supplier_id, job_request_id) VALUES (sup, 99400) RETURNING id INTO ar_id;
  -- An answered alternative (not the original): Available orders as Available.
  INSERT INTO public.candidates(supplier_id, job_request_item_id, availability_request_id, name, size, description,
      available_quantity, unit_price, status, is_original)
    VALUES (sup, 99400, ar_id, 'Yucca rostrata', '15 G', '15 G Yucca rostrata', 6, 250, 'available', false)
    RETURNING id INTO alt;
  ord := public.create_order(sup, jsonb_build_array(jsonb_build_object('candidate_id', alt,
    'allocations', '[{"job_request_item_id":99400,"quantity":2}]'::jsonb)), NULL, NULL, NULL, true, NULL);
  SELECT status INTO got FROM public.order_items WHERE order_id = ord;
  IF got IS DISTINCT FROM 'available' THEN RAISE EXCEPTION 'available alternative ordered as %', got; END IF;
  -- Can Order still reads Need to Order.
  UPDATE public.candidates SET status = 'can_order' WHERE id = alt;
  ord := public.create_order(sup, jsonb_build_array(jsonb_build_object('candidate_id', alt,
    'allocations', '[{"job_request_item_id":99400,"quantity":2}]'::jsonb)), NULL, NULL, NULL, true, NULL);
  SELECT status INTO got FROM public.order_items WHERE order_id = ord;
  IF got IS DISTINCT FROM 'need_to_order' THEN RAISE EXCEPTION 'can order ordered as %', got; END IF;
  RAISE NOTICE '0140 asserts passed';
END $$;
