-- 0040_typed_plant_identity.sql
-- Applied 2026-08-14 via the Supabase MCP at Bhoumik's request, as one
-- transaction (`typed_plant_identity`).
--
-- WHAT THIS CHANGES
-- `inventory.name` stopped being the only place a plant's identity lived. The
-- three things a source actually prints — the common name, the botanical name,
-- and the cultivar / variety / trade name — each get their own column, and
-- `name` becomes the *composition* of them:
--
--     common_name                 = 'Forest Pansy Redbud'
--     botanical_name              = 'Cercis canadensis'
--     cultivar_variety_trade_name = 'Forest Pansy'
--     name  (derived)             = 'Forest Pansy Redbud [Cercis canadensis, Forest Pansy]'
--
-- That is byte-for-byte the format the ingestion SOP already required, so the
-- search document, `name_key`, and every existing row are unaffected. What is
-- new is that the parts are separately readable, filterable and aliasable
-- instead of having to be re-parsed out of a bracket.
--
-- `plant_other_names` is replaced by `plant_aliases`, which is **typed**:
--   * `alias_type = 'plant'`    — the two sides name the same plant
--                                 (common ↔ botanical, spelling variants,
--                                 accepted synonyms). Matched against a row's
--                                 `common_name_key` / `botanical_name_key`.
--   * `alias_type = 'cultivar'` — the two sides name the same selection
--                                 (cultivar ↔ variety ↔ trade name). Matched
--                                 against a row's `cultivar_key` *only*.
--
-- The typing is the point. Migrations 0006/0007/0021/0025/0028/0029 all exist
-- because a cultivar name in an untyped alias table makes every generic row of
-- that species answer a search for one specific selection. A `cultivar` edge
-- here physically cannot reach a species row — it is only ever compared to the
-- cultivar column — so the failure mode those migrations kept cleaning up after
-- is closed structurally rather than by a quality bar alone.
--
-- NO BACKFILL, BY INSTRUCTION. Bhoumik is dropping the catalogue and
-- re-ingesting it. All 235,976 existing rows keep their `name` and get NULL in
-- all three parts; the 13,700 `plant_other_names` pairs are dropped with the
-- table. Deriving the parts from the existing `name` was not attempted — 0005
-- tried exactly that from the alias graph and abandoned it, and the SOP
-- requires each part to be what the *source* printed.

BEGIN;
SET LOCAL statement_timeout = '300s';

-- ---------------------------------------------------------------- 1. parts --
-- Plain nullable columns: metadata-only, no table rewrite on 236k rows.
ALTER TABLE public.inventory
  ADD COLUMN common_name text,
  ADD COLUMN botanical_name text,
  ADD COLUMN cultivar_variety_trade_name text;

COMMENT ON COLUMN public.inventory.common_name IS
  'The plant''s common name exactly as the availability source prints it. NULL when the source prints none — never inferred.';
COMMENT ON COLUMN public.inventory.botanical_name IS
  'The botanical / scientific name exactly as the availability source prints it. NULL when the source prints none — never supplied from outside knowledge.';
COMMENT ON COLUMN public.inventory.cultivar_variety_trade_name IS
  'The cultivar, variety or trade name exactly as the availability source prints it. NULL when the source prints none.';

-- Identity keys for the parts, the same normalization `name_key` uses. These
-- are maintained by trg_inventory_derive_identity below rather than being
-- GENERATED columns: a stored generated column forces a full rewrite of
-- inventory, which would also rebuild the pgroonga and trgm indexes. Never
-- write them by hand — the trigger overwrites whatever you put there.
ALTER TABLE public.inventory
  ADD COLUMN common_name_key text,
  ADD COLUMN botanical_name_key text,
  ADD COLUMN cultivar_key text;

COMMENT ON COLUMN public.inventory.common_name_key IS
  'normalize_plant_key(common_name), maintained by trg_inventory_derive_identity. Never write it.';
COMMENT ON COLUMN public.inventory.botanical_name_key IS
  'normalize_plant_key(botanical_name), maintained by trg_inventory_derive_identity. Never write it.';
COMMENT ON COLUMN public.inventory.cultivar_key IS
  'normalize_plant_key(cultivar_variety_trade_name), maintained by trg_inventory_derive_identity. Never write it.';

-- ------------------------------------------------------- 2. composed name --
-- One implementation of the SOP's name format, so nothing can spell it
-- differently. Head is the common name when there is one, else the botanical
-- name, else the cultivar; whatever is left goes in the bracket in the order
-- botanical, cultivar.
CREATE OR REPLACE FUNCTION public.compose_plant_name(
  common_name text,
  botanical_name text,
  cultivar_variety_trade_name text
) RETURNS text
LANGUAGE sql IMMUTABLE AS $function$
  WITH p AS (
    SELECT nullif(btrim(coalesce(common_name, '')), '')                 AS c,
           nullif(btrim(coalesce(botanical_name, '')), '')              AS b,
           nullif(btrim(coalesce(cultivar_variety_trade_name, '')), '') AS v
  ), h AS (
    SELECT coalesce(c, b, v) AS head,
           CASE
             WHEN c IS NOT NULL THEN array_remove(ARRAY[b, v], NULL)
             WHEN b IS NOT NULL THEN array_remove(ARRAY[v], NULL)
             ELSE '{}'::text[]
           END AS tail
    FROM p
  )
  SELECT CASE
           WHEN head IS NULL THEN NULL
           WHEN cardinality(tail) = 0 THEN head
           ELSE head || ' [' || array_to_string(tail, ', ') || ']'
         END
  FROM h
$function$;

COMMENT ON FUNCTION public.compose_plant_name(text, text, text) IS
  'The SOP plant-name format: Common [Botanical, Cultivar], each part omitted when absent. NULL when all three are.';

CREATE OR REPLACE FUNCTION public.inventory_derive_identity()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  composed text;
BEGIN
  -- Blank is not a value: an empty part must not key to '' and match everything.
  new.common_name                 := nullif(btrim(new.common_name), '');
  new.botanical_name              := nullif(btrim(new.botanical_name), '');
  new.cultivar_variety_trade_name := nullif(btrim(new.cultivar_variety_trade_name), '');

  composed := public.compose_plant_name(
                new.common_name, new.botanical_name, new.cultivar_variety_trade_name);
  -- A row with no parts at all keeps whatever `name` it was given — that is
  -- every pre-0040 row, and every hand-entered one.
  IF composed IS NOT NULL THEN
    new.name := composed;
  END IF;

  new.common_name_key    := nullif(public.normalize_plant_key(new.common_name), '');
  new.botanical_name_key := nullif(public.normalize_plant_key(new.botanical_name), '');
  new.cultivar_key       := nullif(public.normalize_plant_key(new.cultivar_variety_trade_name), '');
  RETURN new;
END;
$function$;

COMMENT ON FUNCTION public.inventory_derive_identity() IS
  'Keeps inventory.name and the three part keys derived from the three name parts. name is not hand-editable on a row that has parts.';

CREATE TRIGGER trg_inventory_derive_identity
  BEFORE INSERT OR UPDATE ON public.inventory
  FOR EACH ROW EXECUTE FUNCTION public.inventory_derive_identity();

-- Mostly-NULL columns, so these are small and cheap.
CREATE INDEX inventory_common_name_key_idx
  ON public.inventory (common_name_key) WHERE common_name_key IS NOT NULL;
CREATE INDEX inventory_botanical_name_key_idx
  ON public.inventory (botanical_name_key) WHERE botanical_name_key IS NOT NULL;
CREATE INDEX inventory_cultivar_key_idx
  ON public.inventory (cultivar_key) WHERE cultivar_key IS NOT NULL;

-- --------------------------------------------------------- 3. plant_aliases --
CREATE TABLE public.plant_aliases (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alias_type text NOT NULL
    CHECK (alias_type IN ('plant', 'cultivar')),
  name text NOT NULL,
  other_name text NOT NULL,
  name_key text GENERATED ALWAYS AS (nullif(public.normalize_plant_key(name), '')) STORED,
  other_name_key text GENERATED ALWAYS AS (nullif(public.normalize_plant_key(other_name), '')) STORED,
  -- Evidence. The SOP has always required that a writer be able to quote the
  -- line printing both sides; `plant_other_names` had nowhere to put it, which
  -- is why 0029 had to attribute a bad edge by reading id ordering.
  source_id uuid REFERENCES public.inventory_sources(id),
  source_line text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.plant_aliases IS
  'Typed name equivalences. A pair says "these two strings name the same thing"; alias_type says what kind of thing.';
COMMENT ON COLUMN public.plant_aliases.alias_type IS
  '''plant'' — same plant (common <-> botanical, synonym, spelling variant); matched against inventory.common_name_key / botanical_name_key. ''cultivar'' — same selection (cultivar <-> variety <-> trade name); matched against inventory.cultivar_key only.';
COMMENT ON COLUMN public.plant_aliases.source_line IS
  'The verbatim line from the ingested source that prints both sides. Required by the ingestion SOP; a pair with no quotable line does not ship.';

CREATE UNIQUE INDEX plant_aliases_pair_key_idx
  ON public.plant_aliases (alias_type, name_key, other_name_key);
CREATE INDEX plant_aliases_name_key_idx ON public.plant_aliases (name_key);
CREATE INDEX plant_aliases_other_key_idx ON public.plant_aliases (other_name_key);
CREATE INDEX plant_aliases_pgroonga_idx
  ON public.plant_aliases
  USING pgroonga (public.normalize_search_text(name || ' ' || other_name))
  WITH (tokenizer='TokenDelimit');

-- Blind-insert contract, same as the table this replaces: duplicates,
-- self-pairs and empty keys are silently skipped rather than raising.
--
-- Two differences from dedupe_plant_other_names(). It is scoped by
-- `alias_type`, so the same two strings can legitimately be a plant pair and a
-- cultivar pair. And it rejects the **mirrored** orientation too, which closes
-- the hole documented against the old table: 168 rows existed there as
-- (b, a) copies of a retired (a, b), and because search treats both endpoints
-- symmetrically, retiring an edge did not stop it coming back reversed.
-- Retired rows still block re-insertion, so `is_active = false` is a blocklist.
CREATE OR REPLACE FUNCTION public.dedupe_plant_aliases()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  nk text := public.normalize_plant_key(new.name);
  ok text := public.normalize_plant_key(new.other_name);
BEGIN
  IF nk = '' OR ok = '' OR nk = ok
     OR EXISTS (
       SELECT 1 FROM public.plant_aliases p
       WHERE p.alias_type = new.alias_type
         AND ( (p.name_key = nk AND p.other_name_key = ok)
            OR (p.name_key = ok AND p.other_name_key = nk) )
     )
  THEN
    RETURN NULL; -- skip row
  END IF;
  RETURN new;
END;
$function$;

CREATE TRIGGER trg_dedupe_plant_aliases
  BEFORE INSERT ON public.plant_aliases
  FOR EACH ROW EXECUTE FUNCTION public.dedupe_plant_aliases();

CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.plant_aliases
  FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');

-- 0011's rule, and 0020's lesson: a table created after it is served to anon by
-- PostgREST unless RLS is on. Same policy shape as plant_other_names had.
ALTER TABLE public.plant_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access" ON public.plant_aliases
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plant_aliases TO authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.plant_aliases_id_seq TO authenticated, service_role;

-- ------------------------------------------------- 4. the derived alias list --
-- One implementation, used by both inventory_enriched and search_inventory, so
-- the two cannot drift the way the old inlined UNIONs could.
--
-- **Only names that are not already in the full name are returned.** An alias
-- whose identity key is a substring of the row's own `name_key` is already
-- visible in the Plant column, so repeating it under "Also known as" is noise.
-- This subsumes the old "not the row's own key" test: because `name` is the
-- composition of the three parts, `name_key` contains all three part keys.
CREATE OR REPLACE FUNCTION public.plant_alias_names(
  p_name_key text,
  p_common_key text,
  p_botanical_key text,
  p_cultivar_key text
) RETURNS text
LANGUAGE sql STABLE AS $function$
  SELECT string_agg(x.other_name, ', ' ORDER BY x.other_name)
  FROM (
    SELECT DISTINCT ON (y.k) y.v AS other_name
    FROM (
      SELECT pa.other_name_key AS k, pa.other_name AS v
        FROM public.plant_aliases pa
       WHERE pa.is_active AND pa.alias_type = 'plant'
         AND pa.name_key IN (p_name_key, p_common_key, p_botanical_key)
      UNION ALL
      SELECT pa.name_key, pa.name
        FROM public.plant_aliases pa
       WHERE pa.is_active AND pa.alias_type = 'plant'
         AND pa.other_name_key IN (p_name_key, p_common_key, p_botanical_key)
      UNION ALL
      SELECT pa.other_name_key, pa.other_name
        FROM public.plant_aliases pa
       WHERE pa.is_active AND pa.alias_type = 'cultivar'
         AND pa.name_key = p_cultivar_key
      UNION ALL
      SELECT pa.name_key, pa.name
        FROM public.plant_aliases pa
       WHERE pa.is_active AND pa.alias_type = 'cultivar'
         AND pa.other_name_key = p_cultivar_key
    ) y
    WHERE y.k IS NOT NULL
      AND strpos(coalesce(p_name_key, ''), y.k) = 0
    ORDER BY y.k, y.v
  ) x
$function$;

COMMENT ON FUNCTION public.plant_alias_names(text, text, text, text) IS
  'The "Also known as" value for one inventory row: active alias endpoints incident to its identity keys, minus every name already spelled inside its own composed name.';

-- ------------------------------------------------------ 5. inventory_enriched --
-- Dropped and recreated rather than replaced, so the new columns sit beside the
-- ones they belong with instead of being appended (CREATE OR REPLACE VIEW
-- cannot reorder). Nothing else depends on it.
DROP VIEW public.inventory_enriched;
CREATE VIEW public.inventory_enriched AS
SELECT inv.id,
       inv.name,
       inv.common_name,
       inv.botanical_name,
       inv.cultivar_variety_trade_name,
       inv.name_key,
       inv.common_name_key,
       inv.botanical_name_key,
       inv.cultivar_key,
       public.plant_alias_names(inv.name_key, inv.common_name_key,
                                inv.botanical_name_key, inv.cultivar_key) AS other_names,
       inv.size, inv.size_std, inv.unit_price, inv.quantity,
       inv.height, inv.width, inv.caliper,
       inv.height_std, inv.width_std, inv.caliper_std,
       inv.notes, inv.internal_notes, inv.image_url,
       inv.supplier_id, inv.source_id, inv.is_active,
       inv.created_at, inv.updated_at
FROM public.inventory inv;
-- Owned by postgres (BYPASSRLS): without this the view hands anon the whole
-- catalogue back and enabling RLS on inventory achieves nothing.
ALTER VIEW public.inventory_enriched SET (security_invoker = true);
GRANT SELECT ON public.inventory_enriched TO anon, authenticated, service_role;

-- ------------------------------------------------------- 6. search_inventory --
-- Dropped and recreated: the RETURNS TABLE gains the three parts and
-- `internal_notes`, and a return-type change cannot go through CREATE OR
-- REPLACE. Same signature, same ordering rules, same dimension bounds.
--
-- `internal_notes` is added because the function has to be recreated anyway —
-- 0039 deliberately left it out to avoid exactly this drop, and the app has
-- been hydrating the column with an extra keyed read per page ever since.
--
-- The pgroonga document is UNCHANGED and `inventory_pgroonga_idx` is not
-- rebuilt. It does not need to be: `name` is the composition of all three
-- parts, so every token of every part is already in the document.
DROP FUNCTION IF EXISTS public.search_inventory(
  text, bigint[], real, text, text,
  double precision, double precision, double precision,
  double precision, double precision, double precision);

CREATE FUNCTION public.search_inventory(
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
    -- Only the two endpoints of directly matching, reviewed equivalence edges
    -- participate. Never traverse a reverse hub to sibling alternatives.
    --
    -- The two arrays are kept apart on purpose. A `plant` edge is compared to a
    -- row's common/botanical name; a `cultivar` edge only ever to its cultivar
    -- column. That is what stops a selection name reaching a generic row of the
    -- same species — the failure mode 0006/0007/0021/0025/0028/0029 each had to
    -- clean up after in the untyped table.
    plant_keys := array_remove(array(
      select distinct k
      from public.plant_aliases pa
      cross join lateral (values (pa.name_key), (pa.other_name_key)) edge(k)
      where pa.is_active and pa.alias_type = 'plant'
        and (public.normalize_search_text(pa.name || ' ' || pa.other_name)
            &@~ pgroonga_condition(q, fuzzy_max_distance_ratio => fuzzy_ratio)
         or public.normalize_search_text(pa.name || ' ' || pa.other_name) &@~ q_star
         or pa.name_key = qkey
         or pa.other_name_key = qkey)
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
         or pa.other_name_key = qkey)
    ) || array[qkey], null);

    -- Spelling variants pgroonga fuzzy can't reach (see 038 header).
    query_words := regexp_split_to_array(q, '[[:space:]]+');

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
                                      inv.botanical_name_key, inv.cultivar_key) as other_names,
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
          or inv.cultivar_key = any($14)
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

GRANT EXECUTE ON FUNCTION public.search_inventory(
  text, bigint[], real, text, text,
  double precision, double precision, double precision,
  double precision, double precision, double precision)
  TO anon, authenticated, service_role;

-- ------------------------------------------------- 7. retire the old table --
-- Nothing references it any more (inventory_enriched was the only dependent).
-- Its 13,700 pairs map whole composed identities, which the part-level table
-- cannot express; Bhoumik is re-ingesting the alias directory with the rest of
-- the catalogue.
DROP TABLE public.plant_other_names;
DROP FUNCTION IF EXISTS public.dedupe_plant_other_names();

NOTIFY pgrst, 'reload schema';
COMMIT;

-- ------------------------------------------------------------ post-apply --
-- Verified immediately after COMMIT — see NOTE.md for the recorded numbers.
--   * inventory row count unchanged; all three parts NULL on every existing row
--   * compose_plant_name round-trips the SOP examples
--   * search_inventory returns 29 columns and one PostgREST signature
--   * inventory_enriched security_invoker = true
--   * a typed cultivar alias reaches only rows carrying that cultivar
--
-- Rollback: this drops `plant_other_names`. There is no snapshot, by
-- instruction — the data is being dropped and re-ingested. The structural half
-- is reversible by restoring 0030's `search_inventory` and 0039's
-- `inventory_enriched` and dropping the new columns/table.
