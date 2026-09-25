-- Disposable PostgreSQL only.
\ir 0111_directional_notes.fixture.sql
\ir ../0111_directional_notes.sql
\ir ../0112_drop_order_item_availability_anchor.sql
UPDATE public.job_requests SET note_from_customer='Same note',note_for_customer='Same note' WHERE id=6001;
UPDATE public.job_request_items SET note_from_customer='   ',note_for_customer=NULL WHERE id=6001;
CREATE TEMP TABLE merged_before AS
 SELECT 'job_requests' AS tbl,id,to_jsonb(t) AS row FROM public.job_requests t
 UNION ALL SELECT 'job_request_items',id,to_jsonb(t) FROM public.job_request_items t
 UNION ALL SELECT 'availability_requests',id,to_jsonb(t) FROM public.availability_requests t
 UNION ALL SELECT 'availability_request_items',id,to_jsonb(t) FROM public.availability_request_items t
 UNION ALL SELECT 'orders',id,to_jsonb(t) FROM public.orders t
 UNION ALL SELECT 'order_items',id,to_jsonb(t) FROM public.order_items t;
CREATE TEMP TABLE merged_history AS SELECT * FROM public.job_request_changelog;
