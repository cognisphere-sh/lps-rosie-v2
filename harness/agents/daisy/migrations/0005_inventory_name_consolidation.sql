-- 0005: consolidate plant identity into inventory.name; drop category + variety
-- Approved by Bhoumik Shah on 2026-07-31.
-- Applied 2026-07-31 as migrations 042* / 043* / 044 (split into small steps
-- because the guarded runner rejects large multi-statement DDL batches).
--
-- inventory.name now carries the whole identity as "Name [scientific, variant]".
-- inventory.category (the source's own grouping) is no longer tracked, and
-- inventory.variety is folded into the name.

-- 042: reversibility — every pre-change name/category/variety.
CREATE TABLE IF NOT EXISTS public.inventory_pre_name_consolidation AS
SELECT id, name AS old_name, category AS old_category, variety AS old_variety
FROM public.inventory;

-- 042b: one composed name per (printed name, variant) offering, for rows whose
-- name does not already contain their cultivar.
CREATE TABLE IF NOT EXISTS public.name_consolidation_map (
  base text NOT NULL,
  base_key text NOT NULL,
  variant text NOT NULL,
  sci text,
  new_name text NOT NULL,
  PRIMARY KEY (base, variant)
);

INSERT INTO public.name_consolidation_map (base, base_key, variant, sci, new_name)
SELECT d.base, d.name_key, d.variant, NULL, d.base || ' [' || d.variant || ']'
FROM (
  SELECT DISTINCT i.name AS base, i.name_key, btrim(i.variety) AS variant
  FROM public.inventory i
  WHERE i.variety IS NOT NULL AND btrim(i.variety) <> ''
    AND position(lower(btrim(i.variety)) in lower(i.name)) = 0
    AND i.name NOT LIKE '%[%'
) d
ON CONFLICT (base, variant) DO NOTHING;

-- 042c/042d: the scientific name is NOT backfilled. Deriving it from the
-- existing alias graph was tried and abandoned — it is too dirty to trust
-- ("Acer Palmatum" resolved to the cultivar "Oto hime", and hybrid names like
-- "Abelia x grandiflora" picked up a redundant "Abelia grandiflora"). Scientific
-- names are captured going forward, from the source, per the ingestion SOP.

-- 042e: appending the cultivar changes the generated name_key, which is what the
-- alias graph joins on, so each new name inherits up to three of its base name's
-- clean equivalents (botanicals first).
--
-- !! THIS STEP WAS WRONG AND IS RETIRED BY 0007. !!
-- It ran before the 0006 cleanup and its "clean" filter caught only quoted and
-- patent-marked cultivars, so unquoted compounds and sibling species were copied
-- onto cultivar rows. It became the largest single source of false positives.
-- Kept here only as the record of what was executed.
CREATE TEMP TABLE clean AS
SELECT a.name_key AS k, a.other_name AS alias FROM public.plant_other_names a
 WHERE a.is_active AND a.other_name NOT LIKE '%''%''%'
   AND a.other_name !~* '(pp\s*[0-9]+|pp\s*af|\mp[0-9]{4,}|[™®])'
UNION
SELECT a.other_name_key, a.name FROM public.plant_other_names a
 WHERE a.is_active AND a.name NOT LIKE '%''%''%'
   AND a.name !~* '(pp\s*[0-9]+|pp\s*af|\mp[0-9]{4,}|[™®])';

CREATE INDEX ON clean (k);

INSERT INTO public.plant_other_names (name, other_name)
SELECT r.new_name, r.alias
FROM (
  SELECT m.new_name, c.alias,
         row_number() OVER (PARTITION BY m.new_name
           ORDER BY (c.alias ~ '^[A-Z][a-z]+ x? ?[a-z]{3,}') DESC, length(c.alias)) AS rn
  FROM public.name_consolidation_map m
  JOIN clean c ON c.k = m.base_key
  WHERE public.normalize_plant_key(c.alias) <> public.normalize_plant_key(m.new_name)
) r
WHERE r.rn <= 3;

-- 042f: rewrite the names (101,678 rows).
UPDATE public.inventory i
SET name = m.new_name
FROM public.name_consolidation_map m
WHERE m.base = i.name
  AND m.variant = btrim(i.variety)
  AND i.variety IS NOT NULL AND btrim(i.variety) <> '';

-- 043a-d: the two search indexes and both views enumerate the doomed columns, so
-- they are rebuilt around the drop. CREATE OR REPLACE VIEW cannot remove a
-- column, hence the drop + recreate.
DROP INDEX IF EXISTS public.inventory_pgroonga_idx;
DROP INDEX IF EXISTS public.inventory_trgm_idx;

DROP VIEW public.rate_charts;
CREATE VIEW public.rate_charts AS
SELECT id, name, size, unit_price, created_at, updated_at, image_url, notes,
       height, width, caliper, supplier_id, is_active, source_id, quantity
FROM public.inventory;

DROP VIEW public.inventory_enriched;
CREATE VIEW public.inventory_enriched AS
SELECT id, name, size, unit_price, created_at, updated_at, image_url, notes,
       height, width, caliper, supplier_id, is_active, source_id, quantity, name_key,
  ( SELECT string_agg(x.other_name, ', '::text ORDER BY x.other_name) AS string_agg
      FROM ( SELECT DISTINCT ON (y.k) y.v AS other_name
               FROM ( SELECT ps.other_name_key AS k, ps.other_name AS v
                        FROM plant_other_names ps
                       WHERE ps.is_active AND ps.name_key = inv.name_key
                      UNION ALL
                      SELECT ps.name_key, ps.name
                        FROM plant_other_names ps
                       WHERE ps.is_active AND ps.other_name_key = inv.name_key
                      UNION ALL
                      SELECT sib.other_name_key, sib.other_name
                        FROM plant_other_names sib
                       WHERE sib.is_active AND sib.name_key IN (
                               SELECT ps.name_key FROM plant_other_names ps
                                WHERE ps.is_active AND ps.other_name_key = inv.name_key)) y
              WHERE y.k <> inv.name_key
              ORDER BY y.k, y.v) x) AS other_names
FROM public.inventory inv;

-- 043e
ALTER TABLE public.inventory
  DROP COLUMN category,
  DROP COLUMN variety;

-- 043f/g: rebuild both indexes over the new document expression. These must stay
-- byte-identical to search_inventory's concatenation or the planner skips them.
CREATE INDEX inventory_pgroonga_idx ON public.inventory
USING pgroonga (
  public.normalize_search_text(
    coalesce(name, '') || ' ' || coalesce(size, '') || ' ' ||
    coalesce(height, '') || ' ' || coalesce(width, '') || ' ' ||
    coalesce(caliper, '') || ' ' || coalesce(notes, ''))
) WITH (tokenizer='TokenDelimit');

CREATE INDEX inventory_trgm_idx ON public.inventory
USING gin (
  public.normalize_search_text(
    coalesce(name, '') || ' ' || coalesce(size, '') || ' ' ||
    coalesce(height, '') || ' ' || coalesce(width, '') || ' ' ||
    coalesce(caliper, '') || ' ' || coalesce(notes, ''))
  gin_trgm_ops);

-- 044: search_inventory loses category/variety from its document, its output and
-- its sort whitelist, and loses the category_filter parameter outright (the
-- column it filtered no longer exists). suppliers.category is untouched — it
-- still backs supplier_category and search_suppliers.
DROP FUNCTION IF EXISTS public.search_inventory(text, bigint[], text, real, text, text);

CREATE OR REPLACE FUNCTION public.search_inventory(search text DEFAULT ''::text, supplier_ids bigint[] DEFAULT NULL::bigint[], fuzzy_ratio real DEFAULT 0.34, sort_column text DEFAULT NULL::text, sort_direction text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name text, other_names text, size text, unit_price numeric, quantity numeric, supplier_id bigint, image_url text, notes text, height text, width text, caliper text, is_active boolean, source_id uuid, source text, created_at timestamp with time zone, updated_at timestamp with time zone, supplier_name text, supplier_category text, supplier_state text, supplier_city text)
 LANGUAGE plpgsql
 STABLE
AS $function$
declare
  q text := public.normalize_search_text(search);
  qkey text := public.normalize_plant_key(search); -- whole query as a name key
  q_star text := case
    when length(substring(btrim(q) from '[a-z0-9]*$')) >= 3
      then btrim(q) || '*' -- last token becomes a Groonga prefix search
    else q
  end;
  hub_keys text[] := '{}';
  matched_keys text[] := '{}';
  trgm_ids uuid[] := '{}';
  dir text := case when lower(coalesce(sort_direction, '')) = 'desc' then 'desc' else 'asc' end;
  col text := case sort_column
    when 'supplier_name'     then 's.name'
    when 'supplier_category' then 's.category'
    when 'supplier_state'    then 's.state'
    when 'supplier_city'     then 's.city'
    when 'name'         then 'inv.name'
    when 'other_names'  then 'other_names'  -- output alias (derived column)
    when 'size'         then 'inv.size'
    when 'unit_price'   then 'inv.unit_price'
    when 'quantity'     then 'inv.quantity'
    when 'height'       then 'inv.height'
    when 'width'        then 'inv.width'
    when 'caliper'      then 'inv.caliper'
    when 'notes'        then 'inv.notes'
    when 'source'       then 'src.file_path'
    when 'created_at'   then 'inv.created_at'
    when 'updated_at'   then 'inv.updated_at'
    else null
  end;
  order_extra text := case when col is null then '' else ', ' || col || ' ' || dir end;
begin
  if q <> '' then
    hub_keys := array(
      select distinct ps.name_key
      from public.plant_other_names ps
      where ps.is_active
        and (public.normalize_search_text(ps.name || ' ' || ps.other_name)
            &@~ pgroonga_condition(q, fuzzy_max_distance_ratio => fuzzy_ratio)
         or public.normalize_search_text(ps.name || ' ' || ps.other_name) &@~ q_star
         or ps.name_key = qkey
         or ps.other_name_key = qkey)
    );
    matched_keys := hub_keys
      || array(
           select distinct ps.other_name_key
           from public.plant_other_names ps
           where ps.is_active
             and (public.normalize_search_text(ps.name || ' ' || ps.other_name)
                 &@~ pgroonga_condition(q, fuzzy_max_distance_ratio => fuzzy_ratio)
              or public.normalize_search_text(ps.name || ' ' || ps.other_name) &@~ q_star
              or ps.name_key = qkey
              or ps.other_name_key = qkey)
         )
      || array(
           select distinct sib.other_name_key
           from public.plant_other_names sib
           where sib.is_active and sib.name_key = any(hub_keys)
         )
      || array[qkey]; -- rows whose own name collapses to the query key

    -- Spelling variants pgroonga fuzzy can't reach (see 038 header).
    trgm_ids := array(
      select inv.id
      from public.inventory inv
      where q <% public.normalize_search_text(
              coalesce(inv.name, '') || ' ' || coalesce(inv.size, '') || ' ' ||
              coalesce(inv.height, '') || ' ' || coalesce(inv.width, '') || ' ' ||
              coalesce(inv.caliper, '') || ' ' || coalesce(inv.notes, ''))
        and public.normalize_search_text(
              coalesce(inv.name, '') || ' ' || coalesce(inv.size, '') || ' ' ||
              coalesce(inv.height, '') || ' ' || coalesce(inv.width, '') || ' ' ||
              coalesce(inv.caliper, '') || ' ' || coalesce(inv.notes, ''))
            not like '%' || q || '%'
      limit 10000 -- ponytail: safety cap; unordered, raise if ever hit legitimately
    );
  end if;

  return query execute format($q$
    select inv.id, inv.name,
           (
             select string_agg(x.other_name, ', ' order by x.other_name)
             from (
               select distinct on (y.k) y.v as other_name
               from (
                 select ps.other_name_key as k, ps.other_name as v
                 from public.plant_other_names ps where ps.is_active and ps.name_key = inv.name_key
                 union all
                 select ps.name_key, ps.name
                 from public.plant_other_names ps where ps.is_active and ps.other_name_key = inv.name_key
                 union all
                 select sib.other_name_key, sib.other_name
                 from public.plant_other_names sib
                 where sib.is_active and sib.name_key in (
                   select ps.name_key from public.plant_other_names ps
                   where ps.is_active and ps.other_name_key = inv.name_key
                 )
               ) y
               where y.k <> inv.name_key
               order by y.k, y.v
             ) x
           ) as other_names,
           inv.size, inv.unit_price,
           inv.quantity, inv.supplier_id, inv.image_url, inv.notes,
           inv.height, inv.width, inv.caliper, inv.is_active,
           inv.source_id, src.file_path as source, inv.created_at, inv.updated_at,
           s.name as supplier_name,
           s.category as supplier_category, s.state as supplier_state, s.city as supplier_city
    from inventory inv
    join suppliers s on s.id = inv.supplier_id
    left join inventory_sources src on src.id = inv.source_id
    where inv.is_active
      and (inv.source_id is null or src.is_active)  -- active or manual sources only
      and ($1 is null or inv.supplier_id = any($1))
      and (
        $2 = ''
        or public.normalize_search_text(
             coalesce(inv.name, '') || ' ' || coalesce(inv.size, '') || ' ' ||
             coalesce(inv.height, '') || ' ' || coalesce(inv.width, '') || ' ' ||
             coalesce(inv.caliper, '') || ' ' || coalesce(inv.notes, ''))
           &@~ pgroonga_condition($2, fuzzy_max_distance_ratio => $3)
        or public.normalize_search_text(
             coalesce(inv.name, '') || ' ' || coalesce(inv.size, '') || ' ' ||
             coalesce(inv.height, '') || ' ' || coalesce(inv.width, '') || ' ' ||
             coalesce(inv.caliper, '') || ' ' || coalesce(inv.notes, ''))
           &@~ $6
        or inv.name_key = any($4)
        or inv.id = any($5)
      )
    order by
      case when $2 = '' then 0
           else pgroonga_score(inv.tableoid, inv.ctid) end desc%s,
      inv.updated_at desc,
      inv.name asc
  $q$, order_extra)
  using supplier_ids, q, fuzzy_ratio, matched_keys, trgm_ids, q_star;
end
$function$;
