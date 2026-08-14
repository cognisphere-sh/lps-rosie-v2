-- 0039_inventory_internal_notes.sql
--
-- Splits the two kinds of note that had been sharing `inventory.notes`.
--
--   notes           — what the SUPPLIER said about this offering in the
--                     availability data: their row description, availability
--                     status, lead time, "limited", "coming soon".
--   internal_notes  — what WE said about it: why a combined size was split,
--                     that a quantity is the supplier's shared/tentative count,
--                     a parse caveat, a QA exception, "price on request".
--
-- Additive and reversible-in-shape: one nullable column, no backfill, no data
-- touched. Existing `notes` content is left exactly as it is — it predates the
-- split and is a mix of both kinds; it is not reclassified here.
--
-- `inventory_enriched` is documented as "every inventory column plus derived
-- other_names", so the new column is appended to it (CREATE OR REPLACE VIEW
-- only permits additions at the end, which is what this is). `search_inventory`
-- is a curated projection with a fixed RETURNS TABLE and is deliberately NOT
-- changed here — internal notes are not search output.

BEGIN;

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS internal_notes text;

COMMENT ON COLUMN public.inventory.notes IS
  'Supplier-stated notes for this offering, taken from the availability data: '
  'their row description, availability status (dated), lead time, per-row '
  'qualifiers. Not for our own commentary — that is internal_notes.';

COMMENT ON COLUMN public.inventory.internal_notes IS
  'LPS-internal notes about this row: parse caveats, why a combined size was '
  'split, that a quantity is the supplier''s shared/tentative count, pricing '
  'unavailable/on request, QA exceptions. Append, do not clobber. Never '
  'supplier-stated text — that is notes.';

CREATE OR REPLACE VIEW public.inventory_enriched AS
 SELECT id,
    name,
    size,
    unit_price,
    created_at,
    updated_at,
    image_url,
    notes,
    height,
    width,
    caliper,
    supplier_id,
    is_active,
    source_id,
    quantity,
    name_key,
    ( SELECT string_agg(x.other_name, ', '::text ORDER BY x.other_name) AS string_agg
           FROM ( SELECT DISTINCT ON (y.k) y.v AS other_name
                   FROM ( SELECT ps.other_name_key AS k,
                            ps.other_name AS v
                           FROM plant_other_names ps
                          WHERE ps.is_active AND ps.name_key = inv.name_key
                        UNION ALL
                         SELECT ps.name_key,
                            ps.name
                           FROM plant_other_names ps
                          WHERE ps.is_active AND ps.other_name_key = inv.name_key) y
                  WHERE y.k <> inv.name_key
                  ORDER BY y.k, y.v) x) AS other_names,
    height_std,
    width_std,
    caliper_std,
    size_std,
    internal_notes
   FROM inventory inv;

COMMIT;
