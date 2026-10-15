-- Run after 0137 and 0138 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0137 body>; <0138 body, each without BEGIN/COMMIT>; <this file>; ROLLBACK;
DO $$
DECLARE sup bigint; ord bigint; got text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'job_lines' AND column_name = 'status') THEN
    RAISE EXCEPTION 'job_lines.status still exists';
  END IF;
  IF (SELECT reloptions FROM pg_class WHERE oid = 'public.job_lines'::regclass) IS DISTINCT FROM '{security_invoker=true}' THEN
    RAISE EXCEPTION 'security_invoker lost';
  END IF;
  IF NOT has_table_privilege('authenticated', 'public.job_lines', 'SELECT')
    OR NOT has_table_privilege('service_role', 'public.job_lines', 'SELECT')
    OR has_table_privilege('anon', 'public.job_lines', 'SELECT') THEN
    RAISE EXCEPTION 'grants';
  END IF;
  IF col_description('public.job_lines'::regclass, (SELECT attnum FROM pg_attribute
      WHERE attrelid = 'public.job_lines'::regclass AND attname = 'demand')) IS NULL THEN
    RAISE EXCEPTION 'column comments lost';
  END IF;
  IF (SELECT candidate_status FROM public.job_lines WHERE id = 1342) IS DISTINCT FROM 'available' THEN RAISE EXCEPTION '1342'; END IF;

  -- create_direct_order still runs against the recreated view.
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99380, 'Test 0138', 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
    VALUES (99380, 99380, 'Oak', '5 G', 3);
  PERFORM public.update_job_line(99380, '{"unit_price":"40","status":"arriving_soon"}');
  SELECT supplier_id INTO sup FROM public.candidates WHERE id = (SELECT default_candidate_id FROM public.job_request_items WHERE id = 99380);
  ord := public.create_direct_order(sup, '[{"job_request_item_id":99380,"quantity":3}]'::jsonb, NULL, NULL, NULL, true, NULL);
  SELECT status INTO got FROM public.order_items WHERE order_id = ord;
  IF got IS DISTINCT FROM 'arriving_soon' THEN RAISE EXCEPTION 'direct order: %', got; END IF;
  RAISE NOTICE '0138 asserts passed';
END $$;
