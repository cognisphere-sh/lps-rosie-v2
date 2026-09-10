-- Run after the disposable fixture and migration 0082. Never against production.
INSERT INTO suppliers VALUES (1,true,true),(2,true,false),(3,true,true);
INSERT INTO job_requests VALUES (1,'sourcing',true);
INSERT INTO availability_requests(id,job_request_id,supplier_id) VALUES (1,1,1),(2,1,3);
INSERT INTO availability_request_items(id,availability_request_id) VALUES (1,1),(2,2);
DO $$
DECLARE token uuid := gen_random_uuid(); new_token uuid := gen_random_uuid();
BEGIN
 IF EXISTS (SELECT 1 FROM availability_requests WHERE public_token IS NOT NULL) THEN RAISE EXCEPTION 'not private by default'; END IF;
 UPDATE availability_requests SET public_token=token WHERE id=1;
 PERFORM answer_public_availability(token,1,'{"status":"available","available_quantity":"4","unit_price":"12.50"}');
 IF NOT EXISTS (SELECT 1 FROM availability_request_items WHERE id=1 AND available_quantity=4 AND unit_price=12.50) THEN RAISE EXCEPTION 'answer not persisted'; END IF;
 BEGIN
   PERFORM answer_public_availability(token,2,'{"notes":"wrong supplier"}');
   RAISE EXCEPTION 'cross-request write permitted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'Line not found' THEN RAISE; END IF;
 END;
 BEGIN
   PERFORM answer_public_availability(token,1,'{"lps_notes":"changed"}');
   RAISE EXCEPTION 'internal field permitted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'Invalid answer field' THEN RAISE; END IF;
 END;
 PERFORM answer_public_availability(token,NULL,NULL,true);
 IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=1 AND status='submitted' AND submitted_at IS NOT NULL) THEN RAISE EXCEPTION 'submit missing'; END IF;
 UPDATE availability_requests SET public_token=NULL WHERE id=1;
 BEGIN
   PERFORM answer_public_availability(token,1,'{"notes":"revoked"}');
   RAISE EXCEPTION 'revoked write permitted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'This link is no longer available' THEN RAISE; END IF;
 END;
 UPDATE availability_requests SET public_token=new_token WHERE id=1;
 UPDATE job_requests SET status='sourcing' WHERE id=1;
 IF EXISTS (SELECT 1 FROM availability_requests WHERE status='closed') THEN RAISE EXCEPTION 'unchanged status closed requests'; END IF;
 UPDATE job_requests SET status='quoted' WHERE id=1;
 IF EXISTS (SELECT 1 FROM availability_requests WHERE status<>'closed' OR public_token IS NOT NULL) THEN RAISE EXCEPTION 'job status failed to close/revoke all'; END IF;
 BEGIN
   PERFORM answer_public_availability(new_token,NULL,NULL,true);
   RAISE EXCEPTION 'closed submit permitted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'This link is no longer available' THEN RAISE; END IF;
 END;
 BEGIN
   INSERT INTO availability_requests(id,job_request_id,supplier_id,public_token) VALUES (3,1,2,gen_random_uuid());
   RAISE EXCEPTION 'non-partner public request permitted';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'Public requests require an active LPS Partner' THEN RAISE; END IF;
 END;
 IF has_function_privilege('anon','answer_public_availability(uuid,bigint,jsonb,boolean)','EXECUTE') THEN RAISE EXCEPTION 'anonymous database access permitted'; END IF;
END $$;
