-- 0121 — a candidate is one fixed plant and size; supplier substitutions point
-- at other candidates; Partial Qty is its own answer; job line status is
-- computed from the selected candidate.
--
-- * `partial_qty` (Partial Qty): has the plant, fewer than demanded. Allowed on
--   candidates, job lines and order lines.
-- * Suppliers no longer rewrite a candidate's size. Diff Sz/Sub must carry a
--   substitute: `offered_candidate_id` (a tag: another active candidate of the
--   same supplier on the same job line) and/or a typed offer
--   (`offer_description`, `offer_unit_price`, `offer_quantity`). Unavailable
--   with a recommended substitute becomes Diff Sz/Sub. The asked candidate is
--   then unavailable at 0/0.
-- * On submission an offered candidate becomes Available (Partial Qty when the
--   offered quantity is short) with the offer's price, quantity and note, and
--   joins the request without reopening it. Typed offers wait for Rosie, who
--   creates the candidate and calls `link_candidate_offer`.
-- * Job lines: the original candidate's answer maps as before, and an answer
--   with a substitute reads Diff Sz/Sub (Chris, JR-90) while the asked
--   candidate itself shows Unavailable; any other selected candidate reads
--   Diff Sz/Sub unless it is unanswered (Pending) or unavailable.
-- * Legacy `diff_size_qty_sub` answers (no offer; the supplier rewrote the
--   candidate) keep their old meaning and are not backfilled.
BEGIN;

-- 1. Statuses ----------------------------------------------------------------
ALTER TABLE public.candidates DROP CONSTRAINT candidates_status_check;
ALTER TABLE public.candidates ADD CONSTRAINT candidates_status_check CHECK (status IS NULL OR status IN
  ('available', 'partial_qty', 'can_order', 'diff_size_qty_sub', 'arriving_soon', 'unavailable'));
ALTER TABLE public.job_request_items DROP CONSTRAINT job_request_items_status_check;
ALTER TABLE public.job_request_items ADD CONSTRAINT job_request_items_status_check CHECK (status IN
  ('available', 'partial_qty', 'unavailable', 'alternative_proposed', 'need_to_order', 'arriving_soon', 'pending'));
ALTER TABLE public.order_items DROP CONSTRAINT order_items_status_check;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_status_check CHECK (status IN
  ('available', 'partial_qty', 'unavailable', 'diff_size_qty_sub', 'need_to_order', 'arriving_soon', 'pending'));

-- 2. Offers ------------------------------------------------------------------
ALTER TABLE public.candidates
  ADD COLUMN offered_candidate_id bigint REFERENCES public.candidates(id) ON DELETE SET NULL,
  ADD COLUMN offer_description text,
  ADD COLUMN offer_unit_price numeric CHECK (offer_unit_price IS NULL OR (offer_unit_price >= 0 AND offer_unit_price < 'Infinity')),
  ADD COLUMN offer_quantity numeric CHECK (offer_quantity IS NULL OR (offer_quantity >= 0 AND offer_quantity < 'Infinity')),
  ADD CONSTRAINT candidates_offer_not_self CHECK (offered_candidate_id IS DISTINCT FROM id);
CREATE INDEX candidates_offered_candidate_idx ON public.candidates (offered_candidate_id) WHERE offered_candidate_id IS NOT NULL;

COMMENT ON COLUMN public.candidates.status IS
  'Supplier answer: available, partial_qty (fewer than demanded), can_order, arriving_soon, unavailable, diff_size_qty_sub (unavailable with a substitute offer; legacy rows without an offer carry a supplier-rewritten size/price), NULL = not answered.';
COMMENT ON COLUMN public.candidates.offered_candidate_id IS
  'Substitute the supplier picked: another active candidate of the same supplier on the same job line. Made Available on submission.';
COMMENT ON COLUMN public.candidates.offer_description IS
  'Substitute the supplier typed (plant and size) when no candidate tag fits. Rosie turns it into a candidate (link_candidate_offer).';
COMMENT ON COLUMN public.candidates.offer_unit_price IS 'Supplier price for the offered substitute.';
COMMENT ON COLUMN public.candidates.offer_quantity IS 'Quantity of the offered substitute the supplier can supply.';
COMMENT ON COLUMN public.job_request_items.status IS
  'Computed from the selected candidate: the original request''s answer (partial_qty = fewer than demanded; an answer with a substitute reads alternative_proposed), or alternative_proposed (Diff Sz/Sub) for any other selected candidate unless it is pending or unavailable. Editable by LPS.';

-- 3. Internal writes that must not reopen or re-process a request -------------
-- Applying an offer moves the offered candidate onto the request and sets its
-- answer from inside a submission; neither is a new ask or a supplier edit.
CREATE OR REPLACE FUNCTION public.availability_request_reopen_on_new_line() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.availability_request_id IS NULL OR (TG_OP = 'UPDATE'
    AND NEW.availability_request_id IS NOT DISTINCT FROM OLD.availability_request_id)
    OR current_setting('lps.applying_offer', true) = 'on' THEN
    RETURN NULL;
  END IF;
  UPDATE public.availability_requests SET status = 'new'
    WHERE id = NEW.availability_request_id AND is_active AND status IN ('processing', 'submitted');
  RETURN NULL;
END $function$;

CREATE OR REPLACE FUNCTION public.process_availability_answer() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  -- Shared note edits may be LPS sourcing instructions, so they do not start
  -- supplier processing. The answer RPC explicitly advances note-only replies.
  IF current_setting('lps.applying_offer', true) = 'on' THEN RETURN NULL; END IF;
  IF ROW(NEW.status, NEW.available_quantity, NEW.unit_price)
    IS DISTINCT FROM ROW(OLD.status, OLD.available_quantity, OLD.unit_price) THEN
    UPDATE public.availability_requests SET status = 'processing'
    WHERE id = NEW.availability_request_id AND is_active AND status NOT IN ('closed', 'draft');
  END IF;
  RETURN NULL;
END $function$;

-- 4. Answers -----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.answer_availability_request(p_request_id bigint, p_supplier_id bigint,
  p_item_id bigint DEFAULT NULL::bigint, p_changes jsonb DEFAULT NULL::jsonb, p_submit boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests; cur public.candidates; k text; next_status text;
  next_offer bigint; next_description text; has_offer boolean;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE id = p_request_id AND supplier_id = p_supplier_id AND is_active AND status NOT IN ('closed', 'draft') FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = ar.supplier_id AND is_active) THEN
    RAISE EXCEPTION 'This request is closed, deleted or unavailable';
  END IF;
  IF p_submit THEN
    UPDATE public.availability_requests SET status = 'submitted', submitted_at = now() WHERE id = ar.id;
  ELSE
    IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb THEN
      RAISE EXCEPTION 'Changes are required';
    END IF;
    FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
      IF k NOT IN ('status', 'available_quantity', 'unit_price', 'note_from_supplier',
          'offered_candidate_id', 'offer_description', 'offer_unit_price', 'offer_quantity')
        OR jsonb_typeof(p_changes->k) <> 'string' THEN
        RAISE EXCEPTION 'Invalid answer field';
      END IF;
    END LOOP;
    FOREACH k IN ARRAY ARRAY['available_quantity', 'unit_price', 'offer_unit_price', 'offer_quantity'] LOOP
      IF p_changes ? k AND nullif(trim(p_changes->>k), '')::numeric::text IN ('NaN', 'Infinity', '-Infinity') THEN
        RAISE EXCEPTION 'Answer numbers must be finite';
      END IF;
    END LOOP;
    SELECT * INTO cur FROM public.candidates
      WHERE id = p_item_id AND availability_request_id = ar.id AND is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Line not found'; END IF;
    next_status := CASE WHEN p_changes ? 'status' THEN nullif(trim(p_changes->>'status'), '') ELSE cur.status END;
    next_offer := CASE WHEN p_changes ? 'offered_candidate_id'
      THEN nullif(trim(p_changes->>'offered_candidate_id'), '')::bigint ELSE cur.offered_candidate_id END;
    next_description := CASE WHEN p_changes ? 'offer_description'
      THEN nullif(btrim(p_changes->>'offer_description'), '') ELSE cur.offer_description END;
    has_offer := next_offer IS NOT NULL OR next_description IS NOT NULL;
    -- Diff Sz/Sub needs a substitute (a tag or a typed one); Unavailable with a
    -- recommended substitute becomes Diff Sz/Sub. A legacy Diff Sz/Sub answer
    -- without an offer is kept as saved while neither is being changed.
    IF next_status = 'unavailable' AND has_offer THEN
      next_status := 'diff_size_qty_sub';
    ELSIF next_status = 'diff_size_qty_sub' AND NOT has_offer AND (p_changes ? 'status'
        OR p_changes ? 'offered_candidate_id' OR p_changes ? 'offer_description') THEN
      RAISE EXCEPTION 'Pick or describe the substitute';
    END IF;
    IF next_status IS DISTINCT FROM 'diff_size_qty_sub' THEN next_offer := NULL; next_description := NULL; END IF;
    IF next_offer IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.candidates o
        WHERE o.id = next_offer AND o.id <> cur.id AND o.is_active AND o.supplier_id = cur.supplier_id
          AND o.job_request_item_id IS NOT DISTINCT FROM cur.job_request_item_id
          AND cur.job_request_item_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Offered candidate must be another candidate of this line and supplier';
    END IF;
    UPDATE public.candidates SET
      status = next_status,
      available_quantity = CASE WHEN next_status = 'unavailable' OR (next_status = 'diff_size_qty_sub' AND has_offer) THEN 0
        WHEN p_changes ? 'available_quantity' THEN nullif(trim(p_changes->>'available_quantity'), '')::numeric
        ELSE available_quantity END,
      unit_price = CASE WHEN next_status = 'unavailable' OR (next_status = 'diff_size_qty_sub' AND has_offer) THEN 0
        WHEN p_changes ? 'unit_price' THEN nullif(trim(p_changes->>'unit_price'), '')::numeric
        ELSE unit_price END,
      note_from_supplier = CASE WHEN p_changes ? 'note_from_supplier'
        THEN nullif(trim(p_changes->>'note_from_supplier'), '') ELSE note_from_supplier END,
      offered_candidate_id = next_offer,
      offer_description = next_description,
      offer_unit_price = CASE WHEN NOT has_offer OR next_status <> 'diff_size_qty_sub' THEN NULL
        WHEN p_changes ? 'offer_unit_price' THEN nullif(trim(p_changes->>'offer_unit_price'), '')::numeric
        ELSE offer_unit_price END,
      offer_quantity = CASE WHEN NOT has_offer OR next_status <> 'diff_size_qty_sub' THEN NULL
        WHEN p_changes ? 'offer_quantity' THEN nullif(trim(p_changes->>'offer_quantity'), '')::numeric
        ELSE offer_quantity END,
      answered_at = now()
    WHERE id = p_item_id;
    UPDATE public.availability_requests SET status = 'processing' WHERE id = ar.id;
  END IF;
  RETURN ar.id;
END $function$;

-- 5. Applying an offer ---------------------------------------------------------
-- The offered candidate takes the supplier's offer as its own answer and joins
-- the request, without reopening it or marking it processing.
CREATE FUNCTION public.apply_candidate_offer(p_candidate_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE src public.candidates; offered public.candidates; qty numeric; demand numeric;
BEGIN
  SELECT * INTO src FROM public.candidates
    WHERE id = p_candidate_id AND is_active AND status = 'diff_size_qty_sub' AND offered_candidate_id IS NOT NULL;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO offered FROM public.candidates WHERE id = src.offered_candidate_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  demand := coalesce(offered.demanded_quantity, src.demanded_quantity);
  qty := coalesce(src.offer_quantity, demand);
  PERFORM set_config('lps.applying_offer', 'on', true);
  UPDATE public.candidates SET
    availability_request_id = src.availability_request_id,
    demanded_quantity = demand,
    status = CASE WHEN qty IS NOT NULL AND demand IS NOT NULL AND qty < demand THEN 'partial_qty' ELSE 'available' END,
    available_quantity = qty,
    unit_price = coalesce(src.offer_unit_price, offered.unit_price),
    note_from_supplier = src.note_from_supplier,
    note_for_customer = coalesce(nullif(btrim(src.note_from_supplier), ''), offered.note_for_customer),
    answered_at = now()
  WHERE id = offered.id;
  PERFORM set_config('lps.applying_offer', 'off', true);
END $function$;

-- Rosie links a typed offer to the candidate she created for it, then applies it
-- (and re-applies the line if that candidate is selected).
CREATE FUNCTION public.link_candidate_offer(p_candidate_id bigint, p_offered_candidate_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE src public.candidates; line bigint;
BEGIN
  SELECT * INTO src FROM public.candidates
    WHERE id = p_candidate_id AND is_active AND status = 'diff_size_qty_sub' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Substitute answer not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.candidates o WHERE o.id = p_offered_candidate_id AND o.id <> src.id
      AND o.is_active AND o.supplier_id = src.supplier_id AND o.job_request_item_id = src.job_request_item_id) THEN
    RAISE EXCEPTION 'Offered candidate must be another candidate of this line and supplier';
  END IF;
  UPDATE public.candidates SET offered_candidate_id = p_offered_candidate_id WHERE id = src.id;
  PERFORM public.apply_candidate_offer(src.id);
  SELECT ji.id INTO line FROM public.job_request_items ji JOIN public.job_requests j ON j.id = ji.job_request_id
    WHERE ji.selected_candidate_id = p_offered_candidate_id AND ji.is_active AND j.is_active
      AND j.status IN ('quoted', 'availability');
  IF line IS NOT NULL THEN PERFORM public.apply_candidate_to_job_item(line); END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.apply_submitted_candidates() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  -- Offers answered since the previous submission make their tag Available first,
  -- so a selected offered candidate is re-applied below.
  PERFORM public.apply_candidate_offer(c.id) FROM public.candidates c
    WHERE c.availability_request_id = NEW.id AND c.is_active AND c.offered_candidate_id IS NOT NULL
      AND c.answered_at > coalesce(OLD.submitted_at, '-infinity'::timestamptz);
  -- Only candidates answered since the previous submission. A supplier reply
  -- becomes the candidate's customer note, then selecting open lines follow.
  UPDATE public.candidates SET note_for_customer = btrim(note_from_supplier)
    WHERE availability_request_id = NEW.id AND is_active
      AND answered_at > coalesce(OLD.submitted_at, '-infinity'::timestamptz)
      AND nullif(btrim(note_from_supplier), '') IS NOT NULL;
  PERFORM public.apply_candidate_to_job_item(ji.id)
    FROM public.job_request_items ji
    JOIN public.candidates c ON c.id = ji.selected_candidate_id
    JOIN public.job_requests j ON j.id = ji.job_request_id
    WHERE c.availability_request_id = NEW.id AND c.is_active AND ji.is_active
      AND j.is_active AND j.status IN ('quoted', 'availability')
      AND c.answered_at > coalesce(OLD.submitted_at, '-infinity'::timestamptz);
  RETURN NULL;
END $function$;

-- 6. Job line status ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_candidate_to_job_item(p_job_request_item_id bigint)
RETURNS void LANGUAGE sql SET search_path TO 'public' AS $function$
  UPDATE public.job_request_items ji SET
    size = c.size,
    unit_price = nullif(c.unit_price, 0),
    available_quantity = least(c.available_quantity, coalesce(c.demanded_quantity, ji.demanded_quantity)),
    status = CASE
      WHEN c.status IS NULL THEN 'pending'
      WHEN c.status = 'unavailable' THEN 'unavailable'
      -- A substitute on offer (or any other candidate chosen) reads Diff Sz/Sub.
      WHEN NOT c.is_original OR c.status = 'diff_size_qty_sub' THEN 'alternative_proposed'
      WHEN c.status = 'can_order' THEN 'need_to_order'
      ELSE c.status END,
    note_for_customer = nullif(btrim(c.note_for_customer), '')
  FROM public.candidates c
  WHERE ji.id = p_job_request_item_id AND c.id = ji.selected_candidate_id;
$function$;

-- 7. Orders ------------------------------------------------------------------
-- An answer with a substitute offer is not stock of the asked plant; order the
-- offered candidate instead. Otherwise create_order is unchanged.
DO $do$
DECLARE def text;
BEGIN
  def := pg_get_functiondef('public.create_order(bigint, jsonb, text, date, text, boolean, text)'::regprocedure);
  IF position($$IF source.status IS NULL OR source.status = 'unavailable' THEN$$ IN def) = 0 THEN
    RAISE EXCEPTION 'create_order changed since 0121 was written';
  END IF;
  EXECUTE replace(def, $$IF source.status IS NULL OR source.status = 'unavailable' THEN$$,
    $$IF source.status IS NULL OR source.status = 'unavailable' OR (source.status = 'diff_size_qty_sub'
      AND (source.offered_candidate_id IS NOT NULL OR source.offer_description IS NOT NULL)) THEN$$);
END $do$;

CREATE OR REPLACE FUNCTION public.update_partner_order_item(p_order_id bigint, p_supplier_id bigint, p_order_item_id bigint, p_status text)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF p_status NOT IN ('pending', 'available', 'partial_qty', 'unavailable', 'diff_size_qty_sub', 'need_to_order', 'arriving_soon') THEN
    RAISE EXCEPTION 'Choose a valid plant status';
  END IF;
  PERFORM 1 FROM public.orders o JOIN public.suppliers s ON s.id = o.supplier_id
    WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id AND o.is_active AND s.is_active
      AND o.status NOT IN ('closed_won', 'closed_lost') FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is unavailable'; END IF;
  UPDATE public.order_items SET status = p_status
    WHERE id = p_order_item_id AND order_id = p_order_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order line is unavailable'; END IF;
  RETURN p_order_item_id;
END $function$;

REVOKE ALL ON FUNCTION public.apply_candidate_offer(bigint), public.link_candidate_offer(bigint, bigint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_candidate_offer(bigint), public.link_candidate_offer(bigint, bigint)
  TO service_role;

COMMIT;
