-- Read-only preflight against the intended database before applying 0088.
-- Reports historical closed ARs whose previous stage cannot be reconstructed.
DO $$
DECLARE required text;
BEGIN
  FOREACH required IN ARRAY ARRAY[
    'job_requests.status','job_requests.is_active','job_requests.rosie_thread_ref',
    'job_request_items.job_request_id','job_request_items.unit_price','job_request_items.is_active',
    'availability_requests.public_token','availability_requests.submitted_at',
    'availability_request_items.mapped_inventory_id','availability_request_items.lps_notes'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=split_part(required,'.',1)
      AND column_name=split_part(required,'.',2)) THEN
      RAISE EXCEPTION '0088 prerequisite column missing: %', required;
    END IF;
  END LOOP;
  IF to_regprocedure('public.answer_public_availability(uuid,bigint,jsonb,boolean)') IS NULL
    OR to_regprocedure('public.close_ar_on_job_status_change()') IS NULL
    OR NOT EXISTS (SELECT 1 FROM pg_trigger
      WHERE tgrelid='public.job_requests'::regclass AND tgname='job_requests_link_threads' AND tgenabled <> 'D') THEN
    RAISE EXCEPTION '0088 prerequisite availability/thread hooks missing';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='availability_requests' AND column_name='status_before_close') THEN
    RAISE EXCEPTION '0088 status_before_close already exists; inspect migration state';
  END IF;
END $$;
SELECT id AS historical_closed_ar_id, job_request_id
FROM public.availability_requests WHERE status='closed' ORDER BY id;
