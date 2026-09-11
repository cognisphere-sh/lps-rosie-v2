-- Disposable DB only: vocabulary, existing history and automatic transitions.
DO $$
DECLARE stage text; event text; result text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM job_statuses_before_0089 old
    FULL JOIN public.job_requests job USING (id)
    WHERE old.id IS NULL OR job.id IS NULL OR old.status IS DISTINCT FROM job.status
  ) THEN RAISE EXCEPTION '0089 rewrote existing job history'; END IF;

  INSERT INTO job_requests(id,is_active) VALUES (300,true),(301,true),(302,true),(303,true),(304,true);
  IF NOT EXISTS (SELECT 1 FROM job_requests WHERE id=300 AND status='sourcing')
    THEN RAISE EXCEPTION 'New jobs must default to Active'; END IF;
  FOREACH stage IN ARRAY ARRAY['sourcing','quoted','availability','confirmed','closed_won','closed_lost','archived'] LOOP
    UPDATE job_requests SET status=stage WHERE id=304;
  END LOOP;
  FOREACH stage IN ARRAY ARRAY['active','quote','won','lost','in_progress'] LOOP
    BEGIN
      UPDATE job_requests SET status=stage WHERE id=304;
      RAISE EXCEPTION 'Accepted display label as stored key: %', stage;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;

  INSERT INTO job_request_items(id,job_request_id,unit_price) VALUES (300,300,105);
  IF NOT EXISTS (SELECT 1 FROM job_requests WHERE id=300 AND status='quoted')
    OR EXISTS (SELECT 1 FROM availability_requests WHERE job_request_id=300)
    THEN RAISE EXCEPTION 'Quick quote pricing must advance to Quote without an AR'; END IF;
  result := record_job_workflow_event(301,'pricing_fetched');
  IF result <> 'quoted' THEN RAISE EXCEPTION 'No-match lookup must advance to Quote'; END IF;
  result := record_job_workflow_event(302,'quote_shared');
  IF result <> 'quoted' THEN RAISE EXCEPTION 'Customer delivery must advance to Quote'; END IF;
  INSERT INTO availability_requests(id,job_request_id,supplier_id) VALUES (300,300,1),(303,303,1);
  IF (SELECT count(*) FROM job_requests WHERE id IN (300,303) AND status='availability') <> 2
    THEN RAISE EXCEPTION 'Partner delivery must advance Active and Quote to Availability'; END IF;
  result := record_job_workflow_event(301,'availability_sent');
  IF result <> 'availability' THEN RAISE EXCEPTION 'Sent email must advance Quote to Availability'; END IF;
  FOREACH event IN ARRAY ARRAY['pricing_fetched','quote_shared','availability_sent'] LOOP
    result := record_job_workflow_event(301,event);
    IF result <> 'availability' THEN RAISE EXCEPTION 'Repeated work regressed Availability'; END IF;
  END LOOP;
  UPDATE job_request_items SET unit_price=106 WHERE id=300;
  IF NOT EXISTS (SELECT 1 FROM job_requests WHERE id=300 AND status='availability')
    THEN RAISE EXCEPTION 'Price edit regressed Availability'; END IF;

  FOREACH stage IN ARRAY ARRAY['sourcing','quoted','availability'] LOOP
    UPDATE job_requests SET status=stage WHERE id=302;
    result := record_job_workflow_event(302,'customer_confirmed');
    IF result <> 'confirmed' THEN RAISE EXCEPTION 'Confirmation failed from %', stage; END IF;
  END LOOP;
  FOREACH stage IN ARRAY ARRAY['confirmed','closed_won','closed_lost','archived'] LOOP
    UPDATE job_requests SET status=stage WHERE id=301;
    FOREACH event IN ARRAY ARRAY['pricing_fetched','quote_shared','availability_sent','customer_confirmed'] LOOP
      result := record_job_workflow_event(301,event);
      IF result <> stage THEN RAISE EXCEPTION 'Workflow changed protected stage %', stage; END IF;
    END LOOP;
  END LOOP;
  UPDATE job_requests SET is_active=false, status='sourcing' WHERE id=301;
  result := record_job_workflow_event(301,'availability_sent');
  IF result <> 'sourcing' THEN RAISE EXCEPTION 'Workflow advanced inactive job'; END IF;

  FOREACH stage IN ARRAY ARRAY['quoted','availability','confirmed'] LOOP
    UPDATE job_requests SET status=stage WHERE id=300;
    IF EXISTS (SELECT 1 FROM availability_requests WHERE id=300 AND status='closed')
      THEN RAISE EXCEPTION 'Working stage % closed AR', stage; END IF;
  END LOOP;
  FOREACH stage IN ARRAY ARRAY['closed_won','closed_lost'] LOOP
    UPDATE job_requests SET status=stage WHERE id=300;
    IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=300 AND status='closed')
      THEN RAISE EXCEPTION 'Terminal stage % did not close AR', stage; END IF;
    UPDATE job_requests SET status='availability' WHERE id=300;
    IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=300 AND status='new')
      THEN RAISE EXCEPTION 'Reopening to Availability did not restore AR'; END IF;
  END LOOP;
  IF has_function_privilege('anon','public.record_job_workflow_event(bigint,text)','EXECUTE')
    OR has_function_privilege('authenticated','public.record_job_workflow_event(bigint,text)','EXECUTE')
    OR NOT has_function_privilege('service_role','public.record_job_workflow_event(bigint,text)','EXECUTE')
    THEN RAISE EXCEPTION 'Workflow function grants changed'; END IF;
END $$;
DROP TABLE job_statuses_before_0089;
