-- 0012: keep missing values last in search_inventory sorting
-- Approved nullable-price follow-up, 2026-08-04.
-- Replaces the current function without changing its signature/search behavior.
-- NULLS LAST applies to every optional sort column in both directions.

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
