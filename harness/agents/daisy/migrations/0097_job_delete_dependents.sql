-- Permanent job deletion removes exclusively owned records and durably retires its chat.
BEGIN;
CREATE TABLE public.deleted_job_threads (
  agent text NOT NULL, thread_id text NOT NULL, job_request_id bigint NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(), purged_at timestamptz,
  deleted_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (agent, thread_id)
);
ALTER TABLE public.deleted_job_threads ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.deleted_job_threads TO service_role;

CREATE FUNCTION public.reject_deleted_job_thread() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.agent = 'rosie' AND NEW.thread_id ~ '^jr-[0-9]+$' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('deleted-job:' || NEW.thread_id, 0));
    IF EXISTS (SELECT 1 FROM public.deleted_job_threads WHERE agent=NEW.agent AND thread_id=NEW.thread_id) THEN
      RAISE EXCEPTION 'This job chat has been deleted';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER threads_reject_deleted_jobs BEFORE INSERT OR UPDATE OF agent,thread_id ON public.threads
  FOR EACH ROW EXECUTE FUNCTION public.reject_deleted_job_thread();

CREATE OR REPLACE FUNCTION public.close_orphaned_availability_on_job_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  ar_ids bigint[] := '{}'; order_ids bigint[] := '{}';
  ar_count bigint := 0; ar_items bigint := 0; order_count bigint := 0; order_items_count bigint := 0;
  item_count bigint; history_count bigint; thread_count bigint; row_id bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('deleted-job:jr-' || OLD.id, 0));
  -- Lock candidate parent rows before examining their associations. This also
  -- serializes against order/AR creation and attachment through foreign keys.
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
    END IF;
  END LOOP;
  FOR row_id IN SELECT ar.id FROM public.availability_requests ar WHERE ar.job_request_id=OLD.id
    OR EXISTS (SELECT 1 FROM public.availability_request_jobs l WHERE l.availability_request_id=ar.id AND l.job_request_id=OLD.id)
    OR EXISTS (SELECT 1 FROM public.availability_request_items ai
      LEFT JOIN public.availability_request_item_jobs l ON l.availability_request_item_id=ai.id
      JOIN public.job_request_items ji ON ji.id=l.job_request_item_id OR ji.id=ai.job_request_item_id
      WHERE ai.availability_request_id=ar.id AND ji.job_request_id=OLD.id)
    ORDER BY ar.id FOR UPDATE LOOP
    IF NOT EXISTS (SELECT 1 FROM public.availability_requests ar WHERE ar.id=row_id AND ar.job_request_id<>OLD.id)
      AND NOT EXISTS (SELECT 1 FROM public.availability_request_jobs l WHERE l.availability_request_id=row_id AND l.job_request_id<>OLD.id)
      AND NOT EXISTS (SELECT 1 FROM public.availability_request_items ai
        LEFT JOIN public.availability_request_item_jobs l ON l.availability_request_item_id=ai.id
        JOIN public.job_request_items ji ON ji.id=l.job_request_item_id OR ji.id=ai.job_request_item_id
        WHERE ai.availability_request_id=row_id AND ji.job_request_id<>OLD.id)
      AND NOT EXISTS (SELECT 1 FROM public.order_items oi JOIN public.availability_request_items ai ON ai.id=oi.availability_request_item_id
        JOIN public.order_item_job_request_items l ON l.order_item_id=oi.id
        JOIN public.job_request_items ji ON ji.id=l.job_request_item_id
        WHERE ai.availability_request_id=row_id AND ji.job_request_id<>OLD.id) THEN
      ar_ids := array_append(ar_ids,row_id);
    ELSIF NOT EXISTS (SELECT 1 FROM public.availability_request_jobs l
      JOIN public.job_requests j ON j.id=l.job_request_id
      WHERE l.availability_request_id=row_id AND j.id<>OLD.id AND j.is_active
        AND j.status NOT IN ('closed_won','closed_lost','archived')) THEN
      -- Preserve other jobs' history while respecting the existing AR guard.
      UPDATE public.availability_requests SET status='closed',public_token=NULL WHERE id=row_id;
    END IF;
  END LOOP;
  SELECT count(*) INTO item_count FROM public.job_request_items WHERE job_request_id=OLD.id;
  SELECT count(*) INTO history_count FROM public.job_request_changelog WHERE job_request_id=OLD.id;
  SELECT count(*) INTO ar_items FROM public.availability_request_items WHERE availability_request_id=ANY(ar_ids);
  SELECT count(*) INTO order_items_count FROM public.order_items WHERE order_id=ANY(order_ids);
  SELECT count(*) INTO thread_count FROM public.threads WHERE agent='rosie' AND thread_id='jr-'||OLD.id;
  DELETE FROM public.orders WHERE id=ANY(order_ids);
  GET DIAGNOSTICS order_count=ROW_COUNT;
  DELETE FROM public.availability_requests WHERE id=ANY(ar_ids);
  GET DIAGNOSTICS ar_count=ROW_COUNT;
  INSERT INTO public.deleted_job_threads(agent,thread_id,job_request_id,deleted_counts)
    VALUES ('rosie','jr-'||OLD.id,OLD.id,jsonb_build_object('items',item_count,'changelog',history_count,
      'availabilityRequests',ar_count,'availabilityRequestItems',ar_items,'orders',order_count,
      'orderItems',order_items_count,'threads',thread_count,'answers',0));
  RETURN OLD;
END $$;

-- Drop by canonical identity even if an old row has no stored thread reference.
CREATE OR REPLACE FUNCTION public.job_requests_drop_thread() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  DELETE FROM public.threads WHERE agent='rosie' AND thread_id='jr-'||OLD.id;
  RETURN OLD;
END $$;

CREATE FUNCTION public.delete_job_request(p_job_request_id bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE affected bigint; result jsonb;
BEGIN
  DELETE FROM public.job_requests WHERE id=p_job_request_id;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected=0 THEN RETURN NULL; END IF;
  SELECT deleted_counts INTO result FROM public.deleted_job_threads WHERE agent='rosie' AND thread_id='jr-'||p_job_request_id;
  RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.delete_job_request(bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.delete_job_request(bigint) TO service_role;
GRANT INSERT ON public.deleted_job_threads TO service_role;
COMMIT;
