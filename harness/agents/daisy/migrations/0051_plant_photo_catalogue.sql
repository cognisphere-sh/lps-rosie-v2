-- 0051_plant_photo_catalogue.sql
-- Applied 2026-08-16 via the Supabase MCP at Bhoumik's request, in three steps
-- recorded in the Supabase history as `plant_photos_table`,
-- `plant_photos_search_indexes` and `search_plant_photos`.
--
-- The searchable supplier plant-photo catalogue — MVP of the plan in daisy's
-- `knowledge/files/plans/searchable-photo-catalogue-plan.md`.
--
-- WHAT THIS IS
-- One table, one private bucket, one RPC. A photo is an independent record with
-- an *optional* supplier, not a column on `inventory`: useful photos predate
-- current availability, show plants nobody stocks right now, and outlive the
-- inventory rows they were taken beside. Retiring a supplier's inventory
-- therefore does not touch a photo.
--
-- WHAT THE PLAN ASKED FOR AND THIS DELIBERATELY DEFERS
-- The plan's phase-1 shape is seven tables — separate `photo_assets`,
-- many-to-many `plant_photo_subjects` / `photo_supplier_links` /
-- `photo_inventory_links` / `photo_tags` / `photo_provenance_events` — plus a
-- review workflow (`pending`/`approved`/`quarantined`), perceptual hashing and
-- generated `display.webp` / `thumb.webp` derivatives. None of that is here.
-- One photo carries one subject, at most one supplier and a `text[]` of tags,
-- which is what the catalogue has to hold today (see the two staged intake
-- batches under `knowledge/files/plant-reference-photos/intake/`). The columns
-- that make the bigger model reachable later without a rewrite ARE here:
-- `sha256` for exact dedupe, `source` for provenance, and the three separate
-- timestamps the plan insists on (`captured_at`, `created_at`, `updated_at`).
--
-- IDENTITY IS THE SAME SHAPE AS `inventory`, on purpose. Three name parts, a
-- derived `name`, derived `*_key` columns — so `plant_aliases` reaches photos
-- exactly as it reaches inventory, and a botanical-name search finds a photo
-- catalogued under its common name. That is the whole reason the search RPC
-- below is `search_inventory`'s algorithm rather than a new one.
--
-- THE BUCKET IS PRIVATE, unlike `lps`. Nothing reads an object key directly:
-- the app resolves a photo id to its path server-side and mints a short-lived
-- signed URL (`/api/photos/<id>/image`), and agents use
-- `scripts/agent/supabase/sign-url`. No storage policy is created, so only the
-- secret key / `postgres` reaches the objects at all.

-- ---- step 1: the bucket, the table, its triggers and RLS ------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('plant-photos', 'plant-photos', false, 26214400,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.plant_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Where the bytes are. `storage_path` is an object key inside
  -- `storage_bucket` — never a URL, never anything a browser supplied.
  storage_bucket text NOT NULL DEFAULT 'plant-photos',
  storage_path text NOT NULL,
  mime_type text,
  byte_size bigint,
  image_width integer,
  image_height integer,
  -- Exact-duplicate detection. The same file catalogued twice is one row with
  -- two provenance notes, not two objects.
  sha256 text,

  -- Optional. A photo with no supplier is still a catalogue photo.
  supplier_id bigint REFERENCES public.suppliers(id) ON DELETE SET NULL,

  -- Plant identity, the same three parts `inventory` carries. Each holds only
  -- what the source said; `name` is composed from them by trigger.
  common_name text,
  botanical_name text,
  cultivar_variety_trade_name text,
  name text,
  common_name_key text,
  botanical_name_key text,
  cultivar_keys text[],

  -- Commercial context, when the source stated it. Never inferred from the
  -- apparent scale of the plant in the frame.
  size text,
  size_std text,
  height text,
  width text,
  caliper text,

  tags text[] NOT NULL DEFAULT '{}',
  caption text,
  notes text,
  -- Verbatim provenance: who supplied it, through which channel, when.
  source text,

  -- Three distinct times, per the plan: when the photo was taken, when we
  -- received it, and when this row last changed. Freshness is derived from
  -- `captured_at` (falling back to `created_at`), never from a hand-set flag.
  captured_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT plant_photos_storage_path_not_blank CHECK (btrim(storage_path) <> '')
);

COMMENT ON TABLE public.plant_photos IS
  'Searchable plant photo catalogue. One row per catalogued photo; supplier and commercial size are optional and are recorded only when a source stated them.';
COMMENT ON COLUMN public.plant_photos.storage_path IS
  'Object key inside storage_bucket (private). Resolve to a signed URL server-side; never accept a path from a client.';
COMMENT ON COLUMN public.plant_photos.source IS
  'Verbatim provenance — who supplied the photo, through which channel, and when.';
COMMENT ON COLUMN public.plant_photos.captured_at IS
  'When the photo was taken, if known. Distinct from created_at (when we received it).';

-- One catalogue row per object, and one row per distinct file.
CREATE UNIQUE INDEX IF NOT EXISTS plant_photos_object_idx
  ON public.plant_photos (storage_bucket, storage_path);
CREATE UNIQUE INDEX IF NOT EXISTS plant_photos_sha256_idx
  ON public.plant_photos (sha256) WHERE sha256 IS NOT NULL;

-- Filter columns. The app filters the RPC's result set in SQL, and browses the
-- table directly when there is no query; both paths use these.
CREATE INDEX IF NOT EXISTS plant_photos_supplier_idx
  ON public.plant_photos (supplier_id, is_active);
CREATE INDEX IF NOT EXISTS plant_photos_active_created_idx
  ON public.plant_photos (is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS plant_photos_size_std_idx
  ON public.plant_photos (size_std) WHERE is_active AND size_std IS NOT NULL;
CREATE INDEX IF NOT EXISTS plant_photos_cultivar_keys_idx
  ON public.plant_photos USING gin (cultivar_keys);
CREATE INDEX IF NOT EXISTS plant_photos_tags_idx
  ON public.plant_photos USING gin (tags);

-- The same derivation `inventory` gets, so the two tables agree on what a
-- plant's identity is and the alias graph reaches both. Tags are folded to
-- trimmed lowercase here so the facet list is the vocabulary, not its casings.
CREATE OR REPLACE FUNCTION public.plant_photos_derive_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  composed text;
BEGIN
  new.common_name                 := nullif(btrim(new.common_name), '');
  new.botanical_name              := nullif(btrim(new.botanical_name), '');
  new.cultivar_variety_trade_name := nullif(btrim(new.cultivar_variety_trade_name), '');

  composed := public.compose_plant_name(
                new.common_name, new.botanical_name, new.cultivar_variety_trade_name);
  IF composed IS NOT NULL THEN
    new.name := composed;
  END IF;

  new.common_name_key    := nullif(public.normalize_plant_key(new.common_name), '');
  new.botanical_name_key := nullif(public.normalize_plant_key(new.botanical_name), '');

  new.cultivar_keys := (
    SELECT array_agg(DISTINCT k)
    FROM (
      SELECT nullif(public.normalize_plant_key(part), '') AS k
      FROM regexp_split_to_table(
             coalesce(new.cultivar_variety_trade_name, ''), '\s*[,;|]\s*') AS part
    ) s
    WHERE k IS NOT NULL
  );

  new.tags := coalesce((
    SELECT array_agg(DISTINCT t ORDER BY t)
    FROM (
      SELECT nullif(btrim(lower(tag)), '') AS t
      FROM unnest(coalesce(new.tags, '{}'::text[])) AS tag
    ) s
    WHERE t IS NOT NULL
  ), '{}'::text[]);

  RETURN new;
END;
$function$;

DROP TRIGGER IF EXISTS trg_plant_photos_derive_identity ON public.plant_photos;
CREATE TRIGGER trg_plant_photos_derive_identity
  BEFORE INSERT OR UPDATE ON public.plant_photos
  FOR EACH ROW EXECUTE FUNCTION public.plant_photos_derive_identity();

DROP TRIGGER IF EXISTS handle_updated_at ON public.plant_photos;
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.plant_photos
  FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');

-- RLS from day one, same shape as every other application table: `anon`
-- reaches nothing, `authenticated` has full access, and the app's secret key
-- and the agents' `postgres` role bypass it.
ALTER TABLE public.plant_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated full access" ON public.plant_photos;
CREATE POLICY "authenticated full access" ON public.plant_photos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---- step 2: the two search indexes --------------------------------------
-- THE DOCUMENT is `name + size + caption + tags + notes`. The three name parts
-- live inside `name`. Dimensions are deliberately out of it — they are filter
-- columns, not search text — exactly as on `inventory`.
--
-- `plant_photo_document()` exists so the expression has ONE definition. On
-- `inventory` the identical concatenation is repeated in the index and four
-- times inside the RPC, and a byte of drift silently disables the indexes.
-- Here the function is the contract; it is IMMUTABLE so it can be indexed.
CREATE OR REPLACE FUNCTION public.plant_photo_document(
  name text, size text, caption text, tags text[], notes text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT coalesce($1, '') || ' ' || coalesce($2, '') || ' ' || coalesce($3, '')
      || ' ' || coalesce(array_to_string($4, ' '), '') || ' ' || coalesce($5, '');
$function$;

COMMENT ON FUNCTION public.plant_photo_document(text, text, text, text[], text) IS
  'The searchable text of a plant photo: name + size + caption + tags + notes. The single definition behind both plant_photos_search_* indexes and search_plant_photos.';

SET statement_timeout = '600s';

-- Exact and substring matching: `sycamor` and `ycamor` both find `sycamore`.
CREATE INDEX IF NOT EXISTS plant_photos_search_ngram_idx
  ON public.plant_photos
  USING pgroonga (
    public.normalize_search_text(
      public.plant_photo_document(name, size, caption, tags, notes))
  )
  WITH (tokenizer='TokenBigramSplitSymbolAlphaDigit');

-- A whole-word lexicon, which is the only thing pgroonga's fuzzy can compute
-- edit distance against. Measured on inventory: fuzzy on a bigram lexicon
-- returns nothing for a substitution typo.
CREATE INDEX IF NOT EXISTS plant_photos_search_word_idx
  ON public.plant_photos
  USING pgroonga (
    public.normalize_search_text(
      public.plant_photo_document(name, size, caption, tags, notes))
  )
  WITH (tokenizer='TokenDelimit');

-- ---- step 3: the search RPC ----------------------------------------------
-- `search_inventory`'s ranking, over photos. Same contract, deliberately:
--
--   * Two parameters, neither a filter. Supplier scoping, tag/size filtering
--     and sorting are the caller's job, applied as SQL over this result —
--     PostgREST puts them in an outer query before its own `range()`, so a
--     filtered page and its `count` describe the same set.
--   * The query is partitioned into groups longest-span-first; a span naming an
--     alias carries the other endpoint as an alternative and still counts once;
--     a span shaped like a size becomes one phrase group matched on a token
--     boundary with fuzzy off.
--   * `relevance = Σ idf(group matched)` — coverage weighted by rarity. Term
--     frequency is binary.
--   * An empty search returns zero rows immediately. Browsing the catalogue is
--     a plain select from `plant_photos`, which is what the app's no-query grid
--     does.
--
-- The one structural difference from `search_inventory`: suppliers are joined
-- LEFT, because a photo's supplier is optional. An inner join here would hide
-- every unattributed photo from search.
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
  name text, common_name text, botanical_name text,
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
  alt_text text[] := '{}';   -- every alternative, flattened
  alt_grp  int[]  := '{}';   -- which group each alternative belongs to
  alt_pad  bool[] := '{}';   -- is this alternative a size phrase?
  grp_idf  real[] := '{}';   -- one IDF per group
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

  -- Nothing to weight against. A one-row catalogue would otherwise divide the
  -- IDF by a document count of zero on its first search.
  if n_docs = 0 then
    return;
  end if;

  cur := 1;
  while cur <= n_words loop
    took := false;
    for span_len in reverse least(6, n_words - cur + 1) .. 1 loop
      span_txt := array_to_string(words[cur : cur + span_len - 1], ' ');

      -- A size span is one phrase group. Its alternatives are the spellings a
      -- *document* can hold, not the ones a user types.
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
           p.name, p.common_name, p.botanical_name,
           p.cultivar_variety_trade_name, p.cultivar_keys,
           p.size, p.size_std, p.height, p.width, p.caliper,
           p.tags, p.caption, p.notes, p.source,
           p.captured_at, p.is_active, p.created_at, p.updated_at,
           btrim(regexp_replace(public.normalize_search_text(
             public.plant_photo_document(p.name, p.size, p.caption, p.tags, p.notes)),
             '\s+', ' ', 'g')) as sdoc
    from public.plant_photos p
    -- LEFT: a photo's supplier is optional, and an unattributed photo is still
    -- part of the catalogue.
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
         c.name, c.common_name, c.botanical_name,
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
GRANT EXECUTE ON FUNCTION public.plant_photo_document(text, text, text, text[], text)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------ post-apply --
-- Verified on an empty catalogue, 2026-08-16:
--   `search_plant_photos('')`             -> 0 rows
--   `search_plant_photos('live oak')`     -> 0 rows, no division by zero
-- Then against the four staged intake photos (see NOTE.md for the numbers):
--   alias reach, size ranking, supplier and tag filters, and the empty-query
--   browse path all exercised.
