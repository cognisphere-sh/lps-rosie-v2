-- 0130 — job lines read from their selected candidate (2026-10-14)
--
-- (Bhoumik 2026-10-13/14) A job line owned two copies of every answer: its own
-- price/status/quantity/customer note, and the selected candidate's. Copying
-- them back and forth (0119 select, 0126 sync, 0129 promotion) kept drifting,
-- promoted substitutes to "original" behind LPS's back and reset published
-- ARs to New on edits nobody meant as a re-ask. Now:
--
-- * A line owns only the customer's ask: name, requested size, demand,
--   internal note. Everything else is read from its selected candidate through
--   the security-invoker view `job_lines`; LPS edits go to that candidate via
--   `update_job_line`. The line's unit_price / total / status /
--   available_quantity / note_for_customer stay physically (deprecated, never
--   read or written) until 0131 drops them; a backup is kept in
--   `job_request_items_pre_0130`.
-- * Every line has a default candidate: the APS (supplier 1) `is_original`
--   one, created by the database when the line is inserted. It is never
--   hidden, deactivated, deleted or demoted while the line exists, and is
--   what the selection falls back to (unselect, deactivation).
-- * Candidate status is the supplier's answer. A substitute answer stores the
--   asked row Unavailable (quantity 0) offering a `diff_size_sub` row; supplier
--   price / quantity / note edits on that row go to the substitute.
--   `diff_size_qty_sub` is renamed `diff_size_sub` (candidates and orders);
--   `alternative_proposed` is retired (job lines read `diff_size_sub`).
-- * Status sets quantity on every writer: available = demand, unavailable = 0,
--   a substitute = demand unless given.
-- * Nothing returns an AR to New automatically any more; reopening is
--   explicit (`reopen_availability_request`), and adding to a submitted,
--   processing or closed AR asks for it first. An LPS (admin) answer edit
--   keeps the AR's status.
-- * The candidate customer note is an LPS override: NULL follows the
--   supplier's reply, '' is deliberately blank. Submission no longer copies
--   it; it switches lines to the offered substitute and hides this AR's other
--   alternatives instead.
-- * 0129's 27 promotions are reverted, and the requested size of lines whose
--   size was overwritten by selection is restored from the changelog (lines
--   1228, 1253 and 1254 are left for review, as is candidate 1321, line
--   1182's second demoted original). Candidate 1381 (line 1199) loses the
--   offer it kept after LPS marked it Available.
--
-- Not covered: candidates have no changelog, so a line's price/status/note
-- history stops in the job History panel until one is added.
BEGIN;
SET LOCAL lock_timeout = '250ms';
SET LOCAL statement_timeout = '5s';
SET LOCAL app.actor = 'migration 0130';

-- 1. Backup of the line values this migration stops reading ----------------
CREATE TABLE public.job_request_items_pre_0130 AS
  SELECT id, unit_price, status, available_quantity, note_for_customer, total, selected_candidate_id
  FROM public.job_request_items;
ALTER TABLE public.job_request_items_pre_0130 ADD PRIMARY KEY (id);
ALTER TABLE public.job_request_items_pre_0130 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_request_items_pre_0130 FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.job_request_items_pre_0130 IS
  'Job line values as they were before 0130 moved them onto the selected candidate. Kept after 0131 drops the columns.';
-- The backfill rewrites candidates too (0129 revert, defaults, notes, statuses).
CREATE TABLE public.candidates_pre_0130 AS SELECT * FROM public.candidates;
ALTER TABLE public.candidates_pre_0130 ADD PRIMARY KEY (id);
ALTER TABLE public.candidates_pre_0130 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.candidates_pre_0130 FROM PUBLIC, anon, authenticated;
COMMENT ON TABLE public.candidates_pre_0130 IS
  'Candidates as they were before 0130 backfilled them. Drop once 0130 is verified.';

-- 2. Automation that must not run during the backfill (or ever again) --------
-- 0126/0129 line → candidate sync, including 0129's is_original promotion.
DROP TRIGGER job_request_items_candidate_sync ON public.job_request_items;
DROP FUNCTION public.sync_job_item_to_candidate();
-- pricing_fetched has no workflow transition; nothing writes line prices now.
DROP TRIGGER job_request_items_pricing_progress ON public.job_request_items;
DROP FUNCTION public.advance_job_on_item_pricing();
-- Automatic AR → New on any candidate change, and on a candidate joining.
DROP TRIGGER candidates_processing ON public.candidates;
DROP FUNCTION public.process_availability_answer();
DROP TRIGGER candidates_reopen ON public.candidates;
DROP FUNCTION public.availability_request_reopen_on_new_line();

-- LPS's own values may change on a closed AR (lps.lps_override, set only by
-- update_job_line and this migration); supplier and job still must match.
CREATE OR REPLACE FUNCTION public.guard_candidate_write() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests;
BEGIN
  IF NEW.availability_request_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO ar FROM public.availability_requests
    WHERE id = NEW.availability_request_id FOR UPDATE;
  IF NOT FOUND OR (ar.status = 'closed' AND current_setting('lps.lps_override', true) IS DISTINCT FROM 'on') THEN
    RAISE EXCEPTION 'This request is closed or unavailable';
  END IF;
  IF ar.supplier_id <> NEW.supplier_id THEN
    RAISE EXCEPTION 'Candidate supplier must match the request supplier';
  END IF;
  IF NEW.job_request_item_id IS NOT NULL AND ar.job_request_id IS DISTINCT FROM
    (SELECT job_request_id FROM public.job_request_items WHERE id = NEW.job_request_item_id) THEN
    RAISE EXCEPTION 'Candidate must be asked on its own job''s request';
  END IF;
  RETURN NEW;
END $function$;

SELECT set_config('lps.lps_override', 'on', true);

-- 3. diff_size_qty_sub → diff_size_sub ---------------------------------------
-- Askers that already offer a substitute (AR-55's five) take the new shape:
-- Unavailable, quantity 0, offering it.
ALTER TABLE public.candidates DROP CONSTRAINT candidates_status_check;
ALTER TABLE public.order_items DROP CONSTRAINT order_items_status_check;
UPDATE public.candidates SET status = 'unavailable', available_quantity = 0
  WHERE status = 'diff_size_qty_sub' AND offered_candidate_id IS NOT NULL;
UPDATE public.candidates SET status = 'diff_size_sub' WHERE status = 'diff_size_qty_sub';
UPDATE public.order_items SET status = 'diff_size_sub' WHERE status = 'diff_size_qty_sub';
ALTER TABLE public.candidates ADD CONSTRAINT candidates_status_check CHECK (status IS NULL OR status IN
  ('available', 'partial_qty', 'can_order', 'diff_size_sub', 'arriving_soon', 'unavailable'));
ALTER TABLE public.order_items ADD CONSTRAINT order_items_status_check CHECK (status IN
  ('available', 'partial_qty', 'unavailable', 'diff_size_sub', 'need_to_order', 'arriving_soon', 'pending'));
-- The line status column is deprecated; nothing validates or indexes it now.
ALTER TABLE public.job_request_items DROP CONSTRAINT job_request_items_status_check;
DROP INDEX public.job_request_items_status_idx;

-- 4. Revert 0129's promotions ----------------------------------------------
-- 0129 made a selected substitute the original and demoted the supplier's
-- old original to Unavailable offering it. The old original is the line's
-- requested plant again. Never-asked ones lose the fabricated answer; asked
-- ones keep Unavailable + the offer (it reads Diff Sz/Sub on their AR).
-- Line 1182 has two demoted originals: 1322 (asked) is restored, 1321 is
-- left as it is for review.
DO $$
DECLARE pairs bigint; restored bigint;
BEGIN
  CREATE TEMP TABLE promotions_0129 ON COMMIT DROP AS
    SELECT o.id AS old_id, p.id AS promoted_id, o.availability_request_id IS NULL AS never_asked
    FROM public.candidates o JOIN public.candidates p ON p.id = o.offered_candidate_id
    WHERE NOT o.is_original AND p.is_original AND o.is_active AND p.is_active
      AND o.status = 'unavailable' AND o.offer_description IS NULL
      AND o.supplier_id = p.supplier_id AND o.job_request_item_id = p.job_request_item_id
      AND ((o.note_from_supplier IS NULL AND o.answered_at IS NULL) OR o.availability_request_id IS NOT NULL);
  SELECT count(*) INTO pairs FROM promotions_0129;
  IF pairs <> 27 THEN RAISE EXCEPTION '0129 promotion pairs: expected 27, found %', pairs; END IF;
  DELETE FROM promotions_0129 WHERE old_id = 1321;
  UPDATE public.candidates SET is_original = false WHERE id IN (SELECT promoted_id FROM promotions_0129);
  UPDATE public.candidates c SET is_original = true,
      status = CASE WHEN p.never_asked THEN NULL ELSE c.status END,
      available_quantity = CASE WHEN p.never_asked THEN NULL ELSE c.available_quantity END,
      offered_candidate_id = CASE WHEN p.never_asked THEN NULL ELSE c.offered_candidate_id END,
      offer_unit_price = CASE WHEN p.never_asked THEN NULL ELSE c.offer_unit_price END,
      offer_quantity = CASE WHEN p.never_asked THEN NULL ELSE c.offer_quantity END
    FROM promotions_0129 p WHERE c.id = p.old_id;
  GET DIAGNOSTICS restored = ROW_COUNT;
  RAISE NOTICE '0130: reverted % of % 0129 promotions', restored, pairs;
END $$;

-- 5. Restore the requested size selection overwrote -------------------------
-- Lines showing a substitute whose size replaced the line's: the size the
-- first selection-made size change replaced (one logged in the same
-- transaction as a selected_candidate_id change). A line whose last size
-- change was LPS's own edit keeps it, as does one that had no size. 1228,
-- 1253 and 1254 need a human (the size does not match the original candidate).
DO $$
DECLARE restored bigint; kept text;
BEGIN
  CREATE TEMP TABLE size_restore_0130 ON COMMIT DROP AS
    WITH size_changes AS (
      SELECT l.id, l.item_id, l.changes->'size'->>'old' AS old_size,
        EXISTS (SELECT 1 FROM public.job_request_changelog s WHERE s.item_id = l.item_id
          AND s.created_at = l.created_at AND s.changes ? 'selected_candidate_id') AS by_selection
      FROM public.job_request_changelog l
      WHERE l.action = 'update' AND l.item_id IS NOT NULL AND l.changes ? 'size')
    SELECT item_id, (array_agg(old_size ORDER BY id) FILTER (WHERE by_selection))[1] AS old_size,
      (array_agg(by_selection ORDER BY id DESC))[1] AS last_by_selection
    FROM size_changes GROUP BY item_id;
  SELECT string_agg(ji.id::text, ', ' ORDER BY ji.id) INTO kept
    FROM public.job_request_items ji JOIN size_restore_0130 r ON r.item_id = ji.id
    JOIN public.candidates c ON c.id = ji.selected_candidate_id
    WHERE NOT c.is_original AND ji.size IS NOT DISTINCT FROM c.size
      AND (NOT r.last_by_selection OR r.old_size IS NULL);
  UPDATE public.job_request_items ji SET size = r.old_size
    FROM size_restore_0130 r, public.candidates c
    WHERE r.item_id = ji.id AND c.id = ji.selected_candidate_id AND NOT c.is_original
      AND ji.size IS NOT DISTINCT FROM c.size AND r.last_by_selection AND r.old_size IS NOT NULL
      AND r.old_size IS DISTINCT FROM ji.size
      AND ji.id NOT IN (1228, 1253, 1254);
  GET DIAGNOSTICS restored = ROW_COUNT;
  RAISE NOTICE '0130: restored the requested size of % lines; kept LPS''s size or no size on lines %', restored, kept;
END $$;

-- 6. Default candidates and selection backfill ------------------------------
ALTER TABLE public.job_request_items ADD COLUMN default_candidate_id bigint;

DO $$
DECLARE n bigint;
BEGIN
  -- The line's active APS original; with two, the one in the line's size, else the first.
  UPDATE public.job_request_items ji SET default_candidate_id = d.id
    FROM (SELECT DISTINCT ON (l.id) l.id AS line_id, c.id
          FROM public.job_request_items l
          JOIN public.candidates c ON c.job_request_item_id = l.id AND c.supplier_id = 1
            AND c.is_original AND c.is_active
          ORDER BY l.id, (c.size IS NOT DISTINCT FROM l.size) DESC, c.id) d
    WHERE ji.id = d.line_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '0130: % lines default to an existing APS original', n;

  -- Lines without one (active or not) get one from the line, priced as the line.
  WITH made AS (
    INSERT INTO public.candidates(supplier_id, is_original, job_request_item_id, name, size,
        demanded_quantity, description, unit_price)
      SELECT 1, true, id, name, size, demanded_quantity, btrim(concat_ws(' ', size, name)),
        coalesce(unit_price, 0)
      FROM public.job_request_items WHERE default_candidate_id IS NULL
      RETURNING id, job_request_item_id)
  UPDATE public.job_request_items ji SET default_candidate_id = made.id
    FROM made WHERE ji.id = made.job_request_item_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '0130: created % default candidates', n;

  -- Unselected lines select their default, which takes the line's own values
  -- (LPS's last word) — except a supplier answer on a published AR, which
  -- keeps its status and quantity. alternative_proposed had no answer behind
  -- it on an original: pending.
  WITH line AS (
    SELECT ji.default_candidate_id AS id, ji.unit_price, ji.status, ji.available_quantity, ji.note_for_customer,
      d.answered_at IS NOT NULL AND coalesce(ar.status <> 'draft', false) AS answered
    FROM public.job_request_items ji
    JOIN public.candidates d ON d.id = ji.default_candidate_id
    LEFT JOIN public.availability_requests ar ON ar.id = d.availability_request_id
    WHERE ji.selected_candidate_id IS NULL)
  UPDATE public.candidates c SET
      unit_price = coalesce(line.unit_price, c.unit_price),
      status = CASE WHEN line.answered THEN c.status ELSE CASE line.status
        WHEN 'pending' THEN NULL WHEN 'alternative_proposed' THEN NULL
        WHEN 'need_to_order' THEN 'can_order' ELSE line.status END END,
      available_quantity = CASE WHEN line.answered THEN c.available_quantity ELSE line.available_quantity END,
      -- The note the line showed: its own, else deliberately blank over a reply.
      note_for_customer = CASE WHEN nullif(btrim(line.note_for_customer), '') IS NOT NULL THEN line.note_for_customer
        WHEN nullif(btrim(c.note_from_supplier), '') IS NOT NULL THEN '' END
    FROM line WHERE c.id = line.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE public.job_request_items SET selected_candidate_id = default_candidate_id
    WHERE selected_candidate_id IS NULL;
  RAISE NOTICE '0130: % unselected lines now select their default', n;

  -- Only an Unavailable answer offers a substitute. LPS marked 1381 Available
  -- after its supplier offered 1382; 1382 keeps its answer on the AR.
  UPDATE public.candidates SET offered_candidate_id = NULL, offer_description = NULL,
      offer_unit_price = NULL, offer_quantity = NULL
    WHERE offered_candidate_id IS NOT NULL AND status IS DISTINCT FROM 'unavailable';
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '0130: cleared % offers left on answers that are not Unavailable', n;

  -- A selected answer that offers a substitute: the line shows the substitute.
  UPDATE public.job_request_items ji SET selected_candidate_id = s.id
    FROM public.candidates c, public.candidates s
    WHERE c.id = ji.selected_candidate_id AND c.status = 'unavailable' AND c.is_active
      AND s.id = c.offered_candidate_id AND s.is_active AND s.job_request_item_id = ji.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '0130: % lines switched to their offered substitute', n;

  -- Customer notes that are only a copy of the supplier reply follow it again.
  UPDATE public.candidates SET note_for_customer = NULL
    WHERE nullif(btrim(note_from_supplier), '') IS NOT NULL AND note_for_customer = btrim(note_from_supplier);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '0130: % customer-note copies now follow the supplier reply', n;

  -- Offered substitutes (not originals) answered Available/Partial are Diff Sz/Sub.
  UPDATE public.candidates s SET status = 'diff_size_sub'
    WHERE NOT s.is_original AND s.status IN ('available', 'partial_qty') AND EXISTS (
      SELECT 1 FROM public.candidates a WHERE a.offered_candidate_id = s.id AND a.is_active AND a.status = 'unavailable');
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE '0130: % offered substitutes now diff_size_sub', n;
END $$;

SELECT set_config('lps.lps_override', '', true);

-- 7. Constraints ------------------------------------------------------------
ALTER TABLE public.job_request_items
  ALTER COLUMN default_candidate_id SET NOT NULL,
  ALTER COLUMN selected_candidate_id SET NOT NULL,
  ADD CONSTRAINT job_request_items_default_candidate_id_key UNIQUE (default_candidate_id),
  ADD CONSTRAINT job_request_items_default_candidate_id_fkey FOREIGN KEY (default_candidate_id)
    REFERENCES public.candidates(id) ON DELETE RESTRICT,
  DROP CONSTRAINT job_request_items_selected_candidate_id_fkey,
  ADD CONSTRAINT job_request_items_selected_candidate_id_fkey FOREIGN KEY (selected_candidate_id)
    REFERENCES public.candidates(id) ON DELETE RESTRICT;
CREATE INDEX job_request_items_selected_candidate_idx ON public.job_request_items(selected_candidate_id);
-- A line's default is inserted (with the line's id) just before the line.
-- The name stays: the app uses it as a PostgREST embed hint.
ALTER TABLE public.candidates ALTER CONSTRAINT candidates_job_request_item_id_fkey DEFERRABLE INITIALLY DEFERRED;

-- 8. Default candidate: created with the line, protected while it exists ----
CREATE FUNCTION public.create_job_line_default() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  -- Price 0 = not found; Rosie prices, maps and describes it afterwards.
  INSERT INTO public.candidates(supplier_id, is_original, job_request_item_id, name, size,
      demanded_quantity, description, unit_price)
    VALUES (1, true, NEW.id, NEW.name, NEW.size, NEW.demanded_quantity,
      btrim(concat_ws(' ', NEW.size, NEW.name)), 0)
    RETURNING id INTO NEW.default_candidate_id;
  NEW.selected_candidate_id := coalesce(NEW.selected_candidate_id, NEW.default_candidate_id);
  RETURN NEW;
END $function$;
CREATE TRIGGER job_request_items_create_default BEFORE INSERT ON public.job_request_items
  FOR EACH ROW EXECUTE FUNCTION public.create_job_line_default();

-- Until the default is asked, it follows the line's ask; once asked, the AR
-- snapshot is the supplier's. An Available default keeps its full quantity.
CREATE FUNCTION public.sync_job_line_default() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  UPDATE public.candidates SET
    name = CASE WHEN NEW.name IS DISTINCT FROM OLD.name THEN NEW.name ELSE name END,
    size = CASE WHEN NEW.size IS DISTINCT FROM OLD.size THEN NEW.size ELSE size END,
    demanded_quantity = CASE WHEN NEW.demanded_quantity IS DISTINCT FROM OLD.demanded_quantity
      THEN NEW.demanded_quantity ELSE demanded_quantity END,
    available_quantity = CASE WHEN status = 'available' AND NEW.demanded_quantity IS DISTINCT FROM OLD.demanded_quantity
      THEN NEW.demanded_quantity ELSE available_quantity END
  WHERE id = NEW.default_candidate_id AND availability_request_id IS NULL;
  RETURN NULL;
END $function$;
CREATE TRIGGER job_request_items_sync_default AFTER UPDATE OF name, size, demanded_quantity ON public.job_request_items
  FOR EACH ROW WHEN (ROW(NEW.name, NEW.size, NEW.demanded_quantity) IS DISTINCT FROM ROW(OLD.name, OLD.size, OLD.demanded_quantity))
  EXECUTE FUNCTION public.sync_job_line_default();

-- Reads the live line table, so a deleted line's SET NULL and its candidates'
-- deletion pass (and returns OLD on DELETE).
CREATE FUNCTION public.protect_default_candidate() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.job_request_items WHERE default_candidate_id = OLD.id) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'The line''s default candidate can''t be deleted';
  END IF;
  IF NEW.hide_from_lps OR NOT NEW.is_active OR NOT NEW.is_original
    OR NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
    OR NEW.job_request_item_id IS DISTINCT FROM OLD.job_request_item_id THEN
    RAISE EXCEPTION 'The line''s default candidate stays its active, visible APS original';
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER candidates_protect_default
  BEFORE UPDATE OF hide_from_lps, is_active, is_original, supplier_id, job_request_item_id OR DELETE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.protect_default_candidate();

-- Any deactivation (delete_candidate, a retired typed substitute, a raw
-- update) returns the lines selecting it to their default.
CREATE FUNCTION public.reselect_default_on_deactivate() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  UPDATE public.job_request_items SET selected_candidate_id = default_candidate_id
    WHERE selected_candidate_id = NEW.id;
  RETURN NULL;
END $function$;
CREATE TRIGGER candidates_reselect_default AFTER UPDATE OF is_active ON public.candidates
  FOR EACH ROW WHEN (OLD.is_active AND NOT NEW.is_active)
  EXECUTE FUNCTION public.reselect_default_on_deactivate();

-- 9. Selection --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.select_candidate(p_job_request_item_id bigint, p_candidate_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  PERFORM 1 FROM public.job_request_items ji JOIN public.job_requests j ON j.id = ji.job_request_id
    WHERE ji.id = p_job_request_item_id AND ji.is_active AND j.is_active
      AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')
    FOR UPDATE OF ji;
  IF NOT FOUND THEN RAISE EXCEPTION 'Open job line not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.candidates
    WHERE id = p_candidate_id AND job_request_item_id = p_job_request_item_id AND is_active) THEN
    RAISE EXCEPTION 'Candidate not found for this line';
  END IF;
  IF EXISTS (SELECT 1 FROM public.candidates WHERE id = p_candidate_id AND hide_from_lps) THEN
    RAISE EXCEPTION 'Candidate is hidden';
  END IF;
  UPDATE public.job_request_items SET selected_candidate_id = p_candidate_id WHERE id = p_job_request_item_id;
END $function$;

CREATE OR REPLACE FUNCTION public.unselect_candidate(p_job_request_item_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  PERFORM 1 FROM public.job_request_items ji JOIN public.job_requests j ON j.id = ji.job_request_id
    WHERE ji.id = p_job_request_item_id AND ji.is_active AND j.is_active
      AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')
    FOR UPDATE OF ji;
  IF NOT FOUND THEN RAISE EXCEPTION 'Open job line not found'; END IF;
  UPDATE public.job_request_items SET selected_candidate_id = default_candidate_id
    WHERE id = p_job_request_item_id AND selected_candidate_id <> default_candidate_id;
END $function$;

CREATE OR REPLACE FUNCTION public.delete_candidate(p_candidate_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.job_request_items WHERE default_candidate_id = p_candidate_id) THEN
    RAISE EXCEPTION 'The line''s default candidate can''t be deleted';
  END IF;
  -- Lines selecting it fall back to their default (candidates_reselect_default).
  UPDATE public.candidates SET is_active = false WHERE id = p_candidate_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Candidate not found'; END IF;
END $function$;

-- The line goes before its candidates (they reference it, it references its
-- default and selection). Candidates asked on an AR stay as its history with
-- no line, as on job deletion.
CREATE OR REPLACE FUNCTION public.delete_job_request_item(p_job_request_id bigint, p_job_request_item_id bigint)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE found_item bigint; ar_item_count bigint := 0; history_count bigint := 0; unasked bigint[];
BEGIN
  SELECT id INTO found_item FROM public.job_request_items
    WHERE id = p_job_request_item_id AND job_request_id = p_job_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*) INTO history_count FROM public.job_request_changelog WHERE item_id = p_job_request_item_id;
  SELECT count(*) FILTER (WHERE availability_request_id IS NOT NULL),
      coalesce(array_agg(id) FILTER (WHERE availability_request_id IS NULL), '{}')
    INTO ar_item_count, unasked
    FROM public.candidates WHERE job_request_item_id = p_job_request_item_id;
  DELETE FROM public.job_request_items WHERE id = p_job_request_item_id;
  DELETE FROM public.candidates WHERE id = ANY(unasked);
  RETURN jsonb_build_object('items', 1, 'availabilityRequests', 0,
    'availabilityRequestItems', ar_item_count, 'changelog', history_count, 'answers', 0);
END $function$;

CREATE OR REPLACE FUNCTION public.close_orphaned_availability_on_job_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  ar_ids bigint[] := '{}'; order_ids bigint[] := '{}'; unasked bigint[];
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
  FOR row_id IN SELECT id FROM public.availability_requests WHERE job_request_id=OLD.id ORDER BY id FOR UPDATE LOOP
    ar_ids := array_append(ar_ids,row_id);
  END LOOP;
  SELECT count(*) INTO item_count FROM public.job_request_items WHERE job_request_id=OLD.id;
  SELECT count(*) INTO history_count FROM public.job_request_changelog WHERE job_request_id=OLD.id;
  SELECT count(*) INTO order_items_count FROM public.order_items WHERE order_id=ANY(order_ids);
  SELECT count(*) INTO thread_count FROM public.threads WHERE agent='rosie' AND thread_id='jr-'||OLD.id;
  DELETE FROM public.orders WHERE id=ANY(order_ids);
  GET DIAGNOSTICS order_count=ROW_COUNT;
  -- Job deletion closes its ARs and keeps their supplier snapshots.
  -- Candidates never asked on an AR go with the job, after its lines.
  UPDATE public.availability_requests SET status='closed',public_token=NULL WHERE id=ANY(ar_ids);
  -- ARs were retained, so the deletion count remains zero.
  SELECT coalesce(array_agg(c.id), '{}') INTO unasked FROM public.candidates c
    JOIN public.job_request_items ji ON ji.id=c.job_request_item_id
    WHERE ji.job_request_id=OLD.id AND c.availability_request_id IS NULL;
  DELETE FROM public.job_request_items WHERE job_request_id=OLD.id;
  DELETE FROM public.candidates WHERE id=ANY(unasked);
  INSERT INTO public.deleted_job_threads(agent,thread_id,job_request_id,deleted_counts)
    VALUES ('rosie','jr-'||OLD.id,OLD.id,jsonb_build_object('items',item_count,'changelog',history_count,
      'availabilityRequests',ar_count,'availabilityRequestItems',ar_items,'orders',order_count,
      'orderItems',order_items_count,'threads',thread_count,'answers',0));
  RETURN OLD;
END $function$;

-- 10. LPS edits of line values ----------------------------------------------
-- Leaving Unavailable drops the substitute the answer offered: a picked one
-- goes back to unanswered and leaves the AR it joined as the substitute; a
-- typed one is retired (lines selecting it fall back to their default).
CREATE FUNCTION public.release_candidate_offer(p_candidate_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE src public.candidates;
BEGIN
  SELECT * INTO src FROM public.candidates WHERE id = p_candidate_id FOR UPDATE;
  IF src.offered_candidate_id IS NULL THEN RETURN; END IF;
  IF src.offer_description IS NOT NULL THEN
    UPDATE public.candidates SET is_active = false WHERE id = src.offered_candidate_id AND is_active;
  ELSE
    UPDATE public.candidates SET status = NULL, available_quantity = NULL, note_from_supplier = NULL,
        answered_at = NULL,
        availability_request_id = CASE WHEN availability_request_id = src.availability_request_id
          THEN NULL ELSE availability_request_id END
      WHERE id = src.offered_candidate_id AND is_active;
  END IF;
  UPDATE public.candidates SET offered_candidate_id = NULL, offer_description = NULL,
      offer_unit_price = NULL, offer_quantity = NULL
    WHERE id = src.id;
END $function$;

-- Writes the line's selected candidate. Not a supplier answer: answered_at,
-- the AR status and is_original are left alone, and a closed AR allows it.
CREATE FUNCTION public.update_job_line(p_item_id bigint, p_changes jsonb)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE line public.job_request_items; c public.candidates; k text; next_status text;
  qty numeric; demand numeric;
BEGIN
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb THEN
    RAISE EXCEPTION 'Changes are required';
  END IF;
  FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
    IF k NOT IN ('status', 'unit_price', 'available_quantity', 'note_for_customer')
      OR jsonb_typeof(p_changes->k) NOT IN ('string', 'number', 'null') THEN
      RAISE EXCEPTION 'Invalid line field';
    END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['unit_price', 'available_quantity'] LOOP
    IF nullif(trim(p_changes->>k), '')::numeric::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'Line numbers must be finite';
    END IF;
  END LOOP;
  SELECT * INTO line FROM public.job_request_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job line not found'; END IF;
  SELECT * INTO c FROM public.candidates WHERE id = line.selected_candidate_id FOR UPDATE;
  demand := coalesce(c.demanded_quantity, line.demanded_quantity);
  qty := CASE WHEN p_changes ? 'available_quantity'
    THEN nullif(trim(p_changes->>'available_quantity'), '')::numeric ELSE c.available_quantity END;

  next_status := c.status;
  IF p_changes ? 'status' THEN
    IF (p_changes->>'status') IS NULL OR (p_changes->>'status') NOT IN
        ('pending', 'available', 'partial_qty', 'unavailable', 'diff_size_sub', 'need_to_order', 'arriving_soon') THEN
      RAISE EXCEPTION 'Choose a valid line status';
    END IF;
    next_status := CASE p_changes->>'status' WHEN 'pending' THEN NULL
      WHEN 'need_to_order' THEN 'can_order' ELSE p_changes->>'status' END;
    -- An original reads Diff Sz/Sub only through the substitute it offers.
    IF next_status = 'diff_size_sub' AND c.is_original THEN
      IF c.status = 'unavailable' AND EXISTS (SELECT 1 FROM public.candidates
          WHERE id = c.offered_candidate_id AND is_active) THEN
        next_status := 'unavailable';
      ELSE
        RAISE EXCEPTION 'Diff Sz/Sub needs a substitute: select it or have the supplier offer one';
      END IF;
    END IF;
  END IF;
  -- Available below demand is Partial Qty; Partial Qty at full demand is Available.
  IF p_changes ? 'available_quantity' AND qty IS NOT NULL AND demand IS NOT NULL THEN
    IF next_status = 'available' AND qty > 0 AND qty < demand THEN next_status := 'partial_qty';
    ELSIF next_status = 'partial_qty' AND qty >= demand THEN next_status := 'available';
    END IF;
  END IF;

  PERFORM set_config('lps.lps_override', 'on', true);
  IF c.offered_candidate_id IS NOT NULL AND c.status = 'unavailable' AND next_status IS DISTINCT FROM 'unavailable' THEN
    PERFORM public.release_candidate_offer(c.id);
  END IF;
  UPDATE public.candidates SET
    status = next_status,
    unit_price = CASE WHEN p_changes ? 'unit_price'
      THEN nullif(trim(p_changes->>'unit_price'), '')::numeric ELSE unit_price END,
    available_quantity = qty,
    -- NULL follows the supplier's reply; '' is deliberately blank.
    note_for_customer = CASE WHEN p_changes ? 'note_for_customer'
      THEN p_changes->>'note_for_customer' ELSE note_for_customer END
  WHERE id = c.id;
  PERFORM set_config('lps.lps_override', '', true);
END $function$;

-- 11. Supplier answers ------------------------------------------------------
-- Makes the asked candidate's substitute Diff Sz/Sub at full demand on the
-- same AR, visible to LPS. Price and reply note are the answer RPC's.
CREATE OR REPLACE FUNCTION public.apply_candidate_offer(p_candidate_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE src public.candidates; offered public.candidates; demand numeric;
BEGIN
  SELECT * INTO src FROM public.candidates
    WHERE id = p_candidate_id AND is_active AND status = 'unavailable' AND offered_candidate_id IS NOT NULL;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO offered FROM public.candidates WHERE id = src.offered_candidate_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  demand := coalesce(offered.demanded_quantity, src.demanded_quantity);
  UPDATE public.candidates SET
    availability_request_id = src.availability_request_id,
    demanded_quantity = demand,
    status = 'diff_size_sub',
    available_quantity = demand,
    -- A supplier's pick is something LPS must see (0124).
    hide_from_lps = false,
    answered_at = now()
  WHERE id = offered.id;
END $function$;

CREATE OR REPLACE FUNCTION public.answer_availability_request(p_request_id bigint, p_supplier_id bigint,
  p_item_id bigint DEFAULT NULL::bigint, p_changes jsonb DEFAULT NULL::jsonb, p_submit boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests; cur public.candidates; k text; next_status text;
  next_offer bigint; next_description text; has_offer boolean; typed boolean; prev_typed boolean;
  offer_changed boolean; qty numeric; demand numeric;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE id = p_request_id AND supplier_id = p_supplier_id  AND status <> 'closed'
      AND (status <> 'draft' OR current_setting('lps.ar_admin_edit', true) = 'on') FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = ar.supplier_id AND is_active) THEN
    RAISE EXCEPTION 'This request is closed, draft or unavailable';
  END IF;
  IF p_submit THEN
    UPDATE public.availability_requests SET status = 'submitted', submitted_at = now() WHERE id = ar.id;
    RETURN ar.id;
  END IF;
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb THEN
    RAISE EXCEPTION 'Changes are required';
  END IF;
  -- offer_unit_price / offer_quantity are still accepted but ignored: a
  -- substitute's price and quantity are its own (sent as unit_price /
  -- available_quantity, which go to it).
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
  -- A substitute is answered through the asked row that offers it.
  IF EXISTS (SELECT 1 FROM public.candidates
      WHERE offered_candidate_id = cur.id AND availability_request_id = ar.id AND is_active) THEN
    RAISE EXCEPTION 'This is a substitute: answer the line that offers it';
  END IF;
  prev_typed := cur.offered_candidate_id IS NOT NULL AND cur.offer_description IS NOT NULL;

  next_status := CASE WHEN p_changes ? 'status' THEN nullif(trim(p_changes->>'status'), '') ELSE cur.status END;
  next_description := CASE WHEN p_changes ? 'offer_description'
    THEN nullif(btrim(p_changes->>'offer_description'), '') ELSE cur.offer_description END;
  -- {status: 'unavailable'} alone keeps the substitute already offered.
  next_offer := CASE WHEN p_changes ? 'offered_candidate_id'
    THEN nullif(trim(p_changes->>'offered_candidate_id'), '')::bigint ELSE cur.offered_candidate_id END;
  -- A typed substitute owns the candidate made for it; a tag has no description.
  typed := next_description IS NOT NULL AND (next_offer IS NULL OR (prev_typed AND next_offer = cur.offered_candidate_id));
  IF NOT typed THEN next_description := NULL; END IF;
  -- Editing a typed substitute keeps its candidate; a new one gets its own.
  IF typed THEN next_offer := CASE WHEN prev_typed THEN cur.offered_candidate_id END; END IF;
  has_offer := next_offer IS NOT NULL OR typed;
  -- A substitute makes the asked candidate Unavailable; Diff Sz/Sub needs one.
  -- A legacy Diff Sz/Sub answer without one is kept while neither is changed.
  IF next_status IN ('unavailable', 'diff_size_sub') AND has_offer THEN
    next_status := 'unavailable';
  ELSIF next_status = 'diff_size_sub' AND (p_changes ? 'status'
      OR p_changes ? 'offered_candidate_id' OR p_changes ? 'offer_description') THEN
    RAISE EXCEPTION 'Pick or describe the substitute';
  END IF;
  IF next_status IS DISTINCT FROM 'unavailable' THEN next_offer := NULL; next_description := NULL; typed := false; has_offer := false; END IF;
  IF next_offer IS NOT NULL AND NOT typed THEN
    IF NOT EXISTS (SELECT 1 FROM public.candidates o
        WHERE o.id = next_offer AND o.id <> cur.id AND o.is_active AND o.supplier_id = cur.supplier_id
          AND o.job_request_item_id IS NOT DISTINCT FROM cur.job_request_item_id
          AND cur.job_request_item_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Offered candidate must be another candidate of this line and supplier';
    END IF;
    -- A row asked on this request in its own right keeps its own answer.
    IF next_offer IS DISTINCT FROM cur.offered_candidate_id AND EXISTS (SELECT 1 FROM public.candidates
        WHERE id = next_offer AND availability_request_id = ar.id) THEN
      RAISE EXCEPTION 'That candidate is asked on this request: answer it on its own line';
    END IF;
  END IF;
  IF typed AND cur.job_request_item_id IS NULL THEN RAISE EXCEPTION 'This line has no job line for a substitute'; END IF;

  -- The previous substitute, if it is being replaced or cleared.
  IF cur.offered_candidate_id IS NOT NULL AND cur.offered_candidate_id IS DISTINCT FROM next_offer THEN
    PERFORM public.release_candidate_offer(cur.id);
  END IF;
  -- A typed substitute: a placeholder named with the text (price unknown,
  -- Rosie enriches it after submission), or the one already made for it.
  IF typed AND next_offer IS NULL THEN
    INSERT INTO public.candidates(supplier_id, job_request_item_id, availability_request_id, name, description,
        is_original, unit_price, demanded_quantity, status, note_from_supplier, answered_at)
      VALUES (cur.supplier_id, cur.job_request_item_id, ar.id, next_description, next_description,
        false, NULL, cur.demanded_quantity, 'diff_size_sub', next_description, now())
      RETURNING id INTO next_offer;
  ELSIF typed AND next_description IS DISTINCT FROM cur.offer_description THEN
    -- Only a changed text renames it, so Rosie's enrichment survives other edits.
    UPDATE public.candidates SET name = next_description, description = next_description WHERE id = next_offer;
  END IF;
  offer_changed := has_offer AND next_offer IS DISTINCT FROM cur.offered_candidate_id;

  -- Available below demand is Partial Qty; Partial Qty at full demand is Available.
  qty := nullif(trim(p_changes->>'available_quantity'), '')::numeric;
  demand := coalesce(cur.demanded_quantity,
    (SELECT demanded_quantity FROM public.job_request_items WHERE id = cur.job_request_item_id));
  IF NOT has_offer AND qty IS NOT NULL AND demand IS NOT NULL THEN
    IF next_status = 'available' AND qty > 0 AND qty < demand THEN next_status := 'partial_qty';
    ELSIF next_status = 'partial_qty' AND qty >= demand THEN next_status := 'available';
    END IF;
  END IF;

  -- The asked row. With a substitute, its price, quantity and reply belong
  -- to the substitute (the AR row shows them from there).
  UPDATE public.candidates SET
    status = next_status,
    -- Unavailable zeroes the quantity; a status never changes the price (0122).
    available_quantity = CASE WHEN next_status = 'unavailable' THEN 0
      WHEN p_changes ? 'available_quantity' THEN qty ELSE available_quantity END,
    unit_price = CASE WHEN NOT has_offer AND p_changes ? 'unit_price'
      THEN nullif(trim(p_changes->>'unit_price'), '')::numeric ELSE unit_price END,
    note_from_supplier = CASE WHEN has_offer THEN NULL WHEN p_changes ? 'note_from_supplier'
      THEN nullif(trim(p_changes->>'note_from_supplier'), '') ELSE note_from_supplier END,
    offered_candidate_id = next_offer,
    offer_description = next_description,
    offer_unit_price = NULL,
    offer_quantity = NULL,
    answered_at = now()
  WHERE id = cur.id;
  IF has_offer THEN
    -- A new substitute, or the row newly answered with it, (re)applies it;
    -- a later edit leaves the substitute's own quantity as set.
    IF offer_changed OR cur.status IS DISTINCT FROM 'unavailable' THEN
      PERFORM public.apply_candidate_offer(cur.id);
    END IF;
    IF p_changes ?| ARRAY['unit_price', 'available_quantity', 'note_from_supplier'] THEN
      UPDATE public.candidates SET
        unit_price = CASE WHEN p_changes ? 'unit_price'
          THEN nullif(trim(p_changes->>'unit_price'), '')::numeric ELSE unit_price END,
        available_quantity = CASE WHEN p_changes ? 'available_quantity' THEN qty ELSE available_quantity END,
        note_from_supplier = CASE WHEN p_changes ? 'note_from_supplier'
          THEN nullif(trim(p_changes->>'note_from_supplier'), '') ELSE note_from_supplier END,
        answered_at = now()
      WHERE id = next_offer;
    END IF;
  END IF;
  -- A supplier answer marks the AR Processing; an LPS edit keeps its status.
  IF ar.status <> 'draft' AND current_setting('lps.ar_admin_edit', true) IS DISTINCT FROM 'on' THEN
    UPDATE public.availability_requests SET status = 'processing' WHERE id = ar.id;
  END IF;
  RETURN ar.id;
END $function$;

CREATE OR REPLACE FUNCTION public.submit_availability_request_note(p_request_id bigint, p_supplier_id bigint, p_note text)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF length(p_note) > 10000 THEN RAISE EXCEPTION 'Supplier note must be 10000 characters or fewer'; END IF;
  -- Existing submission locks and verifies the active request and supplier,
  -- rejects closed requests, and stamps submitted_at in this transaction.
  PERFORM public.answer_availability_request(p_request_id, p_supplier_id, p_submit => true);
  UPDATE public.availability_requests SET note_for_supplier = nullif(btrim(p_note), '') WHERE id = p_request_id;
  RETURN p_request_id;
END $function$;

-- 12. Submission ------------------------------------------------------------
-- For this AR's lines on open jobs: a selected asked row answered
-- Unavailable with a substitute since the previous submission switches the
-- line to the substitute; then this AR's other alternatives are hidden
-- (not the line's default or selection, the supplier's originals, or the
-- substitutes they offer). A candidate LPS unhid can be hidden again by a
-- later submission of the same AR.
CREATE OR REPLACE FUNCTION public.apply_submitted_candidates() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  UPDATE public.job_request_items ji SET selected_candidate_id = s.id
    FROM public.candidates c, public.candidates s, public.job_requests j
    WHERE c.id = ji.selected_candidate_id AND c.availability_request_id = NEW.id AND c.is_active
      AND c.status = 'unavailable' AND c.answered_at > coalesce(OLD.submitted_at, '-infinity'::timestamptz)
      AND s.id = c.offered_candidate_id AND s.is_active AND s.job_request_item_id = ji.id
      AND ji.is_active AND j.id = ji.job_request_id AND j.is_active AND j.status IN ('quoted', 'availability');
  UPDATE public.candidates c SET hide_from_lps = true
    FROM public.job_request_items ji, public.job_requests j
    WHERE c.availability_request_id = NEW.id AND c.supplier_id = NEW.supplier_id AND c.is_active
      AND NOT c.hide_from_lps AND NOT c.is_original
      AND ji.id = c.job_request_item_id AND ji.is_active
      AND c.id <> ji.default_candidate_id AND c.id <> ji.selected_candidate_id
      AND j.id = ji.job_request_id AND j.is_active AND j.status IN ('quoted', 'availability')
      AND NOT EXISTS (SELECT 1 FROM public.candidates o
        WHERE o.job_request_item_id = ji.id AND o.supplier_id = NEW.supplier_id AND o.is_original
          AND o.is_active AND o.offered_candidate_id = c.id);
  RETURN NULL;
END $function$;
DROP TRIGGER availability_requests_apply_selected ON public.availability_requests;
CREATE TRIGGER availability_requests_apply_selected AFTER UPDATE OF status ON public.availability_requests
  FOR EACH ROW WHEN (NEW.status = 'submitted' AND OLD.status IS DISTINCT FROM 'submitted')
  EXECUTE FUNCTION public.apply_submitted_candidates();

-- 13. AR status: no automatic New -------------------------------------------
-- submitted_at stays as history through a reopen (the next submission
-- compares answers against it); only withdrawing to Draft clears it.
CREATE OR REPLACE FUNCTION public.guard_ar_public_link() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status NOT IN ('closed', 'draft') AND NOT EXISTS (
    SELECT 1 FROM public.job_requests j WHERE j.id = NEW.job_request_id AND j.is_active
      AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')
  ) THEN RAISE EXCEPTION 'All linked job requests are closed'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status IN ('processing', 'submitted') THEN
    RAISE EXCEPTION 'Publish the draft before recording supplier progress';
  END IF;
  IF NEW.status = 'draft' THEN NEW.submitted_at := NULL; END IF;
  IF NEW.status IN ('closed', 'draft') THEN
    NEW.public_token := NULL;
  ELSIF NEW.public_token IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.suppliers WHERE id = NEW.supplier_id AND is_active
  ) THEN RAISE EXCEPTION 'Public requests require an active supplier'; END IF;
  -- Reopening an AR is explicit. Entering Submitted is a new submission.
  IF NEW.status = 'submitted' AND (TG_OP = 'INSERT' OR OLD.status <> 'submitted') THEN
    NEW.submitted_at := now();
  END IF;
  RETURN NEW;
END $function$;

-- Submitted / Processing → New, or Closed → New while its job is open (the
-- guard refuses a closed job), with a public link for a non-Partner.
CREATE FUNCTION public.reopen_availability_request(p_request_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests;
BEGIN
  SELECT * INTO ar FROM public.availability_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Availability request not found'; END IF;
  IF ar.status NOT IN ('submitted', 'processing', 'closed') THEN
    RAISE EXCEPTION 'Only a submitted, processing or closed request can be reopened';
  END IF;
  UPDATE public.availability_requests SET status = 'new',
      public_token = CASE WHEN public_token IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.suppliers WHERE id = ar.supplier_id AND is_lps_partner) THEN gen_random_uuid()
        ELSE public_token END
    WHERE id = ar.id;
END $function$;

-- Asking more of a supplier who has answered needs an explicit reopen. An
-- earlier supplier answer is cleared on attach (an ask means unknown); values
-- LPS set by hand stay.
CREATE OR REPLACE FUNCTION public.add_candidates_to_availability_request(p_request_id bigint, p_candidate_ids bigint[])
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests; attached bigint;
BEGIN
  IF coalesce(cardinality(p_candidate_ids), 0) = 0 THEN RAISE EXCEPTION 'Candidates are required'; END IF;
  SELECT * INTO ar FROM public.availability_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Availability request not found'; END IF;
  IF ar.status IN ('submitted', 'processing', 'closed') THEN
    RAISE EXCEPTION 'AR-% is %: reopen it before adding candidates', ar.id, ar.status;
  END IF;
  UPDATE public.candidates c SET availability_request_id = ar.id,
      demanded_quantity = coalesce(c.demanded_quantity, ji.demanded_quantity),
      status = CASE WHEN c.answered_at IS NOT NULL THEN NULL ELSE c.status END,
      available_quantity = CASE WHEN c.answered_at IS NOT NULL THEN NULL ELSE c.available_quantity END,
      answered_at = NULL
    FROM public.job_request_items ji JOIN public.job_requests j ON j.id = ji.job_request_id
    WHERE c.id = ANY(p_candidate_ids) AND c.is_active AND c.availability_request_id IS NULL
      AND c.supplier_id = ar.supplier_id AND ji.id = c.job_request_item_id AND ji.is_active
      AND ji.job_request_id = ar.job_request_id
      AND j.is_active AND j.status NOT IN ('closed_won', 'closed_lost', 'archived');
  GET DIAGNOSTICS attached = ROW_COUNT;
  IF attached <> cardinality(ARRAY(SELECT DISTINCT unnest(p_candidate_ids))) THEN
    RAISE EXCEPTION 'Each candidate must be active, unasked, on an open line of this request''s job and for its supplier';
  END IF;
  RETURN ar.id;
END $function$;

CREATE OR REPLACE FUNCTION public.guard_one_ar_per_job_supplier() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE existing bigint;
BEGIN
  IF NEW.job_request_id IS NULL THEN RETURN NEW; END IF;
  -- Serialize concurrent creates for the job, the same lock create_availability_request takes.
  PERFORM 1 FROM public.job_requests WHERE id = NEW.job_request_id FOR UPDATE;
  SELECT id INTO existing FROM public.availability_requests
    WHERE job_request_id = NEW.job_request_id AND supplier_id = NEW.supplier_id
    ORDER BY id DESC LIMIT 1;
  IF existing IS NOT NULL THEN
    RAISE EXCEPTION 'JR-% already has AR-% with this supplier; add candidates to it (reopen it first if it is submitted, processing or closed)',
      NEW.job_request_id, existing;
  END IF;
  RETURN NEW;
END $function$;

-- 14. Read model ------------------------------------------------------------
CREATE VIEW public.job_lines WITH (security_invoker = true) AS
SELECT ji.id, ji.job_request_id, ji.name, ji.size AS requested_size, ji.demanded_quantity,
  ji.note_internal, ji.is_active, ji.created_at, ji.updated_at,
  ji.default_candidate_id, ji.selected_candidate_id,
  coalesce(c.size, ji.size) AS size,
  nullif(c.unit_price, 0) AS unit_price,
  d.demand,
  CASE WHEN c.available_quantity IS NOT NULL THEN least(c.available_quantity, d.demand) END AS available_quantity,
  ji.demanded_quantity * nullif(c.unit_price, 0) AS total,
  CASE WHEN c.note_for_customer IS NOT NULL THEN nullif(btrim(c.note_for_customer), '')
    ELSE nullif(btrim(c.note_from_supplier), '') END AS note_for_customer,
  CASE
    WHEN c.status IS NULL THEN 'pending'
    WHEN c.status = 'can_order' THEN 'need_to_order'
    WHEN c.status IN ('arriving_soon', 'diff_size_sub') THEN c.status
    WHEN c.status = 'unavailable' AND s.id IS NOT NULL THEN 'diff_size_sub'
    WHEN c.status = 'unavailable' THEN 'unavailable'
    WHEN NOT c.is_original THEN 'diff_size_sub'
    WHEN c.available_quantity < d.demand THEN 'partial_qty'
    ELSE c.status END AS status,
  c.description AS candidate_description, c.name AS candidate_name, c.supplier_id AS candidate_supplier_id,
  NOT c.is_original AS is_substitute,
  CASE WHEN c.is_original THEN ji.name ELSE coalesce(c.description, c.name) END AS quote_name
FROM public.job_request_items ji
JOIN public.candidates c ON c.id = ji.selected_candidate_id
CROSS JOIN LATERAL (SELECT coalesce(c.demanded_quantity, ji.demanded_quantity) AS demand) d
LEFT JOIN public.candidates s ON s.id = c.offered_candidate_id AND s.is_active;
REVOKE ALL ON public.job_lines FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.job_lines TO authenticated, service_role;

-- 15. Orders ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_order(p_supplier_id bigint, p_items jsonb, p_fulfillment_method text DEFAULT NULL::text, p_fulfillment_date date DEFAULT NULL::date, p_note_for_supplier text DEFAULT NULL::text, p_customer_confirmed boolean DEFAULT false, p_note_for_customer text DEFAULT NULL::text)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE line jsonb; allocation jsonb; source public.candidates; ar public.availability_requests;
  job public.job_requests; demand_item public.job_request_items; order_id bigint; line_id bigint;
  demand numeric; allocated numeric; already_ordered numeric;
BEGIN
  IF p_customer_confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Explicit customer confirmation is required'; END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Order items are required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND is_active) THEN RAISE EXCEPTION 'Active supplier required'; END IF;
  -- Serialize supplier commitments, including direct orders for other jobs on a shared AR.
  PERFORM pg_advisory_xact_lock(hashtextextended('order-supplier:' || p_supplier_id, 0));
  FOR job IN SELECT j.* FROM public.job_requests j WHERE j.id IN (
    SELECT ji.job_request_id FROM public.job_request_items ji WHERE ji.id IN (
      SELECT (a->>'job_request_item_id')::bigint FROM jsonb_array_elements(p_items) l,
        LATERAL jsonb_array_elements(l->'allocations') a
    )) ORDER BY j.id FOR UPDATE LOOP
    IF NOT job.is_active OR job.status IN ('closed_won', 'closed_lost', 'archived') THEN RAISE EXCEPTION 'This job request is closed'; END IF;
  END LOOP;
  -- Serialize repeated/subdivided orders on the source request, then its lines.
  PERFORM 1 FROM public.availability_requests a WHERE a.id IN (
    SELECT c.availability_request_id FROM public.candidates c WHERE c.id IN (
      SELECT (l->>'candidate_id')::bigint FROM jsonb_array_elements(p_items) l
    )) ORDER BY a.id FOR UPDATE;
  INSERT INTO public.orders(supplier_id, fulfillment_method, fulfillment_date, note_for_supplier, note_for_customer)
    VALUES (p_supplier_id, p_fulfillment_method, p_fulfillment_date, p_note_for_supplier, p_note_for_customer) RETURNING id INTO order_id;
  FOR line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF jsonb_typeof(line->'allocations') IS DISTINCT FROM 'array' OR jsonb_array_length(line->'allocations') = 0 THEN
      RAISE EXCEPTION 'Order allocations are required'; END IF;
    SELECT * INTO source FROM public.candidates WHERE id = (line->>'candidate_id')::bigint AND is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Availability line not found'; END IF;
    SELECT * INTO ar FROM public.availability_requests WHERE id = source.availability_request_id;
    IF NOT FOUND OR ar.supplier_id <> p_supplier_id OR ar.status = 'closed' THEN RAISE EXCEPTION 'Availability request is closed or belongs to another supplier'; END IF;
    -- An asked row with a substitute is Unavailable: the substitute is what is ordered.
    IF source.status IS NULL OR source.status = 'unavailable' THEN RAISE EXCEPTION 'Supplier must answer availability before ordering'; END IF;
    -- A typed substitute stays unpriced until Rosie enriches it.
    IF coalesce(source.unit_price, 0) = 0 THEN RAISE EXCEPTION 'Price this line before ordering'; END IF;
    SELECT sum((a->>'quantity')::numeric) INTO demand FROM jsonb_array_elements(line->'allocations') a;
    IF demand IS NULL OR demand <= 0 OR demand >= 'Infinity'::numeric THEN RAISE EXCEPTION 'Positive finite quantities are required'; END IF;
    -- All commitments to this supplier for the candidate's job line consume its
    -- budget, including direct orders and selections from another related AR.
    SELECT coalesce(sum(a.quantity), 0) INTO already_ordered
      FROM public.order_item_job_request_items a
      JOIN public.order_items oi ON oi.id = a.order_item_id
      JOIN public.orders o ON o.id = oi.order_id
      WHERE a.job_request_item_id = source.job_request_item_id AND o.supplier_id = p_supplier_id
        AND oi.is_active AND o.is_active AND o.status <> 'closed_lost';
    IF source.demanded_quantity IS NOT NULL AND demand + already_ordered > source.demanded_quantity THEN RAISE EXCEPTION 'Order exceeds remaining requested quantity'; END IF;
    IF source.available_quantity IS NOT NULL AND source.status <> 'can_order' AND demand + already_ordered > source.available_quantity THEN
      RAISE EXCEPTION 'Order exceeds supplier available quantity'; END IF;
    INSERT INTO public.order_items(order_id, name, size, quantity, unit_price, status, note_for_supplier, note_for_customer)
      VALUES (order_id, source.name, source.size, demand, source.unit_price,
        -- As job_lines reads it: an answered substitute is Diff Sz/Sub.
        CASE WHEN source.status = 'can_order' THEN 'need_to_order'
          WHEN source.status IN ('available', 'partial_qty') AND NOT source.is_original THEN 'diff_size_sub'
          ELSE source.status END,
        nullif(concat_ws(E'\n\n', nullif(btrim(source.note_for_supplier), ''), nullif(btrim(source.note_from_supplier), '')), ''),
        CASE WHEN source.note_for_customer IS NOT NULL THEN nullif(btrim(source.note_for_customer), '')
          ELSE nullif(btrim(source.note_from_supplier), '') END)
      RETURNING id INTO line_id;
    FOR allocation IN SELECT * FROM jsonb_array_elements(line->'allocations') LOOP
      allocated := (allocation->>'quantity')::numeric;
      IF allocated IS NULL OR allocated <= 0 OR allocated >= 'Infinity'::numeric THEN RAISE EXCEPTION 'Positive finite allocations are required'; END IF;
      SELECT * INTO demand_item FROM public.job_request_items WHERE id = (allocation->>'job_request_item_id')::bigint AND is_active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Active job line not found'; END IF;
      IF demand_item.id IS DISTINCT FROM source.job_request_item_id THEN RAISE EXCEPTION 'Job line is not allocated to this availability line'; END IF;
      SELECT coalesce(sum(a.quantity), 0) INTO already_ordered FROM public.order_item_job_request_items a
        JOIN public.order_items oi ON oi.id = a.order_item_id JOIN public.orders o ON o.id = oi.order_id
        WHERE a.job_request_item_id = demand_item.id AND oi.is_active AND o.is_active AND o.status <> 'closed_lost';
      IF demand_item.demanded_quantity IS NOT NULL AND allocated + already_ordered > demand_item.demanded_quantity THEN RAISE EXCEPTION 'Order exceeds remaining customer demand'; END IF;
      INSERT INTO public.order_item_job_request_items VALUES (line_id, demand_item.id, allocated);
      UPDATE public.job_requests SET status = 'committed' WHERE id = demand_item.job_request_id AND status IN ('quoted', 'availability');
    END LOOP;
  END LOOP;
  RETURN order_id;
END $function$;

CREATE OR REPLACE FUNCTION public.create_direct_order(p_supplier_id bigint, p_items jsonb, p_fulfillment_method text DEFAULT NULL::text, p_fulfillment_date date DEFAULT NULL::date, p_note_for_supplier text DEFAULT NULL::text, p_customer_confirmed boolean DEFAULT false, p_note_for_customer text DEFAULT NULL::text)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE line jsonb; job public.job_requests; demand_item public.job_request_items; quote_line public.job_lines;
  order_id bigint; line_id bigint; requested numeric; already_ordered numeric;
BEGIN
  IF p_customer_confirmed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Explicit customer confirmation is required';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Order items are required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND is_active) THEN
    RAISE EXCEPTION 'Active supplier required';
  END IF;
  IF p_fulfillment_method IS NOT NULL AND p_fulfillment_method NOT IN ('pickup', 'delivery') THEN
    RAISE EXCEPTION 'Choose pickup or delivery';
  END IF;

  -- Serialize supplier commitments, including direct orders for other jobs on a shared AR.
  PERFORM pg_advisory_xact_lock(hashtextextended('order-supplier:' || p_supplier_id, 0));

  -- Take job locks before line locks, matching the existing order lifecycle.
  FOR job IN SELECT j.* FROM public.job_requests j WHERE j.id IN (
    SELECT ji.job_request_id FROM public.job_request_items ji WHERE ji.id IN (
      SELECT (input_line.line->>'job_request_item_id')::bigint
      FROM jsonb_array_elements(p_items) AS input_line(line)
    )) ORDER BY j.id FOR UPDATE LOOP
    IF NOT job.is_active OR job.status IN ('closed_won', 'closed_lost', 'archived') THEN
      RAISE EXCEPTION 'This job request is closed';
    END IF;
  END LOOP;

  INSERT INTO public.orders(supplier_id, fulfillment_method, fulfillment_date, note_for_supplier, note_for_customer)
    VALUES (p_supplier_id, p_fulfillment_method, p_fulfillment_date, p_note_for_supplier, p_note_for_customer)
    RETURNING id INTO order_id;
  FOR line IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    requested := (line->>'quantity')::numeric;
    IF requested IS NULL OR requested <= 0 OR requested >= 'Infinity'::numeric THEN
      RAISE EXCEPTION 'Positive finite quantities are required';
    END IF;
    SELECT * INTO demand_item FROM public.job_request_items
      WHERE id = (line->>'job_request_item_id')::bigint AND is_active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Active quoted line not found'; END IF;
    -- The line's values are its selected candidate's, as quoted.
    SELECT * INTO quote_line FROM public.job_lines WHERE id = demand_item.id;
    IF quote_line.unit_price IS NULL THEN RAISE EXCEPTION 'Price this line before ordering'; END IF;
    -- Direct and availability-backed orders both consume the same customer demand.
    SELECT coalesce(sum(link.quantity), 0) INTO already_ordered
      FROM public.order_item_job_request_items link
      JOIN public.order_items item ON item.id = link.order_item_id
      JOIN public.orders existing_order ON existing_order.id = item.order_id
      WHERE link.job_request_item_id = demand_item.id AND item.is_active
        AND existing_order.is_active AND existing_order.status <> 'closed_lost';
    IF demand_item.demanded_quantity IS NOT NULL AND requested + already_ordered > demand_item.demanded_quantity THEN
      RAISE EXCEPTION 'Order exceeds remaining customer demand';
    END IF;
    INSERT INTO public.order_items(order_id, name, size, quantity, unit_price, status, note_for_customer)
      VALUES (order_id, quote_line.quote_name, quote_line.size, requested, quote_line.unit_price,
        quote_line.status, quote_line.note_for_customer)
      RETURNING id INTO line_id;
    INSERT INTO public.order_item_job_request_items(order_item_id, job_request_item_id, quantity)
      VALUES (line_id, demand_item.id, requested);
    UPDATE public.job_requests SET status = 'committed'
      WHERE id = demand_item.job_request_id AND status IN ('quoted', 'availability');
  END LOOP;
  RETURN order_id;
END $function$;

CREATE OR REPLACE FUNCTION public.update_partner_order_item(p_order_id bigint, p_supplier_id bigint, p_order_item_id bigint, p_status text)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  -- The pre-0130 name, still sent by partner pages loaded before the rename.
  IF p_status = 'diff_size_qty_sub' THEN p_status := 'diff_size_sub'; END IF;
  IF p_status NOT IN ('pending', 'available', 'partial_qty', 'unavailable', 'diff_size_sub', 'need_to_order', 'arriving_soon') THEN
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

-- 16. Retired functions -------------------------------------------------------
-- No callers: answers link substitutes; the line copy is the job_lines view.
DROP FUNCTION public.link_candidate_offer(bigint, bigint);
DROP FUNCTION public.request_candidate_availability(bigint);
DROP FUNCTION public.apply_candidate_to_job_item(bigint);

-- 17. Status sets quantity, for every writer (last: the backfill keeps its values)
-- Only an actual status change acts, so a note or redirected quantity edit
-- that re-sends the status keeps its quantity.
CREATE FUNCTION public.candidate_status_quantity() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE demand numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  demand := coalesce(NEW.demanded_quantity,
    (SELECT demanded_quantity FROM public.job_request_items WHERE id = NEW.job_request_item_id));
  IF NEW.status = 'available' THEN
    NEW.available_quantity := coalesce(demand, NEW.available_quantity);
  ELSIF NEW.status = 'unavailable' THEN
    NEW.available_quantity := 0;
  ELSIF NEW.status = 'diff_size_sub' AND NEW.available_quantity IS NULL THEN
    NEW.available_quantity := demand;
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER candidates_status_quantity BEFORE INSERT OR UPDATE OF status ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.candidate_status_quantity();

-- 18. Grants and comments ---------------------------------------------------
REVOKE ALL ON FUNCTION public.update_job_line(bigint, jsonb), public.reopen_availability_request(bigint),
  public.release_candidate_offer(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_job_line(bigint, jsonb), public.reopen_availability_request(bigint),
  public.release_candidate_offer(bigint) TO service_role;
REVOKE ALL ON FUNCTION public.create_job_line_default(), public.sync_job_line_default(),
  public.protect_default_candidate(), public.reselect_default_on_deactivate(),
  public.candidate_status_quantity() FROM PUBLIC, anon, authenticated;

COMMENT ON COLUMN public.job_request_items.size IS 'The size the customer asked for (job_lines.requested_size). What fills the line is the selected candidate''s.';
COMMENT ON COLUMN public.job_request_items.default_candidate_id IS
  'The line''s APS original candidate, created with the line. Never hidden, deactivated or deleted while the line exists; the selection falls back to it.';
COMMENT ON COLUMN public.job_request_items.selected_candidate_id IS
  'Candidate whose size, price, quantity, status and customer note fill this line (read through job_lines). Defaults to default_candidate_id.';
COMMENT ON COLUMN public.job_request_items.unit_price IS 'Deprecated by 0130 (read job_lines.unit_price); dropped in 0131.';
COMMENT ON COLUMN public.job_request_items.total IS 'Deprecated by 0130 (read job_lines.total); dropped in 0131.';
COMMENT ON COLUMN public.job_request_items.status IS 'Deprecated by 0130 (read job_lines.status); dropped in 0131.';
COMMENT ON COLUMN public.job_request_items.available_quantity IS 'Deprecated by 0130 (read job_lines.available_quantity); dropped in 0131.';
COMMENT ON COLUMN public.job_request_items.note_for_customer IS 'Deprecated by 0130 (read job_lines.note_for_customer); dropped in 0131.';
COMMENT ON COLUMN public.candidates.status IS
  'Supplier answer: available (quantity = demand), partial_qty (fewer than demanded), can_order, arriving_soon, unavailable (quantity 0; with offered_candidate_id it offers a substitute), diff_size_sub (the substitute, or a legacy single-row answer), NULL = not answered.';
COMMENT ON COLUMN public.candidates.note_for_customer IS
  'LPS override of the customer note. NULL = follow note_from_supplier; '''' = deliberately blank; text = the note.';
COMMENT ON COLUMN public.candidates.offered_candidate_id IS
  'Substitute for an Unavailable answer: another candidate of the same supplier and line (a picked tag), or the placeholder created for a typed one (offer_description set). It is diff_size_sub on the same AR and receives the supplier''s price, quantity and reply.';
COMMENT ON COLUMN public.candidates.offer_unit_price IS 'Unused since 0130 (the substitute''s own unit_price).';
COMMENT ON COLUMN public.candidates.offer_quantity IS 'Unused since 0130 (the substitute''s own available_quantity).';
COMMENT ON COLUMN public.availability_requests.status IS
  'draft = private LPS preparation; publish via send_availability_request to new; supplier answers move to processing, submission to submitted; reopen_availability_request returns submitted/processing/closed to new (never automatic); closed = retained read-only history. AR deletion is prohibited.';
COMMENT ON VIEW public.job_lines IS
  'Job lines as quoted: the line''s ask plus its selected candidate''s values. Read-only; edit through update_job_line (values) and job_request_items (ask).';
COMMENT ON COLUMN public.job_lines.requested_size IS 'The customer''s size (job_request_items.size).';
COMMENT ON COLUMN public.job_lines.size IS 'The selected candidate''s size, else the requested one.';
COMMENT ON COLUMN public.job_lines.unit_price IS 'Selected candidate price; NULL = not priced (0 = not found).';
COMMENT ON COLUMN public.job_lines.demand IS 'The selected candidate''s demand, else the line''s.';
COMMENT ON COLUMN public.job_lines.available_quantity IS 'Selected candidate quantity capped at demand; NULL = not answered.';
COMMENT ON COLUMN public.job_lines.note_for_customer IS 'Effective customer note: the candidate''s override, else the supplier''s reply.';
COMMENT ON COLUMN public.job_lines.status IS
  'pending, available, partial_qty, unavailable, diff_size_sub (a substitute, or an answer offering one), need_to_order, arriving_soon.';
COMMENT ON COLUMN public.job_lines.quote_name IS 'Name a quote prints: the line''s for an original, the substitute''s description otherwise.';

NOTIFY pgrst, 'reload schema';
COMMIT;
