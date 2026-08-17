-- 0057_quoted_exact_plant_search.sql
--
-- Bhoumik-approved quoted exact mode, 2026-08-17.
--
-- One outer pair of straight double quotes changes retrieval only for that
-- call: `"Italian Cypress"` matches an exact common/botanical/composed identity
-- part (plus one reviewed direct alias hop), independent of punctuation and
-- word order. Extra identity tokens do not match, so Arizona Cypress / Blue Ice
-- cannot enter through broad substring, typo or note matching. Unquoted input
-- executes the 0050 discovery body byte-for-byte unchanged.
--
-- No inventory or alias rows are written by this migration.

BEGIN;
SET LOCAL statement_timeout = '300s';

CREATE OR REPLACE FUNCTION public.normalize_identity_token_key(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $function$
  SELECT string_agg(token, ' ' ORDER BY token)
  FROM regexp_split_to_table(
    btrim(regexp_replace(public.normalize_search_text(input), '\s+', ' ', 'g')),
    '\s+'
  ) AS words(token)
  WHERE token <> ''
$function$;

COMMENT ON FUNCTION public.normalize_identity_token_key(text) IS
  'Order-independent normalized token signature for exact identity-part comparison; punctuation/case differ, extra tokens do not.';

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
  raw_search text := btrim(search);
  exact_mode boolean := char_length(raw_search) >= 2
    and left(raw_search, 1) = '"' and right(raw_search, 1) = '"'
    and position('"' in substring(raw_search from 2 for char_length(raw_search) - 2)) = 0;
  exact_text text;
  exact_sig text;
  exact_key text;
  exact_sigs text[] := '{}';
  exact_keys text[] := '{}';
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
  -- exact identity mode. Internal/unbalanced quotes stay on the established
  -- broad discovery path rather than being guessed at.
  if exact_mode then
    exact_text := btrim(substring(raw_search from 2 for char_length(raw_search) - 2));
    exact_sig := public.normalize_identity_token_key(exact_text);
    exact_key := nullif(public.normalize_plant_key(exact_text), '');
    if exact_sig is null or exact_sig = '' or exact_key is null then
      return;
    end if;

    -- One reviewed alias hop is still exact equivalence, not fuzzy discovery.
    -- The token signature makes `Italian Cypress` and `Cypress, Italian` the
    -- same exact part while refusing extra tokens such as `Blue Ice`.
    select array_agg(distinct x.sig), array_agg(distinct x.key)
      into exact_sigs, exact_keys
    from (
      select exact_sig as sig, exact_key as key
      union all
      select public.normalize_identity_token_key(e.v), public.normalize_plant_key(e.v)
      from public.plant_aliases pa
      cross join lateral (values
        (case when public.normalize_identity_token_key(pa.name) = exact_sig then pa.other_name end),
        (case when public.normalize_identity_token_key(pa.other_name) = exact_sig then pa.name end)
      ) e(v)
      where pa.is_active and e.v is not null
    ) x
    where x.sig is not null and x.sig <> '' and x.key is not null and x.key <> '';

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
           (case
              when sig.name_sig = exact_sig or sig.common_sig = exact_sig
                or sig.botanical_sig = exact_sig
                or inv.name_key = exact_key or inv.common_name_key = exact_key
                or inv.botanical_name_key = exact_key
                or coalesce(inv.cultivar_keys, '{}') && array[exact_key]
              then 2 else 1
            end)::real as relevance
    from public.inventory inv
    join public.suppliers s on s.id = inv.supplier_id
    left join public.inventory_sources src on src.id = inv.source_id
    cross join lateral (select
      public.normalize_identity_token_key(inv.name) as name_sig,
      public.normalize_identity_token_key(inv.common_name) as common_sig,
      public.normalize_identity_token_key(inv.botanical_name) as botanical_sig
    ) sig
    where inv.is_active
      and (inv.source_id is null or src.is_active)
      and (sig.name_sig = any(exact_sigs)
        or sig.common_sig = any(exact_sigs)
        or sig.botanical_sig = any(exact_sigs)
        or inv.name_key = any(exact_keys)
        or inv.common_name_key = any(exact_keys)
        or inv.botanical_name_key = any(exact_keys)
        or coalesce(inv.cultivar_keys, '{}') && exact_keys)
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
  'Quoted input uses exact identity-part/direct-alias matching; unquoted input uses broad IDF-weighted partial/fuzzy discovery. Filtering, supplier scoping and sorting are applied by the caller.';

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Required post-apply checks (capture counts and id digests before/after):
--   unquoted Italian Cypress and Cupressus sempervirens: unchanged;
--   quoted forms: no Arizona, arizonica, Blue Ice or unrelated identity;
--   reversed `"Cypress Italian"`: same ids as `"Italian Cypress"`;
--   empty/unbalanced quotes: no exception; unbalanced stays discovery mode.
-- Rollback requires restoring search_inventory from 0050, then:
--   DROP FUNCTION public.normalize_identity_token_key(text);
