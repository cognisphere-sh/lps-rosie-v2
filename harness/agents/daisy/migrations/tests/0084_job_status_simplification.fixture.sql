-- After the 0083 fixture + migration in an empty disposable database only.
-- Audit stand-in verifies the migration does not bypass the installed trigger.
CREATE TABLE job_status_test_history (job_id bigint, old_status text, new_status text);
CREATE FUNCTION job_status_test_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO job_status_test_history VALUES (NEW.id, OLD.status, NEW.status);
  RETURN NEW;
END $$;
CREATE TRIGGER job_status_test_audit AFTER UPDATE OF status ON job_requests
  FOR EACH ROW EXECUTE FUNCTION job_status_test_audit();
UPDATE job_requests SET status='availability' WHERE id=1;
INSERT INTO job_requests VALUES (4,'confirmed',true),(5,'closed_won',true),(6,'closed_lost',true);
