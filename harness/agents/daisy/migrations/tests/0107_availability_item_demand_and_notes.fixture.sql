-- Empty disposable PostgreSQL database only; then run 0107 and its assertions.
\ir 0106_drop_availability_item_job_anchor.fixture.sql
\ir ../0106_drop_availability_item_job_anchor.sql

UPDATE public.availability_request_items SET lps_notes='Customer requests single trunk; named variety only.',
  notes=E'Four available.\nRemainder arrives Friday.' WHERE id=3002;
CREATE TEMP TABLE availability_items_before_0107 AS
  SELECT id,to_jsonb(ai) AS contents FROM public.availability_request_items ai;
CREATE TEMP TABLE availability_allocations_before_0107 AS SELECT * FROM public.availability_request_item_jobs;
