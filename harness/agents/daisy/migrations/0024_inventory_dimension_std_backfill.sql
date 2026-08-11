-- 0024: guarded standardized-dimension backfill (applied 2026-08-11).
--
-- Approved by Bhoumik Shah. The exact 94,297-row input is stored at:
--   artifacts/0024_inventory_dimension_std_backfill.csv.gz
-- SHA-256:
--   ee3e35c0252e67cebcf527ac153c307b21b26d2eed730df070a9d4d57c3a5c6b
--
-- The live apply used deterministic UUID-ordered guarded chunks after a single
-- 94k-row statement proved too large for this Supabase compute. Every chunk
-- required exact current height/width/caliper strings and all three std columns
-- NULL, suppressed the timestamp trigger transaction-locally, and asserted its
-- row/status/field counts before commit. The CSV uses \N for SQL NULL and
-- preserves one genuine empty caliper string. It is the replay/rollback source;
-- do not replace it with the rejected rounded/hidden-evidence artifact.
--
-- Semantics: std values derive only from the corresponding displayed field.
-- Human strings, size, timestamps, identity, source, price and quantity did not
-- change. Height is feet; width/caliper are inches; ranges use the lower bound;
-- explicit unit conversions retain float8 precision; ambiguous values are NULL.

-- Post-apply verification (safe to rerun):
WITH q AS (
  SELECT
    count(*) AS total,
    count(*) FILTER (WHERE is_active) AS active,
    count(*) FILTER (WHERE NOT is_active) AS inactive,
    count(*) FILTER (WHERE height_std IS NOT NULL) AS h,
    count(*) FILTER (WHERE width_std IS NOT NULL) AS w,
    count(*) FILTER (WHERE caliper_std IS NOT NULL) AS c,
    count(*) FILTER (WHERE height_std <= 0 OR width_std <= 0 OR caliper_std <= 0) AS nonpositive,
    md5(string_agg(md5((to_jsonb(i) - ARRAY['height_std','width_std','caliper_std'])::text), '' ORDER BY id)) AS outside_std_digest,
    md5(string_agg(md5((to_jsonb(i) - ARRAY['size','height','width','caliper','height_std','width_std','caliper_std'])::text), '' ORDER BY id)) AS outside_all_target_digest
  FROM public.inventory i
)
SELECT CASE WHEN total = 232837 AND active = 69540 AND inactive = 163297
  AND h = 75357 AND w = 40537 AND c = 22589 AND nonpositive = 0
  AND outside_std_digest = '2ce8e7a2e2e9764bc7ede1f723128c82'
  AND outside_all_target_digest = '8920860c8376c6c477ee70c631cd911e'
THEN 1 ELSE 1 / (random() * 0)::int END AS inventory_qa
FROM q;
