-- 0026: exact-identity plant search and direct alias display.
-- Approved by Bhoumik (Telegram message 671), 2026-08-12.
-- Keeps the existing RPC signature. Removes reverse-hub sibling traversal,
-- derives Other names from direct reviewed edges only, and requires the least
-- common distinguishing token for multi-word identity searches.
-- Post-A baseline (0025): Muskogee word orders 442 rows / 30 suppliers /
-- 344 non-Muskogee identities; generic Crape Myrtle 592 / 37.
BEGIN;

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
                       WHERE ps.is_active AND ps.other_name_key = inv.name_key) y
              WHERE y.k <> inv.name_key
              ORDER BY y.k, y.v) x) AS other_names,
       inv.height_std, inv.width_std, inv.caliper_std
FROM public.inventory inv;
ALTER VIEW public.inventory_enriched SET (security_invoker = true);

CREATE OR REPLACE FUNCTION public.search_inventory(
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
  matched_keys text[] := '{}';
  trgm_ids uuid[] := '{}';
  query_words text[] := '{}';
  dir text := case when lower(coalesce(sort_direction, '')) = 'desc' then 'desc' else 'asc' end;
  col text := case sort_column
    when 'supplier_name'     then 'supplier_name'
    when 'supplier_category' then 'supplier_category'
    when 'supplier_state'    then 'supplier_state'
    when 'supplier_city'     then 'supplier_city'
    when 'name'         then 'name'
    when 'other_names'  then 'other_names'  -- output alias (derived column)
    when 'size'         then 'size'
    when 'unit_price'   then 'unit_price'
    when 'quantity'     then 'quantity'
    when 'height'       then 'height_std'
    when 'width'        then 'width_std'
    when 'caliper'      then 'caliper_std'
    when 'notes'        then 'notes'
    when 'source'       then 'source'
    when 'created_at'   then 'created_at'
    when 'updated_at'   then 'updated_at'
    else null
  end;
  order_extra text := case when col is null then '' else ', ' || col || ' ' || dir || ' nulls last' end;
begin
  if q <> '' then
    -- Only the two endpoints of directly matching, reviewed equivalence edges
    -- participate. Never traverse a reverse hub to sibling alternatives.
    matched_keys := array(
      select distinct k
      from public.plant_other_names ps
      cross join lateral (values (ps.name_key), (ps.other_name_key)) edge(k)
      where ps.is_active
        and (public.normalize_search_text(ps.name || ' ' || ps.other_name)
            &@~ pgroonga_condition(q, fuzzy_max_distance_ratio => fuzzy_ratio)
         or public.normalize_search_text(ps.name || ' ' || ps.other_name) &@~ q_star
         or ps.name_key = qkey
         or ps.other_name_key = qkey)
    ) || array[qkey]; -- rows whose own whole identity collapses to the query key

    -- Spelling variants pgroonga fuzzy can't reach (see 038 header).
    query_words := regexp_split_to_array(q, '[[:space:]]+');

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
    with raw as materialized (
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
               ) y
               where y.k <> inv.name_key
               order by y.k, y.v
             ) x
           ) as other_names,
             inv.size, inv.unit_price, inv.quantity, inv.supplier_id,
             inv.image_url, inv.notes, inv.height, inv.width, inv.caliper,
             inv.is_active, inv.source_id, src.file_path as source,
             inv.created_at, inv.updated_at, s.name as supplier_name,
             s.category as supplier_category, s.state as supplier_state,
             s.city as supplier_city, inv.height_std, inv.width_std,
             inv.caliper_std,
             case when $2 = '' then 0
                  else pgroonga_score(inv.tableoid, inv.ctid) end as relevance
      from inventory inv
      join suppliers s on s.id = inv.supplier_id
      left join inventory_sources src on src.id = inv.source_id
      where inv.is_active
        and (inv.source_id is null or src.is_active)
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
               coalesce(inv.caliper, '') || ' ' || coalesce(inv.notes, '')) &@~ $6
          or inv.name_key = any($4)
          or inv.id = any($5)
        )
    ), intent as (
      select w
      from unnest($13) w
      where length(w) >= 3
      order by (
        select count(*) from raw r
        where public.normalize_search_text(r.name || ' ' || coalesce(r.other_names, ''))
          &@~ pgroonga_condition(w, fuzzy_max_distance_ratio => 0.20)
      ), length(w) desc, w
      limit 1
    )
    select id,name,other_names,size,unit_price,quantity,supplier_id,image_url,
           notes,height,width,caliper,is_active,source_id,source,created_at,
           updated_at,supplier_name,supplier_category,supplier_state,supplier_city,
           height_std,width_std,caliper_std
    from raw r
    where cardinality($13) < 2
       or public.normalize_search_text(r.name || ' ' || coalesce(r.other_names, ''))
          &@~ pgroonga_condition((select w from intent), fuzzy_max_distance_ratio => 0.20)
    order by relevance desc%s, updated_at desc, name asc
  $q$, order_extra)
  using supplier_ids, q, fuzzy_ratio, matched_keys, trgm_ids, q_star,
        height_min, height_max, width_min, width_max, caliper_min, caliper_max,
        query_words;
end
$function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
