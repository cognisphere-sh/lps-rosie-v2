-- After fixture + migration 0083, in a disposable database only.
DO $$
DECLARE stage text; plant_status text;
  token uuid := '10000000-0000-4000-8000-000000000001';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM job_requests WHERE id=3 AND status='archived')
    OR NOT EXISTS (SELECT 1 FROM job_request_items WHERE id=1 AND status='alternative_proposed'
      AND available_quantity=4 AND unit_price=12.50 AND sourcing_notes='Original substitute detail')
    THEN RAISE EXCEPTION 'Legacy data changed'; END IF;
  FOREACH stage IN ARRAY ARRAY['sourcing','quoted','availability','confirmed'] LOOP
    UPDATE job_requests SET status=stage WHERE id=1;
    IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=1 AND status='new' AND public_token=token)
      THEN RAISE EXCEPTION 'Working stage % closed the supplier request', stage; END IF;
  END LOOP;
  FOREACH plant_status IN ARRAY ARRAY['available','unavailable','alternative_proposed','need_to_order','arriving_soon','pending'] LOOP
    UPDATE job_request_items SET status=plant_status WHERE id=1;
  END LOOP;
  BEGIN
    UPDATE job_request_items SET status='not_a_status' WHERE id=1;
    RAISE EXCEPTION 'Unknown plant status accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE job_requests SET status='not_a_status' WHERE id=1;
    RAISE EXCEPTION 'Unknown job status accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  -- Public Pending uses the same persisted NULL as partner/admin edits.
  PERFORM answer_public_availability(token,1,'{"status":""}');
  IF NOT EXISTS (SELECT 1 FROM availability_request_items WHERE id=1 AND status IS NULL
    AND available_quantity=4 AND unit_price=12.50 AND notes='Original ETA')
    THEN RAISE EXCEPTION 'Pending erased answer details'; END IF;
  FOREACH stage IN ARRAY ARRAY['closed_won','closed_lost','archived'] LOOP
    UPDATE availability_requests SET status='new', public_token=token WHERE id=1;
    UPDATE job_requests SET status=stage WHERE id=1;
    IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=1 AND status='closed' AND public_token IS NULL)
      THEN RAISE EXCEPTION 'Terminal stage % failed to close/revoke', stage; END IF;
  END LOOP;
  UPDATE job_requests SET status='sourcing' WHERE id=1;
  UPDATE availability_requests SET status='new', public_token=token WHERE id=1;
  UPDATE job_requests SET is_active=false WHERE id=1;
  IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=1 AND status='closed' AND public_token IS NULL)
    THEN RAISE EXCEPTION 'Deactivation failed to close/revoke'; END IF;
  INSERT INTO job_requests(id,is_active) VALUES (4,true);
  INSERT INTO job_request_items(id) VALUES (2);
  IF NOT EXISTS (SELECT 1 FROM job_requests WHERE id=4 AND status='sourcing')
    OR NOT EXISTS (SELECT 1 FROM job_request_items WHERE id=2 AND status='pending')
    THEN RAISE EXCEPTION 'New record defaults changed'; END IF;
END $$;
