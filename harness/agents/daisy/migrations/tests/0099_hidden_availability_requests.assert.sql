-- Disposable database only: validate real locks/guards and lifecycle behavior.
DO $$
DECLARE token uuid := gen_random_uuid(); stamp timestamptz;
BEGIN
  UPDATE availability_requests SET status='submitted', public_token=token WHERE id=100;
  SELECT submitted_at INTO stamp FROM availability_requests WHERE id=100;
  UPDATE availability_requests SET status='hidden' WHERE id=100;
  IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=100 AND status='hidden'
    AND public_token IS NULL AND submitted_at=stamp) THEN RAISE EXCEPTION 'Hiding failed to revoke link or preserve answers'; END IF;
  BEGIN
    PERFORM answer_availability_request(100,1,p_submit => true);
    RAISE EXCEPTION 'hidden submission accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='hidden submission accepted' THEN RAISE; END IF; END;
  BEGIN
    PERFORM submit_availability_request_note(100,1,'stale page note');
    RAISE EXCEPTION 'hidden note accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='hidden note accepted' THEN RAISE; END IF; END;
  BEGIN
    PERFORM answer_public_availability(token,p_submit => true);
    RAISE EXCEPTION 'hidden public submission accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='hidden public submission accepted' THEN RAISE; END IF; END;
  BEGIN
    UPDATE availability_request_items SET notes='stale answer' WHERE id=100;
    RAISE EXCEPTION 'hidden item write accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='hidden item write accepted' THEN RAISE; END IF; END;
  BEGIN
    INSERT INTO availability_request_items(availability_request_id,name) VALUES (100,'New line');
    RAISE EXCEPTION 'hidden line insert accepted';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='hidden line insert accepted' THEN RAISE; END IF; END;
  UPDATE job_requests SET status='closed_lost' WHERE id=100;
  IF (SELECT status FROM availability_requests WHERE id=100)<>'hidden' THEN RAISE EXCEPTION 'Closing job exposed hidden AR'; END IF;
  UPDATE job_requests SET status='quoted' WHERE id=100;
  IF (SELECT status FROM availability_requests WHERE id=100)<>'hidden' THEN RAISE EXCEPTION 'Reopening job exposed hidden AR'; END IF;
  UPDATE availability_requests SET status='new' WHERE id=100;
  PERFORM answer_availability_request(100,1,100,'{"notes":"restored answer"}');
  PERFORM submit_availability_request_note(100,1,'restored note');
  IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=100 AND status='submitted'
    AND public_token IS NULL AND supplier_notes='restored note') THEN RAISE EXCEPTION 'Explicit reopening failed'; END IF;
  UPDATE availability_requests SET status='hidden' WHERE id=100;
  UPDATE availability_requests SET status='closed' WHERE id=100;
  IF has_function_privilege('anon','public.answer_availability_request(bigint,bigint,bigint,jsonb,boolean)','EXECUTE')
    THEN RAISE EXCEPTION 'RPC permissions widened'; END IF;
END $$;
