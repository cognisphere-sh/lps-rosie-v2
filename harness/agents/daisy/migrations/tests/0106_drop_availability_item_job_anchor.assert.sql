DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='availability_request_items' AND column_name='job_request_item_id')
    OR to_regprocedure('public.sync_availability_item_anchor()') IS NOT NULL
    OR EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='availability_request_items_sync_job_anchor') THEN
    RAISE EXCEPTION 'Legacy column or compatibility trigger survived';
  END IF;
  IF EXISTS (SELECT 1 FROM availability_items_before_0106 old
    FULL JOIN public.availability_request_items ai USING(id)
    WHERE old.contents IS DISTINCT FROM to_jsonb(ai)) THEN
    RAISE EXCEPTION 'Availability snapshot or answer changed';
  END IF;
  IF EXISTS (SELECT * FROM availability_allocations_before_0106 EXCEPT
    SELECT * FROM public.availability_request_item_jobs) THEN
    RAISE EXCEPTION 'Existing allocation changed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.availability_request_item_jobs
    WHERE availability_request_item_id=3000 AND job_request_item_id=3000 AND quantity=6)
    OR NOT EXISTS (SELECT 1 FROM public.availability_request_item_jobs
    WHERE availability_request_item_id=3001 AND job_request_item_id=3003 AND quantity IS NULL)
    OR (SELECT count(*) FROM public.availability_request_item_jobs) <>
      (SELECT count(*)+2 FROM availability_allocations_before_0106) THEN
    RAISE EXCEPTION 'Legacy-only allocations were not preserved exactly';
  END IF;
  IF has_function_privilege('anon','public.create_availability_request(bigint,jsonb,boolean,uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.delete_job_request_item(bigint,bigint)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.create_availability_request(bigint,jsonb,boolean,uuid)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.delete_job_request_item(bigint,bigint)','EXECUTE') THEN
    RAISE EXCEPTION 'RPC grants changed';
  END IF;
END $$;

-- Exercise the creation/ordering/deletion contract with the app's database role.
SET ROLE service_role;
DO $$
DECLARE solo bigint; shared bigint; unknown_request bigint; shared_line bigint; counts jsonb; before_count bigint;
BEGIN
  solo := public.create_availability_request(1,
    '[{"name":"Solo","quantity":6,"allocations":[{"job_request_item_id":3000,"quantity":6}]}]');
  shared := public.create_availability_request(1,
    '[{"name":"Shared","quantity":10,"allocations":[{"job_request_item_id":3000,"quantity":6},{"job_request_item_id":3001,"quantity":4}]}]');
  unknown_request := public.create_availability_request(1,
    '[{"name":"Unknown","quantity":null,"allocations":[{"job_request_item_id":3003,"quantity":null}]}]');
  SELECT id INTO shared_line FROM public.availability_request_items WHERE availability_request_id=shared;
  IF (SELECT sum(quantity) FROM public.availability_request_item_jobs WHERE availability_request_item_id=shared_line)<>10
    OR (SELECT count(*) FROM public.availability_request_jobs WHERE availability_request_id=shared)<>2
    OR NOT EXISTS (SELECT 1 FROM public.availability_request_items ai
      JOIN public.availability_request_item_jobs link ON link.availability_request_item_id=ai.id
      WHERE ai.availability_request_id=unknown_request AND link.quantity IS NULL) THEN
    RAISE EXCEPTION 'Request creation lost associations or unknown demand';
  END IF;
  SELECT count(*) INTO before_count FROM public.availability_requests;
  BEGIN
    PERFORM public.create_availability_request(1,
      '[{"name":"Invalid","quantity":11,"allocations":[{"job_request_item_id":3000,"quantity":6},{"job_request_item_id":3001,"quantity":4}]}]');
    RAISE EXCEPTION 'Mismatched allocation total accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Allocations must equal requested quantity' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.availability_requests)<>before_count THEN
    RAISE EXCEPTION 'Failed creation left a partial request';
  END IF;
  UPDATE public.availability_request_items SET quantity=5 WHERE availability_request_id=solo;
  IF NOT EXISTS (SELECT 1 FROM public.availability_request_item_jobs link
    JOIN public.availability_request_items ai ON ai.id=link.availability_request_item_id
    WHERE ai.availability_request_id=solo AND link.quantity=5) THEN
    RAISE EXCEPTION 'Single-line quantity correction lost its allocation';
  END IF;
  BEGIN
    UPDATE public.availability_request_items SET quantity=11 WHERE id=shared_line;
    RAISE EXCEPTION 'Shared demand redistributed without explicit allocations';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Combined request quantities require explicit allocation edits%' THEN RAISE; END IF;
  END;
  UPDATE public.availability_request_items SET status='available',available_quantity=10 WHERE id=shared_line;
  PERFORM public.create_order(1,jsonb_build_array(jsonb_build_object('availability_request_item_id',shared_line,
    'allocations',jsonb_build_array(jsonb_build_object('job_request_item_id',3000,'quantity',2)))),NULL,NULL,NULL,true);
  BEGIN
    PERFORM public.create_order(1,jsonb_build_array(jsonb_build_object('availability_request_item_id',shared_line,
      'allocations',jsonb_build_array(jsonb_build_object('job_request_item_id',3000,'quantity',5)))),NULL,NULL,NULL,true);
    RAISE EXCEPTION 'Order exceeded job allocation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Order exceeds remaining availability allocation' THEN RAISE; END IF;
  END;

  IF public.delete_job_request_item(3001,3002) IS NOT NULL THEN
    RAISE EXCEPTION 'Deleted a line belonging to another job';
  END IF;
  counts := public.delete_job_request_item(3000,3002);
  IF counts->>'availabilityRequestItems'<>'1' OR EXISTS (SELECT 1 FROM public.availability_request_items WHERE id=3003)
    OR public.delete_job_request_item(3000,3002) IS NOT NULL THEN
    RAISE EXCEPTION 'Junction-only line deletion failed';
  END IF;
  counts := public.delete_job_request_item(3000,3000);
  IF counts->>'availabilityRequestItems'<>'2'
    OR NOT EXISTS (SELECT 1 FROM public.availability_request_items WHERE id=shared_line AND quantity=10)
    OR NOT EXISTS (SELECT 1 FROM public.availability_request_item_jobs
      WHERE availability_request_item_id=shared_line AND job_request_item_id=3001 AND quantity=4)
    OR EXISTS (SELECT 1 FROM public.availability_request_item_jobs WHERE job_request_item_id=3000) THEN
    RAISE EXCEPTION 'Deleting one job item damaged shared demand: %',counts;
  END IF;
  counts := public.delete_job_request_item(3001,3001);
  IF counts->>'availabilityRequestItems'<>'2'
    OR EXISTS (SELECT 1 FROM public.availability_request_items WHERE id IN (3002,shared_line))
    OR NOT EXISTS (SELECT 1 FROM public.availability_request_items WHERE id=3004) THEN
    RAISE EXCEPTION 'Last allocation deletion left an orphan or removed unrelated demand';
  END IF;
END $$;
RESET ROLE;

-- The existing whole-job cascade/rollback checks must also work without the column.
\ir 0097_job_delete_dependents.assert.sql
SELECT 'availability item anchor removal checks passed' AS result;
