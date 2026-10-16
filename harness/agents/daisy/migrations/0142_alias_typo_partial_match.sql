-- 0142_alias_typo_partial_match.sql
--
-- Bhoumik, 2026-10-15: alias expansion forgives typos, an unfinished last
-- word and part of an alias name, not just the exact name.
--
-- Until now a span of the query was an alias only when its letters equalled
-- an alias name (normalize_plant_key). `japanse maple` was no alias, so the
-- ~1,300 APS rows listed only as "Acer palmatum" dropped out, while other
-- maples and Acers filled the list.
--
-- 1. The query parse (sizes and aliases) moves out of search_inventory into
--    search_query_groups(search), unchanged for exact aliases and sizes, so
--    Rosie's aps-price can show the aliases a search used.
-- 2. When no alias name matches exactly, a span matches an alias name of the
--    same number of words whose words each equal or are a typo of the typed
--    ones (one edit for 5-7 letters, two from 8; a swap of two letters is
--    one): `japanse maple`, `japanese mapel`, `bloodgood japanse maple 15
--    gal`, `whale tounge`. A possessive's stray `s` (`whale's` -> `whale s`)
--    is skipped on both sides. A one-word span inside a longer name takes no
--    typo (`prostrata` in "Rosemary prostrata" is not Yucca `rostrata`).
--    Both names of the pair are added.
-- 3. Only when the span is the query's whole plant name (every word but a
--    size's), its last word may be unfinished (3+ letters: `acer palm`), and
--    failing a whole alias name it may match as a run of words inside longer
--    ones (`palmatum` in "Acer palmatum"): the names with the fewest extra
--    words, then the fewest typos (so not "Cyrtomium falcatum"), and only if
--    they belong to at most three pairs, so `japanese`
--    (32 pairs) expands to nothing. A single word needs four letters. Inside
--    a longer name the same leniency read `pear` in "Bradford pear" as
--    prickly pear and `coccinea` in "Salvia coccinea" as scarlet oak.
--
-- Scoring is unchanged: an added name counts whole, as a phrase.

BEGIN;

-- Optimal string alignment distance: insertions, deletions, substitutions
-- and swaps of two adjacent letters each cost one.
CREATE OR REPLACE FUNCTION public.plant_word_distance(a text, b text)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE STRICT PARALLEL SAFE
AS $function$
declare
  la int := char_length(a);
  lb int := char_length(b);
  prev2 int[];
  prev int[];
  cur int[];
  i int;
  j int;
begin
  if la = 0 or lb = 0 then
    return la + lb;
  end if;
  -- prev[j + 1] is the distance from a's first i - 1 letters to b's first j.
  prev := array(select generate_series(0, lb));
  for i in 1 .. la loop
    cur := array[i];
    for j in 1 .. lb loop
      cur := cur || least(prev[j + 1] + 1, cur[j] + 1,
        prev[j] + case when substr(a, i, 1) = substr(b, j, 1) then 0 else 1 end);
      if i > 1 and j > 1 and substr(a, i, 1) = substr(b, j - 1, 1)
         and substr(a, i - 1, 1) = substr(b, j, 1) then
        cur[j + 1] := least(cur[j + 1], prev2[j - 1] + 1);
      end if;
    end loop;
    prev2 := prev;
    prev := cur;
  end loop;
  return prev[lb + 1];
end
$function$;

-- One row per alternative spelling of each query group, in query order: the
-- typed words (typed), a size's canonical spellings (is_size) or an alias
-- name (alias_match exact / close / partial, alias_ids the pairs it came
-- from). search_inventory scores them; aps-price shows the aliases.
CREATE OR REPLACE FUNCTION public.search_query_groups(search text)
RETURNS TABLE(g int, span text, t text, is_size boolean, typed boolean,
              alias_match text, alias_ids bigint[])
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
  size_num text;
  how text;
  alts text[];
  alt_ids text[];  -- each alternative's pair ids, comma-joined
  -- Each alias word a query word matches: query word m_qi (m_qn counting
  -- no stray `s`) is word m_pos of side m_side (0 name, 1 other_name) of
  -- pair m_id, a name of m_slen words; m_typo when it matched as a typo,
  -- m_pre when only as an unfinished word.
  m_qi int[];
  m_qn int[];
  m_id bigint[];
  m_side int[];
  m_pos int[];
  m_slen int[];
  m_typo boolean[];
  m_pre boolean[];
  n_name_words int;  -- the query's words outside sizes
  span_n int;        -- the span's words, less any stray `s`
  took boolean;
  i int;
begin
  g := 0;
  if q = '' then
    return;
  end if;

  words := regexp_split_to_array(q, ' ');
  n_words := cardinality(words);
  select count(*) into n_name_words
  from unnest(words) u(w)
  where u.w !~ '[0-9]'
    and u.w not in ('s', 'g', 'gal', 'gallon', 'gallons', 'box', 'in', 'inch', 'inches');

  -- Matched once per query against the alias vocabulary, then reused by every
  -- span. A word with a digit is never part of an alias.
  select coalesce(array_agg(x.qi), '{}'), coalesce(array_agg(x.qn), '{}'),
         coalesce(array_agg(x.id), '{}'),
         coalesce(array_agg(x.side), '{}'), coalesce(array_agg(x.pos), '{}'),
         coalesce(array_agg(x.slen), '{}'), coalesce(array_agg(x.typo), '{}'),
         coalesce(array_agg(x.pre), '{}')
  into m_qi, m_qn, m_id, m_side, m_pos, m_slen, m_typo, m_pre
  from (
    with side_word as (
      select pa.id, s.side, cardinality(s.w) as slen, u.w, u.pos::int as pos
      from public.plant_aliases pa
      cross join lateral (values
        (0, array_remove(string_to_array(btrim(regexp_replace(public.normalize_search_text(pa.name), '\s+', ' ', 'g')), ' '), 's')),
        (1, array_remove(string_to_array(btrim(regexp_replace(public.normalize_search_text(pa.other_name), '\s+', ' ', 'g')), ' '), 's'))
      ) s(side, w)
      cross join lateral unnest(s.w) with ordinality u(w, pos)
      where pa.is_active
    ),
    -- Materialized, so its per-word work runs once, not per vocabulary word.
    query_word as materialized (
      select u.w, u.qi::int as qi,
             (u.qi - (select count(*) from unnest(words[1 : u.qi]) p(w) where p.w = 's'))::int as qn,
             case when char_length(u.w) >= 8 then 2 when char_length(u.w) >= 5 then 1
                  else 0 end as edits
      from unnest(words) with ordinality u(w, qi)
      where u.w !~ '[0-9]' and u.w <> 's'
    ),
    vocab_match as (
      select vm.qi, vm.qn, vm.w, vm.typo and not vm.typed as typo,
             not (vm.typed or vm.typo) as pre
      from (
        select qw.qi, qw.qn, v.w, v.w = qw.w as typed,
               qw.edits > 0
               and abs(char_length(v.w) - char_length(qw.w)) <= qw.edits
               and similarity(v.w, qw.w) >= 0.2
               and public.plant_word_distance(v.w, qw.w) <= qw.edits as typo,
               qw.qi = n_words and char_length(qw.w) >= 3
               and left(v.w, char_length(qw.w)) = qw.w as unfinished
        from query_word qw
        cross join (select distinct side_word.w from side_word) v
      ) vm
      where vm.typed or vm.typo or vm.unfinished
    )
    select vm.qi, vm.qn, sw.id, sw.side, sw.pos, sw.slen, vm.typo, vm.pre
    from vocab_match vm
    join side_word sw on sw.w = vm.w
  ) x;

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
      alts := null;
      size_num := substring(span_txt from '^[0-9]+(?:\.[0-9]+)?');
      if span_txt ~ '^[0-9]+(\.[0-9]+)? (g|gal|gallon|gallons)$' then
        alts := array[size_num || ' g', size_num || ' gal',
                      size_num || ' gallon', size_num || ' gallons'];
      elsif span_txt ~ '^[0-9]+(\.[0-9]+)? ((in|inch|inches) )?box$' then
        alts := array[size_num || ' box', size_num || ' inch box',
                      size_num || ' in box'];
      end if;

      if alts is not null then
        g := g + 1;
        span := span_txt;
        is_size := true;
        typed := false;
        alias_match := null;
        alias_ids := null;
        foreach t in array alts loop
          return next;
        end loop;
        cur := cur + span_len;
        took := true;
        exit;
      end if;

      -- Alias expansion. A span with a number in it is never an alias:
      -- normalize_plant_key drops digits, so `salvia greggii 1` would
      -- otherwise pass for `salvia greggii` and strand the size's unit as a
      -- word of its own.
      alts := '{}';
      how := null;
      span_n := span_len - cardinality(array_positions(words[cur : cur + span_len - 1], 's'));
      if span_txt !~ '(^| )[0-9]' then
        -- Exact: the span's letters are an alias name; the other name is added.
        span_k := nullif(public.normalize_plant_key(span_txt), '');
        if span_k is not null then
          select coalesce(array_agg(e.v order by e.v), '{}'),
                 coalesce(array_agg(e.ids order by e.v), '{}')
          into alts, alt_ids
          from (
            select btrim(regexp_replace(public.normalize_search_text(o.v), '\s+', ' ', 'g')) as v,
                   string_agg(distinct pa.id::text, ',') as ids
            from public.plant_aliases pa
            cross join lateral (values
              (case when pa.name_key = span_k then pa.other_name end),
              (case when pa.other_name_key = span_k then pa.name end)
            ) o(v)
            where pa.is_active and o.v is not null
            group by 1
          ) e
          where e.v <> '';
          how := 'exact';
        end if;

        -- Close, then partial: the span's words aligned, in order, to
        -- consecutive words of an alias name. Close covers the whole name;
        -- partial a run inside a longer one. The fewest extra words win, then
        -- the fewest typos; partial gives up past three pairs. An unfinished
        -- word, a partial match or a one-word typo needs the span to be the
        -- whole plant name. Both names are added.
        if cardinality(alts) = 0 and span_n > 0 then
          with aligned as (
            select x.id, x.slen - span_n as extra,
                   count(*) filter (where x.typo) as typos
            from unnest(m_qi, m_qn, m_id, m_side, m_pos, m_slen, m_typo, m_pre)
              x(qi, qn, id, side, pos, slen, typo, pre)
            where x.qi between cur and cur + span_len - 1
            group by x.id, x.side, x.slen, x.pos - x.qn
            having count(*) = span_n
               and (span_n = n_name_words
                    or (x.slen = span_n and not bool_or(x.pre)
                        and (span_n > 1 or not bool_or(x.typo))))
          ),
          best as (
            select a.id, a.extra from aligned a
            where (a.extra, a.typos) = (select b.extra, b.typos from aligned b
                                        order by b.extra, b.typos limit 1)
          ),
          chosen as (
            select distinct b.id, case when b.extra = 0 then 'close' else 'partial' end as kind
            from best b
            where b.extra = 0
               or ((span_n > 1 or char_length(span_txt) >= 4)
                   and (select count(distinct c.id) from best c) <= 3)
          )
          select coalesce(array_agg(e.v order by e.v), '{}'),
                 coalesce(array_agg(e.ids order by e.v), '{}'),
                 min(e.kind)
          into alts, alt_ids, how
          from (
            select btrim(regexp_replace(public.normalize_search_text(o.v), '\s+', ' ', 'g')) as v,
                   string_agg(distinct c.id::text, ',') as ids, min(c.kind) as kind
            from chosen c
            join public.plant_aliases pa on pa.id = c.id
            cross join lateral (values (pa.name), (pa.other_name)) o(v)
            group by 1
          ) e
          where e.v <> '';
        end if;
      end if;

      if cardinality(alts) > 0 or span_len = 1 then
        g := g + 1;
        span := span_txt;
        is_size := false;
        t := span_txt;
        typed := true;
        alias_match := null;
        alias_ids := null;
        return next;
        typed := false;
        alias_match := how;
        for i in 1 .. cardinality(alts) loop
          if alts[i] <> span_txt then
            t := alts[i];
            alias_ids := string_to_array(alt_ids[i], ',')::bigint[];
            return next;
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
end
$function$;

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
  -- One entry per alternative spelling of each query group.
  alt_text  text[] := '{}';
  alt_grp   int[]  := '{}';
  alt_size  bool[] := '{}';  -- a size phrase, matched whole
  alt_typed bool[] := '{}';  -- the user's own words, not an alias of them
  n_groups int := 0;
  n_docs bigint;
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

  select count(*) into n_docs from public.inventory inv where inv.is_active;

  -- Sizes and aliases (exact, close or partial): search_query_groups.
  select coalesce(array_agg(qg.t order by qg.k), '{}'),
         coalesce(array_agg(qg.g order by qg.k), '{}'),
         coalesce(array_agg(qg.is_size order by qg.k), '{}'),
         coalesce(array_agg(qg.typed order by qg.k), '{}'),
         coalesce(max(qg.g), 0)
  into alt_text, alt_grp, alt_size, alt_typed, n_groups
  from public.search_query_groups(search)
    with ordinality qg(g, span, t, is_size, typed, alias_match, alias_ids, k);

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
  'Fully double-quoted input uses case-insensitive literal-substring matching over composed/common/botanical/cultivar identity only, with no size/notes match and no alias, token, spelling or fuzzy expansion; unquoted input uses IDF-weighted graded word matching (whole word, typo, word start, notes at 0.4) with whole-phrase size matching and alias names from search_query_groups (exact, typo, unfinished last word or part of a name), and returns rows scoring at least half the best row. Filtering, supplier scoping and sorting are applied by the caller.';

COMMENT ON FUNCTION public.search_query_groups(text) IS
  'Parses a search into scored groups, one row per alternative spelling: the typed words, a size''s canonical spellings, or alias names (exact by plant key; else close: every word equal, a typo or the unfinished last word; else partial: a run of words in the fewest-extra-word names of at most three pairs). Used by search_inventory and Rosie''s aps-price.';

NOTIFY pgrst, 'reload schema';
COMMIT;
