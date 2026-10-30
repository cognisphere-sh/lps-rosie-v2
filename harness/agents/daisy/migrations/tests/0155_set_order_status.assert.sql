-- Run after 0155 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0155 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE sup bigint; o bigint; o2 bigint;
BEGIN
  SELECT id INTO sup FROM public.suppliers WHERE is_active ORDER BY id LIMIT 1;
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99455, 'Test 0155', 'committed');
  INSERT INTO public.orders(job_request_id, supplier_id) VALUES (99455, sup) RETURNING id INTO o;

  -- Any move: skip ahead (stamps the acknowledged date), then back to New (clears it).
  PERFORM public.set_order_status(o, 'completed');
  IF (SELECT status FROM public.orders WHERE id = o) IS DISTINCT FROM 'completed'
    OR (SELECT confirmation_date FROM public.orders WHERE id = o) IS NULL THEN RAISE EXCEPTION 'skip ahead'; END IF;
  PERFORM public.set_order_status(o, 'new');
  IF (SELECT confirmation_date FROM public.orders WHERE id = o) IS NOT NULL THEN RAISE EXCEPTION 'date not cleared'; END IF;

  -- Closing the last open order closes the job; changing the outcome follows it.
  PERFORM public.set_order_status(o, 'closed_won');
  IF (SELECT status FROM public.job_requests WHERE id = 99455) IS DISTINCT FROM 'closed_won' THEN RAISE EXCEPTION 'job not won'; END IF;
  PERFORM public.set_order_status(o, 'closed_lost');
  IF (SELECT status FROM public.job_requests WHERE id = 99455) IS DISTINCT FROM 'closed_lost' THEN RAISE EXCEPTION 'job not lost'; END IF;

  -- Reopening reopens the job.
  PERFORM public.set_order_status(o, 'processing');
  IF (SELECT status FROM public.job_requests WHERE id = 99455) IS DISTINCT FROM 'committed' THEN RAISE EXCEPTION 'job not reopened'; END IF;

  -- Not while another open order with that supplier exists.
  PERFORM public.set_order_status(o, 'closed_lost');
  UPDATE public.job_requests SET status = 'committed' WHERE id = 99455;
  INSERT INTO public.orders(job_request_id, supplier_id) VALUES (99455, sup) RETURNING id INTO o2;
  BEGIN
    PERFORM public.set_order_status(o, 'new');
    RAISE EXCEPTION 'second open order allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'This job already has an open order%' THEN RAISE; END IF;
  END;

  -- Unknown status is refused.
  BEGIN
    PERFORM public.set_order_status(o2, 'shipped');
    RAISE EXCEPTION 'unknown status allowed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Choose an order status' THEN RAISE; END IF;
  END;
END $$;
