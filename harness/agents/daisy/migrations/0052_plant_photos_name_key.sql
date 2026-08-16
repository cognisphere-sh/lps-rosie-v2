-- 0052_plant_photos_name_key.sql
-- Applied 2026-08-16 via the Supabase MCP at Bhoumik's request, in two steps
-- recorded in the Supabase history as `plant_photos_name_key` and
-- `search_plant_photos_name_key`.
--
-- Closes the last gap between `plant_photos`'s identity columns and
-- `inventory`'s. 0051 already gave photos the same three name parts, the same
-- derived `name`, the same `common_name_key` / `botanical_name_key` /
-- `cultivar_keys`, and the same `size` / `size_std` pair — but not `name_key`,
-- which is the one identity column `inventory` maintains as a GENERATED column
-- rather than through its trigger, so it was easy to miss.
--
-- WHY IT EARNS ITS PLACE, rather than being parity for its own sake: the
-- expression and the index are byte-identical to `inventory`'s, so the two
-- tables can be **joined on identity** —
--     join public.plant_photos ph on ph.name_key = inv.name_key
-- which is what a photo indicator on Plant Search needs (the plan's phase 4),
-- and what answers "is there a photo of this row?" without a text comparison.
--
-- ⚠ `name_key` is `normalize_plant_key(name)` and `name` is the **composed**
-- identity, so it is a whole-identity key, not a plant-name one:
-- `windmillpalmtrachycarpusfortunei`, not `windmillpalm`. It matches an
-- identity against an identical identity and nothing looser. Asking "do we
-- already have a photo of this plant?" is `common_name_key` /
-- `botanical_name_key` / `cultivar_keys`, or `search_plant_photos` — exactly
-- the same distinction that holds on `inventory`, which is the point of making
-- the two columns identical rather than inventing a different one here.
--
-- STILL DIFFERENT, and deliberately so: `inventory` also carries
-- `height_std` / `width_std` / `caliper_std` (double precision), which back the
-- app's numeric dimension range filters. Photos carry the raw `height` /
-- `width` / `caliper` text but no standardized pair, because nothing captures a
-- measured value for a photo yet and an unpopulated numeric column reads as a
-- promise the data does not keep. Add them when a range filter is actually
-- wanted on `/photos` — three columns and three partial indexes, mirroring
-- `inventory_supplier_*_std_idx`.

-- ---- step 1: the column ---------------------------------------------------
ALTER TABLE public.plant_photos
  ADD COLUMN IF NOT EXISTS name_key text
    GENERATED ALWAYS AS (public.normalize_plant_key(name)) STORED;

COMMENT ON COLUMN public.plant_photos.name_key IS
  'normalize_plant_key(name), generated — a key for the WHOLE composed identity, matching inventory.name_key exactly so the two tables can be joined on it. Not a plant-name key: use common_name_key / botanical_name_key / cultivar_keys, or search_plant_photos, to find a plant. Never written by hand.';

CREATE INDEX IF NOT EXISTS plant_photos_name_key_idx
  ON public.plant_photos (name_key);

ANALYZE public.plant_photos;

-- ---- step 2: project it from the RPC --------------------------------------
-- `search_plant_photos` has a fixed return type, so a new column has to be
-- added here before the app (or anything else going through PostgREST) can
-- read or filter on it. The body is otherwise unchanged from 0051 — only the
-- projection moves.
DROP FUNCTION IF EXISTS public.search_plant_photos(text, real);

CREATE FUNCTION public.search_plant_photos(
  search text DEFAULT ''::text,
  fuzzy_ratio real DEFAULT 0.34
)
RETURNS TABLE(
  id uuid,
  storage_bucket text, storage_path text, mime_type text, byte_size bigint,
  image_width integer, image_height integer, sha256 text,
  supplier_id bigint, supplier_name text, supplier_category text,
  supplier_city text, supplier_state text,
  name text, name_key text, common_name text, botanical_name text,
  cultivar_variety_trade_name text, cultivar_keys text[],
  size text, size_std text, height text, width text, caliper text,
  tags text[], caption text, notes text, source text,
  captured_at timestamp with time zone, is_active boolean,
  created_at timestamp with time zone, updated_at timestamp with time zone,
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
  select count(*) into n_docs from public.plant_photos p where p.is_active;

  if n_docs = 0 then
    return;
  end if;

  cur := 1;
  while cur <= n_words loop
    took := false;
    for span_len in reverse least(6, n_words - cur + 1) .. 1 loop
      span_txt := array_to_string(words[cur : cur + span_len - 1], ' ');

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
    from public.plant_photos p
    where p.is_active
      and ( public.normalize_search_text(
              public.plant_photo_document(p.name, p.size, p.caption, p.tags, p.notes))
            &@~ pgroonga_condition(grp_query, index_name => 'plant_photos_search_ngram_idx',
                                   fuzzy_max_distance_ratio => fuzzy_ratio)
         or public.normalize_search_text(
              public.plant_photo_document(p.name, p.size, p.caption, p.tags, p.notes))
            &@~ pgroonga_condition(grp_query, index_name => 'plant_photos_search_word_idx',
                                   fuzzy_max_distance_ratio => fuzzy_ratio) );

    grp_idf := grp_idf || ln(1.0 + (n_docs - df + 0.5) / (df + 0.5))::real;
  end loop;

  select string_agg(case when a.p then '"' || a.t || '"' else '(' || a.t || ')' end, ' OR ')
    into all_query
  from unnest(alt_text, alt_pad) a(t, p);

  return query
  with cand as materialized (
    select p.id, p.storage_bucket, p.storage_path, p.mime_type, p.byte_size,
           p.image_width, p.image_height, p.sha256,
           p.supplier_id, s.name as supplier_name, s.category as supplier_category,
           s.city as supplier_city, s.state as supplier_state,
           p.name, p.name_key, p.common_name, p.botanical_name,
           p.cultivar_variety_trade_name, p.cultivar_keys,
           p.size, p.size_std, p.height, p.width, p.caliper,
           p.tags, p.caption, p.notes, p.source,
           p.captured_at, p.is_active, p.created_at, p.updated_at,
           btrim(regexp_replace(public.normalize_search_text(
             public.plant_photo_document(p.name, p.size, p.caption, p.tags, p.notes)),
             '\s+', ' ', 'g')) as sdoc
    from public.plant_photos p
    left join public.suppliers s on s.id = p.supplier_id
    where p.is_active
      and ( public.normalize_search_text(
              public.plant_photo_document(p.name, p.size, p.caption, p.tags, p.notes))
            &@~ pgroonga_condition(all_query, index_name => 'plant_photos_search_ngram_idx',
                                   fuzzy_max_distance_ratio => fuzzy_ratio)
         or public.normalize_search_text(
              public.plant_photo_document(p.name, p.size, p.caption, p.tags, p.notes))
            &@~ pgroonga_condition(all_query, index_name => 'plant_photos_search_word_idx',
                                   fuzzy_max_distance_ratio => fuzzy_ratio) )
  )
  select c.id, c.storage_bucket, c.storage_path, c.mime_type, c.byte_size,
         c.image_width, c.image_height, c.sha256,
         c.supplier_id, c.supplier_name, c.supplier_category,
         c.supplier_city, c.supplier_state,
         c.name, c.name_key, c.common_name, c.botanical_name,
         c.cultivar_variety_trade_name, c.cultivar_keys,
         c.size, c.size_std, c.height, c.width, c.caliper,
         c.tags, c.caption, c.notes, c.source,
         c.captured_at, c.is_active, c.created_at, c.updated_at,
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
  order by coalesce(sc.rel, 0) desc, c.captured_at desc nulls last,
           c.created_at desc, c.name asc;
end
$function$;

COMMENT ON FUNCTION public.search_plant_photos(text, real) IS
  'Which active plant photos answer a query, ranked by IDF-weighted term coverage. Matches name/size/caption/tags/notes with substring and typo tolerance, expanding query terms through plant_aliases and treating a typed size as one phrase group. Filtering, supplier scoping and sorting are the callers job, applied over this result.';

GRANT EXECUTE ON FUNCTION public.search_plant_photos(text, real)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------ post-apply --
-- Verified 2026-08-16 against the four catalogued photos:
--   name_key populated on every existing row with no backfill (GENERATED), e.g.
--     `crapemyrtlelagerstroemianatchez`
--   `where name_key = normalize_plant_key('Windmill Palm - Trachycarpus
--     fortunei')` -> the 2 windmill palm rows. The same expression against the
--     bare `'Windmill Palm'` returns **0**, which is the whole-identity
--     semantics working as intended and the reason the column comment says so
--     out loud.
--   search_plant_photos returns 33 columns and the same rows and relevance as
--     before the projection change (`chusan palm` -> 2 rows @ 0.69, still
--     reached only through the plant_aliases edge)
--   `cultivar_keys && array['natchez']` over the RPC -> 1 row, which is the
--     app's new Cultivar filter
