-- Run after 0141 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0141 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE def_a bigint; ar_id bigint; ord bigint; counts jsonb;
BEGIN
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE
    VALUES (99410, 'Test 0141 A', 'quoted'), (99411, 'Test 0141 B', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99410, 99410, 'Oak', '5 G', 5), (99411, 99411, 'Elm', '15 G', 4);
  PERFORM public.update_job_line(99410, '{"unit_price":"10","status":"available"}');
  PERFORM public.update_job_line(99411, '{"unit_price":"20","status":"available"}');
  SELECT default_candidate_id INTO def_a FROM public.job_request_items WHERE id = 99410;
  ar_id := public.create_availability_request(1, ARRAY[def_a]);
  -- One order shared by both jobs.
  ord := public.create_direct_order(1, '[{"job_request_item_id":99410,"quantity":1},{"job_request_item_id":99411,"quantity":1}]',
    NULL, NULL, NULL, true);

  -- Deleting A takes its line, candidates, AR and its line on the shared order.
  PERFORM public.delete_job_request(99410);
  IF EXISTS (SELECT 1 FROM public.job_request_items WHERE id = 99410)
    OR EXISTS (SELECT 1 FROM public.candidates WHERE id = def_a)
    OR EXISTS (SELECT 1 FROM public.availability_requests WHERE id = ar_id) THEN RAISE EXCEPTION 'job A left rows'; END IF;
  IF (SELECT count(*) FROM public.order_items WHERE order_id = ord) IS DISTINCT FROM 1::bigint THEN
    RAISE EXCEPTION 'shared order should keep only B''s line';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.order_items oi JOIN public.order_item_job_request_items l ON l.order_item_id = oi.id
      WHERE oi.order_id = ord AND l.job_request_item_id = 99411) THEN RAISE EXCEPTION 'B''s order line lost'; END IF;
  SELECT deleted_counts INTO counts FROM public.deleted_job_threads WHERE agent = 'rosie' AND thread_id = 'jr-99410';
  IF (counts->>'orderItems')::int <> 1 OR (counts->>'availabilityRequests')::int <> 1 OR (counts->>'orders')::int <> 0 THEN
    RAISE EXCEPTION 'A counts: %', counts;
  END IF;

  -- Deleting B: the order is now B's alone and goes with it.
  PERFORM public.delete_job_request(99411);
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = ord) THEN RAISE EXCEPTION 'order kept'; END IF;
  RAISE NOTICE '0141 asserts passed';
END $$;
