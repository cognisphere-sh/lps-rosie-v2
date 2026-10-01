-- 0126 — a job line and its selected candidate are one answer.
--
-- (Bhoumik 2026-10-01) While a line has a selected candidate, its status,
-- avail, price, size, demand and customer note represent that candidate:
-- editing them on the line writes the candidate (`sync_job_item_to_candidate`,
-- replacing 0119's note-only `sync_selected_candidate_note`), then the
-- candidate is re-applied so the line shows the derived status. Status maps
-- both ways: Pending ↔ unanswered, Can Order ↔ Need to Order, Unavailable sets
-- the candidate's quantity to 0, Diff Sz/Sub keeps a substitute's answer (an
-- original becomes `diff_size_qty_sub`). These LPS edits do not move the AR to
-- Processing and go through on a closed AR (`lps.line_sync`). Lines with no
-- selection keep their own values; no placeholder candidates.
--
-- Derived line status (`apply_candidate_to_job_item`): an Available or Partial
-- Qty answer reads Diff Sz/Sub when the candidate is not the requested plant;
-- otherwise Partial Qty when the known avail is below demand, Available when it
-- meets it. A substitute that is Can Order / Arriving Soon now reads as that
-- (before, any non-original answer read Diff Sz/Sub). Unavailable and offers
-- are 0123's; Avail stays blank while unchecked (0125).
--
-- Existing lines are not re-applied: 18 open lines differ from their selected
-- candidate (edited on the line before this sync existed).
BEGIN;

CREATE OR REPLACE FUNCTION public.apply_candidate_to_job_item(p_job_request_item_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE prev text := coalesce(current_setting('lps.applying_candidate', true), '');
BEGIN
  -- The line's own sync trigger skips writes made here.
  PERFORM set_config('lps.applying_candidate', 'on', true);
  UPDATE public.job_request_items ji SET
    size = c.size,
    unit_price = nullif(c.unit_price, 0),
    available_quantity = CASE WHEN c.available_quantity IS NOT NULL
      THEN least(c.available_quantity, coalesce(c.demanded_quantity, ji.demanded_quantity)) END,
    status = CASE
      WHEN c.status IS NULL THEN 'pending'
      WHEN c.status = 'unavailable' AND c.offered_candidate_id IS NULL THEN 'unavailable'
      WHEN c.status IN ('unavailable', 'diff_size_qty_sub') THEN 'alternative_proposed'
      WHEN c.status = 'can_order' THEN 'need_to_order'
      WHEN c.status = 'arriving_soon' THEN 'arriving_soon'
      -- Available / Partial Qty from here.
      WHEN NOT c.is_original THEN 'alternative_proposed'
      WHEN c.available_quantity IS NULL OR coalesce(c.demanded_quantity, ji.demanded_quantity) IS NULL THEN c.status
      WHEN c.available_quantity < coalesce(c.demanded_quantity, ji.demanded_quantity) THEN 'partial_qty'
      ELSE 'available' END,
    note_for_customer = nullif(btrim(c.note_for_customer), '')
  FROM public.candidates c
  WHERE ji.id = p_job_request_item_id AND c.id = ji.selected_candidate_id;
  PERFORM set_config('lps.applying_candidate', prev, true);
END $function$;

-- Line edits on a closed AR's candidate are LPS's, not the supplier's.
CREATE OR REPLACE FUNCTION public.guard_candidate_write() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests;
BEGIN
  IF NEW.availability_request_id IS NULL OR current_setting('lps.line_sync', true) = 'on' THEN RETURN NEW; END IF;
  SELECT * INTO ar FROM public.availability_requests
    WHERE id = NEW.availability_request_id FOR UPDATE;
  IF NOT FOUND OR NOT ar.is_active OR ar.status = 'closed' THEN
    RAISE EXCEPTION 'This request is closed or deleted';
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

CREATE FUNCTION public.sync_job_item_to_candidate() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  c public.candidates;
  next_status text;
  status_changed boolean := NEW.status IS DISTINCT FROM OLD.status;
  prev_offer text := coalesce(current_setting('lps.applying_offer', true), '');
BEGIN
  IF current_setting('lps.applying_candidate', true) = 'on' THEN RETURN NULL; END IF;
  SELECT * INTO c FROM public.candidates WHERE id = NEW.selected_candidate_id AND is_active;
  IF NOT FOUND THEN RETURN NULL; END IF;

  next_status := CASE WHEN NOT status_changed THEN c.status
    ELSE CASE NEW.status
      WHEN 'pending' THEN NULL
      WHEN 'need_to_order' THEN 'can_order'
      WHEN 'alternative_proposed' THEN CASE
        WHEN c.is_original THEN 'diff_size_qty_sub'
        WHEN c.status IN ('available', 'partial_qty') THEN c.status
        ELSE 'available' END
      ELSE NEW.status END END;

  -- Not a supplier answer: the AR does not move to Processing (0119's trigger
  -- honours lps.applying_offer), and a closed AR does not refuse it.
  PERFORM set_config('lps.applying_offer', 'on', true);
  PERFORM set_config('lps.line_sync', 'on', true);
  UPDATE public.candidates SET
    status = next_status,
    available_quantity = CASE
      WHEN status_changed AND next_status = 'unavailable' THEN 0
      WHEN NEW.available_quantity IS DISTINCT FROM OLD.available_quantity THEN NEW.available_quantity
      ELSE available_quantity END,
    unit_price = CASE WHEN NEW.unit_price IS DISTINCT FROM OLD.unit_price THEN NEW.unit_price ELSE unit_price END,
    size = CASE WHEN NEW.size IS DISTINCT FROM OLD.size THEN NEW.size ELSE size END,
    -- A candidate without its own demand follows the line's.
    demanded_quantity = CASE WHEN demanded_quantity IS NOT NULL AND NEW.demanded_quantity IS DISTINCT FROM OLD.demanded_quantity
      THEN NEW.demanded_quantity ELSE demanded_quantity END,
    note_for_customer = CASE WHEN NEW.note_for_customer IS DISTINCT FROM OLD.note_for_customer
      THEN NEW.note_for_customer ELSE note_for_customer END
  WHERE id = c.id;
  PERFORM set_config('lps.line_sync', '', true);
  PERFORM set_config('lps.applying_offer', prev_offer, true);

  PERFORM public.apply_candidate_to_job_item(NEW.id);
  RETURN NULL;
END $function$;

DROP TRIGGER job_request_items_candidate_note ON public.job_request_items;
DROP FUNCTION public.sync_selected_candidate_note();

CREATE TRIGGER job_request_items_candidate_sync
  AFTER UPDATE OF status, available_quantity, unit_price, size, demanded_quantity, note_for_customer
  ON public.job_request_items FOR EACH ROW
  WHEN (NEW.selected_candidate_id IS NOT NULL AND NEW.selected_candidate_id IS NOT DISTINCT FROM OLD.selected_candidate_id)
  EXECUTE FUNCTION public.sync_job_item_to_candidate();

REVOKE ALL ON FUNCTION public.sync_job_item_to_candidate() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
