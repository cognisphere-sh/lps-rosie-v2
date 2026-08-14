-- 0043_dash_delimited_plant_name.sql
-- Applied 2026-08-14 via the Supabase MCP at Bhoumik's request.
--
-- `inventory.name` joins its three parts with ` - ` instead of wrapping the tail
-- in brackets:
--
--   before   Forest Pansy Redbud [Cercis canadensis, Forest Pansy]
--   after    Forest Pansy Redbud - Cercis canadensis - Forest Pansy
--
-- ONE SEPARATOR BETWEEN EVERY PART, not a dash replacing the bracket around a
-- still-comma-separated tail. The comma is no longer available as a part
-- separator: since 0041 `cultivar_variety_trade_name` is itself comma-separated
-- (`Wolff, Emperor 1`), so `Acer palmatum - Wolff, Emperor 1` has to mean
-- "botanical `Acer palmatum`, cultivar column `Wolff, Emperor 1`" and would be
-- unreadable if commas also divided the parts.
--
-- The dash is **spaced**, which is what keeps it distinguishable from the
-- hyphens inside real names — `KN30-8` and `Li'l Bang` have no spaces around
-- theirs. It is also how the trade prints it, and how Chris writes it
-- (`Crape Myrtle - 'Muskogee'`, the case 0035 called out).
--
-- SAFE FOR THE SAME REASON 0035 WAS, and this time by construction rather than
-- by audit. `normalize_plant_key()` keeps letters only, so the identity key is
-- byte-identical:
--   normalize_plant_key('… - Cercis canadensis - Forest Pansy')
--     = normalize_plant_key('… [Cercis canadensis, Forest Pansy]')   -> true
-- `normalize_search_text()` maps every punctuation character to a space, so the
-- two forms differ **only in the length of their whitespace runs** — the
-- normalized strings are not equal, but their token arrays are:
--   dash    'forest pansy redbud   cercis canadensis   forest pansy'
--   bracket 'forest pansy redbud  cercis canadensis  forest pansy '
--   regexp_split_to_array(btrim(…), '\s+') equal                    -> true
-- TokenDelimit ignores run length (0035 measured the same thing on 924 rows), so
-- no row's membership in any search result can change and neither the pgroonga
-- document nor its index needs a rebuild.
--
-- SCOPE: the function only. No row is rewritten — every existing row still has
-- NULL parts (0040/0041), so its `name` is untouched legacy text and the trigger
-- leaves it alone. The 7,691 rows 0035 rewrote to brackets keep those brackets;
-- they are re-ingested with the rest of the catalogue.

BEGIN;

CREATE OR REPLACE FUNCTION public.compose_plant_name(
  common_name text,
  botanical_name text,
  cultivar_variety_trade_name text
) RETURNS text
LANGUAGE sql IMMUTABLE AS $function$
  SELECT nullif(
           array_to_string(
             array_remove(ARRAY[
               nullif(btrim(coalesce(common_name, '')), ''),
               nullif(btrim(coalesce(botanical_name, '')), ''),
               nullif(btrim(coalesce(cultivar_variety_trade_name, '')), '')
             ], NULL),
             ' - '),
           '')
$function$;

COMMENT ON FUNCTION public.compose_plant_name(text, text, text) IS
  'The SOP plant-name format: the non-empty parts joined by " - ", in the order common, botanical, cultivar. NULL when all three are empty.';

NOTIFY pgrst, 'reload schema';
COMMIT;

-- ------------------------------------------------------------ post-apply --
--   compose_plant_name('Forest Pansy Redbud','Cercis canadensis','Forest Pansy')
--     -> 'Forest Pansy Redbud - Cercis canadensis - Forest Pansy'
--   compose_plant_name('Eastern Redbud','Cercis canadensis', NULL)
--     -> 'Eastern Redbud - Cercis canadensis'
--   compose_plant_name(NULL,'Acer palmatum','Wolff, Emperor 1')
--     -> 'Acer palmatum - Wolff, Emperor 1'
--   compose_plant_name(NULL,NULL,NULL) -> NULL
--   identity key byte-identical to the bracket form; token arrays equal,
--   normalized strings differing only in whitespace-run length (verified)
