-- 0081_quoted_literal_substring_plant_search.sql
--
-- Bhoumik-approved quoted literal substring mode, 2026-08-29.
--
-- One outer pair of straight double quotes changes only search_inventory's
-- retrieval for that call. The trimmed inner text is matched case-insensitively
-- as one literal substring against plant identity only: composed name and each
-- of its three parts. Size and notes deliberately cannot qualify a row.
-- SQL LIKE metacharacters (`%`, `_`, and the escape character `\`) are data,
-- not patterns. Apostrophes and inner double quotes are data as well.
--
-- This branch never normalizes the phrase, expands an alias, splits it into
-- tokens, applies prefix/partial spelling logic, or runs fuzzy matching. Every
-- matching row has the same relevance; recency and name remain tie-breakers.
-- Unquoted and one-sided-quote input executes the 0057 discovery body unchanged.
-- No inventory, alias, helper, or index rows are written by this migration.

BEGIN;
SET LOCAL statement_timeout = '300s';

CREATE OR REPLACE FUNCTION public.search_inventory(search text DEFAULT ''::text,
                                        fuzzy_ratio real DEFAULT 0.34)
RETURNS TABLE(id uuid, name text, common_name text, botanical_name text,
              cultivar_variety_trade_name text, cultivar_keys text[],
              size text, size_std text, unit_price numeric, quantity numeric,
              supplier_id bigint, image_url text, notes text, internal_notes text,
              height text, width text, caliper text, is_active boolean,
              source_id uuid, source text,
              created_at timestamp with time zone, updated_at timestamp with time zone,
              supplier_name text, supplier_category text,
              supplier_state text, supplier_city text,
              height_std double precision, width_std double precision,
              caliper_std double precision, relevance real)
LANGUAGE plpgsql
STABLE
AS $function$
declare
  raw_search text := regexp_replace(
    search, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  exact_mode boolean := char_length(raw_search) >= 2
    and left(raw_search, 1) = '"' and right(raw_search, 1) = '"';
  exact_text text;
  exact_pattern text;
  q text := btrim(regexp_replace(public.normalize_search_text(search), '\s+', ' ', 'g'));
  words text[];
  n_words int;
  cur int;
  span_len int;
  span_txt text;
  span_k text;
  span_alts text[];
  span_is_size boolean;
  size_num text;
  alt_text text[] := '{}';
  alt_grp  int[]  := '{}';
  alt_pad  bool[] := '{}';
  grp_idf  real[] := '{}';
  n_groups int := 0;
  grp_query text;
  all_query text;
  n_docs bigint;
  df bigint;
  took boolean;
  i int;
begin
  -- A phrase wrapped by one outer pair of straight double quotes opts into
  -- literal substring mode. Trim only its outside whitespace; whitespace and
  -- punctuation inside the phrase remain data. One-sided quotes stay on the
  -- established broad discovery path rather than being guessed at.
  if exact_mode then
    exact_text := regexp_replace(
      substring(raw_search from 2 for char_length(raw_search) - 2),
      '^[[:space:]]+|[[:space:]]+$', '', 'g');
    if exact_text = '' then
      return;
    end if;

    -- Escape LIKE's three metacharacters in data order: the escape character
    -- first, then `%` and `_`. Quotes need no treatment because the phrase is a
    -- PL/pgSQL value, never interpolated into SQL text.
    exact_pattern := '%' ||
      replace(
        replace(
          replace(exact_text, E'\\', E'\\\\'),
          '%', E'\\%'),
        '_', E'\\_') || '%';

    return query
    select inv.id, inv.name, inv.common_name, inv.botanical_name,
           inv.cultivar_variety_trade_name, inv.cultivar_keys,
           inv.size, inv.size_std, inv.unit_price, inv.quantity, inv.supplier_id,
           inv.image_url, inv.notes, inv.internal_notes,
           inv.height, inv.width, inv.caliper, inv.is_active, inv.source_id,
           src.file_path as source, inv.created_at, inv.updated_at,
           s.name as supplier_name, s.category as supplier_category,
           s.state as supplier_state, s.city as supplier_city,
           inv.height_std, inv.width_std, inv.caliper_std,
           1::real as relevance
    from public.inventory inv
    join public.suppliers s on s.id = inv.supplier_id
    left join public.inventory_sources src on src.id = inv.source_id
    where inv.is_active
      and (inv.source_id is null or src.is_active)
      and (coalesce(inv.name, '') ilike exact_pattern escape E'\\'
        or coalesce(inv.common_name, '') ilike exact_pattern escape E'\\'
        or coalesce(inv.botanical_name, '') ilike exact_pattern escape E'\\'
        or coalesce(inv.cultivar_variety_trade_name, '') ilike exact_pattern escape E'\\')
    order by relevance desc, inv.updated_at desc, inv.name asc;
    return;
  end if;

  if q = '' then
    return;
  end if;

  words := regexp_split_to_array(q, ' ');
  n_words := cardinality(words);
  select count(*) into n_docs from public.inventory inv where inv.is_active;

  cur := 1;
  while cur <= n_words loop
    took := false;
    for span_len in reverse least(6, n_words - cur + 1) .. 1 loop
      span_txt := array_to_string(words[cur : cur + span_len - 1], ' ');

      -- A typed size becomes ONE phrase group rather than two junk tokens.
      -- `15g` normalizes to `15 g`, and alone those are the least selective
      -- terms in the corpus: `g` is in 63% of rows, `15` matches any 15
      -- anywhere. As a phrase it is selective (df ~5,200) and earns a real
      -- weight, so a 15 G row outranks a 200 G one without anything being
      -- filtered out.
      --
      -- The alternatives are the spellings a *document* can contain, not the
      -- ones a user types: sizes are stored canonically, so the corpus only
      -- ever prints `15 g` and `24" Box` (-> `24 box`). Someone typing
      -- `15 gal` or `24 inch box` has to reach those.
      span_is_size := false;
      size_num := substring(span_txt from '^[0-9]+(?:\.[0-9]+)?');
      if span_txt ~ '^[0-9]+(\.[0-9]+)? (g|gal|gallon|gallons)$' then
        span_is_size := true;
        span_alts := array[size_num || ' g', size_num || ' gal',
                           size_num || ' gallon', size_num || ' gallons'];
      elsif span_txt ~ '^[0-9]+(\.[0-9]+)? ((in|inch|inches) )?box$' then
        span_is_size := true;
        span_alts := array[size_num || ' box', size_num || ' inch box',
                           size_num || ' in box'];
      end if;

      if span_is_size then
        n_groups := n_groups + 1;
        for i in 1 .. cardinality(span_alts) loop
          alt_text := alt_text || span_alts[i];
          alt_grp  := alt_grp  || n_groups;
          alt_pad  := alt_pad  || true;
        end loop;
        cur := cur + span_len;
        took := true;
        exit;
      end if;

      -- Alias expansion. `alias_type` is deliberately not consulted — it no
      -- longer exists, and since 0045 it was not read here anyway.
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
      if cardinality(span_alts) > 0 or span_len = 1 then
        n_groups := n_groups + 1;
        alt_text := alt_text || span_txt;
        alt_grp  := alt_grp  || n_groups;
        alt_pad  := alt_pad  || false;
        for i in 1 .. cardinality(span_alts) loop
          if span_alts[i] <> span_txt then
            alt_text := alt_text || span_alts[i];
            alt_grp  := alt_grp  || n_groups;
            alt_pad  := alt_pad  || false;
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

  for i in 1 .. n_groups loop
    select string_agg(case when a.p then '"' || a.t || '"' else '(' || a.t || ')' end, ' OR ')
      into grp_query
    from unnest(alt_text, alt_grp, alt_pad) a(t, g, p) where a.g = i;

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

  select string_agg(case when a.p then '"' || a.t || '"' else '(' || a.t || ')' end, ' OR ')
    into all_query
  from unnest(alt_text, alt_pad) a(t, p);

  return query
  with cand as materialized (
    select inv.id, inv.name, inv.common_name, inv.botanical_name,
           inv.cultivar_variety_trade_name, inv.cultivar_keys,
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
         c.cultivar_variety_trade_name, c.cultivar_keys,
         c.size, c.size_std, c.unit_price, c.quantity, c.supplier_id,
         c.image_url, c.notes, c.internal_notes, c.height, c.width, c.caliper,
         c.is_active, c.source_id, c.source, c.created_at, c.updated_at,
         c.supplier_name, c.supplier_category, c.supplier_state, c.supplier_city,
         c.height_std, c.width_std, c.caliper_std,
         coalesce(sc.rel, 0)::real
  from cand c
  left join lateral (
    select sum(m.idf)::real as rel
    from (
      select distinct a.g, grp_idf[a.g] as idf
      from unnest(alt_text, alt_grp, alt_pad) a(t, g, p)
      where (a.p and position(' ' || a.t || ' ' in ' ' || c.sdoc || ' ') > 0)
         or (not a.p and (position(a.t in c.sdoc) > 0
                          or word_similarity(a.t, c.sdoc) >= 0.6))
    ) m
  ) sc on true
  order by coalesce(sc.rel, 0) desc, c.updated_at desc, c.name asc;
end
$function$;

COMMENT ON FUNCTION public.search_inventory(text, real) IS
  'Fully double-quoted input uses case-insensitive literal-substring matching over composed/common/botanical/cultivar identity only, with no size/notes match and no alias, token, spelling or fuzzy expansion; unquoted input uses broad IDF-weighted partial/fuzzy discovery. Filtering, supplier scoping and sorting are applied by the caller.';

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Required post-apply checks (capture unquoted counts/id digests before/after):
--   unquoted representative searches: byte-for-byte identical result ids/order;
--   `"Italian Cypress"`: every row contains that exact case-insensitive phrase
--     in name/common_name/botanical_name/cultivar_variety_trade_name;
--   identity-only predicate fixture in artifacts/0081_*_checks.sql: zero rows;
--   `"100%_\"`: `%`, `_`, and `\` are literal, not LIKE wildcards/escape;
--   `"O''Brien"` and `"""`: apostrophe/inner quote are literal and do not error;
--   `"  search   term  "`: edge whitespace trimmed, internal spacing preserved;
--   `""` / whitespace-only quoted input: zero rows;
--   one-sided quotes: no exception and unchanged broad-discovery behavior;
--   exactly one `search_inventory(text,real)` signature and 30 output columns.
-- Rollback requires restoring search_inventory from 0057. The retained
-- normalize_identity_token_key(text) helper is intentionally left untouched.
