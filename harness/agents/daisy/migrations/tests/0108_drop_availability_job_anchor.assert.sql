DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='availability_requests' AND column_name='job_request_id')
    OR to_regprocedure('public.sync_availability_job_anchor()') IS NOT NULL THEN
    RAISE EXCEPTION 'Legacy header anchor survived';
  END IF;
  IF EXISTS (SELECT 1 FROM availability_headers_before_0108 old
    FULL JOIN public.availability_requests a USING(id) WHERE old.contents IS DISTINCT FROM to_jsonb(a)) THEN
    RAISE EXCEPTION 'Header removal changed existing request data';
  END IF;
  IF EXISTS ((SELECT * FROM availability_header_links_expected_0108 EXCEPT SELECT * FROM public.availability_request_jobs)
    UNION ALL (SELECT * FROM public.availability_request_jobs EXCEPT SELECT * FROM availability_header_links_expected_0108)) THEN
    RAISE EXCEPTION 'Header backfill lost or invented associations';
  END IF;
  IF EXISTS (SELECT 1 FROM jobs_before_0108 old FULL JOIN public.job_requests j USING(id)
    WHERE old.contents IS DISTINCT FROM to_jsonb(j))
    OR EXISTS ((SELECT * FROM history_before_0108 EXCEPT SELECT * FROM public.job_request_changelog)
      UNION ALL (SELECT * FROM public.job_request_changelog EXCEPT SELECT * FROM history_before_0108)) THEN
    RAISE EXCEPTION 'Historical backfill changed job progress';
  END IF;
  IF has_function_privilege('anon','public.create_availability_request(bigint,jsonb,boolean,uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.create_availability_request(bigint,jsonb,boolean,uuid)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.create_availability_request(bigint,jsonb,boolean,uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Creation RPC permissions changed';
  END IF;
END $$;

-- Existing demand, note ownership, public-answer and order-limit checks must
-- still pass with the direct header column physically absent.
\ir 0107_availability_item_demand_and_notes.assert.sql

SET ROLE service_role;
DO $$
DECLARE shared_id bigint; line_id bigint; new_id bigint; processing_id bigint; hidden_id bigint;
  inactive_id bigint; token uuid:=gen_random_uuid(); stamp timestamptz; before_count bigint; counts jsonb;
BEGIN
  INSERT INTO public.job_requests(id,status,is_active) VALUES
    (4100,'quoted',true),(4101,'quoted',true),(4102,'closed_lost',true),(4103,'quoted',false);
  INSERT INTO public.job_request_items(id,job_request_id,quantity)
    VALUES (4100,4100,6),(4101,4101,4),(4102,4102,7),(4103,4103,8);
  shared_id:=public.create_availability_request(1,
    '[{"name":"Shared","demanded_quantity":10,"allocations":[{"job_request_item_id":4100,"quantity":6},{"job_request_item_id":4101,"quantity":4}]}]',false,token);
  SELECT id INTO line_id FROM public.availability_request_items WHERE availability_request_id=shared_id;
  IF (SELECT array_agg(job_request_id ORDER BY job_request_id) FROM public.availability_request_jobs
    WHERE availability_request_id=shared_id) IS DISTINCT FROM ARRAY[4100,4101]::bigint[]
    OR EXISTS (SELECT 1 FROM public.job_requests WHERE id IN (4100,4101) AND status<>'availability') THEN
    RAISE EXCEPTION 'Creation missed a job association or partner delivery progress';
  END IF;
  PERFORM public.answer_availability_request(shared_id,1,p_submit=>true);
  SELECT submitted_at INTO stamp FROM public.availability_requests WHERE id=shared_id;
  new_id:=public.create_availability_request(1,
    '[{"name":"Private new","demanded_quantity":6,"allocations":[{"job_request_item_id":4100,"quantity":6}]}]');
  processing_id:=public.create_availability_request(1,
    '[{"name":"Private processing","demanded_quantity":6,"allocations":[{"job_request_item_id":4100,"quantity":6}]}]');
  UPDATE public.availability_requests SET status='processing' WHERE id=processing_id;
  hidden_id:=public.create_availability_request(1,
    '[{"name":"Hidden","demanded_quantity":6,"allocations":[{"job_request_item_id":4100,"quantity":6}]}]',false,gen_random_uuid());
  UPDATE public.availability_requests SET status='hidden' WHERE id=hidden_id;

  UPDATE public.job_requests SET status='closed_lost' WHERE id=4100;
  IF NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=shared_id AND status='submitted' AND public_token=token)
    OR NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=new_id AND status='closed' AND status_before_close='new') THEN
    RAISE EXCEPTION 'Closing one source job mishandled shared/private requests';
  END IF;
  UPDATE public.job_requests SET status='closed_won' WHERE id=4101;
  IF NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=shared_id AND status='closed'
    AND status_before_close='submitted' AND was_public_before_close AND public_token IS NULL AND submitted_at=stamp) THEN
    RAISE EXCEPTION 'Closing all source jobs lost restoration state';
  END IF;
  BEGIN
    UPDATE public.availability_requests SET status='submitted' WHERE id=shared_id;
    RAISE EXCEPTION 'Reopened request with all jobs closed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'All linked job requests are closed' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.answer_availability_request(shared_id,1,line_id,'{"supplier_notes":"Late answer"}');
    RAISE EXCEPTION 'Closed request accepted an answer';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'This request is closed or hidden or unavailable' THEN RAISE; END IF;
  END;
  UPDATE public.job_requests SET status='quoted' WHERE id=4100;
  IF NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=shared_id AND status='submitted'
    AND status_before_close IS NULL AND NOT was_public_before_close AND submitted_at=stamp
    AND public_token IS NOT NULL AND public_token<>token)
    OR NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=new_id AND status='new' AND public_token IS NULL)
    OR NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=processing_id AND status='processing' AND public_token IS NULL)
    OR NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=hidden_id AND status='hidden' AND public_token IS NULL) THEN
    RAISE EXCEPTION 'Reopening lost stage, timestamp, visibility or token isolation';
  END IF;
  BEGIN
    PERFORM public.answer_public_availability(token,p_submit=>true);
    RAISE EXCEPTION 'Revoked URL regained access';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE '%no longer available%' THEN RAISE; END IF;
  END;

  SELECT count(*) INTO before_count FROM public.availability_requests;
  BEGIN
    PERFORM public.create_availability_request(1,
      '[{"name":"Closed job","demanded_quantity":7,"allocations":[{"job_request_item_id":4102,"quantity":7}]}]');
    RAISE EXCEPTION 'Closed job accepted new work';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'This job request is closed' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.create_availability_request(1,
      '[{"name":"Inactive job","demanded_quantity":8,"allocations":[{"job_request_item_id":4103,"quantity":8}]}]');
    RAISE EXCEPTION 'Inactive job accepted new work';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'This job request is closed' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.create_availability_request(1,
      '[{"name":"Invalid","demanded_quantity":6,"allocations":[{"job_request_item_id":4100,"quantity":5}]}]');
    RAISE EXCEPTION 'Invalid allocation accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Allocations must equal requested quantity' THEN RAISE; END IF; END;
  IF (SELECT count(*) FROM public.availability_requests)<>before_count THEN RAISE EXCEPTION 'Failed creation left a partial request'; END IF;

  inactive_id:=public.create_availability_request(1,
    '[{"name":"Retired","demanded_quantity":6,"allocations":[{"job_request_item_id":4100,"quantity":6}]}]',false,gen_random_uuid());
  UPDATE public.availability_requests SET is_active=false WHERE id=inactive_id;
  IF NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=inactive_id AND NOT is_active AND public_token IS NULL) THEN
    RAISE EXCEPTION 'Deactivation lost history or retained public access';
  END IF;
  BEGIN
    PERFORM public.answer_availability_request(inactive_id,1,p_submit=>true);
    RAISE EXCEPTION 'Inactive request accepted submission';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM<>'This request is closed or hidden or unavailable' THEN RAISE; END IF;
  END;

  -- Removing an individual job item preserves header history and shared lines.
  counts:=public.delete_job_request_item(4100,4100);
  IF NOT EXISTS (SELECT 1 FROM public.availability_request_jobs WHERE availability_request_id=shared_id AND job_request_id=4100)
    OR NOT EXISTS (SELECT 1 FROM public.availability_request_items WHERE id=line_id)
    OR NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=new_id) THEN
    RAISE EXCEPTION 'Line deletion lost header history or a shared line';
  END IF;
  -- Header links still drive closure/deletion after those item links are gone.
  UPDATE public.job_requests SET status='closed_lost' WHERE id=4100;
  IF (SELECT status FROM public.availability_requests WHERE id=shared_id)<>'closed' THEN
    RAISE EXCEPTION 'Header-only association failed closure';
  END IF;
  PERFORM public.delete_job_request(4100);
  IF EXISTS (SELECT 1 FROM public.availability_requests WHERE id IN (new_id,processing_id,hidden_id,inactive_id))
    OR NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=shared_id) THEN
    RAISE EXCEPTION 'Whole-job deletion mishandled exclusive/shared header history';
  END IF;
  PERFORM public.delete_job_request(4101);
  IF EXISTS (SELECT 1 FROM public.availability_requests WHERE id=shared_id) THEN
    RAISE EXCEPTION 'Last job deletion left an orphaned shared request';
  END IF;
END $$;
RESET ROLE;

-- Preserve the existing order/AR deletion, rollback and thread-cleanup contract.
\ir 0097_job_delete_dependents.assert.sql

-- The still-pending display-name migration must also work after column removal.
\ir ../0104_job_scoped_record_names.sql
SET ROLE service_role;
DO $$
DECLARE request_id bigint; saved_name text;
BEGIN
  request_id:=public.create_availability_request(1,
    '[{"name":"Named shared request","demanded_quantity":10,"allocations":[{"job_request_item_id":3001,"quantity":4},{"job_request_item_id":3000,"quantity":6}]}]');
  SELECT record_name INTO saved_name FROM public.availability_requests WHERE id=request_id;
  IF saved_name IS NULL OR saved_name NOT LIKE 'JR-3000:AR-%' THEN
    RAISE EXCEPTION 'First validated job failed to assign a stable request name';
  END IF;
  DELETE FROM public.availability_request_jobs WHERE availability_request_id=request_id AND job_request_id=3000;
  IF (SELECT record_name FROM public.availability_requests WHERE id=request_id) IS DISTINCT FROM saved_name THEN
    RAISE EXCEPTION 'Unlinking first job changed the stable request name';
  END IF;
END $$;
RESET ROLE;
SELECT 'availability header relationship and lifecycle checks passed' AS result;
