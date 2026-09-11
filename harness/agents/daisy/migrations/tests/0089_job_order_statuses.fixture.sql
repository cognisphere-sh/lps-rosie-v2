-- After the 0088 fixture/migration/assertions, in a disposable DB ONLY.
CREATE TEMP TABLE job_statuses_before_0089 AS SELECT id, status FROM public.job_requests;
