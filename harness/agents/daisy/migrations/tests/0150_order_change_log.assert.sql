-- Run after 0150 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0150 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE o1 bigint;
BEGIN
  IF (SELECT count(*) FROM public.orders_pre_0150) <> (SELECT count(*) FROM public.orders) THEN
    RAISE EXCEPTION 'backup and orders differ'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE additional_details LIKE '%**Change log**%') THEN
    RAISE EXCEPTION 'a change log is still in the details'; END IF;
  -- Every split order kept its text: details + log = the old details.
  IF EXISTS (SELECT 1 FROM public.orders o JOIN public.orders_pre_0150 b USING (id)
    WHERE b.additional_details LIKE '%**Change log**%'
      AND (o.change_log IS NULL OR strpos(b.additional_details, o.change_log) = 0
        OR (o.additional_details IS NOT NULL AND strpos(b.additional_details, o.additional_details) <> 1))) THEN
    RAISE EXCEPTION 'split lost text'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders o JOIN public.orders_pre_0150 b USING (id)
    WHERE b.additional_details NOT LIKE '%**Change log**%' AND (o.additional_details IS DISTINCT FROM b.additional_details OR o.change_log IS NOT NULL)) THEN
    RAISE EXCEPTION 'details without a log changed'; END IF;

  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99500, 'Test 0150', 'availability');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE VALUES
    (99501, 99500, 'Cedar Elm', '45 G', 2);
  o1 := public.create_order(99500, 1, ARRAY[99501], '| Customer | Test |');
  IF (SELECT change_log FROM public.orders WHERE id = o1) IS NOT NULL THEN RAISE EXCEPTION 'a new order has no log'; END IF;
  PERFORM public.update_partner_order(o1, 1, '{"change_log":"  - 10/22: Cedar Elm qty 2 → 3  "}');
  IF (SELECT change_log FROM public.orders WHERE id = o1) <> '- 10/22: Cedar Elm qty 2 → 3' THEN RAISE EXCEPTION 'log not saved'; END IF;
  IF (SELECT additional_details FROM public.orders WHERE id = o1) <> '| Customer | Test |' THEN RAISE EXCEPTION 'details changed'; END IF;
  PERFORM public.update_partner_order(o1, 1, '{"change_log":""}');
  IF (SELECT change_log FROM public.orders WHERE id = o1) IS NOT NULL THEN RAISE EXCEPTION 'blank should clear'; END IF;
  BEGIN
    PERFORM public.update_partner_order(o1, 1, '{"change_log":42}');
    RAISE EXCEPTION 'number accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Change log must be text' THEN RAISE; END IF;
  END;
END $$;
