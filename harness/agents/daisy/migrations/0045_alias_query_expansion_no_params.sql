-- 0045_alias_query_expansion_no_params.sql
-- Applied 2026-08-14 via the Supabase MCP at Bhoumik's request.
--
-- TWO CHANGES, both narrowing what the function is responsible for.
--
-- 1. THE FILTER/SORT PARAMETERS ARE GONE. The signature is now just
--    `search_inventory(search text, fuzzy_ratio real)`. `supplier_ids`, the six
--    dimension bounds, `sort_column` and `sort_direction` all left: every one
--    of them is now applied by the app as SQL over the result (PostgREST
--    `.eq()` / `.gte()` / `.order()`), which is where filtering belongs once
--    the pagination has to agree with the count. The function does one job —
--    decide which rows match a query, and in what order of relevance.
--
--    Cost, recorded honestly: `supplier_ids` used to prune `raw` before the
--    intent gate counted over it, so a supplier-scoped search examined one
--    supplier's rows. It now searches the catalogue and is filtered after. The
--    trigram pass already scanned everything regardless, so the difference is
--    the size of `raw`, not a new table scan.
--
-- 2. ALIASES EXPAND THE QUERY INSTEAD OF MATCHING COLUMNS. Previously an alias
--    contributed its endpoints as *identity keys*, compared with `=` / `&&`
--    against `name_key` / `common_name_key` / `botanical_name_key` /
--    `cultivar_keys`. Now the alias's other side is substituted into the
--    pgroonga query itself:
--
--      live oak boardwalk
--        -> ((live oak) OR (quercus virginiana)) boardwalk
--
--    The query is partitioned greedily, longest span first (up to 6 words), so
--    each matched span becomes one OR-group and the groups are AND-ed. That
--    handles several aliases in one query without a combinatorial blow-up:
--    two substituted spans give one `(a OR a') (b OR b')`, not four variants.
--
--    THE POINT OF DOING IT THIS WAY: a row reached through an alias now
--    matches the *text* branch, so `pgroonga_score` scores it. Under the key
--    mechanism every alias-only match scored exactly 0 and sorted below every
--    direct hit. Measured before this change, on `crape myrtle muskogee`: 491
--    rows admitted, six distinct scores (0, 3, 4, 6, 8, 10) and 404 rows at
--    zero — so "order by relevance" was mostly `updated_at desc, name asc`.
--
-- ⚠ WHAT THIS GIVES UP — read before adding an alias.
--    `alias_type` no longer constrains anything at match time. It could only
--    ever do so by naming a *column* to compare against, and there is no column
--    comparison left. A `cultivar` edge and a `plant` edge now expand the query
--    identically.
--
--    So the structural guarantee introduced by 0040 is gone, and the quality
--    bar in the ingestion SOP is once again the only thing standing between a
--    bad pair and a bad result. Concretely: an edge pairing a species with one
--    of its cultivars — the exact shape migration 0025 retired 66 of — expands
--    a search for that cultivar into a search for the whole species, and
--    because such a query is usually one word the identity-intent gate does not
--    run to catch it. `alias_type` is kept on the table: it still documents
--    what a pair asserts, and it still separates the two kinds in the
--    "Also known as" display.
--
-- UNCHANGED: the `qkey` branch (the whole query collapsing to a row's identity
-- key, which is how "LIVEOAK" finds "Live Oak") is *not* an alias mechanism and
-- stays. So does the trigram recall pass, and so does the identity-intent gate.

BEGIN;
SET LOCAL statement_timeout = '300s';

DROP FUNCTION IF EXISTS public.search_inventory(
  text, bigint[], real, text, text,
  double precision, double precision, double precision,
  double precision, double precision, double precision);

CREATE FUNCTION public.search_inventory(
  search text DEFAULT ''::text,
  fuzzy_ratio real DEFAULT 0.34
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
  q_expanded text := q;
  trgm_ids uuid[] := '{}';
  query_words text[] := '{}';
  -- greedy partition state
  parts text[] := '{}';
  pos int;
  n_words int;
  span_len int;
  span_txt text;
  span_k text;
  alts text[];
  matched boolean;
begin
  if q <> '' then
    query_words := regexp_split_to_array(q, '[[:space:]]+');
    n_words := cardinality(query_words);

    -- Walk the query left to right taking the longest span that names an
    -- alias, so `live oak` wins over `live` and the two words are replaced as
    -- one thing. Every span becomes an OR-group; the groups stay AND-ed, which
    -- is what keeps an expanded query from being broader than the typed one.
    pos := 1;
    while pos <= n_words loop
      matched := false;
      for span_len in reverse least(6, n_words - pos + 1) .. 1 loop
        span_txt := array_to_string(query_words[pos : pos + span_len - 1], ' ');
        span_k := nullif(public.normalize_plant_key(span_txt), '');
        if span_k is not null then
          alts := array(
            select distinct btrim(public.normalize_search_text(e.v))
            from public.plant_aliases pa
            cross join lateral (values
              (case when pa.name_key = span_k then pa.other_name end),
              (case when pa.other_name_key = span_k then pa.name end)
            ) e(v)
            where pa.is_active
              and e.v is not null
              and btrim(public.normalize_search_text(e.v)) <> ''
              and btrim(public.normalize_search_text(e.v)) <> span_txt
          );
          if cardinality(alts) > 0 then
            parts := parts || ('((' || span_txt || ') OR ('
                               || array_to_string(alts, ') OR (') || '))');
            pos := pos + span_len;
            matched := true;
            exit;
          end if;
        end if;
      end loop;
      if not matched then
        parts := parts || query_words[pos];
        pos := pos + 1;
      end if;
    end loop;
    -- With no alias hit this reassembles the original query exactly, so an
    -- empty alias directory changes nothing.
    q_expanded := array_to_string(parts, ' ');

    -- Spelling variants pgroonga fuzzy can't reach (see 038 header). Built from
    -- the typed query, not the expansion: this is a similarity net over the
    -- literal text someone entered.
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

  return query
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
             case when q = '' then 0
                  else pgroonga_score(inv.tableoid, inv.ctid) end as relevance
      from public.inventory inv
      join public.suppliers s on s.id = inv.supplier_id
      left join public.inventory_sources src on src.id = inv.source_id
      where inv.is_active
        and (inv.source_id is null or src.is_active)
        and (
          q = ''
          -- the expanded query: this is the only branch that scores
          or public.normalize_search_text(
               coalesce(inv.name, '') || ' ' || coalesce(inv.size, '') || ' ' ||
               coalesce(inv.height, '') || ' ' || coalesce(inv.width, '') || ' ' ||
               coalesce(inv.caliper, '') || ' ' || coalesce(inv.notes, ''))
             &@~ pgroonga_condition(q_expanded, fuzzy_max_distance_ratio => fuzzy_ratio)
          or public.normalize_search_text(
               coalesce(inv.name, '') || ' ' || coalesce(inv.size, '') || ' ' ||
               coalesce(inv.height, '') || ' ' || coalesce(inv.width, '') || ' ' ||
               coalesce(inv.caliper, '') || ' ' || coalesce(inv.notes, '')) &@~ q_star
          -- not an alias mechanism: the query's own identity key
          or inv.name_key = qkey
          or inv.common_name_key = qkey
          or inv.botanical_name_key = qkey
          or inv.id = any(trgm_ids)
        )
    ), intent as (
      select w
      from unnest(query_words) w
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
              and (identity_word like w || '%' or w like identity_word || '%')
          )
        )
      ), length(w) desc, w
      limit 1
    )
    select r.id, r.name, r.common_name, r.botanical_name,
           r.cultivar_variety_trade_name, r.cultivar_keys, r.other_names,
           r.size, r.size_std, r.unit_price, r.quantity, r.supplier_id,
           r.image_url, r.notes, r.internal_notes, r.height, r.width, r.caliper,
           r.is_active, r.source_id, r.source, r.created_at, r.updated_at,
           r.supplier_name, r.supplier_category, r.supplier_state, r.supplier_city,
           r.height_std, r.width_std, r.caliper_std
    from raw r
    where cardinality(query_words) < 2
       or (
          public.normalize_search_text(r.name || ' ' || coalesce(r.other_names, ''))
            &@~ pgroonga_condition((select w from intent), fuzzy_max_distance_ratio => 0.20)
          or exists (
            select 1 from regexp_split_to_table(
              public.normalize_search_text(r.name || ' ' || coalesce(r.other_names, '')),
              '[[:space:]]+'
            ) identity_word
            where length((select w from intent)) >= 3 and length(identity_word) >= 3
              and (identity_word like (select w from intent) || '%'
                   or (select w from intent) like identity_word || '%')
          )
        )
    order by r.relevance desc, r.updated_at desc, r.name asc;
end
$function$;

COMMENT ON FUNCTION public.search_inventory(text, real) IS
  'Which active inventory rows answer a query, most relevant first. Filtering, supplier scoping and sorting are the caller''s job, applied as SQL over this result.';

GRANT EXECUTE ON FUNCTION public.search_inventory(text, real)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
