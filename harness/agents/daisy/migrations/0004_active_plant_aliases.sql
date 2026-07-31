-- 0004: active/inactive plant aliases and cultivar false-positive cleanup
-- Approved by Bhoumik Shah on 2026-07-30.
-- Apply manually: Daisy's guarded query runner intentionally blocks ALTER TABLE.

BEGIN;

ALTER TABLE public.plant_other_names
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- The broad Cercis canadensis hub connected every redbud cultivar to every
-- sibling cultivar. Keep only genuine species-level common-name equivalents.
UPDATE public.plant_other_names
SET is_active = false
WHERE name_key = public.normalize_plant_key('Cercis canadensis')
  AND other_name_key NOT IN (
    public.normalize_plant_key('Redbud'),
    public.normalize_plant_key('Eastern Redbud'),
    public.normalize_plant_key('Redbud Eastern')
  );

-- Cultivar-only alias pairs are not aliases under the revised model. The
-- cultivar remains directly searchable in inventory.name / inventory.variety.
UPDATE public.plant_other_names
SET is_active = false
WHERE (
    name_key IN (
      public.normalize_plant_key('Forest Pansy'),
      public.normalize_plant_key('Forest Pansy Redbud'),
      public.normalize_plant_key('Cercis Can Forest Pansy'),
      public.normalize_plant_key('Merlot'),
      public.normalize_plant_key('Merlot Redbud'),
      public.normalize_plant_key('Cercis canadensis Merlot'),
      public.normalize_plant_key('Ruby Falls'),
      public.normalize_plant_key('Ruby Falls Redbud'),
      public.normalize_plant_key('Cercis canadensis Ruby Falls'),
      public.normalize_plant_key('Traveller'),
      public.normalize_plant_key('Traveller Redbud'),
      public.normalize_plant_key('Texas White'),
      public.normalize_plant_key('Cercis canadensis Texas White')
    )
    OR other_name_key IN (
      public.normalize_plant_key('Forest Pansy'),
      public.normalize_plant_key('Merlot'),
      public.normalize_plant_key('Ruby Falls'),
      public.normalize_plant_key('Traveller'),
      public.normalize_plant_key('Texas White')
    )
  )
  AND (
    lower(name) LIKE '%redbud%'
    OR lower(other_name) LIKE '%redbud%'
    OR lower(name) LIKE 'cercis%'
    OR lower(other_name) LIKE 'cercis%'
  );

CREATE OR REPLACE FUNCTION public.search_inventory(search text DEFAULT ''::text, supplier_ids bigint[] DEFAULT NULL::bigint[], category_filter text DEFAULT NULL::text, fuzzy_ratio real DEFAULT 0.34, sort_column text DEFAULT NULL::text, sort_direction text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, name text, other_names text, category text, size text, unit_price numeric, quantity numeric, supplier_id bigint, image_url text, notes text, variety text, height text, width text, caliper text, is_active boolean, source_id uuid, source text, created_at timestamp with time zone, updated_at timestamp with time zone, supplier_name text, supplier_category text, supplier_state text, supplier_city text)
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
    when 'category'     then 'inv.category'
    when 'size'         then 'inv.size'
    when 'unit_price'   then 'inv.unit_price'
    when 'quantity'     then 'inv.quantity'
    when 'height'       then 'inv.height'
    when 'width'        then 'inv.width'
    when 'caliper'      then 'inv.caliper'
    when 'variety'      then 'inv.variety'
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
              coalesce(inv.name, '') || ' ' || coalesce(inv.category, '') || ' ' ||
              coalesce(inv.variety, '') || ' ' || coalesce(inv.size, '') || ' ' ||
              coalesce(inv.height, '') || ' ' || coalesce(inv.width, '') || ' ' ||
              coalesce(inv.caliper, '') || ' ' || coalesce(inv.notes, ''))
        and public.normalize_search_text(
              coalesce(inv.name, '') || ' ' || coalesce(inv.category, '') || ' ' ||
              coalesce(inv.variety, '') || ' ' || coalesce(inv.size, '') || ' ' ||
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
           inv.category, inv.size, inv.unit_price,
           inv.quantity, inv.supplier_id, inv.image_url, inv.notes, inv.variety,
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
      and ($2 is null or inv.category = $2)
      and (
        $3 = ''
        or public.normalize_search_text(
             coalesce(inv.name, '') || ' ' || coalesce(inv.category, '') || ' ' ||
             coalesce(inv.variety, '') || ' ' || coalesce(inv.size, '') || ' ' ||
             coalesce(inv.height, '') || ' ' || coalesce(inv.width, '') || ' ' ||
             coalesce(inv.caliper, '') || ' ' || coalesce(inv.notes, ''))
           &@~ pgroonga_condition($3, fuzzy_max_distance_ratio => $4)
        or public.normalize_search_text(
             coalesce(inv.name, '') || ' ' || coalesce(inv.category, '') || ' ' ||
             coalesce(inv.variety, '') || ' ' || coalesce(inv.size, '') || ' ' ||
             coalesce(inv.height, '') || ' ' || coalesce(inv.width, '') || ' ' ||
             coalesce(inv.caliper, '') || ' ' || coalesce(inv.notes, ''))
           &@~ $7
        or inv.name_key = any($5)
        or inv.id = any($6)
      )
    order by
      case when $3 = '' then 0
           else pgroonga_score(inv.tableoid, inv.ctid) end desc%s,
      inv.updated_at desc,
      inv.name asc
  $q$, order_extra)
  using supplier_ids, category_filter, q, fuzzy_ratio, matched_keys, trgm_ids, q_star;
end
$function$
;

COMMIT;
