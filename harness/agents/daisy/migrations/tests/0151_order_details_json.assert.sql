-- Run after 0151 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0151 body without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE o1 bigint;
BEGIN
  IF (SELECT count(*) FROM public.orders_pre_0151) <> (SELECT count(*) FROM public.orders) THEN
    RAISE EXCEPTION 'backup and orders differ'; END IF;
  IF (SELECT data_type FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'orders' AND column_name = 'additional_details') <> 'jsonb' THEN
    RAISE EXCEPTION 'additional_details is not jsonb'; END IF;
  -- Every order with text has details, and none without.
  IF EXISTS (SELECT 1 FROM public.orders o JOIN public.orders_pre_0151 b USING (id)
    WHERE (nullif(btrim(b.additional_details), '') IS NULL) <> (o.additional_details IS NULL)) THEN
    RAISE EXCEPTION 'conversion lost or invented details'; END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE NOT public.is_order_details(additional_details)) THEN
    RAISE EXCEPTION 'a converted order fails the shape'; END IF;

  IF pg_temp.details_json(E'| Field | Details |\n| --- | --- |\n| Customer | Lake | Delivery phone | 512 |\nGate 4411\n\n- ring twice')
    <> '[{"field":"Customer","value":"Lake"},{"field":"Delivery phone","value":"512"},{"field":"Notes","value":"Gate 4411\n- ring twice"}]'::jsonb THEN
    RAISE EXCEPTION 'pipe rows, header and notes convert wrong'; END IF;

  IF public.is_order_details('[]') OR public.is_order_details('{}') OR public.is_order_details('[{"field":"A"}]')
    OR public.is_order_details('[{"field":" ","value":"x"}]') OR public.is_order_details('[{"field":"A","value":1}]')
    OR public.is_order_details('[{"field":"A","value":"x","extra":"y"}]') OR public.is_order_details('["A"]')
    OR NOT public.is_order_details('[{"field":"A","value":"x"}]') THEN
    RAISE EXCEPTION 'shape check wrong'; END IF;

  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99510, 'Test 0151', 'availability');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE VALUES
    (99511, 99510, 'Cedar Elm', '45 G', 2);
  BEGIN
    PERFORM public.create_order(99510, 1, ARRAY[99511], '"| Customer | Test |"');
    RAISE EXCEPTION 'markdown accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Additional details must be a list of {"field", "value"} texts' THEN RAISE; END IF;
  END;
  o1 := public.create_order(99510, 1, ARRAY[99511], '[{"field":"Customer","value":"Test"},{"field":"Delivery address","value":"1 Main"}]');
  IF (SELECT additional_details->1->>'field' FROM public.orders WHERE id = o1) <> 'Delivery address' THEN
    RAISE EXCEPTION 'order not kept'; END IF;
  PERFORM public.update_partner_order(o1, 1, '{"additional_details":[{"field":"Payment method","value":"Net 30"}]}');
  IF (SELECT additional_details FROM public.orders WHERE id = o1) <> '[{"field":"Payment method","value":"Net 30"}]'::jsonb THEN
    RAISE EXCEPTION 'details not saved'; END IF;
  PERFORM public.update_partner_order(o1, 1, '{"additional_details":[]}');
  IF (SELECT additional_details FROM public.orders WHERE id = o1) IS NOT NULL THEN RAISE EXCEPTION '[] should clear'; END IF;
  BEGIN
    PERFORM public.update_partner_order(o1, 1, '{"additional_details":"| Customer | Test |"}');
    RAISE EXCEPTION 'text accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Additional details must be a list of {"field", "value"} texts' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE public.orders SET additional_details = '[{"field":"A"}]' WHERE id = o1;
    RAISE EXCEPTION 'direct write skipped the check';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
