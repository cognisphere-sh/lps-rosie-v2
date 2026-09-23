-- Empty disposable PostgreSQL database only; then run 0109 and its assertions.
\ir 0108_drop_availability_job_anchor.fixture.sql
\ir ../0108_drop_availability_job_anchor.sql
\ir ../0095_availability_supplier_note.sql

INSERT INTO public.job_requests(id,status) VALUES (4200,'quoted'),(4201,'quoted');
INSERT INTO public.job_request_items(id,job_request_id,quantity) VALUES (4200,4200,6),(4201,4201,4);
INSERT INTO public.availability_requests(id,supplier_id,public_token) VALUES (4200,1,gen_random_uuid()),(4201,1,gen_random_uuid());
INSERT INTO public.availability_request_jobs VALUES (4200,4200),(4201,4201);
INSERT INTO public.availability_request_items(id,availability_request_id,name,demanded_quantity)
  VALUES (4200,4200,'Previously hidden',6),(4201,4201,'Previously closed',4);
INSERT INTO public.availability_request_item_jobs VALUES (4200,4200,6),(4201,4201,4);
UPDATE public.availability_requests SET status='hidden' WHERE id=4200;
UPDATE public.availability_requests SET status='submitted' WHERE id=4201;
UPDATE public.job_requests SET status='closed_lost' WHERE id=4201;

CREATE TEMP TABLE availability_headers_expected_0109 AS
  SELECT id,(to_jsonb(a)-'status_before_close'-'was_public_before_close') ||
    CASE WHEN status='hidden' THEN '{"status":"closed","is_active":false}'::jsonb ELSE '{}'::jsonb END AS contents
  FROM public.availability_requests a;
CREATE TEMP TABLE availability_items_before_0109 AS SELECT id,to_jsonb(ai) AS contents FROM public.availability_request_items ai;
CREATE TEMP TABLE availability_links_before_0109 AS SELECT * FROM public.availability_request_jobs;
CREATE TEMP TABLE availability_allocations_before_0109 AS SELECT * FROM public.availability_request_item_jobs;
