-- 0050_drop_other_names_and_alias_type.sql
--
-- Retire the **Also known as** column and the alias edge type (Bhoumik,
-- 2026-08-15).
--
-- `other_names` was one derived column: for each row, the active alias
-- endpoints incident to its identity keys, rendered as a display string. It
-- cost more than it returned. 90% of active rows (28,444 of 31,560) had it
-- NULL, it could not be indexed — `plant_alias_names()` is STABLE and reads a
-- second table, so an `ilike` on it meant evaluating the function for every
-- candidate row — and it was the only reason `inventory_enriched` existed.
-- The app now reads `inventory` directly on every path.
--
-- Dropping it orphans `plant_alias_names()`, which was the last reader of
-- `plant_aliases.alias_type`. Search never consulted the type: since 0045 the
-- query expander substitutes the opposite endpoint of every active incident
-- edge without filtering on it, so `plant` and `cultivar` edges already
-- expanded a query identically. The column's remaining job was deciding which
-- identity part an alias hung off for display, and there is no display left.
-- **Retrieval is therefore unchanged by this migration** — the same rows come
-- back, in the same order, for every search.
--
-- What is genuinely lost: the record of what the source asserted, plant-level
-- versus cultivar-level. Accepted explicitly.
--
-- Uniqueness moves from `(alias_type, name_key, other_name_key)` to
-- `(name_key, other_name_key)`. Verified before writing this: zero pairs exist
-- under both types, so no row collides and no dedup is needed.
--
--   SELECT count(*) FROM (
--     SELECT name_key, other_name_key FROM public.plant_aliases
--     GROUP BY 1,2 HAVING count(DISTINCT alias_type) > 1) t;   -- 0

-- ---------------------------------------------------------------- 1. view --
-- The only consumer of plant_alias_names() besides the RPC. Every column it
-- carried beyond `other_names` was a passthrough of `inventory`, so callers
-- move to the table with no projection change.
DROP VIEW public.inventory_enriched;

-- --------------------------------------------------------------- 2. RPC ---
-- `other_names` leaves the projection, which changes the return type, so this
-- is DROP + CREATE rather than CREATE OR REPLACE. One signature in, one
-- signature out — PostgREST must never see two.
--
-- Everything else is carried over byte-for-byte. In particular the
-- normalize_search_text() concatenation below must stay identical to the two
-- `inventory_search_*_idx` index expressions or the indexes are skipped.
DROP FUNCTION public.search_inventory(text, real);

CREATE FUNCTION public.search_inventory(search text DEFAULT ''::text,
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

-- ------------------------------------------------- 3. plant_alias_names ----
-- Now unreferenced: the view is gone and the RPC no longer projects
-- `other_names`. Dropped explicitly — a SQL function body quoted as a string
-- literal carries no tracked dependency, so nothing would have caught this at
-- DDL time; it would simply have failed at call time.
DROP FUNCTION public.plant_alias_names(text, text, text, text[]);

-- ---------------------------------------------------- 4. dedupe trigger ----
-- The rejection test loses its `alias_type` leg. The property that matters is
-- unchanged and is the one 0010 lost: a pair is rejected in **both**
-- orientations, and regardless of `is_active`, so a retired pair is a genuine
-- blocklist rather than something that can return reversed.
CREATE OR REPLACE FUNCTION public.dedupe_plant_aliases()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  nk text := public.normalize_plant_key(new.name);
  ok text := public.normalize_plant_key(new.other_name);
BEGIN
  IF nk = '' OR ok = '' OR nk = ok
     OR EXISTS (
       SELECT 1 FROM public.plant_aliases p
       WHERE ( (p.name_key = nk AND p.other_name_key = ok)
            OR (p.name_key = ok AND p.other_name_key = nk) )
     )
  THEN
    RETURN NULL;
  END IF;
  RETURN new;
END;
$function$;

-- ------------------------------------------------------- 5. uniqueness -----
-- Same index name, one column shorter.
DROP INDEX public.plant_aliases_pair_key_idx;
CREATE UNIQUE INDEX plant_aliases_pair_key_idx
  ON public.plant_aliases (name_key, other_name_key);

-- ------------------------------------------------------ 6. the column ------
-- The CHECK constraint references only this column and goes with it.
ALTER TABLE public.plant_aliases DROP COLUMN alias_type;

-- Verify after apply:
--   SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname = 'search_inventory';          -- 1
--   SELECT to_regclass('public.inventory_enriched');                         -- NULL
--   SELECT to_regprocedure('public.plant_alias_names(text,text,text,text[])');-- NULL
--   SELECT count(*) FROM public.search_inventory('live oak');                -- >0
--
-- Rollback is 0040/0046-shaped: recreate plant_alias_names(), recreate
-- inventory_enriched with security_invoker = true, restore the RPC's
-- `other_names` column, re-add `alias_type` — but the per-row type values are
-- not recoverable.
