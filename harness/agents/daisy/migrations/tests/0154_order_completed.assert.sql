-- Run after 0154 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0154 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE sup bigint; o bigint;
BEGIN
  SELECT id INTO sup FROM public.suppliers WHERE is_active ORDER BY id LIMIT 1;
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99454, 'Test 0154', 'committed');
  INSERT INTO public.orders(job_request_id, supplier_id) VALUES (99454, sup) RETURNING id INTO o;

  -- Completed only follows Ready.
  BEGIN
    PERFORM public.update_partner_order(o, sup, '{"status":"completed"}');
    RAISE EXCEPTION 'New → Completed was allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Orders move from%' THEN RAISE; END IF;
  END;
  PERFORM public.update_partner_order(o, sup, '{"status":"processing"}');
  PERFORM public.update_partner_order(o, sup, '{"status":"order_ready"}');
  PERFORM public.update_partner_order(o, sup, '{"status":"completed"}');
  IF (SELECT status FROM public.orders WHERE id = o) IS DISTINCT FROM 'completed' THEN RAISE EXCEPTION 'not completed'; END IF;

  -- Still open: the supplier can reply, and nothing moves it back.
  PERFORM public.update_partner_order(o, sup, '{"note_from_supplier":"Delivered"}');
  BEGIN
    PERFORM public.update_partner_order(o, sup, '{"status":"order_ready"}');
    RAISE EXCEPTION 'Completed → Ready was allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Orders move from%' THEN RAISE; END IF;
  END;

  -- It holds the open slot: a second open order for the job and supplier is refused.
  BEGIN
    INSERT INTO public.orders(job_request_id, supplier_id) VALUES (99454, sup);
    RAISE EXCEPTION 'second open order allowed';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;

  -- close_order closes it, and the job with it.
  PERFORM public.close_order(o, 'closed_won');
  IF (SELECT status FROM public.orders WHERE id = o) IS DISTINCT FROM 'closed_won' THEN RAISE EXCEPTION 'not closed'; END IF;
  IF (SELECT status FROM public.job_requests WHERE id = 99454) IS DISTINCT FROM 'closed_won' THEN RAISE EXCEPTION 'job not closed'; END IF;
  RAISE NOTICE '0154 asserts passed';
END $$;
