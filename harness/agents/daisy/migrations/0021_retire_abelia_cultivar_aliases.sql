-- 0021: retire exact Abelia sibling-cultivar aliases.
-- Applied 2026-08-11 with explicit Bhoumik approval after a read-only focal audit.
-- Audit: workspace/threads/main/abelia-alias-audit/report.md
--
-- The bare Abelia x grandiflora / Abelia grandiflora hubs were linked to
-- Francis Mason, Rose Creek, Edward Goucher, Kaleidoscope and other selections,
-- making sibling cultivar searches return one another. ID 60 was the adjective
-- fragment "Glossy", not the supported common name "Glossy Abelia".
--
-- Preserve legitimate same-plant mappings:
--   21     Abelia × grandiflora <-> Glossy Abelia
--   50     Abelia x grandiflora <-> Abelia grandiflora
--   61     Abelia x grandiflora <-> Glossy Abelia
--   26846  Abelia x Grandiflora <-> ABELIA, GLOSSY
--
-- Applied update returned exactly 15 rows. No inventory row was changed.
UPDATE public.plant_other_names
SET is_active = false
WHERE is_active
  AND id IN (19,48,49,51,54,59,60,63,67,68,69,74,79,26845,26848);

-- Exact contingency rollback only if separately approved:
-- UPDATE public.plant_other_names
-- SET is_active = true
-- WHERE NOT is_active
--   AND id IN (19,48,49,51,54,59,60,63,67,68,69,74,79,26845,26848);
