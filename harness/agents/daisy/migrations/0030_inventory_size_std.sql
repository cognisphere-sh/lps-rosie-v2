-- 0030_inventory_size_std.sql
--
-- Adds `inventory.size_std` — the standardized container/grade that pairs with
-- the free-text `size` the source printed, exactly as `height_std` /
-- `width_std` / `caliper_std` pair with `height` / `width` / `caliper`.
--
-- Vocabulary (approved by Bhoumik, 2026-08-13):
--
--   Bare Root, Liners, Plug, Trays        word grades
--   <N>G                                  every gallon size, open-ended: the
--                                         printed number, no pot-diameter half
--                                         ("15 G/17\"" and a 17" pot are both
--                                         `15G`)
--   <N>" Box                              boxes stay in inches
--   Field Grown, Grow Bags, Root Pruned   word grades
--   other                                 anything the standard has no bucket
--                                         for (B&B, Quart, hanging baskets…)
--
-- The gallon and box families are open sets, so the constraint is a shape check
-- rather than an enumeration — a supplier who starts selling 12G needs no
-- migration. `size_std` is NULL exactly when no container is known: `size` is
-- NULL, or the row has not been mapped yet.
--
-- `inventory_enriched` and `search_inventory` both enumerate their columns, so
-- both have to be recreated to carry the new one. The view MUST keep
-- `security_invoker = true` — without it the view runs as its BYPASSRLS owner
-- and hands `anon` the whole catalogue back (see docs/supabase-schema.md).

alter table public.inventory
  add column if not exists size_std text;

alter table public.inventory
  drop constraint if exists inventory_size_std_check;

alter table public.inventory
  add constraint inventory_size_std_check check (
    size_std is null
    or size_std ~ '^[0-9]+(\.[0-9]+)?G$'
    or size_std ~ '^[0-9]+" Box$'
    or size_std in ('Bare Root', 'Liners', 'Plug', 'Trays',
                    'Field Grown', 'Grow Bags', 'Root Pruned', 'other')
  );

comment on column public.inventory.size_std is
  'Standardized container/grade for `size`. <N>G | <N>" Box | Bare Root | '
  'Liners | Plug | Trays | Field Grown | Grow Bags | Root Pruned | other. '
  'NULL when no container is known. See docs/supabase-schema.md.';

-- Backs the app's size facet the same way the dimension indexes back the range
-- filters: active rows, per supplier, non-null standard only.
create index if not exists inventory_supplier_size_std_idx
  on public.inventory (supplier_id, size_std)
  where is_active and size_std is not null;

-- ---------------------------------------------------------------- the view

-- CREATE OR REPLACE VIEW can only *append* columns — renaming or reordering
-- the existing ones is rejected — so `size_std` goes on the end rather than
-- next to `size`. Readers select by name; the position carries no meaning.
create or replace view public.inventory_enriched as
  select inv.id,
         inv.name,
         inv.size,
         inv.unit_price,
         inv.created_at,
         inv.updated_at,
         inv.image_url,
         inv.notes,
         inv.height,
         inv.width,
         inv.caliper,
         inv.supplier_id,
         inv.is_active,
         inv.source_id,
         inv.quantity,
         inv.name_key,
         (select string_agg(x.other_name, ', ' order by x.other_name)
            from (select distinct on (y.k) y.v as other_name
                    from (select ps.other_name_key as k, ps.other_name as v
                            from plant_other_names ps
                           where ps.is_active and ps.name_key = inv.name_key
                          union all
                          select ps.name_key, ps.name
                            from plant_other_names ps
                           where ps.is_active and ps.other_name_key = inv.name_key) y
                   where y.k <> inv.name_key
                   order by y.k, y.v) x) as other_names,
         inv.height_std,
         inv.width_std,
         inv.caliper_std,
         inv.size_std
    from inventory inv;

alter view public.inventory_enriched set (security_invoker = true);

-- ------------------------------------------------------------------- the RPC
--
-- Identical to the 0027 body apart from carrying `size_std` through the CTE and
-- the output, and accepting it as a sort column. A RETURNS TABLE change cannot
-- go through CREATE OR REPLACE, so the function is dropped and recreated.

drop function if exists public.search_inventory(text, bigint[], real, text, text,
  double precision, double precision, double precision, double precision,
  double precision, double precision);

create function public.search_inventory(
  search text default ''::text,
  supplier_ids bigint[] default null::bigint[],
  fuzzy_ratio real default 0.34,
  sort_column text default null::text,
  sort_direction text default null::text,
  height_min double precision default null::double precision,
  height_max double precision default null::double precision,
  width_min double precision default null::double precision,
  width_max double precision default null::double precision,
  caliper_min double precision default null::double precision,
  caliper_max double precision default null::double precision
)
returns table(id uuid, name text, other_names text, size text, size_std text,
              unit_price numeric, quantity numeric, supplier_id bigint,
              image_url text, notes text, height text, width text, caliper text,
              is_active boolean, source_id uuid, source text,
              created_at timestamp with time zone, updated_at timestamp with time zone,
              supplier_name text, supplier_category text, supplier_state text,
              supplier_city text, height_std double precision,
              width_std double precision, caliper_std double precision)
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
    when 'size_std'     then 'size_std'
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
             inv.size, inv.size_std, inv.unit_price, inv.quantity, inv.supplier_id,
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
        where (
          public.normalize_search_text(r.name || ' ' || coalesce(r.other_names, ''))
            &@~ pgroonga_condition(w, fuzzy_max_distance_ratio => 0.20)
          or exists (
            select 1 from regexp_split_to_table(
              public.normalize_search_text(r.name || ' ' || coalesce(r.other_names, '')),
              '[[:space:]]+'
            ) identity_word
            where length(w) >= 3 and length(identity_word) >= 3
              and (identity_word like w || '%%' or w like identity_word || '%%')
          )
        )
      ), length(w) desc, w
      limit 1
    )
    select id,name,other_names,size,size_std,unit_price,quantity,supplier_id,image_url,
           notes,height,width,caliper,is_active,source_id,source,created_at,
           updated_at,supplier_name,supplier_category,supplier_state,supplier_city,
           height_std,width_std,caliper_std
    from raw r
    where cardinality($13) < 2
       or (
          public.normalize_search_text(r.name || ' ' || coalesce(r.other_names, ''))
            &@~ pgroonga_condition((select w from intent), fuzzy_max_distance_ratio => 0.20)
          or exists (
            select 1 from regexp_split_to_table(
              public.normalize_search_text(r.name || ' ' || coalesce(r.other_names, '')),
              '[[:space:]]+'
            ) identity_word
            where length((select w from intent)) >= 3 and length(identity_word) >= 3
              and (identity_word like (select w from intent) || '%%' or (select w from intent) like identity_word || '%%')
          )
        )
    order by relevance desc%s, updated_at desc, name asc
  $q$, order_extra)
  using supplier_ids, q, fuzzy_ratio, matched_keys, trgm_ids, q_star,
        height_min, height_max, width_min, width_max, caliper_min, caliper_max,
        query_words;
end
$function$;

-- DROP took the old grants with it; restore exactly what 0027 had.
grant execute on function public.search_inventory(text, bigint[], real, text, text,
  double precision, double precision, double precision, double precision,
  double precision, double precision) to anon, authenticated, service_role;
