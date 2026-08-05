-- 0019_standardize_inventory_sizes.sql
--
-- Applies the SOP §2 size standard retroactively to legacy `inventory.size`.
--
-- `public.normalize_size(text)` has existed since the schema was written and
-- encodes exactly the SOP rule ("#15"/"15gal"/"15G" -> "15 G", "24 inch" -> 24",
-- "6ft" -> 6'), but nothing ever called it: no trigger, no generated column,
-- no default. So the standard only ever applied to whatever a parsing agent
-- remembered to do by hand, and the column drifted -- `1G` and `1 G` are two
-- values in the same table, 8,533 rows and 7,096 rows.
--
-- This is a SYNTACTIC pass only. It fixes unit spelling, spacing and leading
-- zeros. It does NOT touch what the column *carries*: qualifiers like
-- `; Bush`, `TRUE`, `NS`, `<24"`, `(6ct)` stay exactly where they are, and
-- height/caliper values sitting in `size` (`5-6'`, `2-2.5"`) are left alone.
-- Separating those is a semantic change that needs source review per SOP §5.
--
-- Every change is verifiable as spelling-only: the alphanumeric content of the
-- string is preserved except where a unit word collapses to its symbol
-- (`GAL` -> `G`, `Inch` -> `"`, `#` -> ` G`).

BEGIN;

-- ---------------------------------------------------------------- snapshot
-- The pass is a whole-column rewrite over 209,415 rows; keep the old values
-- until the change has settled. Drop this table then (see 0017 for precedent).
CREATE TABLE IF NOT EXISTS public.inventory_pre_size_normalization (
  id          uuid PRIMARY KEY,
  old_size    text,
  snapshot_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.inventory_pre_size_normalization (id, old_size)
SELECT id, size
FROM public.inventory
WHERE size IS NOT NULL
  AND normalize_size(size) IS DISTINCT FROM size
  -- Excluded: `#` means gallons per the SOP, but a *box* is sized in inches,
  -- so `#24 Box` -> `24 G Box` may be flat wrong. 12 rows, listed in NOTE.md,
  -- left verbatim for a human to read against the source.
  AND size !~* '#\s*[0-9.]+\s*(box|bag)'
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------- rewrite
UPDATE public.inventory i
SET size = normalize_size(i.size)
FROM public.inventory_pre_size_normalization s
WHERE i.id = s.id;

COMMIT;

-- ------------------------------------------------------------ verification
-- Run after commit; all four must hold.
--
-- 1. Nothing left to normalize outside the excluded box/bag set:
--    SELECT count(*) FROM inventory
--    WHERE size IS NOT NULL AND normalize_size(size) IS DISTINCT FROM size
--      AND size !~* '#\s*[0-9.]+\s*(box|bag)';                      -- expect 0
--
-- 2. No row lost its size:
--    SELECT count(*) FROM inventory i JOIN inventory_pre_size_normalization s
--    ON s.id = i.id WHERE i.size IS NULL;                           -- expect 0
--
-- 3. No alphanumeric content lost, other than the unit words that collapse
--    to symbols:
--    SELECT count(*) FROM inventory i JOIN inventory_pre_size_normalization s
--    ON s.id = i.id
--    WHERE regexp_replace(lower(s.old_size), '[^a-z0-9]', '', 'g')
--       IS DISTINCT FROM regexp_replace(lower(i.size), '[^a-z0-9]', '', 'g')
--      AND lower(s.old_size) !~ '(gal|gallons?|inch|inches|ft|feet|foot)'
--      AND s.old_size !~ '#';                                       -- expect 0
--
-- 4. Row counts unchanged:
--    SELECT count(*) FROM inventory;                          -- expect 209415
