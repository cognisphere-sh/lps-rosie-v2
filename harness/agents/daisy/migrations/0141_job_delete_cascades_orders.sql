-- 0141 — deleting a job deletes everything of it, orders included (2026-10-15)
--
-- (Bhoumik 2026-10-15) "Deleting a job request should delete job items,
-- candidates, order and AR by cascade." Since 0139 a job delete already takes
-- its lines, their candidates and its ARs, and (since 0097) the orders that are
-- only this job's. What stayed: this job's lines on an order shared with another
-- job (their job link cascaded away, the order line stayed). Now those order
-- lines go too; the order stays for the other job, and an order left with no
-- lines is deleted. The deleted counts' `orderItems` includes them.
BEGIN;
SET LOCAL lock_timeout = '250ms';
SET LOCAL statement_timeout = '5s';
SET LOCAL app.actor = 'migration 0141';

CREATE OR REPLACE FUNCTION public.close_orphaned_availability_on_job_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  ar_ids bigint[] := '{}'; order_ids bigint[] := '{}'; shared_ids bigint[] := '{}';
  ar_count bigint := 0; ar_items bigint := 0; order_count bigint := 0; order_items_count bigint := 0;
  shared_items bigint := 0; emptied bigint := 0;
  item_count bigint; history_count bigint; thread_count bigint; row_id bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('deleted-job:jr-' || OLD.id, 0));
  FOR row_id IN SELECT o.id FROM public.orders o WHERE EXISTS (
    SELECT 1 FROM public.order_items oi JOIN public.order_item_job_request_items l ON l.order_item_id=oi.id
      JOIN public.job_request_items ji ON ji.id=l.job_request_item_id
      WHERE oi.order_id=o.id AND ji.job_request_id=OLD.id
  ) ORDER BY o.id FOR UPDATE LOOP
    IF NOT EXISTS (SELECT 1 FROM public.order_items oi
      JOIN public.order_item_job_request_items l ON l.order_item_id=oi.id
      JOIN public.job_request_items ji ON ji.id=l.job_request_item_id
      WHERE oi.order_id=row_id AND ji.job_request_id<>OLD.id) THEN
      order_ids := array_append(order_ids,row_id);
    ELSE
      shared_ids := array_append(shared_ids,row_id);
    END IF;
  END LOOP;
  FOR row_id IN SELECT id FROM public.availability_requests WHERE job_request_id=OLD.id ORDER BY id FOR UPDATE LOOP
    ar_ids := array_append(ar_ids,row_id);
  END LOOP;
  SELECT count(*) INTO item_count FROM public.job_request_items WHERE job_request_id=OLD.id;
  SELECT count(*) INTO history_count FROM public.job_request_changelog WHERE job_request_id=OLD.id;
  SELECT count(*) INTO order_items_count FROM public.order_items WHERE order_id=ANY(order_ids);
  SELECT count(*) INTO thread_count FROM public.threads WHERE agent='rosie' AND thread_id='jr-'||OLD.id;
  SELECT count(*) INTO ar_items FROM public.candidates WHERE availability_request_id=ANY(ar_ids);
  DELETE FROM public.orders WHERE id=ANY(order_ids);
  GET DIAGNOSTICS order_count=ROW_COUNT;
  -- This job's lines on orders shared with another job (an order line placed
  -- for another job's line too stays).
  DELETE FROM public.order_items oi WHERE oi.order_id=ANY(shared_ids)
    AND EXISTS (SELECT 1 FROM public.order_item_job_request_items l
      JOIN public.job_request_items ji ON ji.id=l.job_request_item_id
      WHERE l.order_item_id=oi.id AND ji.job_request_id=OLD.id)
    AND NOT EXISTS (SELECT 1 FROM public.order_item_job_request_items l
      JOIN public.job_request_items ji ON ji.id=l.job_request_item_id
      WHERE l.order_item_id=oi.id AND ji.job_request_id<>OLD.id);
  GET DIAGNOSTICS shared_items=ROW_COUNT;
  DELETE FROM public.orders o WHERE o.id=ANY(shared_ids)
    AND NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id=o.id);
  GET DIAGNOSTICS emptied=ROW_COUNT;
  DELETE FROM public.job_request_items WHERE job_request_id=OLD.id;
  PERFORM set_config('lps.ar_delete', 'on', true);
  DELETE FROM public.availability_requests WHERE id=ANY(ar_ids);
  GET DIAGNOSTICS ar_count=ROW_COUNT;
  PERFORM set_config('lps.ar_delete', '', true);
  INSERT INTO public.deleted_job_threads(agent,thread_id,job_request_id,deleted_counts)
    VALUES ('rosie','jr-'||OLD.id,OLD.id,jsonb_build_object('items',item_count,'changelog',history_count,
      'availabilityRequests',ar_count,'availabilityRequestItems',ar_items,'orders',order_count + emptied,
      'orderItems',order_items_count + shared_items,'threads',thread_count,'answers',0));
  RETURN OLD;
END $function$;

COMMIT;
