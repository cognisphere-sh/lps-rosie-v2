-- 0035_inventory_name_cultivar_delimiter.sql
-- Applied 2026-08-14 via the Supabase MCP with Bhoumik's approval, in two
-- steps: the snapshot DDL, then the guarded DML.
--
-- Numbering note: this was drafted as 0033 and its DDL step therefore went
-- into the Supabase migration history as `0033_inventory_name_delimiter_snapshot`
-- (2026-08-14 05:01:32). A concurrent session had already taken 0033/0034 for
-- `supplier_locations` and `contact_supplier_links` two minutes earlier, so the
-- file is renumbered 0035. The applied record keeps its original label — an
-- applied migration cannot be renamed.
--
-- Rewrites the cultivar delimiter in inventory.name to the SOP's bracket form:
--     Acer palmatum 'Bloodgood'      -> Acer palmatum [Bloodgood]
--     Thuja occidentalis ['Smaragd'] -> Thuja occidentalis [Smaragd]
--
-- SCOPE — the *format* half of the SOP name rule only.
--
-- It does NOT backfill the scientific name or the common name into the
-- bracket. That half cannot be done from inside the database:
--   * The SOP requires the bracket to carry what the SOURCE printed
--     ("Don't invent a name the source doesn't give").
--   * 0005 already tried deriving the scientific name from the alias graph
--     and abandoned it as too dirty ("Acer Palmatum" resolved to the cultivar
--     "Oto hime"; "Abelia x grandiflora" picked up a redundant
--     "Abelia grandiflora").
--   * 0005's companion alias carry-forward (042e) became the single largest
--     source of search false positives and was retired wholesale by 0007
--     (48,269 pairs), with 0006/0008/0009/0010/0021/0025/0028/0029 cleaning
--     up after it.
-- Filling the missing bracket halves means re-parsing the 491 stashed sources
-- through the ingestion SOP, per supplier, with §5 QA. Not this file.
--
-- WHY THIS ONE IS SAFE
-- normalize_plant_key() strips every non-alpha character and
-- normalize_search_text() maps punctuation to a space, so
--   'Bloodgood' / [Bloodgood] / ['Bloodgood'] collapse to the same key AND the
-- same token stream. Verified after apply: 0 name_key changes, 0 token-stream
-- changes (924 rows differ only in whitespace runs, which TokenDelimit
-- ignores). No plant_other_names edge is re-pointed — the 0007 failure mode
-- cannot fire — and no row's membership in any search result can change.
-- This is a display-consistency change: 1,013 duplicate display identities
-- collapsed, so the plants page stops showing one plant as two or three.
--
-- SELECTION RULE
-- Active rows only (same call as 0031 — retired history keeps its printed
-- text; 20,334 inactive rows match the same pattern and were NOT touched).
-- A name qualifies when it contains EXACTLY TWO apostrophes, so the quoted
-- segment is unambiguous, and the quoted part is the whole tail of the name.
-- Everything else was deliberately left for source review — see the residual
-- note at the bottom.
--
-- EFFECT: 2,965 distinct names, 7,691 active rows.

-- ---- step 1 (DDL, applied as 0033_inventory_name_delimiter_snapshot) ----
-- Reversibility. The transform is not invertible from the result alone
-- ("X [Y]" could have been "X 'Y'" or "X ['Y']"), so snapshot first.
CREATE TABLE IF NOT EXISTS public.inventory_pre_name_delimiter (
  id uuid PRIMARY KEY,
  old_name text NOT NULL,
  snapshot_at timestamptz NOT NULL DEFAULT now()
);
-- 0020's lesson: a snapshot table created after 0011 is served to anon by
-- PostgREST unless RLS is enabled. No policies — only postgres/service_role
-- (BYPASSRLS) ever read it.
ALTER TABLE public.inventory_pre_name_delimiter ENABLE ROW LEVEL SECURITY;

-- ---- step 2 (guarded DML) ----
BEGIN;
SET LOCAL statement_timeout = '180s';
-- Cosmetic normalization: keep updated_at as it was.
SET LOCAL session_replication_role = replica;

WITH plan AS (
  SELECT i.id,
         i.name AS old_name
  FROM public.inventory i
  WHERE i.is_active
    AND (length(i.name) - length(replace(i.name, '''', ''))) = 2
    AND ( i.name ~ '^(.*\S)\s*\[''([^]'']+)''\]$'
       OR (i.name NOT LIKE '%[%]%' AND i.name ~ '^(.*\S)\s+''([^'']+)''\s*$') )
)
INSERT INTO public.inventory_pre_name_delimiter (id, old_name)
SELECT id, old_name FROM plan
ON CONFLICT (id) DO NOTHING;

UPDATE public.inventory i
SET name = regexp_replace(
             CASE
               WHEN s.old_name ~ '^(.*\S)\s*\[''([^]'']+)''\]$'
                 THEN regexp_replace(s.old_name, '^(.*\S)\s*\[''([^]'']+)''\]$', '\1 [\2]')
               ELSE regexp_replace(s.old_name, '^(.*\S)\s+''([^'']+)''\s*$', '\1 [\2]')
             END,
             ',\s*\[', ' [')
FROM public.inventory_pre_name_delimiter s
WHERE i.id = s.id
  AND i.name = s.old_name
  -- belt and braces: never let a rewrite move the identity key
  AND public.normalize_plant_key(
        regexp_replace(
          CASE
            WHEN s.old_name ~ '^(.*\S)\s*\[''([^]'']+)''\]$'
              THEN regexp_replace(s.old_name, '^(.*\S)\s*\[''([^]'']+)''\]$', '\1 [\2]')
            ELSE regexp_replace(s.old_name, '^(.*\S)\s+''([^'']+)''\s*$', '\1 [\2]')
          END,
          ',\s*\[', ' [')
      ) = public.normalize_plant_key(s.old_name);

-- Guards — any failure aborts the whole transaction.
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM public.inventory_pre_name_delimiter;
  IF n <> 7691 THEN RAISE EXCEPTION 'expected 7691 snapshotted rows, got %', n; END IF;

  SELECT count(*) INTO n
  FROM public.inventory_pre_name_delimiter s JOIN public.inventory i ON i.id = s.id
  WHERE public.normalize_plant_key(i.name) <> public.normalize_plant_key(s.old_name);
  IF n <> 0 THEN RAISE EXCEPTION '% rows changed name_key', n; END IF;

  SELECT count(*) INTO n
  FROM public.inventory_pre_name_delimiter s JOIN public.inventory i ON i.id = s.id
  WHERE regexp_replace(lower(i.name), '[^a-z0-9]', '', 'g')
     <> regexp_replace(lower(s.old_name), '[^a-z0-9]', '', 'g');
  IF n <> 0 THEN RAISE EXCEPTION '% rows lost or gained alphanumeric content', n; END IF;

  SELECT count(*) INTO n
  FROM public.inventory_pre_name_delimiter s JOIN public.inventory i ON i.id = s.id
  WHERE i.name ~ '''';
  IF n <> 0 THEN RAISE EXCEPTION '% rewritten rows still contain a quote', n; END IF;

  SELECT count(*) FILTER (WHERE is_active) INTO n FROM public.inventory;
  IF n <> 62572 THEN RAISE EXCEPTION 'active row count moved: %', n; END IF;
END $$;

COMMIT;

-- ------------------------------------------------------------ post-apply --
-- All verified 2026-08-14, immediately after COMMIT:
--   snapshotted 7,691 / rows changed 7,691 / active rows 62,572 (unchanged)
--   distinct active names 26,491 -> 25,478  (1,013 identities consolidated)
--   name_key changes 0; token-stream changes 0
--   search_inventory('Abelia Francis Mason')     10 rows / 9 suppliers  (0021/0026 baseline)
--   search_inventory('Japanese Holly Compacta')   4 rows / 2 suppliers  (0026 baseline)
--   search_inventory('Crape Myrtle Muskogee')   102 rows / 21 suppliers
--     — 0026's baseline was 98/20; the delta is inventory ingested since
--       2026-08-12, not this migration. Four of the 102 were renamed here
--       ("Japanese Crape Myrtle 'Muskogee'" -> "[Muskogee]"), all genuine
--       Muskogee rows that matched identically before the rewrite.
--
-- RESIDUAL — deliberately untouched, 642 names / 1,386 active rows still hold
-- a quoted cultivar. These are judgment cases, not delimiter cases:
--   * trailing form/grade words the SOP bans from `name` outright —
--     "Buxus x 'Green Mountain' Globe/Spiral/Cone", "Picea pungens 'Globosa'
--     Low Graft", "Pinus strobus 'Pendula' Spec";
--   * cultivar + trade name, dash-separated — "Acer palmatum 'Wolff' -
--     Emperor 1®", "Cornus x 'KN30-8' - Venus®". This is exactly Chris's
--     `Crape Myrtle - 'Muskogee'` case and needs the typed-identity work,
--     not a regex;
--   * a foot mark next to a cultivar — "Prunus serrulata 'Kwanzan' 4' Graft";
--   * an apostrophe inside the cultivar or the base — "Magnolia grandiflora
--     'Bracken's Brown Beauty'", "Coreopsis Li'l Bang 'Daybreak'". A naive
--     rewrite mangles these into "Euonymus f. 'Emerald [n Gold]";
--   * unbalanced quotes from the source — "Pinus heldreichii 'Irish Bells".
--
-- Rollback:
--   UPDATE inventory i SET name = s.old_name
--     FROM inventory_pre_name_delimiter s WHERE s.id = i.id;
-- Drop public.inventory_pre_name_delimiter once the change has settled.
