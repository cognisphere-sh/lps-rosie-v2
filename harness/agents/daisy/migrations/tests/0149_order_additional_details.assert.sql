-- Run after 0149 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0149 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE l1 bigint := 99491; l2 bigint := 99492; o1 bigint; again bigint; o public.orders;
BEGIN
  -- The columns moved and every order's old values are backed up.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders'
      AND column_name IN ('fulfillment_date', 'fulfillment_method', 'note_for_supplier', 'note_for_customer')) THEN
    RAISE EXCEPTION 'old order columns still there'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items'
      AND column_name = 'note_for_customer') THEN RAISE EXCEPTION 'row customer note still there'; END IF;
  IF (SELECT count(*) FROM public.order_items_pre_0149) <> (SELECT count(*) FROM public.order_items) THEN
    RAISE EXCEPTION 'row backup and rows differ'; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items'
      AND column_name = 'note_for_supplier') THEN RAISE EXCEPTION 'row note_for_supplier must stay'; END IF;
  IF (SELECT count(*) FROM public.orders_pre_0149) <> (SELECT count(*) FROM public.orders) THEN
    RAISE EXCEPTION 'backup and orders differ'; END IF;
  IF (SELECT count(*) FROM public.functions_pre_0149) <> 3 THEN RAISE EXCEPTION 'expected 3 saved functions'; END IF;
  IF to_regprocedure('public.create_order(bigint,bigint,bigint[],text,text,text)') IS NOT NULL
    OR to_regprocedure('public.create_order(bigint,bigint,bigint[],text)') IS NULL
    OR to_regprocedure('public.confirm_order(bigint,bigint,date,date)') IS NOT NULL THEN
    RAISE EXCEPTION 'old signatures still there'; END IF;

  INSERT INTO public.job_requests(id, name, status, fulfillment_method, expected_install_date) OVERRIDING SYSTEM VALUE
    VALUES (99490, 'Test 0149', 'availability', 'delivery', '2026-11-02');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE VALUES
    (l1, 99490, 'Live Oak', '30 G', 5), (l2, 99490, 'Texas Sage', '5 G', 3);
  PERFORM public.update_job_line(l1, '{"status":"available","unit_price":"185"}');

  -- Additional details are saved on a new order, ignored when lines join it.
  o1 := public.create_order(99490, 1, ARRAY[l1], E'**Customer:** Test\n\n**Change log**\n- 10/21: Order created');
  SELECT * INTO o FROM public.orders WHERE id = o1;
  IF o.additional_details NOT LIKE '**Customer:** Test%' THEN RAISE EXCEPTION 'details not saved'; END IF;
  again := public.create_order(99490, 1, ARRAY[l2], 'ignored');
  IF again <> o1 OR (SELECT additional_details FROM public.orders WHERE id = o1) LIKE 'ignored%' THEN
    RAISE EXCEPTION 'lines should join the open order and keep its details'; END IF;

  -- The removed fields are refused.
  BEGIN
    PERFORM public.update_partner_order(o1, 1, '{"fulfillment_date":"2026-11-01"}');
    RAISE EXCEPTION 'fulfillment_date accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Unsupported order update' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.update_partner_order(o1, 1, '{"note_for_supplier":"x"}');
    RAISE EXCEPTION 'note_for_supplier accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Unsupported order update' THEN RAISE; END IF;
  END;

  -- Confirm and Ready need no date; the details are edited and cleared.
  PERFORM public.update_partner_order(o1, 1, '{"status":"processing"}');
  SELECT * INTO o FROM public.orders WHERE id = o1;
  IF o.status <> 'processing' OR o.confirmation_date IS NULL THEN RAISE EXCEPTION 'confirm failed'; END IF;
  PERFORM public.update_partner_order(o1, 1, '{"additional_details":"  Gate 12  "}');
  IF (SELECT additional_details FROM public.orders WHERE id = o1) <> 'Gate 12' THEN RAISE EXCEPTION 'details not trimmed'; END IF;
  PERFORM public.update_partner_order(o1, 1, '{"status":"order_ready","additional_details":""}');
  SELECT * INTO o FROM public.orders WHERE id = o1;
  IF o.status <> 'order_ready' OR o.additional_details IS NOT NULL THEN RAISE EXCEPTION 'ready or clear failed'; END IF;
END $$;

-- confirm_order without a fulfillment date.
DO $$
DECLARE o1 bigint;
BEGIN
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99495, 'Test 0149 confirm', 'availability');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE VALUES
    (99496, 99495, 'Cedar Elm', '45 G', 2);
  o1 := public.create_order(99495, 1, ARRAY[99496], NULL);
  PERFORM public.confirm_order(o1, 1, '2026-10-20');
  IF (SELECT status FROM public.orders WHERE id = o1) <> 'processing'
    OR (SELECT confirmation_date FROM public.orders WHERE id = o1) <> '2026-10-20' THEN
    RAISE EXCEPTION 'confirm_order failed'; END IF;
END $$;
