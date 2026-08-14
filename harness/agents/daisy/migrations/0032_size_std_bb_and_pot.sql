-- 0032: two more `size_std` buckets — `B&B` and `<N>" Pot` — and the remap of
-- the rows that were sitting in `other` for want of them.
--
-- Requested by Bhoumik on 2026-08-13, right after the 0031 backfill put 8,589
-- rows in `other`. The two biggest occupants were balled-and-burlapped stock
-- (3,224 rows, 219 distinct strings) and bare pot diameters with no gallon
-- equivalent (2,122 rows, 52 distinct diameters) — both real containers a buyer
-- would want to filter on, not oddities.
--
-- `B&B` is a word grade: the burlapped root ball IS the container, which is why
-- a height or caliper printed beside it (`B&B; 3-4' HT`) is the plant's size
-- rather than a second container.
--
-- `<N>" Pot` is a third open numbered family alongside `<N>G` and `<N>" Box`.
-- The three do not overlap, and which one a bare diameter joins is a judgment
-- about the row, not the string:
--   * a diameter WITH a gallon equivalent stays a gallon (17" is `15G`) — that
--     pairing is what makes one checkbox cover every spelling of a 15-gallon
--     container, and 0031 already relies on it;
--   * a diameter that is really a box is `<N>" Box` even when the source never
--     prints the word — desert and palm growers list a bare `36"`;
--   * everything else is `<N>" Pot`, which is the annual/perennial/tropical end
--     of the catalogue.
-- A diameter attached to merchandise (a planter, bowl, basket, tool) is not a
-- plant container at all and stays `other`.

alter table public.inventory
  drop constraint if exists inventory_size_std_check;

alter table public.inventory
  add constraint inventory_size_std_check check (
    size_std is null
    or size_std ~ '^[0-9]+(\.[0-9]+)?G$'
    or size_std ~ '^[0-9]+(\.[0-9]+)?" Pot$'
    or size_std ~ '^[0-9]+" Box$'
    or size_std in ('Bare Root', 'Liners', 'Plug', 'Trays', 'B&B',
                    'Field Grown', 'Grow Bags', 'Root Pruned', 'other')
  );

comment on column public.inventory.size_std is
  'Standardized container/grade for `size`. <N>" Pot | <N>G | <N>" Box | '
  'Bare Root | Liners | Plug | Trays | B&B | Field Grown | Grow Bags | '
  'Root Pruned | other. NULL when no container is known. '
  'See docs/supabase-schema.md.';

-- =========================================================================
-- THE REMAP. 350 supplier/size pairs reclassified by two subagents against
-- RULES-2 (now folded into the ingestion SOP). B&B was unanimous: all 240
-- pairs are the bucket, none named a competing container. 66 bare diameters
-- are pots, 6 are unlabelled boxes, 8 are not containers at all (supplier 42
-- prints shade-tree caliper as a bare inch value, supplier 84 a Buxus height)
-- and take the round-1 move-and-clear treatment. 33 stay `other` — mostly
-- Austin Plant Supply decorative pottery and hand tools, where the diameter
-- describes merchandise rather than a plant container.
--
-- Measurements found inside a B&B string are ADDED, never substituted: only
-- where the dimension column is empty, and only at high confidence (13 pairs
-- held back — topiary standards printing both a stem height and a head size,
-- and sheared globes whose diameter is arguably width, not height).
-- Active rows only. `size` survives everywhere except the 6 measurement pairs.

-- height: 2 bare diameters that are measurements, not containers.
WITH m(sid, sz, dstd) AS (VALUES
    (84, '24"', 2::float8),
    (84, '36"', 3::float8)
)
UPDATE inventory inv
SET height = coalesce(inv.height, inv.size),
    height_std = coalesce(inv.height_std, m.dstd),
    size = NULL,
    size_std = NULL
FROM m
WHERE inv.is_active AND inv.supplier_id = m.sid AND inv.size = m.sz
  AND (inv.height IS NULL
       OR regexp_replace(inv.height, '[^0-9]', '', 'g')
          = regexp_replace(inv.size, '[^0-9]', '', 'g'));

-- caliper: 4 bare diameters that are measurements, not containers.
WITH m(sid, sz, dstd) AS (VALUES
    (42, '2.0"', 2.0::float8),
    (42, '2.5"', 2.5::float8),
    (42, '3.0"', 3.0::float8),
    (42, '4.5"', 4.5::float8)
)
UPDATE inventory inv
SET caliper = coalesce(inv.caliper, inv.size),
    caliper_std = coalesce(inv.caliper_std, m.dstd),
    size = NULL,
    size_std = NULL
FROM m
WHERE inv.is_active AND inv.supplier_id = m.sid AND inv.size = m.sz
  AND (inv.caliper IS NULL
       OR regexp_replace(inv.caliper, '[^0-9]', '', 'g')
          = regexp_replace(inv.size, '[^0-9]', '', 'g'));

-- Conflict sweep: any of those whose target column held a different value.
WITH m(sid, sz) AS (VALUES
    (42, '2.0"'),
    (42, '2.5"'),
    (42, '3.0"'),
    (42, '4.5"'),
    (84, '24"'),
    (84, '36"')
)
UPDATE inventory inv SET size_std = 'other'
FROM m
WHERE inv.is_active AND inv.supplier_id = m.sid AND inv.size = m.sz
  AND inv.size_std = 'other';

UPDATE inventory SET size_std = '11" Pot'
WHERE is_active AND (supplier_id, size) IN ((32, '11"'), (47, '11"'));

UPDATE inventory SET size_std = '13" Pot'
WHERE is_active AND (supplier_id, size) IN ((32, '13"'));

UPDATE inventory SET size_std = '16" Pot'
WHERE is_active AND (supplier_id, size) IN ((98, '16" Pot'));

UPDATE inventory SET size_std = '2" Pot'
WHERE is_active AND (supplier_id, size) IN ((56, '2"'), (85, '2"'));

UPDATE inventory SET size_std = '24" Box'
WHERE is_active AND (supplier_id, size) IN ((1, '24"'));

UPDATE inventory SET size_std = '3" Pot'
WHERE is_active AND (supplier_id, size) IN ((56, '3"'), (73, '3"'), (75, '3"'), (98, '3"'));

UPDATE inventory SET size_std = '3.25" Pot'
WHERE is_active AND (supplier_id, size) IN ((20, '3.25" POT'));

UPDATE inventory SET size_std = '3.5" Pot'
WHERE is_active AND (supplier_id, size) IN ((98, '3.5"'), (20, '3.5" POT'));

UPDATE inventory SET size_std = '30" Box'
WHERE is_active AND (supplier_id, size) IN ((1, '30"'));

UPDATE inventory SET size_std = '36" Box'
WHERE is_active AND (supplier_id, size) IN ((1, '36"'), (55, '36"'), (65, '36"'));

UPDATE inventory SET size_std = '4" Pot'
WHERE is_active AND (supplier_id, size) IN ((1, '4"'), (17, '4"'), (21, '4"'), (23, '4"'), (24, '4"'), (25, '4"'), (37, '4"'), (38, '4"'), (39, '4"'), (47, '4"'), (56, '4"'), (71, '4"'), (72, '4"'), (73, '4"'), (75, '4"'), (77, '4"'), (82, '4"'), (85, '4"'), (94, '4"'), (96, '4"'), (98, '4"'), (105, '4"'), (675, '4"'), (9, '4" pot'), (75, '4" pot'), (37, '4" Pot'), (609, '4" Pot'), (75, '4" Round'), (60, '4" Square'), (75, '4" Square'));

UPDATE inventory SET size_std = '4.5" Pot'
WHERE is_active AND (supplier_id, size) IN ((1, '4.5"'), (98, '4.5"'), (37, '4.5" Pot'), (60, '4.5" Round'));

UPDATE inventory SET size_std = '48" Box'
WHERE is_active AND (supplier_id, size) IN ((65, '48"'));

UPDATE inventory SET size_std = '5" Pot'
WHERE is_active AND (supplier_id, size) IN ((94, '5"'));

UPDATE inventory SET size_std = '6.5" Pot'
WHERE is_active AND (supplier_id, size) IN ((47, '6.5"'), (73, '6.5"'), (98, '6.5"'), (37, '6.5" Pot'));

UPDATE inventory SET size_std = '8" Pot'
WHERE is_active AND (supplier_id, size) IN ((15, '8"'), (16, '8"'), (32, '8"'), (47, '8"'), (72, '8"'), (73, '8"'), (98, '8"'), (94, '8" pot'), (915, '8" pot'), (37, '8" Pot'), (98, '8" Pot'));

UPDATE inventory SET size_std = '9" Pot'
WHERE is_active AND (supplier_id, size) IN ((98, '9"'), (98, '9" Pot'));

UPDATE inventory SET size_std = 'B&B'
WHERE is_active AND (supplier_id, size) IN ((16, '10-12'' B&B Potted'), (20, '10'' B&B'), (20, '10''-12'' B&B'), (20, '10''-12'' B&B MULTI-STEM'), (80, '12 - 15"; B&B'), (20, '12" B&B'), (20, '14''-16'' B&B MULTI-STEM'), (80, '15 - 18"; B&B'), (20, '15" B&B'), (80, '18 - 21"; B&B'), (80, '18 - 24"; B&B'), (80, '18-21"; B&B'), (16, '18-24" B&B Potted'), (20, '18" B&B'), (80, '18" Standard; 15 - 18"; B&B'), (80, '2-Ball; 4 - 5''; B&B'), (80, '2'' Standard; 18 - 21"; B&B'), (80, '2'' Standard; 18 - 24"; B&B'), (80, '2'' Standard; 21 - 24"; B&B'), (80, '2'' Standard; 24 - 30"; B&B'), (80, '2'' Standard; 30 - 36"; B&B'), (80, '21 - 24"; B&B'), (20, '21" B&B'), (80, '24 - 30"; B&B'), (16, '24-30" B&B Potted'), (20, '24" B&B'), (20, '24" B&B PYRAMIDAL'), (80, '3 - 4'' ; B&B'), (80, '3 - 4''; B&B'), (16, '3-4'' B&B Potted'), (80, '3-4''; B&B'), (80, '3-Ball; 36 - 42"; B&B'), (80, '3-Ball; 4 - 5''; B&B'), (20, '3.0" CAL B&B SINGLE STEM'), (20, '3'' B&B'), (20, '3'' B&B PYRAMIDAL'), (20, '3''-4'' B&B'), (80, '30 - 36"; B&B'), (16, '30-36" B&B Potted'), (80, '30-36"; B&B'), (20, '30" B&B'), (80, '36 - 42"; B&B'), (16, '36-42" B&B Potted'), (80, '36-42"; B&B'), (80, '4 - 5''; B&B'), (16, '4-5'' B&B Potted'), (20, '4'' B&B'), (80, '4'' Standard; 18 - 24"; B&B'), (80, '4'' Standard; B&B'), (20, '4''-5'' B&B'), (20, '4''-5'' B&B LOW BRANCHED'), (80, '42 - 48"; B&B'), (16, '42-48" B&B Potted'), (20, '42" B&B'), (80, '48 - 54"; B&B'), (16, '48-54" B&B Potted'), (80, '5 - 6''; B&B'), (16, '5-6'' B&B Potted'), (20, '5'' B&B'), (20, '5''-6'' B&B'), (20, '5''-6'' B&B LOW BRANCHED'), (20, '5''-6'' B&B MULTI-STEM'), (80, '54 - 60"; B&B'), (16, '54-60" B&B Potted'), (80, '6 - 7'' 1.75"; B&B'), (80, '6 - 7''; B&B'), (16, '6-7'' B&B Potted'), (20, '6'' B&B'), (20, '6'' B&B MULTI-STEM'), (20, '6''-7'' B&B'), (20, '6''-7'' B&B LOW BRANCHED'), (20, '6''-7'' B&B MULTI-STEM'), (80, '60 - 66"; B&B'), (80, '66 - 72" ; B&B'), (80, '7 - 8'' 2.0"; B&B'), (80, '7 - 8''; B&B'), (16, '7-8'' B&B Potted'), (20, '7'' B&B'), (20, '7''-8'' B&B'), (20, '7''-8'' B&B MULTI-STEM'), (80, '8 - 10'' 2.25"; B&B'), (80, '8 - 9''; B&B'), (16, '8-10'' B&B Potted'), (20, '8'' B&B'), (20, '8''-10'' B&B MULTI-STEM'), (20, '8''-9'' B&B'), (20, '8''-9'' B&B MULTI-STEM'), (20, '9'' B&B'), (20, '9''-10'' B&B'), (20, '9''-10'' B&B MULTI-STEM'), (16, 'B&B'), (18, 'B&B'), (20, 'B&B'), (23, 'B&B'), (24, 'B&B'), (33, 'B&B'), (41, 'B&B'), (45, 'B&B'), (46, 'B&B'), (48, 'B&B'), (52, 'B&B'), (63, 'B&B'), (97, 'B&B'), (101, 'B&B'), (117, 'B&B'), (126, 'B&B'), (31, 'B&B 0.5"'), (31, 'B&B 1.0"'), (31, 'B&B 1.5"'), (33, 'B&B 1.5"'), (39, 'B&B 1.5" Caliper 1.5"'), (33, 'B&B 1.75"'), (48, 'B&B 10-12'''), (48, 'B&B 12-14'''), (48, 'B&B 14-16'''), (33, 'B&B 15-18"'), (48, 'B&B 18-24"'), (33, 'B&B 18"'), (31, 'B&B 2.0"'), (33, 'B&B 2.0"'), (33, 'B&B 2.5'''), (31, 'B&B 2.5"'), (33, 'B&B 2'''), (39, 'B&B 2" Caliper 2"'), (48, 'B&B 20'' 8.00" cal'), (33, 'B&B 24-30"'), (48, 'B&B 24-30"'), (48, 'B&B 25'' 10.00" cal'), (48, 'B&B 3-4'''), (31, 'B&B 3.5"'), (43, 'B&B 3.5"'), (45, 'B&B 3.5"'), (33, 'B&B 3'''), (45, 'B&B 3"'), (33, 'B&B 30-36"'), (48, 'B&B 30-36"'), (33, 'B&B 30-36" HT'), (48, 'B&B 4-5'''), (31, 'B&B 4.5"'), (33, 'B&B 4'''), (48, 'B&B 40'' 10.00" cal'), (48, 'B&B 42-48"'), (48, 'B&B 48-54"'), (48, 'B&B 5-6'''), (33, 'B&B 5'''), (48, 'B&B 6-7'''), (33, 'B&B 6-7'' HT'), (33, 'B&B 6'''), (48, 'B&B 7-8'''), (33, 'B&B 7-8'' HT'), (33, 'B&B 7'''), (45, 'B&B 7"'), (48, 'B&B 8-10'''), (48, 'B&B 8-9'''), (33, 'B&B 8'''), (48, 'B&B 9-10'''), (45, 'B&B On Sale!!'), (48, 'B&B WB 5-6'''), (48, 'B&B WB 6-7'''), (33, 'B&B; 1.0" Cal; Espalier'), (33, 'B&B; 1.5" Cal; Espalier'), (33, 'B&B; 10-12'' HT'), (33, 'B&B; 12-15" Sprd'), (33, 'B&B; 12-15" Sprd; Low'), (33, 'B&B; 12-15" Sprd; STD'), (33, 'B&B; 15-18" Sprd'), (33, 'B&B; 15-18" Sprd; Low'), (33, 'B&B; 15-18" Sprd; STD'), (33, 'B&B; 18-24" HT'), (33, 'B&B; 18-24" Sprd'), (33, 'B&B; 18-24" Sprd; Low'), (33, 'B&B; 18-24" Sprd; STD'), (33, 'B&B; 2.0" Cal; Espalier'), (33, 'B&B; 24-30" HT'), (33, 'B&B; 24-30" HT; Ball'), (33, 'B&B; 24-30" Sprd'), (33, 'B&B; 24-30" Sprd; Low'), (33, 'B&B; 24-30" Sprd; STD'), (33, 'B&B; 3-4'' HT'), (33, 'B&B; 30-36" HT'), (33, 'B&B; 30-36" HT; Cone'), (33, 'B&B; 30-36" Sprd; Low'), (33, 'B&B; 30-36" Sprd; STD'), (33, 'B&B; 4-5'' HT'), (33, 'B&B; 4-5'' HT; Hedge Form'), (33, 'B&B; 4-5'' HT; Serpentine'), (33, 'B&B; 5-6'' HT'), (33, 'B&B; 5-6'' HT; Hedge Form'), (33, 'B&B; 5-6'' HT; Sheared'), (33, 'B&B; 6-7'' HT'), (33, 'B&B; 6-7'' HT; 1.5" Cal'), (33, 'B&B; 6-7'' HT; Hedge Form'), (33, 'B&B; 6-7'' HT; Sheared'), (33, 'B&B; 7-8'' HT'), (33, 'B&B; 7-8'' HT; 1.75" Cal'), (33, 'B&B; 7-8'' HT; Heavy'), (33, 'B&B; 7-8'' HT; Hedge Form'), (33, 'B&B; 7-8'' HT; Sheared'), (33, 'B&B; 8-9'' HT'), (33, 'B&B; 8-9'' HT; 2.0" Cal'), (33, 'B&B; 8-9'' HT; Hedge Form'), (28, 'Balled and Burlapped'), (80, 'Bush; 18 - 24"; B&B'), (80, 'Bush; 21 - 24"; B&B'), (80, 'Bush; 24 - 30"; B&B'), (80, 'Bush; 30 - 36"; B&B'), (80, 'Bush; 36 - 42"; B&B'), (80, 'Bush; 42 - 48"; B&B'), (80, 'Columnar; 30 - 36"; B&B'), (80, 'Columnar; 36 - 42"; B&B'), (80, 'Columnar; 4 - 5''; B&B'), (80, 'Columnar; 42 - 48"; B&B'), (80, 'Columnar; 48 - 54"; B&B'), (80, 'Columnar; 5 - 6''; B&B'), (80, 'Columnar; 54 - 60"; B&B'), (80, 'Cone; 18 - 21"; B&B'), (80, 'Cone; 18 - 24"; B&B'), (80, 'Cone; 21 - 24"; B&B'), (80, 'Cone; 24 - 30"; B&B'), (80, 'Cone; 30 - 36"; B&B'), (80, 'Cone; 36 - 42"; B&B'), (80, 'Cone; 42 - 48"; B&B'), (80, 'Cone; 48 - 54"; B&B'), (80, 'Cone; 54 - 60"; B&B'), (80, 'Globe; 15 - 18"; B&B'), (80, 'Globe; 18 - 21"; B&B'), (80, 'Globe; 21 - 24"; B&B'), (80, 'Globe; 24 - 30"; B&B'), (80, 'Globe; 30 - 36"; B&B'), (80, 'Globe; 36 - 42"; B&B'), (80, 'Pyramid; 3 - 4'' ; B&B'), (80, 'Pyramid; 36 - 42"; B&B'), (80, 'Pyramid; 4 - 5''; B&B'), (80, 'Serpentine; 4 - 5''; B&B'), (80, 'Serpentine; 5 - 6''; B&B'), (80, 'Spiral; 36 - 42"; B&B'), (80, 'Spiral; 4 - 5''; B&B'), (80, 'Spiral; 48 - 54"; B&B'), (80, 'Spiral; 5 - 6''; B&B'), (80, 'Spiral; 54 - 60"; B&B'));

UPDATE inventory SET size_std = 'other'
WHERE is_active AND (supplier_id, size) IN ((1, '1.25"'), (1, '11"'), (1, '12"'), (1, '13"'), (1, '15"'), (39, '15"'), (1, '16"'), (1, '17.5"'), (1, '18.5"'), (1, '18"'), (1, '19"'), (1, '2"'), (1, '20"'), (1, '21.5"'), (1, '22"'), (1, '24.5"'), (1, '25.5"'), (1, '25"'), (1, '26"'), (1, '27"'), (35, '30"'), (1, '31"'), (1, '32"'), (1, '33.5"'), (1, '33"'), (1, '34.5"'), (1, '34"'), (1, '39"'), (1, '40.5"'), (1, '40"'), (1, '5"'), (1, '8"'), (1, '9"'));

-- height: 175 pairs whose `size` string also prints one. Written only
-- where the column is EMPTY — an existing value is never second-guessed.
WITH m(sid, sz, dtext, dstd) AS (VALUES
    (16, '10-12'' B&B Potted', '10-12''', 10::float8),
    (20, '10'' B&B', '10''', 10::float8),
    (20, '10''-12'' B&B', '10''-12''', 10::float8),
    (20, '10''-12'' B&B MULTI-STEM', '10''-12''', 10::float8),
    (80, '12 - 15"; B&B', '12 - 15"', 1::float8),
    (20, '12" B&B', '12"', 1::float8),
    (20, '14''-16'' B&B MULTI-STEM', '14''-16''', 14::float8),
    (80, '15 - 18"; B&B', '15 - 18"', 1.25::float8),
    (20, '15" B&B', '15"', 1.25::float8),
    (80, '18 - 21"; B&B', '18 - 21"', 1.5::float8),
    (80, '18 - 24"; B&B', '18 - 24"', 1.5::float8),
    (80, '18-21"; B&B', '18-21"', 1.5::float8),
    (16, '18-24" B&B Potted', '18-24"', 1.5::float8),
    (20, '18" B&B', '18"', 1.5::float8),
    (80, '2-Ball; 4 - 5''; B&B', '4 - 5''', 4::float8),
    (80, '21 - 24"; B&B', '21 - 24"', 1.75::float8),
    (20, '21" B&B', '21"', 1.75::float8),
    (80, '24 - 30"; B&B', '24 - 30"', 2::float8),
    (16, '24-30" B&B Potted', '24-30"', 2::float8),
    (20, '24" B&B', '24"', 2::float8),
    (20, '24" B&B PYRAMIDAL', '24"', 2::float8),
    (80, '3 - 4'' ; B&B', '3 - 4''', 3::float8),
    (80, '3 - 4''; B&B', '3 - 4''', 3::float8),
    (16, '3-4'' B&B Potted', '3-4''', 3::float8),
    (80, '3-4''; B&B', '3-4''', 3::float8),
    (80, '3-Ball; 36 - 42"; B&B', '36 - 42"', 3::float8),
    (80, '3-Ball; 4 - 5''; B&B', '4 - 5''', 4::float8),
    (20, '3'' B&B', '3''', 3::float8),
    (20, '3'' B&B PYRAMIDAL', '3''', 3::float8),
    (20, '3''-4'' B&B', '3''-4''', 3::float8),
    (80, '30 - 36"; B&B', '30 - 36"', 2.5::float8),
    (16, '30-36" B&B Potted', '30-36"', 2.5::float8),
    (80, '30-36"; B&B', '30-36"', 2.5::float8),
    (20, '30" B&B', '30"', 2.5::float8),
    (80, '36 - 42"; B&B', '36 - 42"', 3::float8),
    (16, '36-42" B&B Potted', '36-42"', 3::float8),
    (80, '36-42"; B&B', '36-42"', 3::float8),
    (80, '4 - 5''; B&B', '4 - 5''', 4::float8),
    (16, '4-5'' B&B Potted', '4-5''', 4::float8),
    (20, '4'' B&B', '4''', 4::float8),
    (80, '4'' Standard; B&B', '4''', 4::float8),
    (20, '4''-5'' B&B', '4''-5''', 4::float8),
    (20, '4''-5'' B&B LOW BRANCHED', '4''-5''', 4::float8),
    (80, '42 - 48"; B&B', '42 - 48"', 3.5::float8),
    (16, '42-48" B&B Potted', '42-48"', 3.5::float8),
    (20, '42" B&B', '42"', 3.5::float8),
    (80, '48 - 54"; B&B', '48 - 54"', 4::float8),
    (16, '48-54" B&B Potted', '48-54"', 4::float8),
    (80, '5 - 6''; B&B', '5 - 6''', 5::float8),
    (16, '5-6'' B&B Potted', '5-6''', 5::float8),
    (20, '5'' B&B', '5''', 5::float8),
    (20, '5''-6'' B&B', '5''-6''', 5::float8),
    (20, '5''-6'' B&B LOW BRANCHED', '5''-6''', 5::float8),
    (20, '5''-6'' B&B MULTI-STEM', '5''-6''', 5::float8),
    (80, '54 - 60"; B&B', '54 - 60"', 4.5::float8),
    (16, '54-60" B&B Potted', '54-60"', 4.5::float8),
    (80, '6 - 7'' 1.75"; B&B', '6 - 7''', 6::float8),
    (80, '6 - 7''; B&B', '6 - 7''', 6::float8),
    (16, '6-7'' B&B Potted', '6-7''', 6::float8),
    (20, '6'' B&B', '6''', 6::float8),
    (20, '6'' B&B MULTI-STEM', '6''', 6::float8),
    (20, '6''-7'' B&B', '6''-7''', 6::float8),
    (20, '6''-7'' B&B LOW BRANCHED', '6''-7''', 6::float8),
    (20, '6''-7'' B&B MULTI-STEM', '6''-7''', 6::float8),
    (80, '60 - 66"; B&B', '60 - 66"', 5::float8),
    (80, '66 - 72" ; B&B', '66 - 72"', 5.5::float8),
    (80, '7 - 8'' 2.0"; B&B', '7 - 8''', 7::float8),
    (80, '7 - 8''; B&B', '7 - 8''', 7::float8),
    (16, '7-8'' B&B Potted', '7-8''', 7::float8),
    (20, '7'' B&B', '7''', 7::float8),
    (20, '7''-8'' B&B', '7''-8''', 7::float8),
    (20, '7''-8'' B&B MULTI-STEM', '7''-8''', 7::float8),
    (80, '8 - 10'' 2.25"; B&B', '8 - 10''', 8::float8),
    (80, '8 - 9''; B&B', '8 - 9''', 8::float8),
    (16, '8-10'' B&B Potted', '8-10''', 8::float8),
    (20, '8'' B&B', '8''', 8::float8),
    (20, '8''-10'' B&B MULTI-STEM', '8''-10''', 8::float8),
    (20, '8''-9'' B&B', '8''-9''', 8::float8),
    (20, '8''-9'' B&B MULTI-STEM', '8''-9''', 8::float8),
    (20, '9'' B&B', '9''', 9::float8),
    (20, '9''-10'' B&B', '9''-10''', 9::float8),
    (20, '9''-10'' B&B MULTI-STEM', '9''-10''', 9::float8),
    (48, 'B&B 10-12''', '10-12''', 10::float8),
    (48, 'B&B 12-14''', '12-14''', 12::float8),
    (48, 'B&B 14-16''', '14-16''', 14::float8),
    (33, 'B&B 15-18"', '15-18"', 1.25::float8),
    (48, 'B&B 18-24"', '18-24"', 1.5::float8),
    (33, 'B&B 18"', '18"', 1.5::float8),
    (33, 'B&B 2.5''', '2.5''', 2.5::float8),
    (33, 'B&B 2''', '2''', 2::float8),
    (48, 'B&B 20'' 8.00" cal', '20''', 20::float8),
    (33, 'B&B 24-30"', '24-30"', 2::float8),
    (48, 'B&B 24-30"', '24-30"', 2::float8),
    (48, 'B&B 25'' 10.00" cal', '25''', 25::float8),
    (48, 'B&B 3-4''', '3-4''', 3::float8),
    (33, 'B&B 3''', '3''', 3::float8),
    (33, 'B&B 30-36"', '30-36"', 2.5::float8),
    (48, 'B&B 30-36"', '30-36"', 2.5::float8),
    (33, 'B&B 30-36" HT', '30-36"', 2.5::float8),
    (48, 'B&B 4-5''', '4-5''', 4::float8),
    (33, 'B&B 4''', '4''', 4::float8),
    (48, 'B&B 40'' 10.00" cal', '40''', 40::float8),
    (48, 'B&B 42-48"', '42-48"', 3.5::float8),
    (48, 'B&B 48-54"', '48-54"', 4::float8),
    (48, 'B&B 5-6''', '5-6''', 5::float8),
    (33, 'B&B 5''', '5''', 5::float8),
    (48, 'B&B 6-7''', '6-7''', 6::float8),
    (33, 'B&B 6-7'' HT', '6-7''', 6::float8),
    (33, 'B&B 6''', '6''', 6::float8),
    (48, 'B&B 7-8''', '7-8''', 7::float8),
    (33, 'B&B 7-8'' HT', '7-8''', 7::float8),
    (33, 'B&B 7''', '7''', 7::float8),
    (48, 'B&B 8-10''', '8-10''', 8::float8),
    (48, 'B&B 8-9''', '8-9''', 8::float8),
    (33, 'B&B 8''', '8''', 8::float8),
    (48, 'B&B 9-10''', '9-10''', 9::float8),
    (48, 'B&B WB 5-6''', '5-6''', 5::float8),
    (48, 'B&B WB 6-7''', '6-7''', 6::float8),
    (33, 'B&B; 10-12'' HT', '10-12''', 10::float8),
    (33, 'B&B; 18-24" HT', '18-24"', 1.5::float8),
    (33, 'B&B; 24-30" HT', '24-30"', 2::float8),
    (33, 'B&B; 24-30" HT; Ball', '24-30"', 2::float8),
    (33, 'B&B; 3-4'' HT', '3-4''', 3::float8),
    (33, 'B&B; 30-36" HT', '30-36"', 2.5::float8),
    (33, 'B&B; 30-36" HT; Cone', '30-36"', 2.5::float8),
    (33, 'B&B; 4-5'' HT', '4-5''', 4::float8),
    (33, 'B&B; 4-5'' HT; Hedge Form', '4-5''', 4::float8),
    (33, 'B&B; 4-5'' HT; Serpentine', '4-5''', 4::float8),
    (33, 'B&B; 5-6'' HT', '5-6''', 5::float8),
    (33, 'B&B; 5-6'' HT; Hedge Form', '5-6''', 5::float8),
    (33, 'B&B; 5-6'' HT; Sheared', '5-6''', 5::float8),
    (33, 'B&B; 6-7'' HT', '6-7''', 6::float8),
    (33, 'B&B; 6-7'' HT; 1.5" Cal', '6-7''', 6::float8),
    (33, 'B&B; 6-7'' HT; Hedge Form', '6-7''', 6::float8),
    (33, 'B&B; 6-7'' HT; Sheared', '6-7''', 6::float8),
    (33, 'B&B; 7-8'' HT', '7-8''', 7::float8),
    (33, 'B&B; 7-8'' HT; 1.75" Cal', '7-8''', 7::float8),
    (33, 'B&B; 7-8'' HT; Heavy', '7-8''', 7::float8),
    (33, 'B&B; 7-8'' HT; Hedge Form', '7-8''', 7::float8),
    (33, 'B&B; 7-8'' HT; Sheared', '7-8''', 7::float8),
    (33, 'B&B; 8-9'' HT', '8-9''', 8::float8),
    (33, 'B&B; 8-9'' HT; 2.0" Cal', '8-9''', 8::float8),
    (33, 'B&B; 8-9'' HT; Hedge Form', '8-9''', 8::float8),
    (80, 'Bush; 18 - 24"; B&B', '18 - 24"', 1.5::float8),
    (80, 'Bush; 21 - 24"; B&B', '21 - 24"', 1.75::float8),
    (80, 'Bush; 24 - 30"; B&B', '24 - 30"', 2::float8),
    (80, 'Bush; 30 - 36"; B&B', '30 - 36"', 2.5::float8),
    (80, 'Bush; 36 - 42"; B&B', '36 - 42"', 3::float8),
    (80, 'Bush; 42 - 48"; B&B', '42 - 48"', 3.5::float8),
    (80, 'Columnar; 30 - 36"; B&B', '30 - 36"', 2.5::float8),
    (80, 'Columnar; 36 - 42"; B&B', '36 - 42"', 3::float8),
    (80, 'Columnar; 4 - 5''; B&B', '4 - 5''', 4::float8),
    (80, 'Columnar; 42 - 48"; B&B', '42 - 48"', 3.5::float8),
    (80, 'Columnar; 48 - 54"; B&B', '48 - 54"', 4::float8),
    (80, 'Columnar; 5 - 6''; B&B', '5 - 6''', 5::float8),
    (80, 'Columnar; 54 - 60"; B&B', '54 - 60"', 4.5::float8),
    (80, 'Cone; 18 - 21"; B&B', '18 - 21"', 1.5::float8),
    (80, 'Cone; 18 - 24"; B&B', '18 - 24"', 1.5::float8),
    (80, 'Cone; 21 - 24"; B&B', '21 - 24"', 1.75::float8),
    (80, 'Cone; 24 - 30"; B&B', '24 - 30"', 2::float8),
    (80, 'Cone; 30 - 36"; B&B', '30 - 36"', 2.5::float8),
    (80, 'Cone; 36 - 42"; B&B', '36 - 42"', 3::float8),
    (80, 'Cone; 42 - 48"; B&B', '42 - 48"', 3.5::float8),
    (80, 'Cone; 48 - 54"; B&B', '48 - 54"', 4::float8),
    (80, 'Cone; 54 - 60"; B&B', '54 - 60"', 4.5::float8),
    (80, 'Pyramid; 3 - 4'' ; B&B', '3 - 4''', 3::float8),
    (80, 'Pyramid; 36 - 42"; B&B', '36 - 42"', 3::float8),
    (80, 'Pyramid; 4 - 5''; B&B', '4 - 5''', 4::float8),
    (80, 'Serpentine; 4 - 5''; B&B', '4 - 5''', 4::float8),
    (80, 'Serpentine; 5 - 6''; B&B', '5 - 6''', 5::float8),
    (80, 'Spiral; 36 - 42"; B&B', '36 - 42"', 3::float8),
    (80, 'Spiral; 4 - 5''; B&B', '4 - 5''', 4::float8),
    (80, 'Spiral; 48 - 54"; B&B', '48 - 54"', 4::float8),
    (80, 'Spiral; 5 - 6''; B&B', '5 - 6''', 5::float8),
    (80, 'Spiral; 54 - 60"; B&B', '54 - 60"', 4.5::float8)
)
UPDATE inventory inv
SET height = m.dtext,
    height_std = m.dstd
FROM m
WHERE inv.is_active AND inv.supplier_id = m.sid AND inv.size = m.sz
  AND inv.height IS NULL;

-- width: 14 pairs whose `size` string also prints one. Written only
-- where the column is EMPTY — an existing value is never second-guessed.
WITH m(sid, sz, dtext, dstd) AS (VALUES
    (33, 'B&B; 12-15" Sprd', '12-15"', 12::float8),
    (33, 'B&B; 12-15" Sprd; Low', '12-15"', 12::float8),
    (33, 'B&B; 12-15" Sprd; STD', '12-15"', 12::float8),
    (33, 'B&B; 15-18" Sprd', '15-18"', 15::float8),
    (33, 'B&B; 15-18" Sprd; Low', '15-18"', 15::float8),
    (33, 'B&B; 15-18" Sprd; STD', '15-18"', 15::float8),
    (33, 'B&B; 18-24" Sprd', '18-24"', 18::float8),
    (33, 'B&B; 18-24" Sprd; Low', '18-24"', 18::float8),
    (33, 'B&B; 18-24" Sprd; STD', '18-24"', 18::float8),
    (33, 'B&B; 24-30" Sprd', '24-30"', 24::float8),
    (33, 'B&B; 24-30" Sprd; Low', '24-30"', 24::float8),
    (33, 'B&B; 24-30" Sprd; STD', '24-30"', 24::float8),
    (33, 'B&B; 30-36" Sprd; Low', '30-36"', 30::float8),
    (33, 'B&B; 30-36" Sprd; STD', '30-36"', 30::float8)
)
UPDATE inventory inv
SET width = m.dtext,
    width_std = m.dstd
FROM m
WHERE inv.is_active AND inv.supplier_id = m.sid AND inv.size = m.sz
  AND inv.width IS NULL;

-- caliper: 20 pairs whose `size` string also prints one. Written only
-- where the column is EMPTY — an existing value is never second-guessed.
WITH m(sid, sz, dtext, dstd) AS (VALUES
    (20, '3.0" CAL B&B SINGLE STEM', '3.0"', 3::float8),
    (31, 'B&B 0.5"', '0.5"', 0.5::float8),
    (31, 'B&B 1.0"', '1.0"', 1::float8),
    (31, 'B&B 1.5"', '1.5"', 1.5::float8),
    (33, 'B&B 1.5"', '1.5"', 1.5::float8),
    (39, 'B&B 1.5" Caliper 1.5"', '1.5"', 1.5::float8),
    (33, 'B&B 1.75"', '1.75"', 1.75::float8),
    (31, 'B&B 2.0"', '2.0"', 2::float8),
    (33, 'B&B 2.0"', '2.0"', 2::float8),
    (31, 'B&B 2.5"', '2.5"', 2.5::float8),
    (39, 'B&B 2" Caliper 2"', '2"', 2::float8),
    (31, 'B&B 3.5"', '3.5"', 3.5::float8),
    (43, 'B&B 3.5"', '3.5"', 3.5::float8),
    (45, 'B&B 3.5"', '3.5"', 3.5::float8),
    (45, 'B&B 3"', '3"', 3::float8),
    (31, 'B&B 4.5"', '4.5"', 4.5::float8),
    (45, 'B&B 7"', '7"', 7::float8),
    (33, 'B&B; 1.0" Cal; Espalier', '1.0"', 1::float8),
    (33, 'B&B; 1.5" Cal; Espalier', '1.5"', 1.5::float8),
    (33, 'B&B; 2.0" Cal; Espalier', '2.0"', 2::float8)
)
UPDATE inventory inv
SET caliper = m.dtext,
    caliper_std = m.dstd
FROM m
WHERE inv.is_active AND inv.supplier_id = m.sid AND inv.size = m.sz
  AND inv.caliper IS NULL;
