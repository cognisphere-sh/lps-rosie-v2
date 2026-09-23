\set ON_ERROR_STOP on
CREATE FUNCTION pg_temp.check_name(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION '%', message; END IF; END $$;
SELECT pg_temp.check_name((SELECT record_name='JR-100:AR-1' FROM public.availability_requests WHERE id=100), 'AR backfill');
SELECT pg_temp.check_name((SELECT record_name='JR-100:AR-2' FROM public.availability_requests WHERE id=101), 'per-job AR sequence');
SELECT pg_temp.check_name((SELECT record_name='JR-103:AR-1' FROM public.availability_requests WHERE id=102), 'separate job starts at one');
SELECT pg_temp.check_name((SELECT record_name='JR-100:Order-1' FROM public.orders WHERE id=500), 'order backfill');
SELECT pg_temp.check_name((SELECT record_name='JR-100:Order-2' FROM public.orders WHERE id=501), 'separate order sequence');
SET ROLE service_role;
INSERT INTO public.availability_requests(id,job_request_id,supplier_id) VALUES (103,100,1);
RESET ROLE;
SELECT pg_temp.check_name((SELECT record_name='JR-100:AR-3' FROM public.availability_requests WHERE id=103), 'service role assignment');
DELETE FROM public.availability_requests WHERE id=103;
INSERT INTO public.availability_requests(id,job_request_id,supplier_id) VALUES (104,100,1);
SELECT pg_temp.check_name((SELECT record_name='JR-100:AR-4' FROM public.availability_requests WHERE id=104), 'never reuse deleted AR number');
INSERT INTO public.availability_request_jobs VALUES (104,103);
DELETE FROM public.availability_request_jobs WHERE availability_request_id=104 AND job_request_id=100;
SELECT pg_temp.check_name((SELECT record_name='JR-100:AR-4' FROM public.availability_requests WHERE id=104), 'shared AR name survives allocation changes');
UPDATE public.availability_requests SET status='closed' WHERE id=104;
SELECT pg_temp.check_name((SELECT record_name='JR-100:AR-4' FROM public.availability_requests WHERE id=104), 'status does not rename');
INSERT INTO public.orders(id,supplier_id) OVERRIDING SYSTEM VALUE VALUES (502,1);
INSERT INTO public.order_items(id,order_id,name,quantity) OVERRIDING SYSTEM VALUE VALUES (502,502,'Oak',2);
SET ROLE service_role;
INSERT INTO public.order_item_job_request_items VALUES (502,100,1);
RESET ROLE;
INSERT INTO public.order_item_job_request_items VALUES (502,103,1);
UPDATE public.order_item_job_request_items SET quantity=2 WHERE order_item_id=502 AND job_request_item_id=100;
SELECT pg_temp.check_name((SELECT record_name='JR-100:Order-3' FROM public.orders WHERE id=502), 'direct/shared order names once');
DELETE FROM public.order_item_job_request_items WHERE order_item_id=502 AND job_request_item_id=100;
SELECT pg_temp.check_name((SELECT record_name='JR-100:Order-3' FROM public.orders WHERE id=502), 'shared order name remains anchored');
SELECT pg_temp.check_name((SELECT last_number=3 FROM public.job_record_counters WHERE job_request_id=100 AND record_type='Order'), 'allocation updates do not consume numbers');
SELECT pg_temp.check_name(NOT has_table_privilege('authenticated','public.job_record_counters','UPDATE'), 'counter mutation restricted');
SELECT pg_temp.check_name(NOT has_function_privilege('anon','public.assign_job_record_name(text,bigint,bigint)','EXECUTE'), 'assignment RPC restricted');
-- A rollback rolls back both assignment and counter increment.
BEGIN;
INSERT INTO public.availability_requests(id,job_request_id,supplier_id) VALUES (105,100,1);
ROLLBACK;
INSERT INTO public.availability_requests(id,job_request_id,supplier_id) VALUES (105,100,1);
SELECT pg_temp.check_name((SELECT record_name='JR-100:AR-5' FROM public.availability_requests WHERE id=105), 'transactional counter');
