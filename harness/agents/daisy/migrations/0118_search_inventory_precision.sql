-- 0118_search_inventory_precision.sql
--
-- Bhoumik-approved search_inventory audit fixes, 2026-09-29.
--
-- Replaces the body of the two-argument search_inventory RPC; the signature,
-- return columns and quoted-literal semantics (0081) are unchanged.
--
-- 1. A span containing a number is never alias-expanded. normalize_plant_key
--    drops digits, so `salvia greggii 1 g` used to read "salvia greggii 1" as
--    the alias `salvia greggii`, swallow the 1 and search the stray `g` (in 69%
--    of rows): 46,761 rows in 3.2 s. The size now stays one phrase.
-- 2. Retrieval and scoring share one hit list. Each alternative spelling is
--    looked up per word, and every (row, word) earns a graded credit: whole
--    word 1.0, typo up to 0.6 by trigram closeness, word start or (from five
--    letters) inside a longer word 0.45, and 0.9 for typed words found in
--    the name once spaces are ignored (`feathergrass` / "Feather Grass").
--    Only words of three letters or more match as word starts.
--    Sizes and aliases count only as a whole phrase. Previously a typo row
--    was retrieved by pgroonga but scored 0 by the stricter re-check, and a
--    whole-document word_similarity let "white" + "sale" pass for the alias
--    `white salvia`.
-- 3. The quoted branch prefilters on one trigram-indexed identity string, so
--    it stops scanning every row with four ILIKEs (~340 ms).
-- 4. A word found only in notes earns 0.4 of the credit it would in name/size.
-- 5. Minimum match: a row is returned only if its relevance reaches half the
--    best row's. A typed multi-word name also scales by the share of its
--    words found.
--
-- No table data changes. One partial GIN index is added.

BEGIN;
SET LOCAL statement_timeout = '300s';

CREATE INDEX inventory_identity_trgm_idx ON public.inventory USING gin (
  (coalesce(name, '') || E'\n' || coalesce(common_name, '') || E'\n' ||
   coalesce(botanical_name, '') || E'\n' || coalesce(cultivar_variety_trade_name, ''))
  public.gin_trgm_ops)
  WHERE is_active;

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
  -- One entry per alternative spelling of each query group.
  alt_text  text[] := '{}';
  alt_grp   int[]  := '{}';
  alt_size  bool[] := '{}';  -- a size phrase, matched whole
  alt_typed bool[] := '{}';  -- the user's own words, not an alias of them
  n_groups int := 0;
  n_docs bigint;
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

    -- The joined identity string is what inventory_identity_trgm_idx indexes.
    -- A phrase inside one part is inside the join, so it only narrows; the
    -- per-part test below still decides, and a match across a newline is not
    -- one.
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
      and (coalesce(inv.name, '') || E'\n' || coalesce(inv.common_name, '') || E'\n' ||
           coalesce(inv.botanical_name, '') || E'\n' ||
           coalesce(inv.cultivar_variety_trade_name, '')) ilike exact_pattern escape E'\\'
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
          alt_text  := alt_text  || span_alts[i];
          alt_grp   := alt_grp   || n_groups;
          alt_size  := alt_size  || true;
          alt_typed := alt_typed || false;
        end loop;
        cur := cur + span_len;
        took := true;
        exit;
      end if;

      -- Alias expansion. `alias_type` is deliberately not consulted — it no
      -- longer exists, and since 0045 it was not read here anyway. A span with
      -- a number in it is never an alias: normalize_plant_key drops digits, so
      -- `salvia greggii 1` would otherwise pass for `salvia greggii` and strand
      -- the size's unit as a word of its own.
      span_k := case when span_txt !~ '(^| )[0-9]'
                     then nullif(public.normalize_plant_key(span_txt), '') end;
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
        alt_text  := alt_text  || span_txt;
        alt_grp   := alt_grp   || n_groups;
        alt_size  := alt_size  || false;
        alt_typed := alt_typed || true;
        for i in 1 .. cardinality(span_alts) loop
          if span_alts[i] <> span_txt then
            alt_text  := alt_text  || span_alts[i];
            alt_grp   := alt_grp   || n_groups;
            alt_size  := alt_size  || false;
            alt_typed := alt_typed || false;
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

  return query
  with alt as (
    select a.k, a.g, a.t, a.is_size, a.typed,
           case when a.is_size then array[a.t] else string_to_array(a.t, ' ') end as w
    from unnest(alt_text, alt_grp, alt_size, alt_typed)
      with ordinality a(t, g, is_size, typed, k)
  ),
  -- Retrieval, per alternative. The word index matches whole words, falls back
  -- to pgroonga's fuzzy match for a word absent from its vocabulary, and takes
  -- word starts for a lone word of three letters or more (`g*` would be 69% of
  -- rows, all tied). The bigram index adds words of five letters or more
  -- found inside longer ones (`myrtle` in `crapemyrtle`); shorter ones only
  -- pull in noise (`ash` in `washington`). The typed words
  -- may match any of them; a size or alias is looked up as its whole phrase,
  -- which is all it is scored on.
  alt_q as (
    select alt.k,
      case
        when not alt.typed then '"' || alt.t || '"'
        when cardinality(alt.w) = 1 and alt.t ~ '^[a-z]{3}' then alt.t || ' OR ' || alt.t || '*'
        else array_to_string(alt.w, ' OR ')
      end as word_q,
      case
        when not alt.typed or alt.t ~ '^[0-9 ]+$'
          or char_length(replace(alt.t, ' ', '')) < 5 then null
        else array_to_string(alt.w, ' OR ')
      end as gram_q
    from alt
  ),
  hit as (
    select h.k, h.id, bool_or(h.by_word) as by_word
    from (
      select aq.k, m.id, true as by_word
      from alt_q aq
      cross join lateral (
        select inv.id from public.inventory inv
        where inv.is_active
          and public.normalize_search_text(
                coalesce(inv.name,'') || ' ' || coalesce(inv.size,'') || ' ' || coalesce(inv.notes,''))
              &@~ pgroonga_condition(aq.word_q, index_name => 'inventory_search_word_idx',
                                     fuzzy_max_distance_ratio => fuzzy_ratio)
      ) m
      union all
      select aq.k, m.id, false
      from (select * from alt_q where gram_q is not null) aq
      cross join lateral (
        select inv.id from public.inventory inv
        where inv.is_active
          and public.normalize_search_text(
                coalesce(inv.name,'') || ' ' || coalesce(inv.size,'') || ' ' || coalesce(inv.notes,''))
              &@~ pgroonga_condition(aq.gram_q, index_name => 'inventory_search_ngram_idx')
      ) m
    ) h
    group by h.k, h.id
  ),
  -- Each hit with its row's text: name and size are the plant's identity,
  -- notes are scored apart from them. A size only qualifies a plant: when the
  -- query names one, rows matching the size alone (10,000 for `1 g`) cannot
  -- pass the minimum match, so they are not normalized and scored. The text is
  -- fetched per hit by primary key; joining two CTEs by id instead lets the
  -- planner, which expects few pgroonga rows, pick a quadratic nested loop.
  doc as materialized (
    select h.k, h.id, h.by_word,
      ' ' || btrim(regexp_replace(public.normalize_search_text(
        coalesce(inv.name,'') || ' ' || coalesce(inv.size,'')), '\s+', ' ', 'g')) || ' ' as idoc,
      ' ' || btrim(regexp_replace(public.normalize_search_text(inv.notes), '\s+', ' ', 'g')) || ' ' as ndoc
    from (
      select hit.k, hit.id, hit.by_word,
             bool_or(not alt.is_size) over (partition by hit.id) as names_plant
      from hit join alt on alt.k = hit.k
    ) h
    join public.inventory inv on inv.id = h.id
    where h.names_plant or not exists (select 1 from alt where not alt.is_size)
  ),
  -- Credit for each typed word in each retrieved row. A retrieved word that is
  -- not in the text as typed was matched fuzzily by pgroonga, and earns its
  -- trigram closeness (`cyprus` is nearer cypress than cedrus); the words of a
  -- multi-word name are retrieved with OR, so for those a missing word is
  -- checked for a typo against the identity instead. A name scales by the
  -- share of its words found.
  alt_score as (
    select alt.g, doc.id,
           sum(c.credit) / cardinality(alt.w)
             * count(*) filter (where c.credit > 0) / cardinality(alt.w) as credit,
           bool_and(c.credit > 0) as complete
    from doc
    join alt on alt.k = doc.k and alt.typed
    cross join lateral unnest(alt.w) as w(t)
    cross join lateral (select case
        when position(' ' || w.t || ' ' in doc.idoc) > 0 then 1.0
        when position(' ' || w.t || ' ' in doc.ndoc) > 0 then 0.4
        when w.t ~ '^[0-9]' then 0          -- a number is a whole word or nothing
        when position(' ' || w.t in doc.idoc) > 0 then 0.45
        when position(' ' || w.t in doc.ndoc) > 0 then 0.2
        when doc.by_word and cardinality(alt.w) = 1 then 0.6 * word_similarity(w.t, doc.idoc)
        when char_length(w.t) >= 4 and word_similarity(w.t, doc.idoc) >= 0.6
          then 0.6 * word_similarity(w.t, doc.idoc)
        when char_length(w.t) >= 5 and position(w.t in doc.idoc) > 0 then 0.45
        when position(w.t in doc.ndoc) > 0 then 0.1
        else 0 end as credit) c
    group by alt.k, alt.g, alt.w, doc.id
  ),
  -- Sizes and aliases are names: they count only whole, as the phrase, so the
  -- alias `white salvia` no longer matches "White Flame ... Salvia".
  phrase_score as (
    select alt.g, doc.id,
           case when position(' ' || alt.t || ' ' in doc.idoc) > 0 then 1.0 else 0.4 end as credit,
           true as complete
    from doc
    join alt on alt.k = doc.k and not alt.typed
    where position(' ' || alt.t || ' ' in doc.idoc) > 0
       or position(' ' || alt.t || ' ' in doc.ndoc) > 0
  ),
  -- Word breaks differ between lists: `feathergrass` must find "Mexican
  -- Feather Grass", `crape myrtle` must find "Crapemyrtle". Checked for the
  -- typed words against every retrieved row's identity with spaces removed.
  joined as (
    select alt.g, doc.id, 0.9 as credit, true as complete
    from alt
    join doc on position(replace(alt.t, ' ', '') in replace(doc.idoc, ' ', '')) > 0
    where alt.typed and char_length(replace(alt.t, ' ', '')) >= 6
  ),
  grp_score as (
    select s.g, s.id, max(s.credit) as credit, bool_or(s.complete) as complete
    from (select * from alt_score union all select * from phrase_score
          union all select * from joined) s
    group by s.g, s.id
  ),
  -- IDF over rows holding every word of some alternative of the group. A
  -- size's rows were not all scored, but its phrase hits are exact already.
  grp_df as (
    select gs.g, count(*) as df from grp_score gs
    where gs.complete and gs.g not in (select alt.g from alt where alt.is_size)
    group by gs.g
    union all
    select alt.g, count(distinct hit.id) from hit join alt on alt.k = hit.k
    where alt.is_size
    group by alt.g
  ),
  grp_idf as (
    select gg.g, ln(1.0 + (n_docs - coalesce(d.df, 0) + 0.5) / (coalesce(d.df, 0) + 0.5)) as idf
    from generate_series(1, n_groups) gg(g)
    left join grp_df d on d.g = gg.g
  ),
  scored as (
    select gs.id, sum(gs.credit * gi.idf)::real as rel
    from grp_score gs
    join grp_idf gi on gi.g = gs.g
    group by gs.id
    having sum(gs.credit * gi.idf) > 0
  ),
  visible as materialized (
    select inv.id, inv.name, inv.common_name, inv.botanical_name,
           inv.cultivar_variety_trade_name, inv.cultivar_keys,
           inv.size, inv.size_std, inv.unit_price, inv.quantity, inv.supplier_id,
           inv.image_url, inv.notes, inv.internal_notes,
           inv.height, inv.width, inv.caliper, inv.is_active, inv.source_id,
           src.file_path as source, inv.created_at, inv.updated_at,
           s.name as supplier_name, s.category as supplier_category,
           s.state as supplier_state, s.city as supplier_city,
           inv.height_std, inv.width_std, inv.caliper_std,
           sc.rel
    from scored sc
    join public.inventory inv on inv.id = sc.id
    join public.suppliers s on s.id = inv.supplier_id
    left join public.inventory_sources src on src.id = inv.source_id
    where inv.source_id is null or src.is_active
  )
  -- Minimum match: half the best row's relevance. Enough for a row missing the
  -- least selective group (usually the size) or found by a typo; not enough
  -- for one matching only the size, only in its notes, or only by a word
  -- start when whole words matched elsewhere.
  select v.id, v.name, v.common_name, v.botanical_name,
         v.cultivar_variety_trade_name, v.cultivar_keys,
         v.size, v.size_std, v.unit_price, v.quantity, v.supplier_id,
         v.image_url, v.notes, v.internal_notes, v.height, v.width, v.caliper,
         v.is_active, v.source_id, v.source, v.created_at, v.updated_at,
         v.supplier_name, v.supplier_category, v.supplier_state, v.supplier_city,
         v.height_std, v.width_std, v.caliper_std, v.rel
  from visible v
  where v.rel >= 0.5 * (select max(x.rel) from visible x)
  order by v.rel desc, v.updated_at desc, v.name asc;
end
$function$;

COMMENT ON FUNCTION public.search_inventory(text, real) IS
  'Fully double-quoted input uses case-insensitive literal-substring matching over composed/common/botanical/cultivar identity only, with no size/notes match and no alias, token, spelling or fuzzy expansion; unquoted input uses IDF-weighted graded word matching (whole word, typo, word start, notes at 0.4) with whole-phrase alias and size matching, and returns rows scoring at least half the best row. Filtering, supplier scoping and sorting are applied by the caller.';

NOTIFY pgrst, 'reload schema';
COMMIT;
