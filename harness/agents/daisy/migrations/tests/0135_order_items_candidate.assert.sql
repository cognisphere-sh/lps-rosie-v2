-- Run after 0135 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0135 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE def_a bigint; sup bigint; ar_id bigint; asked bigint; ord bigint; got record; n bigint;
BEGIN
  -- Backfill: every live order line that has a same-supplier candidate on its job line is linked,
  -- and only to such a candidate.
  SELECT count(*) INTO n FROM public.order_items i JOIN public.orders o ON o.id = i.order_id
    WHERE i.candidate_id IS NULL AND EXISTS (SELECT 1 FROM public.order_item_job_request_items l
      JOIN public.candidates c ON c.job_request_item_id = l.job_request_item_id AND c.supplier_id = o.supplier_id
      WHERE l.order_item_id = i.id);
  IF n <> 0 THEN RAISE EXCEPTION 'backfill left % linkable lines unlinked', n; END IF;
  SELECT count(*) INTO n FROM public.order_items i JOIN public.orders o ON o.id = i.order_id
    JOIN public.candidates c ON c.id = i.candidate_id
    WHERE c.supplier_id <> o.supplier_id OR NOT EXISTS (SELECT 1 FROM public.order_item_job_request_items l
      WHERE l.order_item_id = i.id AND l.job_request_item_id = c.job_request_item_id);
  IF n <> 0 THEN RAISE EXCEPTION 'backfill linked % lines to a foreign candidate', n; END IF;

  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99350, 'Test 0135', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99350, 99350, 'Live Oak', '15 G', 10);
  SELECT default_candidate_id INTO def_a FROM public.job_request_items WHERE id = 99350;
  SELECT supplier_id INTO sup FROM public.candidates WHERE id = def_a;
  PERFORM public.update_job_line(99350, '{"unit_price":"210"}');
  -- The selected candidate differs from the ask (as a supplier's answer would).
  UPDATE public.candidates SET name = 'Quercus virginiana', size = '30 G' WHERE id = def_a;

  -- Direct order: the selected candidate's name and size, linked to it.
  ord := public.create_direct_order(sup, '[{"job_request_item_id":99350,"quantity":4}]'::jsonb, NULL, NULL, NULL, true, NULL);
  SELECT candidate_id, name, size, quantity, unit_price INTO got FROM public.order_items WHERE order_id = ord;
  IF got.candidate_id IS DISTINCT FROM def_a OR got.name IS DISTINCT FROM 'Quercus virginiana'
    OR got.size IS DISTINCT FROM '30 G' OR got.quantity IS DISTINCT FROM 4 OR got.unit_price IS DISTINCT FROM 210 THEN
    RAISE EXCEPTION 'direct order line: %', got;
  END IF;

  -- Answer-backed order: linked to the answered candidate, not the selection.
  INSERT INTO public.availability_requests(supplier_id, job_request_id) VALUES (sup, 99350) RETURNING id INTO ar_id;
  INSERT INTO public.candidates(supplier_id, job_request_item_id, availability_request_id, name, size,
      demanded_quantity, available_quantity, unit_price, status, is_original)
    VALUES (sup, 99350, ar_id, 'Live Oak', '45 G', 6, 6, 300, 'available', true) RETURNING id INTO asked;
  ord := public.create_order(sup, jsonb_build_array(jsonb_build_object('candidate_id', asked,
    'allocations', '[{"job_request_item_id":99350,"quantity":2}]'::jsonb)), NULL, NULL, NULL, true, NULL);
  SELECT candidate_id, name, size, unit_price INTO got FROM public.order_items WHERE order_id = ord;
  IF got.candidate_id IS DISTINCT FROM asked OR got.size IS DISTINCT FROM '45 G' OR got.unit_price IS DISTINCT FROM 300 THEN
    RAISE EXCEPTION 'answer order line: %', got;
  END IF;

  -- Deleting the candidate keeps the order line, unlinked.
  DELETE FROM public.candidates WHERE id = asked;
  SELECT candidate_id, name INTO got FROM public.order_items WHERE order_id = ord;
  IF NOT FOUND OR got.candidate_id IS NOT NULL OR got.name IS DISTINCT FROM 'Live Oak' THEN
    RAISE EXCEPTION 'after candidate delete: %', got;
  END IF;
  RAISE NOTICE '0135 assertions passed';
END $$;
