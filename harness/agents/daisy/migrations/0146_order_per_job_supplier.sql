-- 0146 — one order per job and supplier; an order row copies one selected candidate (2026-10-16)
--
-- (Bhoumik 2026-10-16) "One order maps to one job only. So an order just
-- converts selected candidate to order row. 1-1 mapping between candidate and
-- order item row. The status, avl qty, unit price are copied from candidate.
-- However post order, user and Chris can add new rows in order or update
-- status, price, qty or delete rows. ... order can also have note from
-- supplier, note for supplier, note for customer." Decided with him the same
-- day: one open order per job and supplier (more lines go onto it); Chris
-- ticks the lines to order; the supplier's order page links to their AR for
-- the job; suppliers keep confirm / date / Ready and row status, and add their
-- own reply note on the header and each row. p_customer_confirmed and the
-- per-supplier advisory lock are removed (the job row lock serialises orders).
-- * orders.job_request_id (NOT NULL, ON DELETE CASCADE), backfilled from the
--   allocations (every live order covers exactly one job). At most one open
--   order per job and supplier (orders_one_open_per_job_supplier).
-- * orders.note_from_supplier and order_items.note_from_supplier (the
--   supplier's reply). Existing notes are kept as they are.
-- * order_items.candidate_id is UNIQUE: a candidate is on at most one row.
--   Rows added by hand have no candidate.
-- * order_item_job_request_items is dropped (backed up as
--   order_item_job_request_items_pre_0146) with the remaining-demand checks.
-- * create_order(job, supplier, line ids, method, notes) copies each line's
--   selected candidate (it must be that supplier's and not on an order yet):
--   name, size, price, status in the line vocabulary, the quantity the job line
--   shows available (else its Qty), LPS's ask, the supplier's reply and the
--   effective customer note. create_direct_order is dropped.
-- * update_partner_order also takes note_from_supplier; update_partner_order_item
--   takes p_note_from_supplier (NULL keeps, '' clears).
-- * close_order: when a job's last open order closes, the job closes Won if
--   any of its orders was won, else Lost.
-- * close_orphaned_availability_on_job_delete deletes the job's orders by
--   orders.job_request_id.
-- Rollback: re-create the allocation table from the backup, drop the new
-- columns, index and constraint, drop the new create_order and
-- update_partner_order_item, and EXECUTE each definition saved in
-- functions_pre_0146.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '30s';

-- The replaced and dropped functions, exactly as they were.
CREATE TABLE public.functions_pre_0146 AS
  SELECT p.oid::regprocedure::text AS signature, pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('create_order', 'create_direct_order',
      'update_partner_order', 'update_partner_order_item', 'close_order', 'close_orphaned_availability_on_job_delete');
ALTER TABLE public.functions_pre_0146 ADD PRIMARY KEY (signature);
ALTER TABLE public.functions_pre_0146 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.functions_pre_0146 FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.functions_pre_0146 IS 'Function definitions 0146 replaced or dropped, for rollback.';

-- Backup of the allocations.
CREATE TABLE public.order_item_job_request_items_pre_0146 AS
  TABLE public.order_item_job_request_items;
ALTER TABLE public.order_item_job_request_items_pre_0146 ADD PRIMARY KEY (order_item_id, job_request_item_id);
ALTER TABLE public.order_item_job_request_items_pre_0146 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_item_job_request_items_pre_0146 FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.order_item_job_request_items_pre_0146 IS
  'Order line → job line allocations before 0146 made each order belong to one job.';

-- Each order belongs to one job.
ALTER TABLE public.orders ADD COLUMN job_request_id bigint
  REFERENCES public.job_requests(id) ON DELETE CASCADE;
UPDATE public.orders o SET job_request_id = x.job_request_id
  FROM (SELECT oi.order_id, min(ji.job_request_id) AS job_request_id, count(DISTINCT ji.job_request_id) AS jobs
          FROM public.order_items oi
          JOIN public.order_item_job_request_items a ON a.order_item_id = oi.id
          JOIN public.job_request_items ji ON ji.id = a.job_request_item_id
          GROUP BY oi.order_id) x
  WHERE x.order_id = o.id AND x.jobs = 1;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.orders WHERE job_request_id IS NULL) THEN
    RAISE EXCEPTION '0146: an order has no single job';
  END IF;
END $$;
ALTER TABLE public.orders ALTER COLUMN job_request_id SET NOT NULL;
CREATE INDEX orders_job_request_idx ON public.orders(job_request_id);
CREATE UNIQUE INDEX orders_one_open_per_job_supplier ON public.orders(job_request_id, supplier_id)
  WHERE is_active AND status IN ('new', 'processing', 'order_ready');

-- The supplier's reply, on the header and each row.
ALTER TABLE public.orders ADD COLUMN note_from_supplier text;
ALTER TABLE public.order_items ADD COLUMN note_from_supplier text;

-- One row per candidate.
ALTER TABLE public.order_items ADD CONSTRAINT order_items_candidate_id_key UNIQUE (candidate_id);

DROP FUNCTION public.create_order(bigint, jsonb, text, date, text, boolean, text);
DROP FUNCTION public.create_direct_order(bigint, jsonb, text, date, text, boolean, text);
DROP FUNCTION public.update_partner_order_item(bigint, bigint, bigint, text);
DROP TABLE public.order_item_job_request_items;

CREATE FUNCTION public.create_order(p_job_request_id bigint, p_supplier_id bigint, p_job_request_item_ids bigint[],
    p_fulfillment_method text DEFAULT NULL, p_note_for_supplier text DEFAULT NULL, p_note_for_customer text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE job public.job_requests; line public.job_request_items; c public.candidates;
  v_order bigint; v_item bigint; taken bigint; qty numeric;
BEGIN
  IF p_job_request_item_ids IS NULL OR cardinality(p_job_request_item_ids) = 0 THEN
    RAISE EXCEPTION 'Choose at least one job line to order';
  END IF;
  IF p_fulfillment_method IS NOT NULL AND p_fulfillment_method NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'Choose pickup or delivery';
  END IF;
  -- The job row lock serialises orders for the job.
  SELECT * INTO job FROM public.job_requests WHERE id = p_job_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job request not found'; END IF;
  IF NOT job.is_active OR job.status IN ('closed_won', 'closed_lost', 'archived') THEN
    RAISE EXCEPTION 'This job request is closed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND is_active) THEN
    RAISE EXCEPTION 'Active supplier required';
  END IF;
  -- One open order per job and supplier: more lines go onto it.
  SELECT id INTO v_order FROM public.orders
    WHERE job_request_id = job.id AND supplier_id = p_supplier_id AND is_active
      AND status IN ('new', 'processing', 'order_ready')
    FOR UPDATE;
  IF v_order IS NULL THEN
    INSERT INTO public.orders(job_request_id, supplier_id, fulfillment_method, note_for_supplier, note_for_customer)
      VALUES (job.id, p_supplier_id, p_fulfillment_method,
        nullif(btrim(p_note_for_supplier), ''), nullif(btrim(p_note_for_customer), ''))
      RETURNING id INTO v_order;
  END IF;
  FOREACH v_item IN ARRAY (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(p_job_request_item_ids) x) LOOP
    SELECT * INTO line FROM public.job_request_items
      WHERE id = v_item AND job_request_id = job.id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Job line % is not an active line of JR-%', v_item, job.id; END IF;
    SELECT * INTO c FROM public.candidates WHERE id = line.selected_candidate_id FOR UPDATE;
    IF c.supplier_id <> p_supplier_id THEN
      RAISE EXCEPTION '% is selected from another supplier', line.name;
    END IF;
    SELECT oi.order_id INTO taken FROM public.order_items oi WHERE oi.candidate_id = c.id;
    IF FOUND THEN
      RAISE EXCEPTION '% is already on order O-%', coalesce(c.description, c.name), taken;
    END IF;
    -- The quantity the job line shows available, else its Qty.
    qty := coalesce(nullif(least(c.available_quantity, line.demanded_quantity), 0), line.demanded_quantity);
    IF qty IS NULL THEN RAISE EXCEPTION 'Set a quantity for % before ordering', line.name; END IF;
    INSERT INTO public.order_items(order_id, candidate_id, name, size, quantity, unit_price, status,
        note_for_supplier, note_from_supplier, note_for_customer)
      VALUES (v_order, c.id, c.name, coalesce(c.size, line.size), qty, c.unit_price,
        CASE WHEN c.status IS NULL THEN 'pending' WHEN c.status = 'can_order' THEN 'need_to_order' ELSE c.status END,
        nullif(btrim(c.note_for_supplier), ''), nullif(btrim(c.note_from_supplier), ''),
        CASE WHEN c.note_for_customer IS NOT NULL THEN nullif(btrim(c.note_for_customer), '')
          ELSE nullif(btrim(c.note_from_supplier), '') END);
  END LOOP;
  UPDATE public.job_requests SET status = 'committed' WHERE id = job.id AND status IN ('quoted', 'availability');
  RETURN v_order;
END $function$;

CREATE OR REPLACE FUNCTION public.update_partner_order(p_order_id bigint, p_supplier_id bigint, p_patch jsonb)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE current_order public.orders; next_status text; next_method text; next_date date; date_text text;
  next_note text; next_reply text;
BEGIN
  IF jsonb_typeof(p_patch) IS DISTINCT FROM 'object' OR p_patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'Order update is required'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_patch) key
    WHERE key NOT IN ('status', 'fulfillment_method', 'fulfillment_date', 'note_for_supplier', 'note_from_supplier')) THEN
    RAISE EXCEPTION 'Unsupported order update'; END IF;
  -- Job before order, as create_order and close_order lock.
  PERFORM 1 FROM public.job_requests j JOIN public.orders o ON o.job_request_id = j.id
    WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id FOR UPDATE OF j;
  SELECT o.* INTO current_order FROM public.orders o JOIN public.suppliers s ON s.id = o.supplier_id
    WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id AND o.is_active AND s.is_active FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is unavailable'; END IF;
  IF current_order.status NOT IN ('new', 'processing', 'order_ready') OR NOT EXISTS (
    SELECT 1 FROM public.job_requests j WHERE j.id = current_order.job_request_id AND j.is_active
      AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')) THEN
    RAISE EXCEPTION 'Closed orders cannot be changed'; END IF;
  next_status := current_order.status;
  IF p_patch ? 'status' THEN
    next_status := p_patch->>'status';
    IF next_status IS NULL OR NOT (
      (current_order.status = 'new' AND next_status = 'processing') OR
      (current_order.status = 'processing' AND next_status = 'order_ready')
    ) THEN RAISE EXCEPTION 'Orders move from New to Processing to Order Ready'; END IF;
  END IF;
  next_method := CASE WHEN p_patch ? 'fulfillment_method' THEN p_patch->>'fulfillment_method' ELSE current_order.fulfillment_method END;
  IF next_method IS NOT NULL AND next_method NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'Choose pickup or delivery'; END IF;
  next_date := current_order.fulfillment_date;
  IF p_patch ? 'fulfillment_date' THEN
    date_text := p_patch->>'fulfillment_date';
    IF date_text IS NOT NULL AND date_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RAISE EXCEPTION 'Fulfillment date must be a valid date (YYYY-MM-DD)'; END IF;
    next_date := date_text::date;
    IF next_date IS NOT NULL AND to_char(next_date, 'YYYY-MM-DD') <> date_text THEN
      RAISE EXCEPTION 'Fulfillment date must be a valid date (YYYY-MM-DD)'; END IF;
  END IF;
  IF next_status IN ('processing', 'order_ready') AND next_date IS NULL THEN
    RAISE EXCEPTION 'Choose a fulfillment date before confirming the order'; END IF;
  next_note := current_order.note_for_supplier;
  IF p_patch ? 'note_for_supplier' THEN
    IF jsonb_typeof(p_patch->'note_for_supplier') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'Supplier note must be text'; END IF;
    IF length(p_patch->>'note_for_supplier') > 10000 THEN
      RAISE EXCEPTION 'Supplier note must be 10000 characters or fewer'; END IF;
    next_note := nullif(btrim(p_patch->>'note_for_supplier'), '');
  END IF;
  next_reply := current_order.note_from_supplier;
  IF p_patch ? 'note_from_supplier' THEN
    IF jsonb_typeof(p_patch->'note_from_supplier') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'Note from supplier must be text'; END IF;
    IF length(p_patch->>'note_from_supplier') > 10000 THEN
      RAISE EXCEPTION 'Note from supplier must be 10000 characters or fewer'; END IF;
    next_reply := nullif(btrim(p_patch->>'note_from_supplier'), '');
  END IF;
  UPDATE public.orders SET status = next_status, fulfillment_method = next_method, fulfillment_date = next_date,
    note_for_supplier = next_note, note_from_supplier = next_reply,
    confirmation_date = CASE WHEN current_order.status = 'new' AND next_status = 'processing'
      THEN coalesce(current_order.confirmation_date, CURRENT_DATE) ELSE confirmation_date END
    WHERE id = p_order_id;
  RETURN p_order_id;
END $function$;

CREATE FUNCTION public.update_partner_order_item(p_order_id bigint, p_supplier_id bigint, p_order_item_id bigint,
    p_status text, p_note_from_supplier text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF p_status = 'diff_size_qty_sub' THEN p_status := 'diff_size_sub'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('pending', 'available', 'partial_qty', 'unavailable', 'diff_size_sub', 'need_to_order', 'arriving_soon') THEN
    RAISE EXCEPTION 'Choose a valid plant status';
  END IF;
  IF length(p_note_from_supplier) > 10000 THEN
    RAISE EXCEPTION 'Note from supplier must be 10000 characters or fewer';
  END IF;
  PERFORM 1 FROM public.orders o JOIN public.suppliers s ON s.id = o.supplier_id
    WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id AND o.is_active AND s.is_active
      AND o.status NOT IN ('closed_won', 'closed_lost') FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is unavailable'; END IF;
  -- NULL keeps the supplier's note; '' clears it.
  UPDATE public.order_items SET status = p_status,
    note_from_supplier = CASE WHEN p_note_from_supplier IS NULL THEN note_from_supplier
      ELSE nullif(btrim(p_note_from_supplier), '') END
    WHERE id = p_order_item_id AND order_id = p_order_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order line is unavailable'; END IF;
  RETURN p_order_item_id;
END $function$;

CREATE OR REPLACE FUNCTION public.close_order(p_order_id bigint, p_status text)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE job_id bigint;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('closed_won', 'closed_lost') THEN RAISE EXCEPTION 'Choose Won or Lost'; END IF;
  SELECT o.job_request_id INTO job_id FROM public.orders o WHERE o.id = p_order_id;
  PERFORM 1 FROM public.job_requests WHERE id = job_id FOR UPDATE;
  UPDATE public.orders SET status = p_status WHERE id = p_order_id AND is_active
    AND (status IN ('new', 'processing', 'order_ready') OR status = p_status);
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is unavailable or already closed with a different outcome'; END IF;
  -- The job closes with its last open order: Won if any of its orders was won.
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE job_request_id = job_id AND is_active
      AND status IN ('new', 'processing', 'order_ready')) THEN
    UPDATE public.job_requests SET status = CASE WHEN EXISTS (SELECT 1 FROM public.orders
        WHERE job_request_id = job_id AND is_active AND status = 'closed_won') THEN 'closed_won' ELSE 'closed_lost' END
      WHERE id = job_id AND is_active AND status NOT IN ('closed_won', 'closed_lost', 'archived');
  END IF;
  RETURN p_order_id;
END $function$;

CREATE OR REPLACE FUNCTION public.close_orphaned_availability_on_job_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  ar_ids bigint[] := '{}'; order_ids bigint[] := '{}';
  ar_count bigint := 0; ar_items bigint := 0; order_count bigint := 0; order_items_count bigint := 0;
  item_count bigint; history_count bigint; thread_count bigint; row_id bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('deleted-job:jr-' || OLD.id, 0));
  FOR row_id IN SELECT id FROM public.orders WHERE job_request_id=OLD.id ORDER BY id FOR UPDATE LOOP
    order_ids := array_append(order_ids,row_id);
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
  DELETE FROM public.job_request_items WHERE job_request_id=OLD.id;
  PERFORM set_config('lps.ar_delete', 'on', true);
  DELETE FROM public.availability_requests WHERE id=ANY(ar_ids);
  GET DIAGNOSTICS ar_count=ROW_COUNT;
  PERFORM set_config('lps.ar_delete', '', true);
  INSERT INTO public.deleted_job_threads(agent,thread_id,job_request_id,deleted_counts)
    VALUES ('rosie','jr-'||OLD.id,OLD.id,jsonb_build_object('items',item_count,'changelog',history_count,
      'availabilityRequests',ar_count,'availabilityRequestItems',ar_items,'orders',order_count,
      'orderItems',order_items_count,'threads',thread_count,'answers',0));
  RETURN OLD;
END $function$;

REVOKE ALL ON FUNCTION public.create_order(bigint, bigint, bigint[], text, text, text),
  public.update_partner_order_item(bigint, bigint, bigint, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(bigint, bigint, bigint[], text, text, text),
  public.update_partner_order_item(bigint, bigint, bigint, text, text) TO service_role;

COMMIT;
