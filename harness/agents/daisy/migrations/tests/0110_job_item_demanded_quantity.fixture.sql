-- Empty disposable PostgreSQL database only; then run 0110 and its assertions.
\ir 0109_ar_soft_delete.fixture.sql
\ir ../0109_ar_soft_delete.sql
\ir ../0094_partner_order_lifecycle.sql
\ir ../0100_direct_quote_orders.sql

ALTER TABLE public.job_request_items
  ADD COLUMN available_quantity numeric CHECK (available_quantity IS NULL OR available_quantity >= 0),
  ADD COLUMN total numeric(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  ADD COLUMN external_notes text;
CREATE TRIGGER job_items_changelog AFTER INSERT OR UPDATE ON public.job_request_items
  FOR EACH ROW EXECUTE FUNCTION public.log_job_request_changes();
INSERT INTO public.job_requests(id,status) VALUES (5000,'quoted'),(5001,'quoted'),(5002,'quoted');
INSERT INTO public.job_request_items(id,job_request_id,name,quantity,available_quantity,unit_price,external_notes)
  VALUES (5000,5000,'Oak',10,3,12.50,'Single trunk'),
    (5001,5001,'Maple',NULL,NULL,20,NULL),(5002,5002,'Pine',2.5,0,4,NULL);
CREATE TEMP TABLE job_items_before_0110 AS
  SELECT id,(to_jsonb(ji)-'quantity') || jsonb_build_object('demanded_quantity',quantity) AS contents
  FROM public.job_request_items ji;
CREATE TEMP TABLE history_before_0110 AS SELECT * FROM public.job_request_changelog;
CREATE TEMP TABLE access_before_0110 AS
  SELECT oid,proacl,prosecdef,proconfig FROM pg_proc WHERE pronamespace='public'::regnamespace
  AND proname IN ('create_direct_order','create_order','close_order');
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
