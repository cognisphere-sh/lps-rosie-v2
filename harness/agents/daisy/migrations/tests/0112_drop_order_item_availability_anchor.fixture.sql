-- Empty disposable PostgreSQL database only; then run 0112 and its assertions.
\ir 0111_directional_notes.fixture.sql
\ir ../0111_directional_notes.sql

CREATE TEMP TABLE order_anchor_rows_before AS
  SELECT 'orders' AS table_name,id,to_jsonb(o) AS contents FROM public.orders o
  UNION ALL SELECT 'order_items',id,to_jsonb(i)-'availability_request_item_id' FROM public.order_items i
  UNION ALL SELECT 'job_requests',id,to_jsonb(j) FROM public.job_requests j
  UNION ALL SELECT 'job_request_items',id,to_jsonb(j) FROM public.job_request_items j
  UNION ALL SELECT 'availability_requests',id,to_jsonb(a) FROM public.availability_requests a
  UNION ALL SELECT 'availability_request_items',id,to_jsonb(a) FROM public.availability_request_items a;
CREATE TEMP TABLE order_anchor_allocations_before AS
  SELECT * FROM public.order_item_job_request_items;
CREATE TEMP TABLE order_anchor_ar_links_before AS
  SELECT * FROM public.availability_request_item_jobs;
CREATE TEMP TABLE order_anchor_functions_before AS
  SELECT oid,proname,prosrc,proacl,prosecdef,proconfig FROM pg_proc WHERE pronamespace='public'::regnamespace;
