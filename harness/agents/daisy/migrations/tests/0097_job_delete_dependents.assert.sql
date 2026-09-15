DO $$ DECLARE counts jsonb; BEGIN
  counts:=public.delete_job_request(2000);
  IF counts->>'orders'<>'1' OR counts->>'availabilityRequests'<>'1' OR counts->>'threads'<>'1'
    OR counts->>'orderItems'<>'1' OR counts->>'items'<>'1' THEN RAISE EXCEPTION 'wrong deletion counts: %',counts; END IF;
  IF EXISTS(SELECT 1 FROM job_requests WHERE id=2000) OR EXISTS(SELECT 1 FROM orders WHERE id=2000)
    OR EXISTS(SELECT 1 FROM availability_requests WHERE id=2000) OR EXISTS(SELECT 1 FROM threads WHERE thread_id='jr-2000')
    THEN RAISE EXCEPTION 'job dependents survived'; END IF;
  IF NOT EXISTS(SELECT 1 FROM orders WHERE id=2001) OR NOT EXISTS(SELECT 1 FROM availability_requests WHERE id=2001)
    OR NOT EXISTS(SELECT 1 FROM threads WHERE thread_id='supplier-1') THEN RAISE EXCEPTION 'shared or unrelated record was deleted'; END IF;
  IF (SELECT count(*) FROM thread_messages)<>3 THEN RAISE EXCEPTION 'transcript cascade incorrect'; END IF;
  IF NOT EXISTS(SELECT 1 FROM deleted_job_threads WHERE thread_id='jr-2000' AND purged_at IS NULL) THEN RAISE EXCEPTION 'cleanup not queued'; END IF;
  BEGIN
    PERFORM link_thread('rosie','jr-2000'); RAISE EXCEPTION 'deleted chat recreated';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='deleted chat recreated' THEN RAISE; END IF; END;
  IF delete_job_request(2000) IS NOT NULL THEN RAISE EXCEPTION 'missing job was deleted again'; END IF;
END $$;
-- Direct SQL deletion uses the same cascade, including shared records' last owner.
DELETE FROM job_requests WHERE id=2001;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM orders WHERE id=2001) OR EXISTS(SELECT 1 FROM availability_requests WHERE id=2001)
    THEN RAISE EXCEPTION 'last owner left orphaned shared records'; END IF;
END $$;
CREATE FUNCTION fail_test_order_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test deletion failure'; END $$;
CREATE TRIGGER fail_test_order_delete BEFORE DELETE ON orders FOR EACH ROW EXECUTE FUNCTION fail_test_order_delete();
DO $$ BEGIN
  BEGIN
    PERFORM delete_job_request(2002); RAISE EXCEPTION 'expected failure missing';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='expected failure missing' THEN RAISE; END IF; END;
  IF NOT EXISTS(SELECT 1 FROM job_requests WHERE id=2002) OR NOT EXISTS(SELECT 1 FROM orders WHERE id=2002)
    OR NOT EXISTS(SELECT 1 FROM availability_requests WHERE id=2002) OR NOT EXISTS(SELECT 1 FROM threads WHERE thread_id='jr-2002')
    OR EXISTS(SELECT 1 FROM deleted_job_threads WHERE thread_id='jr-2002') THEN RAISE EXCEPTION 'failed deletion was partial'; END IF;
END $$;
DROP TRIGGER fail_test_order_delete ON orders;
SELECT 'job deletion migration checks passed' AS result;
