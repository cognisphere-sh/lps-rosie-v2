-- 0042_alias_query_term_expansion.sql
-- Applied 2026-08-14 via the Supabase MCP at Bhoumik's request.
--
-- WHY
-- Aliases were not enriching the query. The alias branch selected an edge only
-- when the **whole query** matched that edge's text, and pgroonga's `&@~` is
-- AND across tokens — measured, not assumed:
--
--   normalize_search_text('zzzoak quercus zzztestensis zzzboardwalk 15 g')
--     &@~ pgroonga_condition('zzzoak zzzbwalk')      -> false
--     &@~ pgroonga_condition('zzzoak zzzboardwalk')  -> true
--
-- So `Live Oak Boardwalk` could never reach the `Live Oak` ↔ `Quercus
-- virginiana` edge: no single edge's document contains both "live oak" and
-- "boardwalk". The cases that appeared to work were being carried by the
-- pg_trgm fallback firing by luck on string similarity —
-- `'quercus zzztestensis zzzbwalk' <% document` is true while
-- `'zzzoak zzzbwalk' <% document` is false, which is why the same query worked
-- through the botanical name and failed through the common name.
--
-- WHAT CHANGES
-- The alias branch also selects an edge when **any contiguous run of query
-- words** collapses to one of its endpoint keys. `Live Oak Boardwalk` yields the
-- spans `live`, `oak`, `boardwalk`, `live oak`, `oak boardwalk`,
-- `live oak boardwalk`; `live oak` keys to `liveoak`, which is the edge's
-- endpoint, so `quercusvirginiana` joins the admitted key set and the row is
-- found. Spans, not single words, because alias names are routinely two words —
-- neither `live` nor `oak` alone keys to `liveoak`.
--
-- **Purely additive.** The existing whole-query fuzzy, prefix and `qkey`
-- conditions are untouched and still OR'd in, so nothing that matched before
-- stops matching — this only widens which edges are eligible.
--
-- WHY THIS DOES NOT REOPEN THE 0006/0007/0021/0025/0028/0029 WOUND
-- Three things bound it, and all three predate this change:
--   1. **Admission is exact key equality, not text.** An edge admits a row only
--      when the row's whole `common_name_key` / `botanical_name_key`, or one of
--      its `cultivar_keys`, *equals* an endpoint. A span that merely looks like
--      part of a name matches nothing.
--   2. **The types stay separate.** A `cultivar` edge is still only ever
--      compared to `cultivar_keys`, so a selection name still cannot reach a
--      generic row of its species.
--   3. **The identity-intent gate still runs after admission.** A multi-word
--      query still requires its least-common word in the row's own name or a
--      direct alias, so an invented cultivar still returns nothing.
--
-- Span length is capped at 6 words so a pasted paragraph cannot turn into a
-- quadratic number of key lookups.
--
-- NOT OBSERVABLE ON LIVE DATA YET: `plant_aliases` is empty until the re-ingest,
-- so every fixture below is unchanged by construction. The behaviour is verified
-- against synthetic rows in a rolled-back transaction; see NOTE.md.

BEGIN;
SET LOCAL statement_timeout = '300s';

CREATE OR REPLACE FUNCTION public.search_inventory(
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
  cultivar_variety_trade_name text, other_names text,
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
  cultivar_keys text[] := '{}';
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

    -- Every contiguous run of query words, as an identity key. This is what
    -- lets one term of a multi-word query reach an alias on its own: `live oak`
    -- inside `live oak boardwalk` keys to `liveoak`. Alias names are commonly
    -- two words, so single words are not enough. Capped at 6-word spans.
    span_keys := array_remove(array(
      select distinct nullif(
               public.normalize_plant_key(
                 array_to_string(query_words[i:j], ' ')), '')
      from generate_subscripts(query_words, 1) i,
           generate_subscripts(query_words, 1) j
      where j >= i and j - i < 6
    ), null);

    -- Only the two endpoints of directly matching, reviewed equivalence edges
    -- participate. Never traverse a reverse hub to sibling alternatives.
    --
    -- The two arrays are kept apart on purpose. A `plant` edge is compared to a
    -- row's common/botanical name; a `cultivar` edge only ever to the names in
    -- its cultivar column. That is what stops a selection name reaching a
    -- generic row of the same species — the failure mode 0006/0007/0021/0025/
    -- 0028/0029 each had to clean up after in the untyped table.
    --
    -- The `span_keys` conditions are 0042's addition; everything else is the
    -- whole-query matching that was here before, kept so nothing regresses.
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
    ) || array[qkey], null); -- rows whose own identity collapses to the query key

    cultivar_keys := array_remove(array(
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
             inv.cultivar_variety_trade_name,
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
           other_names,size,size_std,unit_price,quantity,supplier_id,image_url,
           notes,internal_notes,height,width,caliper,is_active,source_id,source,
           created_at,updated_at,supplier_name,supplier_category,supplier_state,
           supplier_city,height_std,width_std,caliper_std
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
        query_words, cultivar_keys;
end
$function$;

NOTIFY pgrst, 'reload schema';
COMMIT;
