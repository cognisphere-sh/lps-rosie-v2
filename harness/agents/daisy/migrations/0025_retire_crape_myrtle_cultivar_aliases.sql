-- Approved by Bhoumik (Telegram message 671), 2026-08-12 04:39 CDT.
-- Applied as migration 0025. Exact rollback is commented at bottom.
BEGIN;

-- Serialize focal rows and fail closed unless all exact 66 remain active.
SELECT id FROM public.plant_other_names
WHERE id IN (
 6571,12983,13002,13004,13005,13006,13007,13009,13010,13014,13015,
 13016,13017,13019,13021,13025,13026,13027,13028,27008,13043,13044,
 13029,13045,13048,13031,13032,13034,13052,13035,13036,13037,27012,
 13023,13022,13060,13061,13062,13064,13068,13071,13072,13082,13083,
 13086,13088,13090,13091,13092,13096,13099,26595,13101,13103,13104,
 13105,13106,13107,13111,13112,13115,12953,13169,13204,13205,13225
) FOR UPDATE;

WITH target(id) AS (VALUES
 (6571),(12983),(13002),(13004),(13005),(13006),(13007),(13009),(13010),
 (13014),(13015),(13016),(13017),(13019),(13021),(13025),(13026),(13027),
 (13028),(27008),(13043),(13044),(13029),(13045),(13048),(13031),(13032),
 (13034),(13052),(13035),(13036),(13037),(27012),(13023),(13022),(13060),
 (13061),(13062),(13064),(13068),(13071),(13072),(13082),(13083),(13086),
 (13088),(13090),(13091),(13092),(13096),(13099),(26595),(13101),(13103),
 (13104),(13105),(13106),(13107),(13111),(13112),(13115),(12953),(13169),
 (13204),(13205),(13225)
), guard AS (
 SELECT 1 / ((count(*) FILTER (WHERE p.is_active))::integer / 66)
          / ((SELECT is_active::integer FROM public.plant_other_names WHERE id=13059)) AS ok
 FROM target t
 JOIN public.plant_other_names p USING(id)
), updated AS (
 UPDATE public.plant_other_names p SET is_active=false
 FROM target t,guard g WHERE p.id=t.id AND p.is_active AND g.ok=1
 RETURNING p.id,p.name,p.other_name,p.is_active
)
SELECT count(*) updated_count,
 (count(*)=66) AS exact_count_guard,
 md5(string_agg(id::text,',' ORDER BY id)) updated_id_digest
FROM updated;

COMMIT;

-- Exact contingency rollback, only with separate explicit approval:
-- UPDATE public.plant_other_names SET is_active=true
-- WHERE NOT is_active AND id IN (
-- 6571,12983,13002,13004,13005,13006,13007,13009,13010,13014,13015,
-- 13016,13017,13019,13021,13025,13026,13027,13028,27008,13043,13044,
-- 13029,13045,13048,13031,13032,13034,13052,13035,13036,13037,27012,
-- 13023,13022,13060,13061,13062,13064,13068,13071,13072,13082,13083,
-- 13086,13088,13090,13091,13092,13096,13099,26595,13101,13103,13104,
-- 13105,13106,13107,13111,13112,13115,12953,13169,13204,13205,13225);
