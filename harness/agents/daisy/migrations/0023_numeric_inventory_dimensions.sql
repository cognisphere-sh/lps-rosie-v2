-- 0023: standard numeric inventory dimensions and server-backed range filters.
-- Approved by Bhoumik Shah 2026-08-11. Human-readable source strings remain in
-- height/width/caliper; nullable float8 companions power filtering and sorting.
-- height_std is feet; width_std and caliper_std are inches. A later guarded
-- backfill uses the approved lower bound for ranges and preserves source text.

BEGIN;

ALTER TABLE public.inventory
  ADD COLUMN height_std double precision,
  ADD COLUMN width_std double precision,
  ADD COLUMN caliper_std double precision;

COMMENT ON COLUMN public.inventory.height_std IS
  'Standardized height in feet; lower bound for ranges; NULL when unknown or ambiguous.';
COMMENT ON COLUMN public.inventory.width_std IS
  'Standardized width in inches; lower bound for ranges; NULL when unknown or ambiguous.';
COMMENT ON COLUMN public.inventory.caliper_std IS
  'Standardized caliper in inches; lower bound for ranges; NULL when unknown or ambiguous.';

CREATE OR REPLACE VIEW public.rate_charts AS
SELECT id, name, size, unit_price, created_at, updated_at, image_url, notes,
       height, width, caliper, supplier_id, is_active, source_id, quantity,
       height_std, width_std, caliper_std
FROM public.inventory;
ALTER VIEW public.rate_charts SET (security_invoker = true);

CREATE OR REPLACE VIEW public.inventory_enriched AS
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
              ORDER BY y.k, y.v) x) AS other_names,
       inv.height_std, inv.width_std, inv.caliper_std
FROM public.inventory inv;
ALTER VIEW public.inventory_enriched SET (security_invoker = true);

CREATE INDEX inventory_supplier_height_std_idx
  ON public.inventory (supplier_id, height_std)
  WHERE is_active AND height_std IS NOT NULL;
CREATE INDEX inventory_supplier_width_std_idx
  ON public.inventory (supplier_id, width_std)
  WHERE is_active AND width_std IS NOT NULL;
CREATE INDEX inventory_supplier_caliper_std_idx
  ON public.inventory (supplier_id, caliper_std)
  WHERE is_active AND caliper_std IS NOT NULL;

DROP FUNCTION public.search_inventory(text, bigint[], real, text, text);

CREATE FUNCTION public.search_inventory(
  search text DEFAULT ''::text,
  supplier_ids bigint[] DEFAULT NULL::bigint[],
  fuzzy_ratio real DEFAULT 0.34,
  sort_column text DEFAULT NULL::text,
  sort_direction text DEFAULT NULL::text,
  height_min double precision DEFAULT NULL,
  height_max double precision DEFAULT NULL,
  width_min double precision DEFAULT NULL,
  width_max double precision DEFAULT NULL,
  caliper_min double precision DEFAULT NULL,
  caliper_max double precision DEFAULT NULL
)
 RETURNS TABLE(id uuid, name text, other_names text, size text, unit_price numeric, quantity numeric, supplier_id bigint, image_url text, notes text, height text, width text, caliper text, is_active boolean, source_id uuid, source text, created_at timestamp with time zone, updated_at timestamp with time zone, supplier_name text, supplier_category text, supplier_state text, supplier_city text, height_std double precision, width_std double precision, caliper_std double precision)
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
    when 'height'       then 'inv.height_std'
    when 'width'        then 'inv.width_std'
    when 'caliper'      then 'inv.caliper_std'
    when 'notes'        then 'inv.notes'
    when 'source'       then 'src.file_path'
    when 'created_at'   then 'inv.created_at'
    when 'updated_at'   then 'inv.updated_at'
    else null
  end;
  order_extra text := case when col is null then '' else ', ' || col || ' ' || dir || ' nulls last' end;
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
           s.category as supplier_category, s.state as supplier_state, s.city as supplier_city,
           inv.height_std, inv.width_std, inv.caliper_std
    from inventory inv
    join suppliers s on s.id = inv.supplier_id
    left join inventory_sources src on src.id = inv.source_id
    where inv.is_active
      and (inv.source_id is null or src.is_active)  -- active or manual sources only
      and ($1 is null or inv.supplier_id = any($1))
      and ($7 is null or inv.height_std >= $7)
      and ($8 is null or inv.height_std <= $8)
      and ($9 is null or inv.width_std >= $9)
      and ($10 is null or inv.width_std <= $10)
      and ($11 is null or inv.caliper_std >= $11)
      and ($12 is null or inv.caliper_std <= $12)
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
  using supplier_ids, q, fuzzy_ratio, matched_keys, trgm_ids, q_star,
        height_min, height_max, width_min, width_max, caliper_min, caliper_max;
end
$function$;

NOTIFY pgrst, 'reload schema';

COMMIT;
