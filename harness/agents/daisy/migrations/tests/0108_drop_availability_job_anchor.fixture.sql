-- Empty disposable database only; then run 0108 and its assertions.
\ir 0107_availability_item_demand_and_notes.fixture.sql
\ir ../0107_availability_item_demand_and_notes.sql

INSERT INTO public.job_requests(id,status) VALUES
  (4000,'quoted'),(4001,'quoted'),(4002,'closed_lost'),(4003,'quoted');
INSERT INTO public.availability_requests(id,job_request_id,supplier_id,status)
  VALUES (4000,4000,1,'new'),(4001,4001,1,'new'),(4002,4002,1,'closed'),(4003,4003,1,'new');
INSERT INTO public.availability_request_jobs VALUES (4001,4003);
-- Simulate incomplete historical backfills, including a shared header and
-- an empty closed request. Existing associations must survive unchanged.
DELETE FROM public.availability_request_jobs WHERE
  (availability_request_id,job_request_id) IN ((4000,4000),(4001,4001),(4002,4002));
UPDATE public.job_requests SET status='quoted' WHERE id IN (4000,4001);
CREATE TEMP TABLE availability_headers_before_0108 AS
  SELECT id,to_jsonb(a)-'job_request_id' AS contents FROM public.availability_requests a;
CREATE TEMP TABLE availability_header_links_expected_0108 AS
  SELECT * FROM public.availability_request_jobs UNION
  SELECT id,job_request_id FROM public.availability_requests WHERE job_request_id IS NOT NULL;
CREATE TEMP TABLE jobs_before_0108 AS SELECT id,to_jsonb(j) AS contents FROM public.job_requests j;
CREATE TEMP TABLE history_before_0108 AS SELECT * FROM public.job_request_changelog;
