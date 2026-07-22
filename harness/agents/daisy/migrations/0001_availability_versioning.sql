-- Daisy schema update — run once against project xyeyiqchadfszewztnrf.
-- Requires DDL privileges (Supabase SQL editor, or psql as postgres).
-- Daisy's own `query` script blocks DDL by design, so this is operator-run.
--
-- Changes:
--   1. rate_charts.common_name  -> common_names  (comma-separated list of names)
--   2. rate_charts.category      (new text col, backfilled from the section name)
--   3. rate_charts.is_active     (new flag; old rows are disabled on re-ingest)
--   4. drop rate_charts.section_id + the rate_chart_sections table
--
-- All existing rate_charts rows have a non-null section_id, so the category
-- backfill is total (no NULLs introduced). Idempotent where practical.

BEGIN;

-- 1. Rename common_name -> common_names. Data is already text and some rows
--    already hold comma-separated values (e.g. "Columbine, Granny's Bonnet"),
--    so no value transform is needed — a single name is a 1-element list.
ALTER TABLE public.rate_charts RENAME COLUMN common_name TO common_names;

-- 2. Category column, backfilled from the section each row points at.
ALTER TABLE public.rate_charts ADD COLUMN IF NOT EXISTS category text;
UPDATE public.rate_charts rc
SET    category = s.name
FROM   public.rate_chart_sections s
WHERE  rc.section_id = s.id
  AND  (rc.category IS DISTINCT FROM s.name);

-- 3. Versioning flag. Existing rows are the current active set.
ALTER TABLE public.rate_charts ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS rate_charts_supplier_active_idx
  ON public.rate_charts (supplier_id, is_active);

-- 4. Drop the sections linkage, then the table (dropping the column removes
--    the FK constraint first, so the table drop is unblocked).
ALTER TABLE public.rate_charts DROP COLUMN IF EXISTS section_id;
DROP TABLE IF EXISTS public.rate_chart_sections;

COMMIT;

-- Post-check (should return 0 rows with a null/empty category):
--   SELECT count(*) FROM public.rate_charts WHERE category IS NULL;
