-- 0006: retire cultivar / trade-name aliases that cause search false positives
-- Approved by Bhoumik Shah on 2026-07-31.
-- Applied 2026-07-31 as migrations 045a / 045b / 045c.
--
-- Under the revised model an alias exists only so search finds a row by another
-- name the same plant is known by (common name, scientific name, synonym,
-- spelling variant). A pair naming a cultivar or a patented/trademarked
-- selection links a species to one of its selections, which makes every sibling
-- cultivar match every other one. The cultivar itself stays searchable — it now
-- lives directly in inventory.name.
--
-- Deactivates rather than deletes: inactive pairs stay as history and power
-- neither search nor display (see 0004).

-- 045a: an explicit cultivar epithet in quotes, or a patent / trademark marker.
UPDATE public.plant_other_names
SET is_active = false
WHERE is_active
  AND (
    name LIKE '%''%''%' OR other_name LIKE '%''%''%'
    OR name ~* '(pp\s*[0-9]+|pp\s*af|\mp[0-9]{4,}|[™®])'
    OR other_name ~* '(pp\s*[0-9]+|pp\s*af|\mp[0-9]{4,}|[™®])'
  );

-- 045b: pairs where one whole side is a cultivar epithet seen in quotes
-- elsewhere in the table (e.g. "Hemerocallis" <-> "Stella De Oro").
--
-- Two deliberate guards:
--   * only multi-word epithets, because single words like "Gala", "Mango" or
--     "Plum" are just as often a legitimate common name;
--   * matching on a space-preserving normalization, not normalize_plant_key,
--     which strips spaces and would let the holly cultivar "Ilex x 'Oak Leaf'"
--     collapse to "oakleaf" and kill the genuine "Hydrangea quercifolia" <->
--     "Oakleaf" pair.
CREATE TEMP TABLE ep AS
WITH raw AS (
  SELECT substring(name from '''([A-Za-z][^'']*)''') AS e
    FROM public.plant_other_names WHERE name LIKE '%''%''%'
  UNION ALL
  SELECT substring(other_name from '''([A-Za-z][^'']*)''')
    FROM public.plant_other_names WHERE other_name LIKE '%''%''%'
)
SELECT DISTINCT btrim(regexp_replace(public.normalize_search_text(e), '\s+', ' ', 'g')) AS t
FROM raw
WHERE e LIKE '% %';

UPDATE public.plant_other_names p
SET is_active = false
WHERE p.is_active
  AND (
    btrim(regexp_replace(public.normalize_search_text(p.name), '\s+', ' ', 'g')) IN (SELECT t FROM ep)
    OR btrim(regexp_replace(public.normalize_search_text(p.other_name), '\s+', ' ', 'g')) IN (SELECT t FROM ep)
  );

-- 045c: the same epithets as a *prefix* to a head noun — "Autumn Blaze Maple",
-- "Rose Creek Abelia", "Forest Pansy Redbud". Linking these marketing names to
-- the bare species is what let a Forest Pansy search reach a Merlot row.
-- Matched on leading words, so only a cultivar prefix counts, never a chance
-- word appearing later in a genuine common name.
CREATE INDEX ON ep (t);

CREATE TEMP TABLE cand AS
SELECT p.id,
  string_to_array(btrim(regexp_replace(public.normalize_search_text(p.name), '\s+',' ','g')), ' ') AS nw,
  string_to_array(btrim(regexp_replace(public.normalize_search_text(p.other_name), '\s+',' ','g')), ' ') AS ow
FROM public.plant_other_names p WHERE p.is_active;

UPDATE public.plant_other_names p
SET is_active = false
FROM cand c
WHERE p.id = c.id
  AND (
       (array_length(c.ow,1) > 2 AND array_to_string(c.ow[1:2],' ') IN (SELECT t FROM ep))
    OR (array_length(c.ow,1) > 3 AND array_to_string(c.ow[1:3],' ') IN (SELECT t FROM ep))
    OR (array_length(c.nw,1) > 2 AND array_to_string(c.nw[1:2],' ') IN (SELECT t FROM ep))
    OR (array_length(c.nw,1) > 3 AND array_to_string(c.nw[1:3],' ') IN (SELECT t FROM ep))
  );
