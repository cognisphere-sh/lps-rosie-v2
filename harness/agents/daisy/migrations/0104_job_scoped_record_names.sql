-- Stable display names; primary keys and portal routes remain unchanged.
BEGIN;
ALTER TABLE public.availability_requests ADD COLUMN record_name text UNIQUE;
ALTER TABLE public.orders ADD COLUMN record_name text UNIQUE;
CREATE TABLE public.job_record_counters (
  job_request_id bigint NOT NULL,
  record_type text NOT NULL CHECK (record_type IN ('AR', 'Order')),
  last_number bigint NOT NULL CHECK (last_number > 0),
  PRIMARY KEY (job_request_id, record_type)
);
-- Retain counters after deletion so a surviving/retried job never reuses a name.
ALTER TABLE public.job_record_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_record_counters FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.job_record_counters TO service_role;

CREATE FUNCTION public.assign_job_record_name(p_kind text, p_record_id bigint, p_job_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE existing_name text; next_number bigint;
BEGIN
  IF p_job_id IS NULL THEN RETURN; END IF;
  IF p_kind = 'AR' THEN
    SELECT record_name INTO existing_name FROM public.availability_requests WHERE id = p_record_id FOR UPDATE;
  ELSIF p_kind = 'Order' THEN
    SELECT record_name INTO existing_name FROM public.orders WHERE id = p_record_id FOR UPDATE;
  ELSE
    RAISE EXCEPTION 'Unsupported record kind';
  END IF;
  IF NOT FOUND OR existing_name IS NOT NULL THEN RETURN; END IF;
  INSERT INTO public.job_record_counters(job_request_id, record_type, last_number)
    VALUES (p_job_id, p_kind, 1)
    ON CONFLICT (job_request_id, record_type) DO UPDATE
      SET last_number = job_record_counters.last_number + 1
    RETURNING last_number INTO next_number;
  existing_name := format('JR-%s:%s-%s', p_job_id, p_kind, next_number);
  IF p_kind = 'AR' THEN
    UPDATE public.availability_requests SET record_name = existing_name WHERE id = p_record_id;
  ELSE
    UPDATE public.orders SET record_name = existing_name WHERE id = p_record_id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.assign_job_record_name(text,bigint,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_job_record_name(text,bigint,bigint) TO service_role;

-- Backfill every historical record (including closed/hidden ones) in creation
-- order. For shared records, use the lowest linked job as the historical anchor.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT a.id, coalesce(min(l.job_request_id), a.job_request_id) AS job_id
    FROM public.availability_requests a LEFT JOIN public.availability_request_jobs l ON l.availability_request_id = a.id
    GROUP BY a.id ORDER BY a.created_at, a.id
  LOOP PERFORM public.assign_job_record_name('AR', r.id, r.job_id); END LOOP;
  FOR r IN SELECT o.id, min(j.job_request_id) AS job_id FROM public.orders o
    LEFT JOIN public.order_items i ON i.order_id = o.id
    LEFT JOIN public.order_item_job_request_items l ON l.order_item_id = i.id
    LEFT JOIN public.job_request_items j ON j.id = l.job_request_item_id
    GROUP BY o.id ORDER BY o.created_at, o.id
  LOOP PERFORM public.assign_job_record_name('Order', r.id, r.job_id); END LOOP;
END $$;

CREATE FUNCTION public.name_linked_supplier_record() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE order_id bigint; job_id bigint;
BEGIN
  IF TG_TABLE_NAME = 'availability_request_jobs' THEN
    PERFORM public.assign_job_record_name('AR', NEW.availability_request_id, NEW.job_request_id);
  ELSE
    SELECT i.order_id, j.job_request_id INTO order_id, job_id
      FROM public.order_items i CROSS JOIN public.job_request_items j
      WHERE i.id = NEW.order_item_id AND j.id = NEW.job_request_item_id;
    PERFORM public.assign_job_record_name('Order', order_id, job_id);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.name_linked_supplier_record() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.name_linked_supplier_record() TO service_role;
CREATE TRIGGER availability_request_record_name AFTER INSERT OR UPDATE ON public.availability_request_jobs
  FOR EACH ROW EXECUTE FUNCTION public.name_linked_supplier_record();
CREATE TRIGGER order_record_name AFTER INSERT OR UPDATE ON public.order_item_job_request_items
  FOR EACH ROW EXECUTE FUNCTION public.name_linked_supplier_record();
COMMENT ON COLUMN public.availability_requests.record_name IS 'Stable JR-<job>:AR-<per-job sequence> display name. First linked job anchors shared records; no renumbering on unlink/delete. NULL until linked.';
COMMENT ON COLUMN public.orders.record_name IS 'Stable JR-<job>:Order-<per-job sequence> display name. First linked job anchors shared records; no renumbering on unlink/delete. NULL until linked.';
NOTIFY pgrst, 'reload schema';
COMMIT;
