-- Empty disposable database only; then run 0104 and its assertions.
\ir 0092_job_orders_workflow.fixture.sql
\ir ../0092_job_orders_workflow.sql
-- Match the nullable source introduced by 0100 for direct orders.
ALTER TABLE public.order_items ALTER COLUMN availability_request_item_id DROP NOT NULL;
INSERT INTO public.orders(id,supplier_id,created_at) OVERRIDING SYSTEM VALUE
  VALUES (500,1,'2026-09-01'),(501,1,'2026-09-02');
INSERT INTO public.order_items(id,order_id,name,quantity) OVERRIDING SYSTEM VALUE
  VALUES (500,500,'Oak',1),(501,501,'Oak',1);
INSERT INTO public.order_item_job_request_items VALUES (500,100,1),(501,100,1);
INSERT INTO public.availability_requests(id,job_request_id,supplier_id) VALUES (101,100,1),(102,103,1);
-- Existing Supabase service-role grants, absent from the minimal 0091 fixture.
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
