-- After fixture + migration 0084, in a disposable database only.
DO $$
DECLARE stage text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM job_requests WHERE id=1 AND status='quoted')
    OR NOT EXISTS (SELECT 1 FROM job_status_test_history WHERE job_id=1 AND old_status='availability' AND new_status='quoted')
    THEN RAISE EXCEPTION 'Availability conversion or history missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=1 AND status='new' AND public_token IS NOT NULL)
    THEN RAISE EXCEPTION 'Migration closed a working supplier request'; END IF;
  IF NOT EXISTS (SELECT 1 FROM job_requests WHERE id=3 AND status='archived')
    OR NOT EXISTS (SELECT 1 FROM job_requests WHERE id=4 AND status='confirmed')
    OR NOT EXISTS (SELECT 1 FROM job_requests WHERE id=5 AND status='closed_won')
    OR NOT EXISTS (SELECT 1 FROM job_requests WHERE id=6 AND status='closed_lost')
    THEN RAISE EXCEPTION 'Existing historical or confirmed state changed'; END IF;
  FOREACH stage IN ARRAY ARRAY['sourcing','quoted','confirmed'] LOOP
    UPDATE job_requests SET status=stage WHERE id=1;
    IF EXISTS (SELECT 1 FROM availability_requests WHERE id=1 AND status='closed')
      THEN RAISE EXCEPTION 'Working stage closed supplier request'; END IF;
  END LOOP;
  BEGIN
    UPDATE job_requests SET status='availability' WHERE id=1;
    RAISE EXCEPTION 'Retired availability stage accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO job_requests(id,is_active) VALUES (7,true);
  IF NOT EXISTS (SELECT 1 FROM job_requests WHERE id=7 AND status='sourcing')
    THEN RAISE EXCEPTION 'New job default changed'; END IF;
  FOREACH stage IN ARRAY ARRAY['closed_won','closed_lost'] LOOP
    UPDATE availability_requests SET status='new' WHERE id=1;
    UPDATE job_requests SET status=stage WHERE id=1;
    IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=1 AND status='closed')
      THEN RAISE EXCEPTION 'Terminal stage failed to close supplier request'; END IF;
  END LOOP;
END $$;
