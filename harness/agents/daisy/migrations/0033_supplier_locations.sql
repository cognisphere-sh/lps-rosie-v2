-- 0033_supplier_locations.sql
--
-- Multi-location suppliers (Bhoumik, 2026-08-14).
--
-- A nursery that grows or sells at several sites keeps **one `suppliers` row
-- per location** — that is already how Everde, Moon Valley and a dozen others
-- sit in the table, and it is what `inventory`, `inventory_sources` and the
-- contact links hang off. What was missing is the *company* those rows belong
-- to. With only the name to go on, "every Everde location" was a guess:
-- `Everde Growers - Glen Flora Farm`, `EVERDE GROWERS - BUNNELL` and the
-- unsuffixed HQ row 32 do not share a parseable prefix, Newton uses no dash at
-- all (`Newton Nurseries Katy`) and Calloway's uses an em dash. Ingestion needs
-- the exact set, because a drop that names no location is written to **every**
-- location of that company — guessing the set there means guessing which
-- nurseries claim to have stock.
--
-- `supplier_groups` is that company. `suppliers.group_id` is NULL for the
-- single-site majority, and NULL means "one location", not "unknown".
--
-- The 16 groups backfilled below were identified by hand: a shared brand name
-- **and** a shared website domain, one row per distinct site. Families that met
-- only one half of that test were deliberately left ungrouped and are listed at
-- the bottom of this file for someone to confirm — a wrong group is not a
-- cosmetic error, it fans a supplier's availability out to a nursery that never
-- offered it.

create table if not exists public.supplier_groups (
  id         bigint generated always as identity primary key,
  name       text not null,
  website    text,
  notes      text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.supplier_groups is
  'One row per multi-location company. Its locations are the `suppliers` rows '
  'pointing back through `suppliers.group_id`. See docs/supabase-schema.md.';

create trigger handle_updated_at before update on public.supplier_groups
  for each row execute function moddatetime('updated_at');

alter table public.supplier_groups enable row level security;

create policy "authenticated full access" on public.supplier_groups
  for all to authenticated using (true) with check (true);

alter table public.suppliers
  add column if not exists group_id bigint references public.supplier_groups(id);

comment on column public.suppliers.group_id is
  'The multi-location company this location belongs to, or NULL when the '
  'supplier is a single site. NULL means "one location", not "unknown".';

create index if not exists suppliers_group_idx
  on public.suppliers (group_id) where group_id is not null;

-- ------------------------------------------------------------------ backfill

with g as (
  insert into public.supplier_groups (name, website) values
    ('ArborGen',                        'arborgen.com'),
    ('Alta Vista Nursery',              'altavista-nursery.com'),
    ('Calloway''s Nursery',             'calloways.com'),
    ('Devil Mountain Wholesale Nursery','devilmountainnursery.com'),
    ('Everde Growers',                  'everde.com'),
    ('Klepac Greenhouses',              'klepac.com'),
    ('Moon Valley Nurseries',           'moonvalleynurseries.com'),
    ('Newton Nurseries',                'newtonnurseries.com'),
    ('Snapper Creek Nursery',           'snappercreek.biz'),
    ('Sunscape',                        'sunscapeinc.com'),
    ('Tree of Life Nursery (RGV)',      'treeoflifenurseryrgv.com'),
    ('Tree Valley Nursery',             'treevalleynursery.com'),
    ('Triangle Nursery LLC',            'triangletrees.net'),
    ('Vickery Greenhouse',              'vickerygreenhouse.com'),
    ('Whitfill Nursery',                'whitfillnursery.com'),
    ('YC Nursery',                      'ycnursery.com')
  returning id, name
), m(name, ids) as (
  values
    ('ArborGen',                         array[110, 1208, 1209]::bigint[]),
    ('Alta Vista Nursery',               array[607, 1206]),
    ('Calloway''s Nursery',              array[119, 1388, 1389]),
    ('Devil Mountain Wholesale Nursery', array[126, 1390, 1391]),
    ('Everde Growers',                   array[32, 1230, 1231, 1232, 1233]),
    ('Klepac Greenhouses',               array[73, 1279]),
    ('Moon Valley Nurseries',            array[91, 1296, 1297, 1298, 1299, 1300,
                                               1301, 1302, 1303, 1304, 1305, 1306,
                                               1307, 1308, 1309, 1310, 1311]),
    ('Newton Nurseries',                 array[645, 1318, 1319, 1320]),
    ('Snapper Creek Nursery',            array[526, 1348]),
    ('Sunscape',                         array[28, 1358, 1359]),
    ('Tree of Life Nursery (RGV)',       array[667, 1367, 1368]),
    ('Tree Valley Nursery',              array[668, 1369]),
    ('Triangle Nursery LLC',             array[570, 1370]),
    ('Vickery Greenhouse',               array[677, 1379]),
    ('Whitfill Nursery',                 array[1383, 1384]),
    ('YC Nursery',                       array[47, 1387])
)
update public.suppliers s
   set group_id = g.id
  from g join m on m.name = g.name
 where s.id = any(m.ids);

-- ------------------------------------------------- deliberately NOT grouped
--
-- Confirm with Chris before grouping any of these; each is one supplier row
-- per line, with why it was left alone.
--
-- Brand + domain match, but the sites are far apart and the brand is a common
-- surname / phrase — could as easily be two unrelated nurseries, one of which
-- has the wrong website on file:
--   143  Hawkins Nursery And Tree Farm   Wills Point TX  hawkinsnursery.com
--   1262 HAWKINS NURSERY INC             Travelers Rs SC hawkinsnursery.com
--   62   New Life Nursery, Inc.          Bridgeton NJ    newlifenursery.com
--   448  New Life Nursery, Inc           Holland MI      newlifenursery.com
--   141  Groundworks Texas               Alvin TX        datepalm.com
--   1259 GROUNDWORKS OF P B CTY          Boynton Beach FL datepalm.com
--
-- Same brand and region, no shared website to corroborate it:
--   1366 Tree of Life Garden Center      San Benito TX   (no website)
--        — possibly a fourth Tree of Life (RGV) site.
--
-- Same brand, same city: these look like **duplicate rows**, not locations.
-- They want merging, which is a separate job against the sources:
--   6/917        Acosta Farms Nursery, Inc / Acosta Farms      Miami FL
--   11/1331      R. Plants Inc. / R. PLANTS NURSERY            Homestead FL
--   455/919/1324 Old Courthouse Nursery ×2 / OLD COURTHOUSE NSY Warsaw NC
--
-- Shared website, unrelated companies — the domain is a marketplace or was
-- copied onto the wrong row. Not groups:
--   plantsearch.com (9 rows), sharptreefarm.com, springgardensnurseryinc.com,
--   tropictraditions.com, bayougardens.com
