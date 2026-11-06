-- Run in a transaction that is rolled back, after applying 0156.
DO $$
DECLARE ar bigint; other_supplier_ar bigint; other_job_ar bigint; sup2 bigint;
  o bigint; again bigint; line_id bigint; state text; saved_submission timestamptz;
BEGIN
  SELECT id INTO STRICT sup2 FROM public.suppliers WHERE is_active AND id <> 1 ORDER BY id LIMIT 1;
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES
    (99560, 'Test 0156 order AR', 'availability'), (99561, 'Test 0156 other job', 'availability'),
    (99562, 'Test 0156 no AR', 'availability');
  INSERT INTO public.availability_requests(job_request_id, supplier_id, status, public_token) VALUES
    (99560, 1, 'new', gen_random_uuid()) RETURNING id INTO ar;
  INSERT INTO public.availability_requests(job_request_id, supplier_id, status) VALUES
    (99560, sup2, 'new') RETURNING id INTO other_supplier_ar;
  INSERT INTO public.availability_requests(job_request_id, supplier_id, status) VALUES
    (99561, 1, 'new') RETURNING id INTO other_job_ar;

  -- New orders and additions to an existing order close every AR lifecycle state.
  FOREACH state IN ARRAY ARRAY['new', 'processing', 'submitted', 'draft', 'closed'] LOOP
    -- Reopening is explicit; Draft can only advance through New.
    UPDATE public.availability_requests SET status = 'new' WHERE id = ar;
    UPDATE public.availability_requests SET status = state,
      public_token = CASE WHEN state IN ('draft', 'closed') THEN NULL ELSE gen_random_uuid() END WHERE id = ar;
    SELECT submitted_at INTO saved_submission FROM public.availability_requests WHERE id = ar;
    INSERT INTO public.job_request_items(job_request_id, name, size, demanded_quantity)
      VALUES (99560, 'Live Oak', '30 G', 5) RETURNING id INTO line_id;
    again := public.create_order(99560, 1, ARRAY[line_id]);
    IF o IS NOT NULL AND again <> o THEN RAISE EXCEPTION 'did not reuse existing order'; END IF;
    o := again;
    IF NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id = ar
      AND status = 'closed' AND public_token IS NULL AND submitted_at IS NOT DISTINCT FROM saved_submission) THEN
      RAISE EXCEPTION 'AR not closed or submission changed from %', state;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = o AND quantity = 5 AND size = '30 G') THEN
      RAISE EXCEPTION 'order snapshot missing'; END IF;
  END LOOP;
  IF (SELECT status FROM public.job_requests WHERE id = 99560) <> 'committed' THEN
    RAISE EXCEPTION 'job not committed'; END IF;
  IF EXISTS (SELECT 1 FROM public.availability_requests WHERE id IN (other_supplier_ar, other_job_ar) AND status <> 'new') THEN
    RAISE EXCEPTION 'unrelated AR was closed'; END IF;

  -- A partially processed, invalid batch must preserve the AR and existing rows.
  UPDATE public.availability_requests SET status = 'new', public_token = gen_random_uuid() WHERE id = ar;
  INSERT INTO public.job_request_items(job_request_id, name, demanded_quantity)
    VALUES (99560, 'Cedar Elm', 2) RETURNING id INTO line_id;
  BEGIN
    PERFORM public.create_order(99560, 1, ARRAY[line_id, 9223372036854775807::bigint]);
    RAISE EXCEPTION 'invalid line accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Job line % is not an active line%' THEN RAISE; END IF;
  END;
  IF NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id = ar AND status = 'new' AND public_token IS NOT NULL)
    OR (SELECT count(*) FROM public.order_items WHERE order_id = o) <> 5 THEN
    RAISE EXCEPTION 'failed order changed the AR or order rows'; END IF;

  -- A closed ask cannot receive further supplier answers.
  PERFORM public.create_order(99560, 1, ARRAY[line_id]);
  BEGIN
    PERFORM public.answer_availability_request(ar, 1, NULL, NULL, true);
    RAISE EXCEPTION 'supplier wrote to closed AR';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'This request is closed%' THEN RAISE; END IF;
  END;

  -- An order does not require an AR.
  INSERT INTO public.job_request_items(job_request_id, name, demanded_quantity)
    VALUES (99562, 'Yaupon', 3) RETURNING id INTO line_id;
  PERFORM public.create_order(99562, 1, ARRAY[line_id]);
  IF EXISTS (SELECT 1 FROM public.availability_requests WHERE job_request_id = 99562) THEN
    RAISE EXCEPTION 'order created an AR'; END IF;
  RAISE NOTICE '0156 asserts passed';
END $$;
