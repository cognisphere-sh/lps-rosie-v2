-- 0056_job_request_item_available_quantity.sql
-- Applied 2026-08-17 via the Supabase MCP at Bhoumik's request, one step
-- recorded in the Supabase history as `job_request_item_available_quantity`.
--
-- One column: `job_request_items.available_quantity`.
--
-- WHY. The Order Requests design (Claude Design project ebbc6644-…) gives every
-- line item two quantity columns — **Demand** (what the customer asked for) and
-- **Avail** (how many we can actually supply) — and derives the whole "Partial"
-- state from the gap between them: green when avail covers demand, amber when it
-- is short, red at zero, and a dash while nobody has answered yet. 0055 shipped
-- only `quantity`, so that column had no data behind it.
--
-- SEMANTICS, matching the design's own reading:
--   NULL  = not yet answered. Rendered as "—", never as zero.
--   0     = asked and confirmed unavailable.
--   < quantity = partial cover; the UI derives the "Partial" pill from this
--                rather than from a status value, so the two can never disagree.
-- It is deliberately NOT constrained against `quantity`: a supplier offering
-- more than was asked is real, and clamping it would lose that.
--
-- The item `status` stays the human judgement (`available`,
-- `alternative_proposed`, …) and this stays the number. Nothing derives one from
-- the other in the database — the UI reads both.

ALTER TABLE public.job_request_items
  ADD COLUMN IF NOT EXISTS available_quantity numeric
    CONSTRAINT job_request_items_available_quantity_check
    CHECK (available_quantity IS NULL OR available_quantity >= 0);

COMMENT ON COLUMN public.job_request_items.available_quantity IS
  'How many we can actually supply. NULL = not yet answered (renders as a dash, never zero); 0 = confirmed unavailable; below quantity = partial cover, which is where the UI''s "Partial" pill comes from. Not clamped to quantity — a supplier may offer more than was asked.';

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------ post-apply --
-- Verified 2026-08-17: column present and nullable; a negative value is
-- rejected by the CHECK; NULL, 0 and a value above `quantity` all accepted;
-- an UPDATE of it writes one `job_request_changelog` row naming only
-- `available_quantity` (the 0055 trigger picks the new column up with no
-- change, since it diffs `to_jsonb(NEW)` rather than a column list).
