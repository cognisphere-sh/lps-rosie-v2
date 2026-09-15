-- Empty disposable PostgreSQL only: fixture, 0098, then assertions.
-- Exercise the production lifecycle and note routines before replacing the RPC.
\ir 0096_order_supplier_confirmation_note.fixture.sql
\ir ../0096_order_supplier_confirmation_note.sql
\ir 0096_order_supplier_confirmation_note.assert.sql
CREATE TEMP TABLE rows_before_0098(relation_name text PRIMARY KEY, rows jsonb NOT NULL);
DO $$
DECLARE relation_name text; relation_rows jsonb;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['orders', 'order_items', 'order_item_job_request_items',
    'job_requests', 'job_request_items', 'job_request_changelog', 'availability_requests',
    'availability_request_items', 'availability_request_item_jobs', 'availability_request_jobs'] LOOP
    EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), ''[]''::jsonb) FROM public.%I t', relation_name)
      INTO relation_rows;
    INSERT INTO rows_before_0098 VALUES (relation_name, relation_rows);
  END LOOP;
END $$;
