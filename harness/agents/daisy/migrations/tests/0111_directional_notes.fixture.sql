-- Empty disposable PostgreSQL database only; then run 0111 and its assertions.
\ir 0110_job_item_demanded_quantity.fixture.sql
\ir ../0110_job_item_demanded_quantity.sql
\ir ../0096_order_supplier_confirmation_note.sql
\ir ../0098_order_confirmation_optional_method.sql

ALTER TABLE public.job_requests ADD COLUMN IF NOT EXISTS customer_notes text, ADD COLUMN IF NOT EXISTS sourcing_notes text, ADD COLUMN IF NOT EXISTS external_notes text;
ALTER TABLE public.job_request_items ADD COLUMN IF NOT EXISTS customer_notes text, ADD COLUMN IF NOT EXISTS sourcing_notes text;
ALTER TABLE public.availability_requests ADD COLUMN IF NOT EXISTS lps_notes text;

INSERT INTO public.job_requests(id,status,customer_notes,sourcing_notes,external_notes)
  VALUES (6000,'quoted','Customer job requirement','Private job sourcing','Customer job update'),
    (6001,'quoted','Second customer requirement',NULL,NULL);
INSERT INTO public.job_request_items(id,job_request_id,name,demanded_quantity,unit_price,customer_notes,sourcing_notes,external_notes)
  VALUES (6000,6000,'Oak',20,10,'White flowers','Private line sourcing','Customer line update'),
    (6001,6001,'Oak',20,10,'No substitutes',NULL,'Second customer update');
SELECT public.create_availability_request(1,'[{"name":"Oak","demanded_quantity":40,"lps_notes":"Please check white flowers","allocations":[{"job_request_item_id":6000,"quantity":20},{"job_request_item_id":6001,"quantity":20}]}]') AS request_id \gset notes_
SELECT id AS item_id FROM public.availability_request_items WHERE availability_request_id=:notes_request_id \gset notes_
SELECT public.answer_availability_request(:notes_request_id,1,:notes_item_id,'{"status":"available","available_quantity":"40","unit_price":"10","supplier_notes":"Ready Friday"}');
UPDATE public.availability_requests SET lps_notes='Pickup instructions',supplier_notes='Morning pickup only' WHERE id=:notes_request_id;
SELECT public.create_order(1,jsonb_build_array(jsonb_build_object('availability_request_item_id',:notes_item_id,
  'allocations',jsonb_build_array(jsonb_build_object('job_request_item_id',6000,'quantity',2)))),NULL,NULL,'Order instructions',true) AS backed_id \gset notes_
SELECT public.create_direct_order(1,'[{"job_request_item_id":6001,"quantity":2}]',NULL,NULL,'Direct instructions',true) AS direct_id \gset notes_
UPDATE public.orders SET supplier_notes='Committed note' WHERE id=:notes_backed_id;
CREATE TEMP TABLE note_test_ids AS SELECT :notes_request_id::bigint request_id,:notes_item_id::bigint item_id,
  :notes_backed_id::bigint backed_id,:notes_direct_id::bigint direct_id;
CREATE TEMP TABLE note_rows_before AS
  SELECT 'job_requests' AS table_name,id,to_jsonb(j) AS contents FROM public.job_requests j
  UNION ALL SELECT 'job_request_items',id,to_jsonb(j) FROM public.job_request_items j
  UNION ALL SELECT 'availability_requests',id,to_jsonb(j) FROM public.availability_requests j
  UNION ALL SELECT 'availability_request_items',id,to_jsonb(j) FROM public.availability_request_items j
  UNION ALL SELECT 'orders',id,to_jsonb(j) FROM public.orders j
  UNION ALL SELECT 'order_items',id,to_jsonb(j) FROM public.order_items j;
CREATE TEMP TABLE note_history_before AS SELECT * FROM public.job_request_changelog;
CREATE TEMP TABLE note_functions_before AS SELECT proname,pg_get_function_identity_arguments(oid) AS args,proacl,prosecdef,proconfig,prosrc
  FROM pg_proc WHERE pronamespace='public'::regnamespace;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

GRANT SELECT ON note_test_ids TO service_role;
