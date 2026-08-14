-- 0041_multi_name_cultivar_keys.sql
-- Applied 2026-08-14 via the Supabase MCP at Bhoumik's request, as one
-- transaction (`multi_name_cultivar_keys`). Follows 0040 the same day.
--
-- WHY
-- 0040 assumed `cultivar_variety_trade_name` held **one** name — the cultivar —
-- with any other name for the same selection carried as a `cultivar` edge in
-- `plant_aliases`. Bhoumik's rule is different and simpler to parse against a
-- source: the column captures **everything in the printed name that the common
-- and botanical name don't**, minus size / form / grade. A row printing
-- `Acer palmatum 'Wolff' - Emperor 1®` therefore stores *both* selection names.
--
-- That breaks 0040's key, and quietly:
--   normalize_plant_key('Wolff, Emperor 1') = 'wolffemperor'
-- which equals neither 'wolff' nor 'emperor'. Every exact-match path that
-- 0040 built on `cultivar_key` — the typed alias branch in search_inventory,
-- and plant_alias_names' "Also known as" — silently stops matching the moment a
-- row names two things. Only the fuzzy pgroonga document would still find the
-- row, which is exactly the fail-open behaviour 0026/0027 removed.
--
-- WHAT CHANGES
-- `inventory.cultivar_key text` becomes `inventory.cultivar_keys text[]`: one
-- normalized key per name in the column. Matching moves from `=` to array
-- overlap (`&&`), so it stays **exact per name** — no substring test, no fuzzy
-- fallback, and a row naming two selections is found by either of them.
--
-- The column's own format is the SOP's business, not the database's: names are
-- comma-separated, the separator the bracket and `other_names` already use, so
-- the Cultivar cell reads as prose. The trigger is deliberately more forgiving
-- than the SOP and also splits on `;` and `|`, so an ingest that reaches for a
-- different separator degrades to a wrong-looking cell rather than to a row
-- that silently stops matching its own aliases. It does **not** split on `-` or
-- `/`: `KN30-8` is one cultivar code, and a `Globe/Spiral` is a form that the
-- SOP keeps out of this column entirely.
--
-- No backfill needed — every row still has NULL parts (0040, same day).

BEGIN;
SET LOCAL statement_timeout = '300s';

-- ---------------------------------------------------------- 1. the column --
-- `inventory_enriched` reads the column being replaced, so it has to go first;
-- it is recreated over the new shape in step 3. Same for plant_alias_names,
-- whose signature changes with it.
DROP VIEW public.inventory_enriched;
DROP FUNCTION public.plant_alias_names(text, text, text, text);

ALTER TABLE public.inventory DROP COLUMN cultivar_key;
ALTER TABLE public.inventory ADD COLUMN cultivar_keys text[];

COMMENT ON COLUMN public.inventory.cultivar_variety_trade_name IS
  'Everything the printed plant name carries that the common and botanical name do not — cultivar, variety, selection and trade names — exactly as the source prints them, comma-separated when there is more than one. Never a size, container, dimension, form or grade code. NULL when the source prints none.';
COMMENT ON COLUMN public.inventory.cultivar_keys IS
  'One normalize_plant_key() per name in cultivar_variety_trade_name, maintained by trg_inventory_derive_identity. What cultivar alias edges match against, by array overlap. Never write it.';

CREATE INDEX inventory_cultivar_keys_idx
  ON public.inventory USING gin (cultivar_keys);

-- --------------------------------------------------------- 2. the trigger --
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

  -- One key per name the column carries, so a row naming a cultivar *and* a
  -- trade name is reachable by either. Splitting on `,` is what the SOP writes;
  -- `;` and `|` are accepted so a stray separator costs a tidy cell, not a
  -- silently unmatched row. Never `-` or `/` — those occur inside real names.
  new.cultivar_keys := (
    SELECT array_agg(DISTINCT k)
    FROM (
      SELECT nullif(public.normalize_plant_key(part), '') AS k
      FROM regexp_split_to_table(
             coalesce(new.cultivar_variety_trade_name, ''), '\s*[,;|]\s*') AS part
    ) s
    WHERE k IS NOT NULL
  );
  RETURN new;
END;
$function$;

-- ------------------------------------------------- 3. the derived alias list --
CREATE FUNCTION public.plant_alias_names(
  p_name_key text,
  p_common_key text,
  p_botanical_key text,
  p_cultivar_keys text[]
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
         AND pa.name_key = ANY(p_cultivar_keys)
      UNION ALL
      SELECT pa.name_key, pa.name
        FROM public.plant_aliases pa
       WHERE pa.is_active AND pa.alias_type = 'cultivar'
         AND pa.other_name_key = ANY(p_cultivar_keys)
    ) y
    WHERE y.k IS NOT NULL
      AND strpos(coalesce(p_name_key, ''), y.k) = 0
    ORDER BY y.k, y.v
  ) x
$function$;

COMMENT ON FUNCTION public.plant_alias_names(text, text, text, text[]) IS
  'The "Also known as" value for one inventory row: active alias endpoints incident to its identity keys, minus every name already spelled inside its own composed name.';

CREATE VIEW public.inventory_enriched AS
SELECT inv.id,
       inv.name,
       inv.common_name,
       inv.botanical_name,
       inv.cultivar_variety_trade_name,
       inv.name_key,
       inv.common_name_key,
       inv.botanical_name_key,
       inv.cultivar_keys,
       public.plant_alias_names(inv.name_key, inv.common_name_key,
                                inv.botanical_name_key, inv.cultivar_keys) AS other_names,
       inv.size, inv.size_std, inv.unit_price, inv.quantity,
       inv.height, inv.width, inv.caliper,
       inv.height_std, inv.width_std, inv.caliper_std,
       inv.notes, inv.internal_notes, inv.image_url,
       inv.supplier_id, inv.source_id, inv.is_active,
       inv.created_at, inv.updated_at
FROM public.inventory inv;
ALTER VIEW public.inventory_enriched SET (security_invoker = true);
GRANT SELECT ON public.inventory_enriched TO anon, authenticated, service_role;

-- ------------------------------------------------------- 4. search_inventory --
-- The RETURNS TABLE is unchanged (the keys were never returned), so this one
-- goes through CREATE OR REPLACE — no drop, no grants to restore.
CREATE OR REPLACE FUNCTION public.search_inventory(
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
    -- row's common/botanical name; a `cultivar` edge only ever to the names in
    -- its cultivar column. That is what stops a selection name reaching a
    -- generic row of the same species — the failure mode 0006/0007/0021/0025/
    -- 0028/0029 each had to clean up after in the untyped table.
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
                                      inv.botanical_name_key, inv.cultivar_keys) as other_names,
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
          or inv.cultivar_keys && $14
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

NOTIFY pgrst, 'reload schema';
COMMIT;

-- ------------------------------------------------------------ post-apply --
-- Verified immediately after COMMIT — see NOTE.md for the recorded numbers.
--   * a row whose cultivar column names two selections keys to both, and is
--     found by an alias edge on either
--   * the sibling-species row beside it is still not reachable by either
--   * `;` and `|` split the same way `,` does
--   * fixtures unchanged from 0040
