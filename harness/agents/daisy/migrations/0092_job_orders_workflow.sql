-- Quote first; customer commitment creates supplier orders. Availability asks
-- and order lines can combine demand from several jobs without losing history.
BEGIN;

ALTER TABLE public.job_requests DROP CONSTRAINT job_requests_status_check;
-- 0089 Confirmed meant customer confirmation; preserve that meaning as Committed.
-- No supplier confirmations or historical orders can be inferred from it.
UPDATE public.job_requests SET status = CASE status WHEN 'sourcing' THEN 'quoted' ELSE 'committed' END
  WHERE status IN ('sourcing', 'confirmed');
ALTER TABLE public.job_requests ALTER COLUMN status SET DEFAULT 'quoted';
ALTER TABLE public.job_requests ADD CONSTRAINT job_requests_status_check CHECK (
  status IN ('quoted', 'availability', 'committed', 'confirmed', 'closed_won', 'closed_lost', 'archived')
);
ALTER TABLE public.job_requests ADD COLUMN expected_install_date date,
  ADD COLUMN fulfillment_method text CHECK (fulfillment_method IN ('pickup', 'delivery'));
COMMENT ON COLUMN public.job_requests.status IS
  'Quote (quoted, default), Availability, Committed (customer confirmed), Confirmed (supplier confirmed), Won/Lost. Archived is legacy history. 0092 maps Active/sourcing to Quote and historical customer Confirmed to Committed, without inventing supplier confirmations or orders.';
COMMENT ON COLUMN public.job_requests.expected_install_date IS 'Expected customer installation date.';
COMMENT ON COLUMN public.job_requests.fulfillment_method IS 'Requested pickup or delivery; NULL until specified.';

-- Keep old anchor columns as compatibility hints, never as exclusive ownership.
ALTER TABLE public.availability_requests DROP CONSTRAINT availability_requests_job_request_id_fkey;
ALTER TABLE public.availability_requests ALTER COLUMN job_request_id DROP NOT NULL;
ALTER TABLE public.availability_requests ADD CONSTRAINT availability_requests_job_request_id_fkey
  FOREIGN KEY (job_request_id) REFERENCES public.job_requests(id) ON DELETE SET NULL;
CREATE TABLE public.availability_request_jobs (
  availability_request_id bigint NOT NULL REFERENCES public.availability_requests(id) ON DELETE CASCADE,
  job_request_id bigint NOT NULL REFERENCES public.job_requests(id) ON DELETE CASCADE,
  PRIMARY KEY (availability_request_id, job_request_id)
);
CREATE INDEX availability_request_jobs_job_idx ON public.availability_request_jobs(job_request_id);
CREATE TABLE public.availability_request_item_jobs (
  availability_request_item_id bigint NOT NULL REFERENCES public.availability_request_items(id) ON DELETE CASCADE,
  job_request_item_id bigint NOT NULL REFERENCES public.job_request_items(id) ON DELETE CASCADE,
  quantity numeric CHECK (quantity > 0 AND quantity < 'Infinity'::numeric),
  PRIMARY KEY (availability_request_item_id, job_request_item_id)
);
CREATE INDEX availability_request_item_jobs_job_idx ON public.availability_request_item_jobs(job_request_item_id);
INSERT INTO public.availability_request_jobs SELECT id, job_request_id
  FROM public.availability_requests WHERE job_request_id IS NOT NULL;
INSERT INTO public.availability_request_item_jobs
  SELECT ar.id, ar.job_request_item_id, ar.quantity FROM public.availability_request_items ar
  WHERE ar.job_request_item_id IS NOT NULL;
INSERT INTO public.availability_request_jobs
  SELECT DISTINCT ar.availability_request_id, ji.job_request_id
  FROM public.availability_request_item_jobs link
  JOIN public.availability_request_items ar ON ar.id = link.availability_request_item_id
  JOIN public.job_request_items ji ON ji.id = link.job_request_item_id
  ON CONFLICT DO NOTHING;
COMMENT ON TABLE public.availability_request_jobs IS 'All jobs represented by a supplier availability ask; authoritative many-to-many association.';
COMMENT ON TABLE public.availability_request_item_jobs IS 'Demand allocations per availability line. Multiple job items can share one line, and one job item can appear in multiple asks. NULL quantity preserves demand that has not been specified; orders require explicit positive allocations.';
COMMENT ON COLUMN public.availability_requests.job_request_id IS 'Optional legacy primary-job hint. Use availability_request_jobs for complete associations. Deleting one job preserves shared supplier evidence.';
COMMENT ON COLUMN public.availability_request_items.job_request_item_id IS 'Optional legacy primary-line hint. Use availability_request_item_jobs for complete demand allocations.';

CREATE TABLE public.orders (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id bigint NOT NULL REFERENCES public.suppliers(id),
  status text NOT NULL DEFAULT 'committed' CHECK (status IN ('committed', 'confirmed', 'closed_won', 'closed_lost')),
  fulfillment_method text CHECK (fulfillment_method IN ('pickup', 'delivery')),
  confirmation_date date,
  fulfillment_date date,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_supplier_idx ON public.orders(supplier_id, is_active, created_at DESC);
CREATE TABLE public.order_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id bigint NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  availability_request_item_id bigint REFERENCES public.availability_request_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  size text,
  quantity numeric NOT NULL CHECK (quantity > 0 AND quantity < 'Infinity'::numeric),
  unit_price numeric(10,2) CHECK (unit_price > 0 AND unit_price < 'Infinity'::numeric),
  total numeric(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN
    ('available', 'unavailable', 'diff_size_qty_sub', 'need_to_order', 'arriving_soon', 'pending')),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_items_order_idx ON public.order_items(order_id);
CREATE INDEX order_items_availability_idx ON public.order_items(availability_request_item_id);
CREATE TABLE public.order_item_job_request_items (
  order_item_id bigint NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  job_request_item_id bigint NOT NULL REFERENCES public.job_request_items(id) ON DELETE CASCADE,
  quantity numeric NOT NULL CHECK (quantity > 0 AND quantity < 'Infinity'::numeric),
  PRIMARY KEY (order_item_id, job_request_item_id)
);
CREATE INDEX order_item_job_request_items_job_idx ON public.order_item_job_request_items(job_request_item_id);
COMMENT ON TABLE public.orders IS 'One supplier order created after explicit customer commitment; can contain demand from several jobs.';
COMMENT ON TABLE public.order_items IS 'Ordered supplier-line snapshots; Can Order availability becomes Need to Order. Supplier confirmation preserves line procurement status.';
COMMENT ON TABLE public.order_item_job_request_items IS 'Allocation of an ordered quantity to customer demand; jobs can span orders and orders can span jobs.';
COMMENT ON COLUMN public.orders.fulfillment_date IS 'Scheduled pickup or delivery date.';

CREATE OR REPLACE FUNCTION public.record_job_workflow_event(p_job_request_id bigint, p_event text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE job public.job_requests; next_status text;
BEGIN
  IF p_event IS NULL OR p_event NOT IN
    ('pricing_fetched', 'availability_sent', 'quote_shared', 'customer_confirmed', 'supplier_confirmed') THEN
    RAISE EXCEPTION 'Unknown job workflow event';
  END IF;
  SELECT * INTO job FROM public.job_requests WHERE id = p_job_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job request not found'; END IF;
  IF job.is_active AND job.status NOT IN ('closed_won', 'closed_lost', 'archived') THEN
    IF p_event = 'customer_confirmed' AND job.status IN ('quoted', 'availability') THEN
      next_status := 'committed';
    ELSIF p_event = 'supplier_confirmed' AND job.status = 'committed' THEN
      next_status := 'confirmed';
    ELSIF p_event = 'availability_sent' AND job.status = 'quoted' THEN
      next_status := 'availability';
    END IF;
    IF next_status IS NOT NULL THEN
      UPDATE public.job_requests SET status = next_status WHERE id = job.id;
      RETURN next_status;
    END IF;
  END IF;
  RETURN job.status;
END $$;

-- Legacy direct inserts remain linked. New writes use the atomic RPC below.
CREATE FUNCTION public.sync_availability_job_anchor() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.job_request_id IS NOT NULL THEN
    INSERT INTO public.availability_request_jobs VALUES (NEW.id, NEW.job_request_id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER availability_requests_sync_job_anchor AFTER INSERT OR UPDATE OF job_request_id
  ON public.availability_requests FOR EACH ROW EXECUTE FUNCTION public.sync_availability_job_anchor();
CREATE FUNCTION public.sync_availability_item_anchor() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.job_request_item_id IS NOT NULL THEN
    INSERT INTO public.availability_request_item_jobs VALUES (NEW.id, NEW.job_request_item_id, NEW.quantity)
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER availability_request_items_sync_job_anchor AFTER INSERT OR UPDATE OF job_request_item_id
  ON public.availability_request_items FOR EACH ROW EXECUTE FUNCTION public.sync_availability_item_anchor();
CREATE FUNCTION public.link_availability_item_job() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE request_id bigint; job_id bigint;
BEGIN
  SELECT job_request_id INTO job_id FROM public.job_request_items WHERE id = NEW.job_request_item_id;
  SELECT availability_request_id INTO request_id FROM public.availability_request_items WHERE id = NEW.availability_request_item_id;
  INSERT INTO public.availability_request_jobs VALUES (request_id, job_id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER availability_request_item_jobs_link AFTER INSERT OR UPDATE
  ON public.availability_request_item_jobs FOR EACH ROW EXECUTE FUNCTION public.link_availability_item_job();
-- A single-job quantity correction must stay consistent with its demand link.
-- A combined line needs an explicit distribution decision, never a guessed split.
CREATE FUNCTION public.sync_availability_quantity_allocation() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE allocation_count integer; known_count integer; allocated_quantity numeric;
BEGIN
  IF NEW.quantity IS NOT DISTINCT FROM OLD.quantity THEN RETURN NEW; END IF;
  SELECT count(*), count(quantity), sum(quantity) INTO allocation_count, known_count, allocated_quantity
    FROM public.availability_request_item_jobs WHERE availability_request_item_id = NEW.id;
  IF allocation_count > 1 AND NOT (
    (known_count = allocation_count AND NEW.quantity IS NOT NULL AND allocated_quantity = NEW.quantity)
    OR (known_count = 0 AND NEW.quantity IS NULL)
  ) THEN
    RAISE EXCEPTION 'Combined request quantities require explicit allocation edits; this field cannot redistribute demand across jobs';
  ELSIF allocation_count = 1 THEN
    UPDATE public.availability_request_item_jobs SET quantity = NEW.quantity WHERE availability_request_item_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER availability_request_items_quantity_allocations BEFORE UPDATE OF quantity
  ON public.availability_request_items FOR EACH ROW EXECUTE FUNCTION public.sync_availability_quantity_allocation();

CREATE FUNCTION public.advance_linked_job_on_partner_request() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.availability_requests ar JOIN public.suppliers s ON s.id = ar.supplier_id
    WHERE ar.id = NEW.availability_request_id AND ar.is_active AND ar.status <> 'closed' AND s.is_active AND s.is_lps_partner) THEN
    PERFORM public.record_job_workflow_event(NEW.job_request_id, 'availability_sent');
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER availability_request_jobs_progress AFTER INSERT ON public.availability_request_jobs
  FOR EACH ROW EXECUTE FUNCTION public.advance_linked_job_on_partner_request();
-- The link trigger now covers every represented job exactly once.
DROP TRIGGER availability_requests_job_progress ON public.availability_requests;

CREATE OR REPLACE FUNCTION public.guard_ar_public_link() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.job_request_id IS NOT NULL THEN
    PERFORM 1 FROM public.job_requests WHERE id = NEW.job_request_id AND is_active
      AND status NOT IN ('closed_won', 'closed_lost', 'archived') FOR UPDATE;
    IF NOT FOUND AND NEW.status <> 'closed' THEN RAISE EXCEPTION 'This job request is closed'; END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> 'closed' AND NOT EXISTS (
    SELECT 1 FROM public.job_requests j WHERE j.is_active AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')
      AND (j.id = NEW.job_request_id OR EXISTS (SELECT 1 FROM public.availability_request_jobs l
        WHERE l.availability_request_id = NEW.id AND l.job_request_id = j.id))
  ) THEN RAISE EXCEPTION 'All linked job requests are closed';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status = 'closed' AND OLD.status <> 'closed' THEN
    NEW.status_before_close := OLD.status;
    NEW.was_public_before_close := OLD.public_token IS NOT NULL;
  ELSIF NEW.status <> 'closed' THEN
    NEW.status_before_close := NULL;
    NEW.was_public_before_close := false;
  END IF;
  IF NEW.status = 'closed' OR NOT NEW.is_active THEN
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
  FOR ar IN SELECT a.* FROM public.availability_requests a WHERE a.job_request_id = NEW.id
    OR EXISTS (SELECT 1 FROM public.availability_request_jobs l WHERE l.availability_request_id = a.id AND l.job_request_id = NEW.id)
    ORDER BY a.id FOR UPDATE LOOP
    IF NEW.status IN ('closed_won', 'closed_lost', 'archived') OR NOT NEW.is_active THEN
      IF NOT EXISTS (SELECT 1 FROM public.availability_request_jobs l JOIN public.job_requests j ON j.id = l.job_request_id
        WHERE l.availability_request_id = ar.id AND j.is_active AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')) THEN
        UPDATE public.availability_requests SET status = 'closed', public_token = NULL
          WHERE id = ar.id AND (status <> 'closed' OR public_token IS NOT NULL);
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
CREATE FUNCTION public.close_orphaned_availability_on_job_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE ar public.availability_requests;
BEGIN
  FOR ar IN SELECT a.* FROM public.availability_requests a WHERE a.job_request_id = OLD.id
    OR EXISTS (SELECT 1 FROM public.availability_request_jobs l WHERE l.availability_request_id = a.id AND l.job_request_id = OLD.id)
    ORDER BY a.id FOR UPDATE LOOP
    IF NOT EXISTS (SELECT 1 FROM public.availability_request_jobs l JOIN public.job_requests j ON j.id = l.job_request_id
      WHERE l.availability_request_id = ar.id AND j.id <> OLD.id AND j.is_active
      AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')) THEN
      UPDATE public.availability_requests SET status = 'closed', public_token = NULL WHERE id = ar.id;
    END IF;
  END LOOP;
  RETURN OLD;
END $$;
CREATE TRIGGER job_requests_preserve_shared_availability BEFORE DELETE ON public.job_requests
  FOR EACH ROW EXECUTE FUNCTION public.close_orphaned_availability_on_job_delete();

CREATE FUNCTION public.create_availability_request(p_supplier_id bigint, p_items jsonb,
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
    IF jsonb_array_length(line->'allocations') = 1 THEN
      UPDATE public.availability_request_items SET job_request_item_id = (line->'allocations'->0->>'job_request_item_id')::bigint WHERE id = line_id;
    END IF;
  END LOOP;
  RETURN request_id;
END $$;

CREATE FUNCTION public.create_order(p_supplier_id bigint, p_items jsonb,
  p_fulfillment_method text DEFAULT NULL, p_fulfillment_date date DEFAULT NULL,
  p_notes text DEFAULT NULL, p_customer_confirmed boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE line jsonb; allocation jsonb; source public.availability_request_items; ar public.availability_requests;
  job public.job_requests; demand_item public.job_request_items; order_id bigint; line_id bigint;
  demand numeric; allocated numeric; allocation_limit numeric; already_ordered numeric;
BEGIN
  IF p_customer_confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Explicit customer confirmation is required'; END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Order items are required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND is_active) THEN RAISE EXCEPTION 'Active supplier required'; END IF;
  FOR job IN SELECT j.* FROM public.job_requests j WHERE j.id IN (
    SELECT ji.job_request_id FROM public.job_request_items ji WHERE ji.id IN (
      SELECT (a->>'job_request_item_id')::bigint FROM jsonb_array_elements(p_items) l,
        LATERAL jsonb_array_elements(l->'allocations') a
    )) ORDER BY j.id FOR UPDATE LOOP
    IF NOT job.is_active OR job.status IN ('closed_won', 'closed_lost', 'archived') THEN RAISE EXCEPTION 'This job request is closed'; END IF;
  END LOOP;
  -- Serialize repeated/subdivided orders on the source request, then its lines.
  PERFORM 1 FROM public.availability_requests a WHERE a.id IN (
    SELECT ai.availability_request_id FROM public.availability_request_items ai WHERE ai.id IN (
      SELECT (l->>'availability_request_item_id')::bigint FROM jsonb_array_elements(p_items) l
    )) ORDER BY a.id FOR UPDATE;
  INSERT INTO public.orders(supplier_id, fulfillment_method, fulfillment_date, notes)
    VALUES (p_supplier_id, p_fulfillment_method, p_fulfillment_date, p_notes) RETURNING id INTO order_id;
  FOR line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(line->'allocations') IS DISTINCT FROM 'array' OR jsonb_array_length(line->'allocations') = 0 THEN
      RAISE EXCEPTION 'Order allocations are required'; END IF;
    SELECT * INTO source FROM public.availability_request_items WHERE id = (line->>'availability_request_item_id')::bigint AND is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Availability line not found'; END IF;
    SELECT * INTO ar FROM public.availability_requests WHERE id = source.availability_request_id;
    IF ar.supplier_id <> p_supplier_id OR NOT ar.is_active OR ar.status = 'closed' THEN RAISE EXCEPTION 'Availability request is closed or belongs to another supplier'; END IF;
    IF source.status IS NULL OR source.status = 'unavailable' THEN RAISE EXCEPTION 'Supplier must answer availability before ordering'; END IF;
    SELECT sum((a->>'quantity')::numeric) INTO demand FROM jsonb_array_elements(line->'allocations') a;
    IF demand IS NULL OR demand <= 0 OR demand >= 'Infinity'::numeric THEN RAISE EXCEPTION 'Positive finite quantities are required'; END IF;
    SELECT coalesce(sum(oi.quantity), 0) INTO already_ordered FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
      WHERE oi.availability_request_item_id = source.id AND oi.is_active AND o.is_active AND o.status <> 'closed_lost';
    IF source.quantity IS NOT NULL AND demand + already_ordered > source.quantity THEN RAISE EXCEPTION 'Order exceeds remaining requested quantity'; END IF;
    IF source.available_quantity IS NOT NULL AND source.status <> 'can_order' AND demand + already_ordered > source.available_quantity THEN
      RAISE EXCEPTION 'Order exceeds supplier available quantity'; END IF;
    INSERT INTO public.order_items(order_id, availability_request_item_id, name, size, quantity, unit_price, status, notes)
      VALUES (order_id, source.id, source.name, source.size, demand, source.unit_price,
        CASE WHEN source.status = 'can_order' THEN 'need_to_order' ELSE coalesce(source.status, 'pending') END, source.notes)
      RETURNING id INTO line_id;
    FOR allocation IN SELECT * FROM jsonb_array_elements(line->'allocations') LOOP
      allocated := (allocation->>'quantity')::numeric;
      IF allocated IS NULL OR allocated <= 0 OR allocated >= 'Infinity'::numeric THEN RAISE EXCEPTION 'Positive finite allocations are required'; END IF;
      SELECT * INTO demand_item FROM public.job_request_items WHERE id = (allocation->>'job_request_item_id')::bigint AND is_active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Active job line not found'; END IF;
      SELECT quantity INTO allocation_limit FROM public.availability_request_item_jobs
        WHERE availability_request_item_id = source.id AND job_request_item_id = demand_item.id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Job line is not allocated to this availability line'; END IF;
      SELECT coalesce(sum(a.quantity), 0) INTO already_ordered FROM public.order_item_job_request_items a
        JOIN public.order_items oi ON oi.id = a.order_item_id JOIN public.orders o ON o.id = oi.order_id
        WHERE a.job_request_item_id = demand_item.id AND oi.availability_request_item_id = source.id
          AND oi.is_active AND o.is_active AND o.status <> 'closed_lost';
      IF allocation_limit IS NOT NULL AND allocated + already_ordered > allocation_limit THEN RAISE EXCEPTION 'Order exceeds remaining availability allocation'; END IF;
      SELECT coalesce(sum(a.quantity), 0) INTO already_ordered FROM public.order_item_job_request_items a
        JOIN public.order_items oi ON oi.id = a.order_item_id JOIN public.orders o ON o.id = oi.order_id
        WHERE a.job_request_item_id = demand_item.id AND oi.is_active AND o.is_active AND o.status <> 'closed_lost';
      IF demand_item.quantity IS NOT NULL AND allocated + already_ordered > demand_item.quantity THEN RAISE EXCEPTION 'Order exceeds remaining customer demand'; END IF;
      INSERT INTO public.order_item_job_request_items VALUES (line_id, demand_item.id, allocated);
      -- A further order makes a previously supplier-confirmed job Committed again.
      UPDATE public.job_requests SET status = 'committed' WHERE id = demand_item.job_request_id AND status IN ('quoted', 'availability', 'confirmed');
    END LOOP;
  END LOOP;
  RETURN order_id;
END $$;

CREATE FUNCTION public.confirm_order(p_order_id bigint, p_supplier_id bigint,
  p_confirmation_date date DEFAULT CURRENT_DATE, p_fulfillment_date date DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE job_id bigint;
BEGIN
  -- Match the creation lock order so a new order cannot race confirmation.
  PERFORM 1 FROM public.job_requests j WHERE j.id IN (
    SELECT ji.job_request_id FROM public.order_item_job_request_items a
      JOIN public.job_request_items ji ON ji.id = a.job_request_item_id JOIN public.order_items oi ON oi.id = a.order_item_id
      WHERE oi.order_id = p_order_id
  ) ORDER BY j.id FOR UPDATE;
  PERFORM 1 FROM public.orders o JOIN public.suppliers s ON s.id = o.supplier_id
    WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id AND o.is_active AND s.is_active
      AND o.status IN ('committed', 'confirmed') FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is closed or unavailable'; END IF;
  UPDATE public.orders SET status = 'confirmed', confirmation_date = coalesce(confirmation_date, p_confirmation_date, CURRENT_DATE),
    fulfillment_date = coalesce(p_fulfillment_date, fulfillment_date) WHERE id = p_order_id;
  FOR job_id IN SELECT DISTINCT ji.job_request_id FROM public.order_item_job_request_items a
    JOIN public.job_request_items ji ON ji.id = a.job_request_item_id JOIN public.order_items oi ON oi.id = a.order_item_id
    WHERE oi.order_id = p_order_id LOOP
    IF NOT EXISTS (SELECT 1 FROM public.order_item_job_request_items a JOIN public.job_request_items ji ON ji.id = a.job_request_item_id
      JOIN public.order_items oi ON oi.id = a.order_item_id JOIN public.orders o ON o.id = oi.order_id
      WHERE ji.job_request_id = job_id AND oi.is_active AND o.is_active AND o.status = 'committed') THEN
      PERFORM public.record_job_workflow_event(job_id, 'supplier_confirmed');
    END IF;
  END LOOP;
  RETURN p_order_id;
END $$;

CREATE FUNCTION public.close_order(p_order_id bigint, p_status text)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE job_id bigint; lost boolean;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('closed_won', 'closed_lost') THEN RAISE EXCEPTION 'Choose Won or Lost'; END IF;
  PERFORM 1 FROM public.job_requests j WHERE j.id IN (
    SELECT ji.job_request_id FROM public.order_item_job_request_items a
      JOIN public.job_request_items ji ON ji.id = a.job_request_item_id JOIN public.order_items oi ON oi.id = a.order_item_id
      WHERE oi.order_id = p_order_id
  ) ORDER BY j.id FOR UPDATE;
  UPDATE public.orders SET status = p_status WHERE id = p_order_id AND is_active
    AND (status IN ('committed', 'confirmed') OR status = p_status);
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is unavailable or already closed with a different outcome'; END IF;
  FOR job_id IN SELECT DISTINCT ji.job_request_id FROM public.order_item_job_request_items a
    JOIN public.job_request_items ji ON ji.id = a.job_request_item_id JOIN public.order_items oi ON oi.id = a.order_item_id
    WHERE oi.order_id = p_order_id LOOP
    IF NOT EXISTS (SELECT 1 FROM public.order_item_job_request_items a JOIN public.job_request_items ji ON ji.id = a.job_request_item_id
      JOIN public.order_items oi ON oi.id = a.order_item_id JOIN public.orders o ON o.id = oi.order_id
      WHERE ji.job_request_id = job_id AND oi.is_active AND o.is_active AND o.status IN ('committed', 'confirmed'))
      AND NOT EXISTS (SELECT 1 FROM public.job_request_items ji WHERE ji.job_request_id = job_id AND ji.is_active
        AND (ji.quantity IS NULL OR ji.quantity > (SELECT coalesce(sum(a.quantity), 0)
          FROM public.order_item_job_request_items a JOIN public.order_items oi ON oi.id = a.order_item_id
          JOIN public.orders o ON o.id = oi.order_id WHERE a.job_request_item_id = ji.id AND oi.is_active AND o.is_active
            AND o.status IN ('closed_won', 'closed_lost')))) THEN
      SELECT EXISTS (SELECT 1 FROM public.order_item_job_request_items a JOIN public.job_request_items ji ON ji.id = a.job_request_item_id
        JOIN public.order_items oi ON oi.id = a.order_item_id JOIN public.orders o ON o.id = oi.order_id
        WHERE ji.job_request_id = job_id AND oi.is_active AND o.is_active AND o.status = 'closed_lost') INTO lost;
      UPDATE public.job_requests SET status = CASE WHEN lost THEN 'closed_lost' ELSE 'closed_won' END
        WHERE id = job_id AND is_active AND status NOT IN ('closed_won', 'closed_lost', 'archived');
    END IF;
  END LOOP;
  RETURN p_order_id;
END $$;

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
DO $$
DECLARE relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY['availability_request_jobs', 'availability_request_item_jobs',
    'orders', 'order_items', 'order_item_job_request_items'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation_name);
    EXECUTE format('CREATE POLICY "authenticated full access" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', relation_name);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role, authenticated', relation_name);
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', relation_name);
    END IF;
  END LOOP;
END $$;
GRANT USAGE, SELECT ON SEQUENCE public.orders_id_seq, public.order_items_id_seq TO service_role, authenticated;
REVOKE ALL ON FUNCTION public.create_availability_request(bigint,jsonb,boolean,uuid),
  public.create_order(bigint,jsonb,text,date,text,boolean), public.confirm_order(bigint,bigint,date,date),
  public.close_order(bigint,text), public.record_job_workflow_event(bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_availability_request(bigint,jsonb,boolean,uuid),
  public.create_order(bigint,jsonb,text,date,text,boolean), public.confirm_order(bigint,bigint,date,date),
  public.close_order(bigint,text), public.record_job_workflow_event(bigint,text) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
