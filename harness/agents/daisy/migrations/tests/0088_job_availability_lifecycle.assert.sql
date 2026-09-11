-- Disposable DB only. Exercise database behavior, including direct agent writes.
CREATE FUNCTION test_reject(statement text, expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF position(expected IN SQLERRM) = 0 THEN RAISE; END IF;
    RETURN;
  END;
  RAISE EXCEPTION 'Expected rejection: %', statement;
END $$;

DO $$
DECLARE final_stage text; stage text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=99 AND status='closed' AND public_token IS NULL)
    THEN RAISE EXCEPTION 'Historical closed job request was not closed/revoked'; END IF;
  UPDATE job_requests SET status='quoted' WHERE id=5;
  IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=99 AND status='new')
    OR NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=98 AND status='closed' AND status_before_close IS NULL)
    THEN RAISE EXCEPTION 'Reconciliation must preserve known prior stages without inventing unknown legacy history'; END IF;

  INSERT INTO job_requests(id,is_active) VALUES (10,true),(11,true),(12,true),(20,true),(21,true),(22,true);
  IF NOT EXISTS (SELECT 1 FROM job_requests WHERE id=10 AND status='sourcing')
    THEN RAISE EXCEPTION 'Intake must start New'; END IF;
  INSERT INTO job_request_items(id,job_request_id) VALUES (10,10);
  IF NOT EXISTS (SELECT 1 FROM job_requests WHERE id=10 AND status='sourcing')
    THEN RAISE EXCEPTION 'Unpriced intake advanced job'; END IF;
  UPDATE job_request_items SET unit_price=105 WHERE id=10;
  IF NOT EXISTS (SELECT 1 FROM job_requests WHERE id=10 AND status='quoted')
    OR EXISTS (SELECT 1 FROM availability_requests WHERE job_request_id=10)
    OR NOT EXISTS (SELECT 1 FROM job_request_items WHERE id=10 AND status='pending')
    THEN RAISE EXCEPTION 'Quick quote pricing must progress job without creating AR or confirming stock'; END IF;
  final_stage := record_job_workflow_event(11,'pricing_fetched');
  IF final_stage <> 'quoted' THEN RAISE EXCEPTION 'No-match lookup did not progress job'; END IF;
  final_stage := record_job_workflow_event(12,'quote_shared');
  IF final_stage <> 'quoted' THEN RAISE EXCEPTION 'Quote sharing did not progress job'; END IF;
  PERFORM test_reject($q$SELECT record_job_workflow_event(12,'unknown')$q$, 'Unknown job workflow event');
  PERFORM test_reject($q$SELECT record_job_workflow_event(12,NULL)$q$, 'Unknown job workflow event');
  final_stage := record_job_workflow_event(12,'customer_confirmed');
  IF final_stage <> 'confirmed' THEN RAISE EXCEPTION 'Customer confirmation failed'; END IF;
  final_stage := record_job_workflow_event(12,'pricing_fetched');
  IF final_stage <> 'confirmed' THEN RAISE EXCEPTION 'Stale lookup regressed Confirmed'; END IF;

  INSERT INTO suppliers VALUES (2,true,false),(3,false,false);
  INSERT INTO availability_requests(id,job_request_id,supplier_id) VALUES (200,20,1);
  IF NOT EXISTS (SELECT 1 FROM job_requests WHERE id=20 AND status='quoted')
    THEN RAISE EXCEPTION 'Partner portal delivery did not progress job'; END IF;
  INSERT INTO availability_requests(id,job_request_id,supplier_id,public_token)
    VALUES (201,21,2,'10000000-0000-4000-8000-000000000201');
  IF NOT EXISTS (SELECT 1 FROM job_requests WHERE id=21 AND status='sourcing')
    THEN RAISE EXCEPTION 'Preparing a non-partner email marked it sent'; END IF;
  final_stage := record_job_workflow_event(21,'availability_sent');
  IF final_stage <> 'quoted' THEN RAISE EXCEPTION 'Actual email delivery did not progress job'; END IF;
  INSERT INTO availability_request_items(id,availability_request_id,unit_price) VALUES (201,201,45);
  IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=201 AND status='new')
    THEN RAISE EXCEPTION 'Seeded catalogue price counted as supplier response'; END IF;
  PERFORM answer_public_availability('10000000-0000-4000-8000-000000000201',201,'{"notes":"Checking stock"}');
  IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=201 AND status='processing')
    THEN RAISE EXCEPTION 'Public partial answer did not start Processing'; END IF;
  PERFORM answer_availability_request(201,2,NULL,NULL,true);
  UPDATE availability_requests SET submitted_at='2026-09-01T12:00:00Z' WHERE id=201;
  IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=201 AND status='submitted' AND submitted_at IS NOT NULL)
    THEN RAISE EXCEPTION 'Submission did not complete and timestamp'; END IF;
  PERFORM answer_availability_request(201,2,201,'{"notes":"Updated delivery date"}');
  IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=201 AND status='processing' AND submitted_at='2026-09-01T12:00:00Z')
    THEN RAISE EXCEPTION 'Completed edit must return to Processing and retain submission history'; END IF;
  PERFORM answer_availability_request(201,2,NULL,NULL,true);
  UPDATE availability_requests SET submitted_at='2026-09-01T12:00:00Z' WHERE id=201;
  PERFORM test_reject($q$SELECT answer_availability_request(201,1,201,'{"notes":"Wrong supplier"}')$q$, 'unavailable');
  PERFORM test_reject($q$SELECT answer_availability_request(201,2,999,'{"notes":"Wrong line"}')$q$, 'Line not found');
  PERFORM test_reject($q$SELECT answer_availability_request(201,2,201,'{"lps_notes":"Wrong field"}')$q$, 'Invalid answer field');
  PERFORM test_reject($q$SELECT answer_availability_request(201,2,201,'{"unit_price":"NaN"}')$q$, 'finite');

  -- Confirmed leaves supplier work open. Each terminal state closes it and
  -- stale lifecycle calls cannot reopen the job or any supplier request.
  UPDATE job_requests SET status='confirmed' WHERE id=21;
  IF EXISTS (SELECT 1 FROM availability_requests WHERE id=201 AND status='closed')
    THEN RAISE EXCEPTION 'Customer confirmation closed supplier request'; END IF;
  INSERT INTO availability_requests(id,job_request_id,supplier_id,status)
    VALUES (210,21,2,'new'),(211,21,2,'processing');
  UPDATE job_requests SET status='closed_won' WHERE id=21;
  IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=201 AND status='closed' AND public_token IS NULL)
    THEN RAISE EXCEPTION 'Job closure failed to close/revoke AR'; END IF;
  final_stage := record_job_workflow_event(21,'customer_confirmed');
  IF final_stage <> 'closed_won' THEN RAISE EXCEPTION 'Stale confirmation reopened job'; END IF;
  PERFORM test_reject($q$SELECT answer_availability_request(201,2,201,'{"notes":"Too late"}')$q$, 'closed');
  PERFORM test_reject($q$SELECT answer_availability_request(201,2,NULL,NULL,true)$q$, 'closed');
  PERFORM test_reject($q$SELECT answer_public_availability('10000000-0000-4000-8000-000000000201',201,'{"notes":"Too late"}')$q$, 'no longer available');
  PERFORM test_reject($q$UPDATE availability_request_items SET unit_price=50 WHERE id=201$q$, 'closed');
  PERFORM test_reject($q$UPDATE availability_request_items SET mapped_inventory_id=gen_random_uuid() WHERE id=201$q$, 'closed');
  PERFORM test_reject($q$INSERT INTO availability_request_items(id,availability_request_id) VALUES (202,201)$q$, 'closed');
  PERFORM test_reject($q$UPDATE availability_requests SET status='new' WHERE id=201$q$, 'job request is closed');
  PERFORM test_reject($q$INSERT INTO availability_requests(id,job_request_id,supplier_id) VALUES (202,21,2)$q$, 'job request is closed');
  UPDATE job_requests SET status='quoted' WHERE id=21;
  IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=201 AND status='submitted'
    AND status_before_close IS NULL AND submitted_at='2026-09-01T12:00:00Z')
    OR NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=210 AND status='new')
    OR NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=211 AND status='processing')
    THEN RAISE EXCEPTION 'Job reopening did not restore each prior availability stage'; END IF;
  IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=201 AND public_token IS NOT NULL
    AND public_token <> '10000000-0000-4000-8000-000000000201'::uuid)
    OR EXISTS (SELECT 1 FROM availability_requests WHERE id IN (210,211) AND public_token IS NOT NULL)
    THEN RAISE EXCEPTION 'Reopening must issue fresh URLs only for previously public requests'; END IF;
  UPDATE job_requests SET status='closed_lost' WHERE id=21;
  UPDATE suppliers SET is_active=false WHERE id=2;
  UPDATE job_requests SET status='quoted' WHERE id=21;
  IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=201 AND status='submitted' AND public_token IS NULL)
    THEN RAISE EXCEPTION 'Inactive supplier must not block reopening or regain public access'; END IF;

  INSERT INTO availability_requests(id,job_request_id,supplier_id,is_active) VALUES (220,22,2,false);
  UPDATE job_requests SET status='closed_lost' WHERE id=22;
  IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=220 AND status='closed')
    THEN RAISE EXCEPTION 'Inactive request was not closed with its job'; END IF;
  UPDATE job_requests SET is_active=false WHERE id=20;
  IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=200 AND status='closed')
    THEN RAISE EXCEPTION 'Deactivation did not close requests'; END IF;

  IF has_function_privilege('anon','public.answer_availability_request(bigint,bigint,bigint,jsonb,boolean)','EXECUTE')
    OR has_function_privilege('authenticated','public.answer_availability_request(bigint,bigint,bigint,jsonb,boolean)','EXECUTE')
    OR has_function_privilege('authenticated','public.record_job_workflow_event(bigint,text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.answer_availability_request(bigint,bigint,bigint,jsonb,boolean)','EXECUTE')
    THEN RAISE EXCEPTION 'Lifecycle function grants are unsafe'; END IF;
END $$;
DROP FUNCTION test_reject(text,text);
