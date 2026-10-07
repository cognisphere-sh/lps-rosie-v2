-- 0129 — overriding a substitute line to Available makes it the original.
--
-- (Bhoumik 2026-10-05) Under 0126 a selected candidate that is not the
-- original always reads Diff Sz/Sub once Available or Partial Qty, so LPS
-- setting such a line to Available snapped straight back (JR-98 Top soil).
-- Now, when LPS sets a line to Available or Partial Qty while its selected
-- candidate is a substitute, that candidate becomes the line's original
-- request (`is_original`), and the supplier's previous original on the line
-- is demoted and marked Diff Sz/Sub — stored as 0123 stores it: Unavailable
-- (quantity 0, price kept) offering the promoted candidate. Other suppliers'
-- originals are untouched. Like 0126's line edits this is not a supplier
-- answer (`lps.line_sync`). Existing lines are not re-applied.
BEGIN;

CREATE OR REPLACE FUNCTION public.sync_job_item_to_candidate() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  c public.candidates;
  next_status text;
  status_changed boolean := NEW.status IS DISTINCT FROM OLD.status;
  promote boolean;
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
  -- Available / Partial Qty picked on a substitute: it becomes the original.
  promote := status_changed AND NEW.status IN ('available', 'partial_qty') AND NOT c.is_original;

  -- Not a supplier answer: the AR does not move to Processing (0119's trigger
  -- honours lps.applying_offer), and a closed AR does not refuse it.
  PERFORM set_config('lps.applying_offer', 'on', true);
  PERFORM set_config('lps.line_sync', 'on', true);
  UPDATE public.candidates SET
    status = next_status,
    is_original = is_original OR promote,
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
  -- The supplier's previous original reads Diff Sz/Sub, offering the promoted one.
  IF promote THEN
    UPDATE public.candidates SET
      is_original = false, status = 'unavailable', available_quantity = 0,
      offered_candidate_id = c.id, offer_description = NULL, offer_unit_price = NULL, offer_quantity = NULL
    WHERE job_request_item_id = NEW.id AND supplier_id = c.supplier_id AND is_original AND is_active AND id <> c.id;
  END IF;
  PERFORM set_config('lps.line_sync', '', true);
  PERFORM set_config('lps.applying_offer', prev_offer, true);

  PERFORM public.apply_candidate_to_job_item(NEW.id);
  RETURN NULL;
END $function$;

REVOKE ALL ON FUNCTION public.sync_job_item_to_candidate() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
