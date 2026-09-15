-- Disposable PostgreSQL only: fixture, 0094 (optionally twice), then assertions.
\ir 0093_remove_job_confirmed_status.fixture.sql
\ir ../0093_remove_job_confirmed_status.sql
CREATE TEMP TABLE orders_before_0094 AS SELECT * FROM public.orders;
CREATE TEMP TABLE jobs_before_0094 AS SELECT * FROM public.job_requests;
CREATE TEMP TABLE items_before_0094 AS SELECT * FROM public.order_items;
CREATE TEMP TABLE allocations_before_0094 AS SELECT * FROM public.order_item_job_request_items;
