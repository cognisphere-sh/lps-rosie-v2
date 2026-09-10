-- After the 0082 fixture + migration in an empty disposable database only.
ALTER TABLE job_requests ADD CONSTRAINT job_requests_status_check
  CHECK (status IN ('sourcing','quoted','closed_won','closed_lost','archived'));
ALTER TABLE job_requests ALTER COLUMN status SET DEFAULT 'sourcing';
CREATE TABLE job_request_items (
  id bigint PRIMARY KEY, status text NOT NULL DEFAULT 'pending'
    CONSTRAINT job_request_items_status_check CHECK (status IN ('pending','available','alternative_proposed','unavailable')),
  available_quantity numeric, unit_price numeric, sourcing_notes text
);
INSERT INTO suppliers VALUES (1,true,true);
INSERT INTO job_requests VALUES (1,'sourcing',true),(2,'quoted',true),(3,'archived',true);
INSERT INTO job_request_items VALUES (1,'alternative_proposed',4,12.50,'Original substitute detail');
INSERT INTO availability_requests(id,job_request_id,supplier_id,public_token)
  VALUES (1,1,1,'10000000-0000-4000-8000-000000000001');
INSERT INTO availability_request_items(id,availability_request_id,status,available_quantity,unit_price,notes)
  VALUES (1,1,'can_order',4,12.50,'Original ETA');
