-- 0046_bm25_search.sql
-- Applied 2026-08-14 via the Supabase MCP at Bhoumik's request, in four steps
-- recorded in the Supabase history as `search_ngram_index`, `search_word_index`,
-- `search_inventory_bm25` and `drop_superseded_search_indexes`.
--
-- A rewrite of what search *is*, replacing three mechanisms with one ranking.
-- The brief: match names / size / notes, tolerate typos, match partially at
-- either end, expand through aliases, and rank by overlap with rare terms
-- weighted heavily. Filtering and sorting happen after, over the result.
--
-- WHAT WENT
--   * the identity-intent gate — a hard filter that picked the rarest query word
--     and excluded every row not matching it. Ranking by IDF does the same job
--     without discarding anything: the rare word simply dominates the score.
--   * the pg_trgm fallback and `inventory_trgm_idx` — substring matching on a
--     bigram index is what that branch was approximating, less precisely.
--   * `inventory_pgroonga_idx` — superseded, and its document included
--     height/width/caliper, which are filter columns rather than search text.
--
-- THE DOCUMENT is now `name + size + notes`. The three name parts are inside
-- `name`, which is composed from them; the dimensions are gone from it.
--
-- TWO INDEXES OVER THE SAME EXPRESSION, because one cannot do both jobs:
--   * `inventory_search_ngram_idx` (TokenBigramSplitSymbolAlphaDigit) — exact
--     and **substring** matching. This is what makes partial work at both ends:
--     `sycamor` and `ycamor` both find `sycamore`. TokenDelimit could only ever
--     resolve a prefix through its lexicon.
--   * `inventory_search_word_idx` (TokenDelimit) — gives pgroonga's fuzzy a
--     whole-word lexicon to compute edit distance against. **Measured: fuzzy is
--     useless on a bigram lexicon** — the substitution typo `mvskogee` returns 0
--     there and 188 here. Substring alone only catches truncations, never a
--     substitution or transposition.
--   `pgroonga_condition(..., index_name => ...)` targets each one explicitly,
--   since both are built on the identical expression.
--
-- HOW A QUERY IS SCORED
--   1. Normalize, then partition into **groups**, longest span first (≤ 6
--      words), so `live oak` is one concept rather than two words.
--   2. A span that names an alias carries the other side of every edge it
--      touches as an *alternative*. A group matches if any alternative does, and
--      contributes its weight once — so an alias never double-counts.
--   3. Per group, `df` = how many active rows match it, and
--      `idf = ln(1 + (N - df + 0.5) / (df + 0.5))`.
--   4. Retrieval is every group OR'd — one index scan per index, ~17ms.
--   5. `relevance = Σ idf(g)` over the groups a row matched. Matching per row is
--      cheap string work: substring (covering exact, prefix and suffix) or
--      `word_similarity >= 0.6` (covering typos).
--
-- Term frequency is deliberately **binary** — BM25 with k1 → 0. Repetition in a
-- plant name carries no information; a row whose notes say "maple" five times is
-- not a better answer than one named "Maple". What remains is the part that does
-- carry information: how much of the query a row covers, weighted by how rare
-- each part is. That is why there is no `avgdl` and no length normalization to
-- keep fresh.
--
-- Worked example, `crape myrtle muskogee` — three tiers, and they read exactly
-- as intended (`crape myrtle` is one group because an alias names it):
--     10.38   178 rows   both groups          Crape Myrtle - 'Muskogee'
--      5.82    10 rows   the rare group only  CrapeM Muskogee   (a typo'd source row)
--      4.55   567 rows   the generic group    Catawba Crape Myrtle
--
-- ⚠ RESULT SETS ARE LARGER, AND THAT IS THE DESIGN. Retrieval is now OR, so
-- every generic Crape Myrtle appears — ranked last. `Crape Myrtle Muskogee`
-- returns 755 rows where the gated version returned 116, and `Live Oak` returns
-- 1,792 where it returned 302. The first page is better and the tail is longer.
-- If the old tightness is wanted back, the principled form is a floor on
-- `relevance` (for example, require the highest-IDF group to match) rather than
-- reinstating the gate.
--
-- Also gone: the "never call with an empty search" footgun. An empty query now
-- returns zero rows immediately instead of walking the catalogue.

-- ---- step 1: substring index -------------------------------------------
SET statement_timeout = '600s';

CREATE INDEX IF NOT EXISTS inventory_search_ngram_idx
  ON public.inventory
  USING pgroonga (
    public.normalize_search_text(
      coalesce(name, '') || ' ' || coalesce(size, '') || ' ' || coalesce(notes, ''))
  )
  WITH (tokenizer='TokenBigramSplitSymbolAlphaDigit');

-- ---- step 2: whole-word index, for fuzzy --------------------------------
CREATE INDEX IF NOT EXISTS inventory_search_word_idx
  ON public.inventory
  USING pgroonga (
    public.normalize_search_text(
      coalesce(name, '') || ' ' || coalesce(size, '') || ' ' || coalesce(notes, ''))
  )
  WITH (tokenizer='TokenDelimit');

-- ---- step 3: the function ------------------------------------------------
-- (applied as `search_inventory_bm25`; body as deployed — see
--  pg_get_functiondef for the authoritative copy)
DROP FUNCTION IF EXISTS public.search_inventory(text, real);

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
  height_std double precision, width_std double precision, caliper_std double precision,
  relevance real)
LANGUAGE plpgsql
STABLE
AS $function$
declare
  q text := btrim(regexp_replace(public.normalize_search_text(search), '\s+', ' ', 'g'));
  words text[];
  n_words int;
  cur int;
  span_len int;
  span_txt text;
  span_k text;
  span_alts text[];
  alt_text text[] := '{}';   -- every alternative, flattened
  alt_grp  int[]  := '{}';   -- which group each alternative belongs to
  grp_idf  real[] := '{}';   -- one IDF per group
  n_groups int := 0;
  grp_query text;
  all_query text;
  n_docs bigint;
  df bigint;
  took boolean;
  i int;
begin
  -- An empty query has nothing to rank, so it returns nothing rather than
  -- walking the catalogue. Listing is `inventory_enriched`'s job.
  if q = '' then
    return;
  end if;

  words := regexp_split_to_array(q, ' ');
  n_words := cardinality(words);
  select count(*) into n_docs from public.inventory inv where inv.is_active;

  -- Partition the query into groups, longest span first, so `live oak` is one
  -- concept rather than two words. A span that names an alias carries the other
  -- side of every edge it touches as an alternative; a group matches if ANY of
  -- its alternatives does, and contributes its weight once.
  cur := 1;
  while cur <= n_words loop
    took := false;
    for span_len in reverse least(6, n_words - cur + 1) .. 1 loop
      span_txt := array_to_string(words[cur : cur + span_len - 1], ' ');
      span_k := nullif(public.normalize_plant_key(span_txt), '');
      span_alts := '{}';
      if span_k is not null then
        span_alts := array(
          select distinct btrim(regexp_replace(public.normalize_search_text(e.v), '\s+', ' ', 'g'))
          from public.plant_aliases pa
          cross join lateral (values
            (case when pa.name_key = span_k then pa.other_name end),
            (case when pa.other_name_key = span_k then pa.name end)
          ) e(v)
          where pa.is_active and e.v is not null
            and btrim(regexp_replace(public.normalize_search_text(e.v), '\s+', ' ', 'g')) <> ''
        );
      end if;
      -- take the span if it resolved an alias, or if we are down to one word
      if cardinality(span_alts) > 0 or span_len = 1 then
        n_groups := n_groups + 1;
        alt_text := alt_text || span_txt;
        alt_grp  := alt_grp  || n_groups;
        for i in 1 .. cardinality(span_alts) loop
          if span_alts[i] <> span_txt then
            alt_text := alt_text || span_alts[i];
            alt_grp  := alt_grp  || n_groups;
          end if;
        end loop;
        cur := cur + span_len;
        took := true;
        exit;
      end if;
    end loop;
    if not took then
      cur := cur + 1;
    end if;
  end loop;

  -- IDF per group: rare terms carry more weight, which is what makes a
  -- distinguishing cultivar outrank the generic words around it.
  for i in 1 .. n_groups loop
    select string_agg('(' || a.t || ')', ' OR ') into grp_query
    from unnest(alt_text, alt_grp) a(t, g) where a.g = i;

    select count(*) into df
    from public.inventory inv
    where inv.is_active
      and ( public.normalize_search_text(
              coalesce(inv.name,'') || ' ' || coalesce(inv.size,'') || ' ' || coalesce(inv.notes,''))
            &@~ pgroonga_condition(grp_query, index_name => 'inventory_search_ngram_idx',
                                   fuzzy_max_distance_ratio => fuzzy_ratio)
         or public.normalize_search_text(
              coalesce(inv.name,'') || ' ' || coalesce(inv.size,'') || ' ' || coalesce(inv.notes,''))
            &@~ pgroonga_condition(grp_query, index_name => 'inventory_search_word_idx',
                                   fuzzy_max_distance_ratio => fuzzy_ratio) );

    grp_idf := grp_idf || ln(1.0 + (n_docs - df + 0.5) / (df + 0.5))::real;
  end loop;

  select string_agg('(' || t || ')', ' OR ') into all_query from unnest(alt_text) t;

  return query
  with cand as materialized (
    select inv.id, inv.name, inv.common_name, inv.botanical_name,
           inv.cultivar_variety_trade_name, inv.cultivar_keys,
           public.plant_alias_names(inv.name_key, inv.common_name_key,
                                    inv.botanical_name_key, inv.cultivar_keys) as other_names,
           inv.size, inv.size_std, inv.unit_price, inv.quantity, inv.supplier_id,
           inv.image_url, inv.notes, inv.internal_notes,
           inv.height, inv.width, inv.caliper, inv.is_active, inv.source_id,
           src.file_path as source, inv.created_at, inv.updated_at,
           s.name as supplier_name, s.category as supplier_category,
           s.state as supplier_state, s.city as supplier_city,
           inv.height_std, inv.width_std, inv.caliper_std,
           btrim(regexp_replace(public.normalize_search_text(
             coalesce(inv.name,'') || ' ' || coalesce(inv.size,'') || ' ' || coalesce(inv.notes,'')),
             '\s+', ' ', 'g')) as sdoc
    from public.inventory inv
    join public.suppliers s on s.id = inv.supplier_id
    left join public.inventory_sources src on src.id = inv.source_id
    where inv.is_active
      and (inv.source_id is null or src.is_active)
      and ( public.normalize_search_text(
              coalesce(inv.name,'') || ' ' || coalesce(inv.size,'') || ' ' || coalesce(inv.notes,''))
            &@~ pgroonga_condition(all_query, index_name => 'inventory_search_ngram_idx',
                                   fuzzy_max_distance_ratio => fuzzy_ratio)
         or public.normalize_search_text(
              coalesce(inv.name,'') || ' ' || coalesce(inv.size,'') || ' ' || coalesce(inv.notes,''))
            &@~ pgroonga_condition(all_query, index_name => 'inventory_search_word_idx',
                                   fuzzy_max_distance_ratio => fuzzy_ratio) )
  )
  select c.id, c.name, c.common_name, c.botanical_name,
         c.cultivar_variety_trade_name, c.cultivar_keys, c.other_names,
         c.size, c.size_std, c.unit_price, c.quantity, c.supplier_id,
         c.image_url, c.notes, c.internal_notes, c.height, c.width, c.caliper,
         c.is_active, c.source_id, c.source, c.created_at, c.updated_at,
         c.supplier_name, c.supplier_category, c.supplier_state, c.supplier_city,
         c.height_std, c.width_std, c.caliper_std,
         coalesce(sc.rel, 0)::real
  from cand c
  left join lateral (
    -- Each matched group counts once, weighted by its rarity. A group matches
    -- on substring (which covers exact, prefix and suffix) or on close
    -- lexical similarity (which covers typos).
    select sum(m.idf)::real as rel
    from (
      select distinct a.g, grp_idf[a.g] as idf
      from unnest(alt_text, alt_grp) a(t, g)
      where position(a.t in c.sdoc) > 0
         or word_similarity(a.t, c.sdoc) >= 0.6
    ) m
  ) sc on true
  order by coalesce(sc.rel, 0) desc, c.updated_at desc, c.name asc;
end
$function$;

COMMENT ON FUNCTION public.search_inventory(text, real) IS
  'Which active inventory rows answer a query, ranked by IDF-weighted term coverage. Matches names/size/notes with substring and typo tolerance, expanding query terms through plant_aliases. Filtering, supplier scoping and sorting are the callers job, applied over this result.';

GRANT EXECUTE ON FUNCTION public.search_inventory(text, real)
  TO anon, authenticated, service_role;

-- ---- step 4: retire what this replaced ----------------------------------
DROP INDEX IF EXISTS public.inventory_pgroonga_idx;
DROP INDEX IF EXISTS public.inventory_trgm_idx;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------ post-apply --
-- Verified against live data, 2026-08-14 (N = 63,788 active):
--   partial, post   `Mexican Sycamor`   -> top "SYCAMORE, TRINITY MEXICAN …"
--   partial, pre    `ycamore`           -> 78 rows, top "SYCAMORE, BLOODGOOD …"
--   typo (swap)     `Mexican Sycamoer`  -> same top row as the correct spelling
--   typo (insert)   `Muskogeee`         -> 204 rows, top "Crape Myrtle - 'Muskogee'"
--   alias, both ways `Paperbark Maple` / `Acer griseum` -> 66 rows each,
--                    top "Paperbark Maple - Acer griseum"
--   empty search    -> 0 rows, immediately
--   filters compose: `… where size_std='15G'` 150 rows, `… where supplier_id=32` 280
--   timing: 269 ms for a three-group query returning 755 rows
