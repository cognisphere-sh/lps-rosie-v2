-- Availability line relationships live solely in availability_request_item_jobs.
-- Preserve legacy-only associations before removing the redundant source hint.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Stop concurrent writers while checking and copying the legacy associations.
-- Lock customer demand before supplier requests, matching the creation RPC.
LOCK TABLE public.job_requests, public.job_request_items,
  public.availability_requests, public.availability_request_jobs,
  public.availability_request_items, public.availability_request_item_jobs
  IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.availability_request_items ai
    WHERE ai.job_request_item_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.availability_request_item_jobs link
        WHERE link.availability_request_item_id = ai.id
          AND link.job_request_item_id = ai.job_request_item_id)
      AND EXISTS (SELECT 1 FROM public.availability_request_item_jobs link
        WHERE link.availability_request_item_id = ai.id)
  ) THEN
    RAISE EXCEPTION 'Resolve missing legacy allocations on shared availability lines before dropping the source hint';
  END IF;
END $$;

INSERT INTO public.availability_request_item_jobs
  (availability_request_item_id, job_request_item_id, quantity)
SELECT ai.id, ai.job_request_item_id, ai.quantity
FROM public.availability_request_items ai
WHERE ai.job_request_item_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.availability_request_item_jobs link
    WHERE link.availability_request_item_id = ai.id);

DROP TRIGGER availability_request_items_sync_job_anchor ON public.availability_request_items;
DROP FUNCTION public.sync_availability_item_anchor() RESTRICT;

CREATE OR REPLACE FUNCTION public.create_availability_request(p_supplier_id bigint, p_items jsonb,
  p_share_customer_details boolean DEFAULT false, p_public_token uuid DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE line jsonb; allocation jsonb; job public.job_requests; item public.job_request_items;
  request_id bigint; line_id bigint; primary_job_id bigint; demand numeric; allocation_total numeric; unknown_quantity boolean;
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
    primary_job_id := coalesce(primary_job_id, job.id);
  END LOOP;
  IF primary_job_id IS NULL THEN RAISE EXCEPTION 'Job allocations are required'; END IF;
  INSERT INTO public.availability_requests(job_request_id, supplier_id, share_customer_details, public_token)
    VALUES (primary_job_id, p_supplier_id, p_share_customer_details, p_public_token) RETURNING id INTO request_id;
  FOR line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(line->'allocations') IS DISTINCT FROM 'array' OR jsonb_array_length(line->'allocations') = 0
      OR nullif(trim(line->>'name'), '') IS NULL THEN RAISE EXCEPTION 'Named lines with job allocations are required'; END IF;
    demand := (line->>'quantity')::numeric;
    IF demand <= 0 OR demand >= 'Infinity'::numeric THEN RAISE EXCEPTION 'Known quantities must be positive and finite'; END IF;
    INSERT INTO public.availability_request_items(availability_request_id, name, size, quantity, unit_price, mapped_inventory_id, lps_notes)
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

CREATE OR REPLACE FUNCTION public.delete_job_request_item(
  p_job_request_id bigint,
  p_job_request_item_id bigint
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  found_item bigint;
  ar_item_count bigint := 0;
  history_count bigint := 0;
BEGIN
  SELECT id INTO found_item FROM public.job_request_items
    WHERE id = p_job_request_item_id AND job_request_id = p_job_request_id
    FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Lock the supplier lines before examining their allocations. New links take
  -- a foreign-key lock on these rows and must wait until deletion finishes.
  PERFORM 1 FROM public.availability_request_items ai
    WHERE EXISTS (SELECT 1 FROM public.availability_request_item_jobs link
      WHERE link.availability_request_item_id = ai.id
        AND link.job_request_item_id = p_job_request_item_id)
    ORDER BY ai.id FOR UPDATE;
  SELECT count(*) INTO history_count FROM public.job_request_changelog
    WHERE item_id = p_job_request_item_id;

  -- Delete exclusively linked lines, including the last allocation of a
  -- previously shared line. Other shared lines retain their original snapshot.
  DELETE FROM public.availability_request_items ai
    WHERE EXISTS (SELECT 1 FROM public.availability_request_item_jobs link
      WHERE link.availability_request_item_id = ai.id
        AND link.job_request_item_id = p_job_request_item_id)
      AND NOT EXISTS (SELECT 1 FROM public.availability_request_item_jobs link
        WHERE link.availability_request_item_id = ai.id
          AND link.job_request_item_id <> p_job_request_item_id);
  GET DIAGNOSTICS ar_item_count = ROW_COUNT;
  DELETE FROM public.job_request_items WHERE id = p_job_request_item_id;

  RETURN jsonb_build_object(
    'items', 1,
    'availabilityRequests', 0,
    'availabilityRequestItems', ar_item_count,
    'changelog', history_count,
    'answers', 0
  );
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
  FOR row_id IN SELECT ar.id FROM public.availability_requests ar WHERE ar.job_request_id=OLD.id
    OR EXISTS (SELECT 1 FROM public.availability_request_jobs l WHERE l.availability_request_id=ar.id AND l.job_request_id=OLD.id)
    OR EXISTS (SELECT 1 FROM public.availability_request_items ai
      JOIN public.availability_request_item_jobs l ON l.availability_request_item_id=ai.id
      JOIN public.job_request_items ji ON ji.id=l.job_request_item_id
      WHERE ai.availability_request_id=ar.id AND ji.job_request_id=OLD.id)
    ORDER BY ar.id FOR UPDATE LOOP
    IF NOT EXISTS (SELECT 1 FROM public.availability_requests ar WHERE ar.id=row_id AND ar.job_request_id<>OLD.id)
      AND NOT EXISTS (SELECT 1 FROM public.availability_request_jobs l WHERE l.availability_request_id=row_id AND l.job_request_id<>OLD.id)
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

ALTER TABLE public.availability_request_items DROP COLUMN job_request_item_id RESTRICT;

-- CREATE OR REPLACE keeps existing privileges; make the intended RPC access explicit.
REVOKE ALL ON FUNCTION public.create_availability_request(bigint,jsonb,boolean,uuid),
  public.delete_job_request_item(bigint,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_availability_request(bigint,jsonb,boolean,uuid),
  public.delete_job_request_item(bigint,bigint) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
