-- Availability header relationships live solely in availability_request_jobs.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

LOCK TABLE public.job_requests, public.job_request_items,
  public.availability_requests, public.availability_request_jobs,
  public.availability_request_items, public.availability_request_item_jobs
  IN ACCESS EXCLUSIVE MODE;

-- Preserve legacy-only links, including history whose item rows were removed.
-- Copying existing associations is not a new supplier delivery event.
ALTER TABLE public.availability_request_jobs DISABLE TRIGGER availability_request_jobs_progress;
INSERT INTO public.availability_request_jobs(availability_request_id, job_request_id)
  SELECT id, job_request_id FROM public.availability_requests WHERE job_request_id IS NOT NULL
  ON CONFLICT DO NOTHING;
ALTER TABLE public.availability_request_jobs ENABLE TRIGGER availability_request_jobs_progress;

DROP TRIGGER availability_requests_sync_job_anchor ON public.availability_requests;
DROP FUNCTION public.sync_availability_job_anchor() RESTRICT;

CREATE OR REPLACE FUNCTION public.create_availability_request(p_supplier_id bigint, p_items jsonb,
  p_share_customer_details boolean DEFAULT false, p_public_token uuid DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE line jsonb; allocation jsonb; job public.job_requests; item public.job_request_items;
  request_id bigint; line_id bigint; linked_job_ids bigint[] := '{}'; demand numeric; allocation_total numeric; unknown_quantity boolean;
BEGIN
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Availability items are required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND is_active) THEN
    RAISE EXCEPTION 'Active supplier required';
  END IF;
  -- Lock customer demand before the supplier request, the same order as closure.
  FOR job IN SELECT j.* FROM public.job_requests j WHERE j.id IN (
    SELECT ji.job_request_id FROM public.job_request_items ji WHERE ji.id IN (
      SELECT (a->>'job_request_item_id')::bigint FROM jsonb_array_elements(p_items) l,
        LATERAL jsonb_array_elements(l->'allocations') a
    )) ORDER BY j.id FOR UPDATE LOOP
    IF NOT job.is_active OR job.status IN ('closed_won', 'closed_lost', 'archived') THEN
      RAISE EXCEPTION 'This job request is closed';
    END IF;
    linked_job_ids := array_append(linked_job_ids, job.id);
  END LOOP;
  IF cardinality(linked_job_ids) = 0 THEN RAISE EXCEPTION 'Job allocations are required'; END IF;
  INSERT INTO public.availability_requests(supplier_id, share_customer_details, public_token)
    VALUES (p_supplier_id, p_share_customer_details, p_public_token) RETURNING id INTO request_id;
  -- Establish every validated header link before line triggers update the AR.
  INSERT INTO public.availability_request_jobs(availability_request_id, job_request_id)
    SELECT request_id, linked_job_id FROM unnest(linked_job_ids) AS jobs(linked_job_id)
    ORDER BY linked_job_id;
  FOR line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(line->'allocations') IS DISTINCT FROM 'array' OR jsonb_array_length(line->'allocations') = 0
      OR nullif(trim(line->>'name'), '') IS NULL THEN RAISE EXCEPTION 'Named lines with job allocations are required'; END IF;
    demand := (line->>'demanded_quantity')::numeric;
    IF demand <= 0 OR demand >= 'Infinity'::numeric THEN RAISE EXCEPTION 'Known quantities must be positive and finite'; END IF;
    INSERT INTO public.availability_request_items(availability_request_id, name, size, demanded_quantity, unit_price, mapped_inventory_id, lps_notes)
      VALUES (request_id, line->>'name', line->>'size', demand, (line->>'unit_price')::numeric,
        (line->>'mapped_inventory_id')::uuid, line->>'lps_notes') RETURNING id INTO line_id;
    allocation_total := 0;
    unknown_quantity := false;
    FOR allocation IN SELECT * FROM jsonb_array_elements(line->'allocations') LOOP
      SELECT * INTO item FROM public.job_request_items WHERE id = (allocation->>'job_request_item_id')::bigint AND is_active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Active job line not found'; END IF;
      IF (allocation->>'quantity')::numeric <= 0 OR (allocation->>'quantity')::numeric >= 'Infinity'::numeric THEN
        RAISE EXCEPTION 'Known allocations must be positive and finite'; END IF;
      INSERT INTO public.availability_request_item_jobs VALUES (line_id, item.id, (allocation->>'quantity')::numeric);
      unknown_quantity := unknown_quantity OR (allocation->>'quantity') IS NULL;
      allocation_total := allocation_total + coalesce((allocation->>'quantity')::numeric, 0);
    END LOOP;
    IF (unknown_quantity AND demand IS NOT NULL) OR (NOT unknown_quantity AND demand IS DISTINCT FROM allocation_total) THEN
      RAISE EXCEPTION 'Allocations must equal requested quantity'; END IF;
  END LOOP;
  RETURN request_id;
END $$;

CREATE OR REPLACE FUNCTION public.guard_ar_public_link() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Creation validates and locks jobs in create_availability_request before
  -- inserting the header; its junction rows follow in the same transaction.
  IF TG_OP = 'UPDATE' AND NEW.status NOT IN ('closed', 'hidden') AND NOT EXISTS (
    SELECT 1 FROM public.availability_request_jobs l JOIN public.job_requests j ON j.id = l.job_request_id
      WHERE l.availability_request_id = NEW.id AND j.is_active
        AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')
  ) THEN RAISE EXCEPTION 'All linked job requests are closed';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'closed' AND OLD.status <> 'closed' THEN
    NEW.status_before_close := OLD.status;
    NEW.was_public_before_close := OLD.public_token IS NOT NULL;
  ELSIF NEW.status NOT IN ('closed', 'hidden') THEN
    NEW.status_before_close := NULL;
    NEW.was_public_before_close := false;
  END IF;
  IF NEW.status IN ('closed', 'hidden') OR NOT NEW.is_active THEN
    NEW.public_token := NULL;
  ELSIF NEW.public_token IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.suppliers WHERE id = NEW.supplier_id AND is_active
  ) THEN RAISE EXCEPTION 'Public requests require an active supplier';
  END IF;
  IF NEW.status = 'submitted' AND
    (TG_OP = 'INSERT' OR (OLD.status <> 'submitted' AND NOT
      (OLD.status = 'closed' AND OLD.status_before_close IS NOT DISTINCT FROM 'submitted'))) THEN
    NEW.submitted_at := now();
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.close_ar_on_job_status_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ar public.availability_requests;
BEGIN
  FOR ar IN SELECT a.* FROM public.availability_requests a WHERE EXISTS (SELECT 1 FROM public.availability_request_jobs l WHERE l.availability_request_id = a.id AND l.job_request_id = NEW.id)
    ORDER BY a.id FOR UPDATE LOOP
    IF NEW.status IN ('closed_won', 'closed_lost', 'archived') OR NOT NEW.is_active THEN
      IF NOT EXISTS (SELECT 1 FROM public.availability_request_jobs l JOIN public.job_requests j ON j.id = l.job_request_id
        WHERE l.availability_request_id = ar.id AND j.is_active AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')) THEN
        UPDATE public.availability_requests SET status = 'closed', public_token = NULL
          WHERE id = ar.id AND status <> 'hidden' AND (status <> 'closed' OR public_token IS NOT NULL);
      END IF;
    ELSIF (OLD.status IN ('closed_won', 'closed_lost', 'archived') OR NOT OLD.is_active)
      AND ar.status = 'closed' AND ar.status_before_close IS NOT NULL THEN
      UPDATE public.availability_requests SET status = ar.status_before_close,
        public_token = CASE WHEN ar.was_public_before_close AND ar.is_active AND EXISTS (
          SELECT 1 FROM public.suppliers s WHERE s.id = ar.supplier_id AND s.is_active
        ) THEN gen_random_uuid() ELSE NULL END WHERE id = ar.id;
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

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
  FOR row_id IN SELECT ar.id FROM public.availability_requests ar WHERE EXISTS (SELECT 1 FROM public.availability_request_jobs l WHERE l.availability_request_id=ar.id AND l.job_request_id=OLD.id)
    OR EXISTS (SELECT 1 FROM public.availability_request_items ai
      JOIN public.availability_request_item_jobs l ON l.availability_request_item_id=ai.id
      JOIN public.job_request_items ji ON ji.id=l.job_request_item_id
      WHERE ai.availability_request_id=ar.id AND ji.job_request_id=OLD.id)
    ORDER BY ar.id FOR UPDATE LOOP
    IF NOT EXISTS (SELECT 1 FROM public.availability_request_jobs l WHERE l.availability_request_id=row_id AND l.job_request_id<>OLD.id)
      AND NOT EXISTS (SELECT 1 FROM public.availability_request_items ai
        JOIN public.availability_request_item_jobs l ON l.availability_request_item_id=ai.id
        JOIN public.job_request_items ji ON ji.id=l.job_request_item_id
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

ALTER TABLE public.availability_requests DROP COLUMN job_request_id RESTRICT;
COMMENT ON TABLE public.availability_request_jobs IS
  'Authoritative job associations for an availability request, including header history retained after individual job items are deleted.';

REVOKE ALL ON FUNCTION public.create_availability_request(bigint,jsonb,boolean,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_availability_request(bigint,jsonb,boolean,uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
