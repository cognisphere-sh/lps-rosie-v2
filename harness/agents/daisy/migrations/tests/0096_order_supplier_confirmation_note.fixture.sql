-- Empty disposable PostgreSQL only: fixture, 0096 (optionally twice), assertions.
-- Include the production order routines and their existing lifecycle regression checks.
\ir 0094_partner_order_lifecycle.fixture.sql
\ir ../0094_partner_order_lifecycle.sql
\ir 0094_partner_order_lifecycle.assert.sql
CREATE TEMP TABLE orders_before_0096 AS SELECT * FROM public.orders;
CREATE TEMP TABLE jobs_before_0096 AS SELECT * FROM public.job_requests;
CREATE TEMP TABLE items_before_0096 AS SELECT * FROM public.order_items;
CREATE TEMP TABLE allocations_before_0096 AS SELECT * FROM public.order_item_job_request_items;
CREATE TEMP TABLE availability_before_0096 AS SELECT * FROM public.availability_requests;
CREATE TEMP TABLE availability_items_before_0096 AS SELECT * FROM public.availability_request_items;
