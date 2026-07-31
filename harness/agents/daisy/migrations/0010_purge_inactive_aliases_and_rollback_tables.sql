-- 0010: purge retired alias pairs and the 0005 rollback scaffolding
-- Applied 2026-07-31 as migrations 051 / 052. Approved by Bhoumik.
--
-- Deletes the 78,807 pairs the 0004-0009 cleanups had retired, keeping the
-- 13,429 active ones, and drops the two rollback tables.
--
-- !! TWO IRREVERSIBLE CONSEQUENCES — read before adding more cleanup. !!
--
-- 1. Tombstones are gone. dedupe_plant_other_names() rejects an INSERT whose
--    (name_key, other_name_key) already exists REGARDLESS of is_active, so the
--    soft-deleted rows were silently acting as a blocklist: a retired cultivar
--    alias physically could not be re-inserted. That protection no longer
--    exists. The ingestion SOP's alias quality bar is now the ONLY thing
--    keeping cultivar, generic and junk aliases out. If they start recurring,
--    add a dedicated blocklist table of retired (name_key, other_name_key)
--    pairs and extend the trigger — do NOT reintroduce soft-deleted rows.
--
-- 2. The name consolidation can no longer be rolled back, and the 359 distinct
--    inventory.category values from the source files exist nowhere in the
--    database. Recovering a row's printed common-first identity requires
--    reparsing the supplier source.
--
-- Verified unchanged afterwards: Forest Pansy 45/0, Ruby Falls 46/0,
-- Merlot Redbud 12/0 alias, Texas Redbud 57, Loblolly Pine 59,
-- Giant sequoia 30. 73,395 active inventory rows.

DELETE FROM public.plant_other_names WHERE NOT is_active;

DROP TABLE IF EXISTS public.inventory_pre_name_consolidation;
DROP TABLE IF EXISTS public.name_consolidation_map;
