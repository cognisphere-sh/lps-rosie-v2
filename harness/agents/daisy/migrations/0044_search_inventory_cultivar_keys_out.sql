-- 0044_search_inventory_cultivar_keys_out.sql
-- Applied 2026-08-14 via the Supabase MCP at Bhoumik's request.
--
-- Adds `cultivar_keys text[]` to `search_inventory`'s RETURNS TABLE. Body
-- unchanged apart from projecting the column; a return-type change cannot go
-- through CREATE OR REPLACE, so this is a DROP + CREATE with grants restored.
--
-- WHY
-- The app is moving every column filter off the browser and onto SQL applied
-- over the RPC result (PostgREST `.in()` / `.gte()` / `.overlaps()`), because
-- filtering a page that the server already truncated is wrong: a search for
-- `Crape Myrtle` matches 570 rows of which 105 are 15G, but only 73 land in the
-- 300-row first page — so 32 of them were unreachable by ticking the size box,
-- and the header's "showing 73 of 570" was wrong twice over.
--
-- Every other filterable value is already in the projection (`size_std`,
-- `unit_price`, `quantity`, `height_std`/`width_std`/`caliper_std`,
-- `supplier_category`/`supplier_city`/`supplier_state`). The cultivar is the
-- exception: the column holds a comma-separated residual (`Wolff, Emperor 1`),
-- so filtering it by one selected name needs the normalized array, matched with
-- `&&`. Without it the only options are an exact whole-cell match (wrong for
-- multi-name rows) or a substring `ilike` (matches `Wolff` inside `Wolffii`).
--
-- `inventory_enriched` already carries the column, so the app's browse path
-- needed nothing.

BEGIN;
SET LOCAL statement_timeout = '300s';

DROP FUNCTION IF EXISTS public.search_inventory(
  text, bigint[], real, text, text,
  double precision, double precision, double precision,
  double precision, double precision, double precision);

CREATE FUNCTION public.search_inventory(
  search text DEFAULT ''::text,
  supplier_ids bigint[] DEFAULT NULL::bigint[],
  fuzzy_ratio real DEFAULT 0.34,
  sort_column text DEFAULT NULL::text,
  sort_direction text DEFAULT NULL::text,
  height_min double precision DEFAULT NULL::double precision,
  height_max double precision DEFAULT NULL::double precision,
  width_min double precision DEFAULT NULL::double precision,
  width_max double precision DEFAULT NULL::double precision,
  caliper_min double precision DEFAULT NULL::double precision,
  caliper_max double precision DEFAULT NULL::double precision
)
RETURNS TABLE(
  id uuid, name text, common_name text, botanical_name text,
  cultivar_variety_trade_name text, cultivar_keys text[], other_names text,
  size text, size_std text, unit_price numeric, quantity numeric,
  supplier_id bigint, image_url text, notes text, internal_notes text,
  height text, width text, caliper text, is_active boolean,
  source_id uuid, source text,
  created_at timestamp with time zone, updated_at timestamp with time zone,
  supplier_name text, supplier_category text, supplier_state text, supplier_city text,
  height_std double precision, width_std double precision, caliper_std double precision)
LANGUAGE plpgsql
STABLE
AS $function$
declare
  q text := public.normalize_search_text(search);
  qkey text := nullif(public.normalize_plant_key(search), ''); -- whole query as a name key
  q_star text := case
    when length(substring(btrim(q) from '[a-z0-9]*$')) >= 3
      then btrim(q) || '*' -- last token becomes a Groonga prefix search
    else q
  end;
  plant_keys text[] := '{}';
  cultivar_alias_keys text[] := '{}';
  trgm_ids uuid[] := '{}';
  query_words text[] := '{}';
  span_keys text[] := '{}';
  dir text := case when lower(coalesce(sort_direction, '')) = 'desc' then 'desc' else 'asc' end;
  col text := case sort_column
    when 'supplier_name'     then 'supplier_name'
    when 'supplier_category' then 'supplier_category'
    when 'supplier_state'    then 'supplier_state'
    when 'supplier_city'     then 'supplier_city'
    when 'name'           then 'name'
    when 'common_name'    then 'common_name'
    when 'botanical_name' then 'botanical_name'
    when 'cultivar_variety_trade_name' then 'cultivar_variety_trade_name'
    when 'other_names'    then 'other_names'  -- output alias (derived column)
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
    query_words := regexp_split_to_array(q, '[[:space:]]+');

    -- Every contiguous run of query words, as an identity key: what lets one
    -- term of a multi-word query reach an alias on its own (0042).
    span_keys := array_remove(array(
      select distinct nullif(
               public.normalize_plant_key(
                 array_to_string(query_words[i:j], ' ')), '')
      from generate_subscripts(query_words, 1) i,
           generate_subscripts(query_words, 1) j
      where j >= i and j - i < 6
    ), null);

    plant_keys := array_remove(array(
      select distinct k
      from public.plant_aliases pa
      cross join lateral (values (pa.name_key), (pa.other_name_key)) edge(k)
      where pa.is_active and pa.alias_type = 'plant'
        and (public.normalize_search_text(pa.name || ' ' || pa.other_name)
            &@~ pgroonga_condition(q, fuzzy_max_distance_ratio => fuzzy_ratio)
         or public.normalize_search_text(pa.name || ' ' || pa.other_name) &@~ q_star
         or pa.name_key = qkey
         or pa.other_name_key = qkey
         or pa.name_key = any(span_keys)
         or pa.other_name_key = any(span_keys))
    ) || array[qkey], null);

    cultivar_alias_keys := array_remove(array(
      select distinct k
      from public.plant_aliases pa
      cross join lateral (values (pa.name_key), (pa.other_name_key)) edge(k)
      where pa.is_active and pa.alias_type = 'cultivar'
        and (public.normalize_search_text(pa.name || ' ' || pa.other_name)
            &@~ pgroonga_condition(q, fuzzy_max_distance_ratio => fuzzy_ratio)
         or public.normalize_search_text(pa.name || ' ' || pa.other_name) &@~ q_star
         or pa.name_key = qkey
         or pa.other_name_key = qkey
         or pa.name_key = any(span_keys)
         or pa.other_name_key = any(span_keys))
    ) || array[qkey], null);

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
    with raw as materialized (
      select inv.id, inv.name, inv.common_name, inv.botanical_name,
             inv.cultivar_variety_trade_name, inv.cultivar_keys,
             public.plant_alias_names(inv.name_key, inv.common_name_key,
                                      inv.botanical_name_key, inv.cultivar_keys) as other_names,
             inv.size, inv.size_std, inv.unit_price, inv.quantity, inv.supplier_id,
             inv.image_url, inv.notes, inv.internal_notes,
             inv.height, inv.width, inv.caliper,
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
          or inv.common_name_key = any($4)
          or inv.botanical_name_key = any($4)
          or inv.cultivar_keys && $14
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
    select id,name,common_name,botanical_name,cultivar_variety_trade_name,
           cultivar_keys,other_names,size,size_std,unit_price,quantity,supplier_id,
           image_url,notes,internal_notes,height,width,caliper,is_active,source_id,
           source,created_at,updated_at,supplier_name,supplier_category,
           supplier_state,supplier_city,height_std,width_std,caliper_std
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
  using supplier_ids, q, fuzzy_ratio, plant_keys, trgm_ids, q_star,
        height_min, height_max, width_min, width_max, caliper_min, caliper_max,
        query_words, cultivar_alias_keys;
end
$function$;

GRANT EXECUTE ON FUNCTION public.search_inventory(
  text, bigint[], real, text, text,
  double precision, double precision, double precision,
  double precision, double precision, double precision)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
