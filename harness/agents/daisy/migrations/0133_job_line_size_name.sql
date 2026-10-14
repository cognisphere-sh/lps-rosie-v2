-- 0133 — job line size and name edit what the line shows (2026-10-14)
--
-- (Bhoumik 2026-10-14) The job table shows the selected candidate's size
-- (job_lines.size) and, on a substitute, its name, but editing them wrote the
-- line's requested values. update_job_line now also takes `size` and `name`
-- (string or null; a blank size is NULL, a blank name is refused):
-- * Selected candidate is an original: the line's ask and the candidate both
--   change, so an asked default or another supplier's original shows it too
--   (an unasked default also follows through job_request_items_sync_default).
-- * Selected candidate is a substitute: only the candidate changes; the line
--   keeps the customer's requested size and name.
-- * A substitute's name edit rebuilds its description from its size and
--   name (a quote prints the description for a substitute). Otherwise a
--   description that is just "<size> <name>" (any case) is regenerated from
--   the new values; one that starts "<size> " keeps its text after the new
--   size; any other custom one is kept. A rebuilt description never repeats
--   a size the name already starts with (a typed substitute's name "15 G Oak").
-- * sync_job_line_default applies the same description rule, so an unasked
--   default's description follows its size and name.
-- As for the other keys: an LPS override (closed AR allowed), never a
-- supplier answer (answered_at, AR status and is_original untouched).
-- Demand and the internal note stay plain job_request_items edits.
BEGIN;
SET LOCAL lock_timeout = '250ms';
SET LOCAL statement_timeout = '5s';
SET LOCAL app.actor = 'migration 0133';

-- Writes the line's selected candidate. Not a supplier answer: answered_at,
-- the AR status and is_original are left alone, and a closed AR allows it.
CREATE OR REPLACE FUNCTION public.update_job_line(p_item_id bigint, p_changes jsonb)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE line public.job_request_items; c public.candidates; k text; next_status text;
  qty numeric; demand numeric; next_size text; next_name text;
BEGIN
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb THEN
    RAISE EXCEPTION 'Changes are required';
  END IF;
  FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
    IF k NOT IN ('status', 'unit_price', 'available_quantity', 'note_for_customer', 'size', 'name')
      OR jsonb_typeof(p_changes->k) NOT IN ('string', 'number', 'null') THEN
      RAISE EXCEPTION 'Invalid line field';
    END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['unit_price', 'available_quantity'] LOOP
    IF nullif(trim(p_changes->>k), '')::numeric::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'Line numbers must be finite';
    END IF;
  END LOOP;
  IF p_changes ? 'name' AND nullif(btrim(p_changes->>'name'), '') IS NULL THEN
    RAISE EXCEPTION 'Plant name is required';
  END IF;
  SELECT * INTO line FROM public.job_request_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job line not found'; END IF;
  SELECT * INTO c FROM public.candidates WHERE id = line.selected_candidate_id FOR UPDATE;
  demand := coalesce(c.demanded_quantity, line.demanded_quantity);
  qty := CASE WHEN p_changes ? 'available_quantity'
    THEN nullif(trim(p_changes->>'available_quantity'), '')::numeric ELSE c.available_quantity END;
  next_size := CASE WHEN p_changes ? 'size' THEN nullif(btrim(p_changes->>'size'), '') ELSE c.size END;
  next_name := CASE WHEN p_changes ? 'name' THEN btrim(p_changes->>'name') ELSE c.name END;

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
      THEN p_changes->>'note_for_customer' ELSE note_for_customer END,
    size = CASE WHEN p_changes ? 'size' THEN next_size ELSE size END,
    name = CASE WHEN p_changes ? 'name' THEN next_name ELSE name END,
    -- A substitute's new name, or a generated "<size> <name>" description,
    -- rebuilds it; a "<size> <own text>" one swaps its size; a custom one is kept.
    description = CASE WHEN (p_changes ? 'name' AND NOT c.is_original) OR ((p_changes ? 'size' OR p_changes ? 'name')
        AND lower(description) = lower(btrim(concat_ws(' ', c.size, c.name))))
      THEN CASE WHEN next_size IS NOT NULL AND lower(left(next_name, length(next_size) + 1)) = lower(next_size || ' ')
        THEN next_name ELSE btrim(concat_ws(' ', next_size, next_name)) END
      WHEN p_changes ? 'size' AND lower(left(description, length(c.size) + 1)) = lower(c.size || ' ')
      THEN btrim(concat_ws(' ', next_size, substr(description, length(c.size) + 2)))
      ELSE description END
  WHERE id = c.id;
  -- An original is the customer's plant: its ask changes with it. A
  -- substitute leaves the requested size and name as asked.
  IF c.is_original AND (p_changes ? 'size' OR p_changes ? 'name') THEN
    UPDATE public.job_request_items SET
      size = CASE WHEN p_changes ? 'size' THEN next_size ELSE size END,
      name = CASE WHEN p_changes ? 'name' THEN next_name ELSE name END
    WHERE id = line.id;
  END IF;
  PERFORM set_config('lps.lps_override', '', true);
END $function$;

-- Until the default is asked, it follows the line's ask; once asked, the AR
-- snapshot is the supplier's. An Available default keeps its full quantity.
-- Its description follows by update_job_line's rule (already written when
-- update_job_line wrote this default itself).
CREATE OR REPLACE FUNCTION public.sync_job_line_default() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  UPDATE public.candidates SET
    name = CASE WHEN NEW.name IS DISTINCT FROM OLD.name THEN NEW.name ELSE name END,
    size = CASE WHEN NEW.size IS DISTINCT FROM OLD.size THEN NEW.size ELSE size END,
    description = CASE WHEN ROW(NEW.size, NEW.name) IS DISTINCT FROM ROW(OLD.size, OLD.name)
        AND lower(description) = lower(btrim(concat_ws(' ', size, name)))
      THEN CASE WHEN NEW.size IS NOT NULL AND lower(left(NEW.name, length(NEW.size) + 1)) = lower(NEW.size || ' ')
        THEN NEW.name ELSE btrim(concat_ws(' ', NEW.size, NEW.name)) END
      WHEN NEW.size IS DISTINCT FROM OLD.size AND size IS DISTINCT FROM NEW.size
        AND lower(left(description, length(size) + 1)) = lower(size || ' ')
      THEN btrim(concat_ws(' ', NEW.size, substr(description, length(size) + 2)))
      ELSE description END,
    demanded_quantity = CASE WHEN NEW.demanded_quantity IS DISTINCT FROM OLD.demanded_quantity
      THEN NEW.demanded_quantity ELSE demanded_quantity END,
    available_quantity = CASE WHEN status = 'available' AND NEW.demanded_quantity IS DISTINCT FROM OLD.demanded_quantity
      THEN NEW.demanded_quantity ELSE available_quantity END
  WHERE id = NEW.default_candidate_id AND availability_request_id IS NULL;
  RETURN NULL;
END $function$;

COMMENT ON VIEW public.job_lines IS
  'Job lines as quoted: the line''s ask plus its selected candidate''s values. Read-only; edit through update_job_line (values, and the shown size/name) and job_request_items (the ask).';
COMMIT;
