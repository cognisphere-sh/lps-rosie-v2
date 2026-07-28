-- 040_search_prefix_match
--
-- Fix: word-prefix searches returned nothing ("Mexican Sycamor" → 0 rows,
-- "Mexican Sycamore" → 17). The pgroonga index (TokenDelimit) matches whole
-- tokens; its indexed fuzzy path tolerates edits at the *start* of a token
-- ("ycamore" works) but not at the end, and the 038 trgm fallback explicitly
-- excludes queries that appear as a substring of the document — which every
-- word-prefix query does. So prefixes of words fell between both branches.
--
-- Fix: build q_star — the normalized query with a Groonga prefix wildcard
-- ('*') appended to the last token when that token is ≥ 3 chars (shorter
-- tokens fall back to the plain query to avoid exploding matches on e.g.
-- "15 g") — and OR it into the pgroonga conditions of search_inventory
-- (document + alias-graph subqueries) and search_suppliers. Prefix search
-- resolves through the pgroonga lexicon, so it only works via the index —
-- plans confirmed to stay BitmapOr on the pgroonga indexes.

create or replace function public.search_inventory(search text default ''::text, supplier_ids bigint[] default null::bigint[], category_filter text default null::text, fuzzy_ratio real default 0.34, sort_column text default null::text, sort_direction text default null::text)
 returns table(id uuid, name text, other_names text, category text, size text, unit_price numeric, quantity numeric, supplier_id bigint, image_url text, notes text, variety text, height text, width text, caliper text, is_active boolean, source_id uuid, source text, created_at timestamp with time zone, updated_at timestamp with time zone, supplier_name text, supplier_category text, supplier_state text, supplier_city text)
 language plpgsql
 stable
as $function$
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
      where public.normalize_search_text(ps.name || ' ' || ps.other_name)
            &@~ pgroonga_condition(q, fuzzy_max_distance_ratio => fuzzy_ratio)
         or public.normalize_search_text(ps.name || ' ' || ps.other_name) &@~ q_star
         or ps.name_key = qkey
         or ps.other_name_key = qkey
    );
    matched_keys := hub_keys
      || array(
           select distinct ps.other_name_key
           from public.plant_other_names ps
           where public.normalize_search_text(ps.name || ' ' || ps.other_name)
                 &@~ pgroonga_condition(q, fuzzy_max_distance_ratio => fuzzy_ratio)
              or public.normalize_search_text(ps.name || ' ' || ps.other_name) &@~ q_star
              or ps.name_key = qkey
              or ps.other_name_key = qkey
         )
      || array(
           select distinct sib.other_name_key
           from public.plant_other_names sib
           where sib.name_key = any(hub_keys)
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
                 from public.plant_other_names ps where ps.name_key = inv.name_key
                 union all
                 select ps.name_key, ps.name
                 from public.plant_other_names ps where ps.other_name_key = inv.name_key
                 union all
                 select sib.other_name_key, sib.other_name
                 from public.plant_other_names sib
                 where sib.name_key in (
                   select ps.name_key from public.plant_other_names ps
                   where ps.other_name_key = inv.name_key
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
$function$;

create or replace function public.search_suppliers(search text default ''::text, category_filter text default null::text, fuzzy_ratio real default 0.34, sort_column text default null::text, sort_direction text default null::text)
 returns table(id bigint, name text, address text, city text, state text, zip text, phone text, email text, poc_name text, poc_email text, poc_phone text, website text, latitude double precision, longitude double precision, notes text, category text, created_at timestamp with time zone, updated_at timestamp with time zone)
 language plpgsql
 stable
as $function$
declare
  q text := public.normalize_search_text(search);
  q_star text := case
    when length(substring(btrim(q) from '[a-z0-9]*$')) >= 3
      then btrim(q) || '*' -- last token becomes a Groonga prefix search
    else q
  end;
  trgm_ids bigint[] := '{}';
  dir text := case when lower(coalesce(sort_direction, '')) = 'desc' then 'desc' else 'asc' end;
  col text := case sort_column
    when 'name'       then 's.name'
    when 'category'   then 's.category'
    when 'poc_name'   then 's.poc_name'
    when 'poc_email'  then 's.poc_email'
    when 'poc_phone'  then 's.poc_phone'
    when 'website'    then 's.website'
    when 'email'      then 's.email'
    when 'phone'      then 's.phone'
    when 'address'    then 's.address'
    when 'city'       then 's.city'
    when 'state'      then 's.state'
    when 'zip'        then 's.zip'
    when 'notes'      then 's.notes'
    when 'created_at' then 's.created_at'
    when 'updated_at' then 's.updated_at'
    else null
  end;
  order_extra text := case when col is null then '' else ', ' || col || ' ' || dir end;
begin
  if q <> '' then
    trgm_ids := array(
      select s.id
      from public.suppliers s
      where q <% public.normalize_search_text(
              coalesce(s.name, '') || ' ' || coalesce(s.poc_name, '') || ' ' ||
              coalesce(s.email, '') || ' ' || coalesce(s.phone, '') || ' ' ||
              coalesce(s.address, '') || ' ' || coalesce(s.city, '') || ' ' ||
              coalesce(s.state, '') || ' ' || coalesce(s.zip, '') || ' ' ||
              coalesce(s.category, '') || ' ' || coalesce(s.notes, ''))
    );
  end if;

  return query execute format($q$
    select s.id, s.name, s.address, s.city, s.state, s.zip, s.phone, s.email,
           s.poc_name, s.poc_email, s.poc_phone, s.website, s.latitude, s.longitude,
           s.notes, s.category, s.created_at, s.updated_at
    from suppliers s
    where s.is_active
      and ($1 is null or s.category = $1)
      and (
        $2 = ''
        or public.normalize_search_text(
             coalesce(s.name, '') || ' ' || coalesce(s.poc_name, '') || ' ' ||
             coalesce(s.email, '') || ' ' || coalesce(s.phone, '') || ' ' ||
             coalesce(s.address, '') || ' ' || coalesce(s.city, '') || ' ' ||
             coalesce(s.state, '') || ' ' || coalesce(s.zip, '') || ' ' ||
             coalesce(s.category, '') || ' ' || coalesce(s.notes, ''))
           &@~ pgroonga_condition($2, fuzzy_max_distance_ratio => $3)
        or public.normalize_search_text(
             coalesce(s.name, '') || ' ' || coalesce(s.poc_name, '') || ' ' ||
             coalesce(s.email, '') || ' ' || coalesce(s.phone, '') || ' ' ||
             coalesce(s.address, '') || ' ' || coalesce(s.city, '') || ' ' ||
             coalesce(s.state, '') || ' ' || coalesce(s.zip, '') || ' ' ||
             coalesce(s.category, '') || ' ' || coalesce(s.notes, ''))
           &@~ $5
        or s.id = any($4)
      )
    order by
      case when $2 = '' then 0
           else pgroonga_score(s.tableoid, s.ctid) end desc%s,
      s.updated_at desc,
      s.name asc
  $q$, order_extra)
  using category_filter, q, fuzzy_ratio, trgm_ids, q_star;
end
$function$;
