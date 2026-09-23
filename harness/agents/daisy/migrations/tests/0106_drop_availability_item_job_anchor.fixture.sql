-- Empty disposable PostgreSQL database only; then run 0106 and its assertions.
\ir 0097_job_delete_dependents.fixture.sql
\ir ../0097_job_delete_dependents.sql
\ir ../0099_hidden_availability_requests.sql
\ir ../0102_job_and_order_line_delete.sql

INSERT INTO public.job_requests(id,status) VALUES (3000,'quoted'),(3001,'quoted'),(3002,'quoted');
INSERT INTO public.job_request_items(id,job_request_id,quantity)
  VALUES (3000,3000,6),(3001,3001,4),(3002,3000,3),(3003,3000,NULL),(3004,3002,8);
INSERT INTO public.availability_requests(id,job_request_id,supplier_id)
  VALUES (3000,3000,1),(3001,3002,1);
INSERT INTO public.availability_request_items(id,availability_request_id,job_request_item_id,name,quantity)
  VALUES (3000,3000,3000,'Legacy only',6),(3001,3000,3003,'Unknown demand',NULL),
    (3002,3000,3000,'Shared',10),(3003,3000,NULL,'Junction only',3),
    (3004,3001,3004,'Unrelated',8);
UPDATE public.availability_request_item_jobs SET quantity=6 WHERE availability_request_item_id=3002;
INSERT INTO public.availability_request_item_jobs VALUES (3002,3001,4),(3003,3002,3);
-- Simulate legacy-only lines without overwriting already correct shared allocations.
DELETE FROM public.availability_request_item_jobs WHERE availability_request_item_id IN (3000,3001);

CREATE TEMP TABLE availability_items_before_0106 AS
  SELECT id,to_jsonb(ai)-'job_request_item_id' AS contents FROM public.availability_request_items ai;
CREATE TEMP TABLE availability_allocations_before_0106 AS SELECT * FROM public.availability_request_item_jobs;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
