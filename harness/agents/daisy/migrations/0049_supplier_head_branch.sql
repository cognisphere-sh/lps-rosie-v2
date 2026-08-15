-- 0049_supplier_head_branch.sql
--
-- The head branch replaces `supplier_groups` (Bhoumik, 2026-08-15).
--
-- 0033 modelled a multi-location company as a separate `supplier_groups` row
-- that its locations pointed at. The group row never earned its keep: all 16
-- had null `notes`, every `website` duplicated the members' own, and the only
-- thing it added was a company name — which one of its locations already
-- carries, because that location *is* the company's office. Everde is the
-- shape: supplier 32 is the Houston corporate office at 5151 Mitchelldale, and
-- Glen Flora, Mill Creek, Bunnell and Canal Point are its farms.
--
-- So the company is now named by one of its own rows. `head_branch_id` points
-- every supplier at its head branch, and **a head branch points at itself** —
-- there is no null case and no second table. A single-site supplier is its own
-- head, which is the same statement as "this company has one location".
--
-- The company's locations, from any one of them:
--
--   SELECT id, name, city, state FROM suppliers
--   WHERE head_branch_id = (SELECT head_branch_id FROM suppliers WHERE id = <any>)
--     AND is_active ORDER BY id;
--
-- One level, always: a branch may only point at a row that is its own head, so
-- `head_branch_id` never chains and the query above is complete. The trigger
-- below enforces that in both directions and fills the self-reference on
-- insert, since an identity PK cannot be a column default.
--
-- ------------------------------------------------------------------- the heads
--
-- Which row is the head was decided per company from the contacts on file and
-- confirmed against each company's own site: the head is the row at the
-- **business office** — the address the company publishes as its headquarters
-- or main location — not the largest farm. Six differ from 0033's first-listed
-- member, and three companies have no head-office row at all:
--
--   ArborGen      110  Bullard TX      * US HQ (Ridgeville SC) is not a row;
--                                        Bullard holds the toll-free line and
--                                        the Production Coordinator.
--   Alta Vista    607  Fort Worth TX     main office line (817) 337-7434.
--   Calloway's    119  Arlington TX    * corporate (North Richland Hills) is
--                                        not a row; 119 holds info@calloways.
--   Devil Mtn     126  San Ramon CA      HQ; the availability list arrives here.
--   Everde         32  Houston TX        "Everde Growers Corporate Office".
--   Klepac       1279  Blanco TX         Main Complex, 200 Kendalia Rd, the
--                                        (830) 833-4574 line, info@klepac.com.
--                                        73 is the Creek distribution centre.
--   Moon Valley    91  Glen Flora TX   * Phoenix corporate is not a row; 91 is
--                                        the only row with a company-level
--                                        @mvncorp.com contact (Director of
--                                        Wholesale). The other 16 are yards.
--   Newton        645  Houston TX        HQ, 5110 Bingle Rd.
--   Snapper Creek 526  Ft Pierce FL      HQ, 20107 Orange Ave; sales@ is this
--                                        site's address, not Homestead's.
--   Sunscape     1358  Tampa FL          HQ, 13417 W Hillsborough Ave. Malabar
--                                        (28) is the east-coast yard.
--   Tree of Life 1368  San Juan TX       flagship, listed first on their own
--                                        locations page.
--   Tree Valley  1369  Tomball TX        11906 Boudreaux Rd, main line
--                                        (832) 435-9398, info@ on this row.
--   Triangle     1370  Houston TX        the business office; Groveland (570)
--                                        is the 100-acre growing facility.
--   Vickery      1379  Dallas TX         HQ, 4911 E Grand Ave; Austin is the
--                                        satellite.
--   Whitfill     1383  Phoenix AZ        main location, 2647 E Southern Ave,
--                                        (602) 268-9096.
--   YC             47  Dallas TX         location 1 in their own catalog.
--
--   * = no head-office row exists; the pick is the best stand-in and is worth
--       revisiting if that office is ever onboarded.
--
-- The families 0033 deliberately left ungrouped are unchanged — they are still
-- listed at the bottom of `0033_supplier_locations.sql` and are still their own
-- heads here, which is what "not confirmed to be one company" means.

-- ----------------------------------------------------------------- the column

alter table public.suppliers
  add column if not exists head_branch_id bigint references public.suppliers(id);

comment on column public.suppliers.head_branch_id is
  'The head branch of the company this supplier belongs to. A head branch — '
  'and every single-site supplier — points at itself, so this is never null '
  'and never chains: a company''s locations are the rows sharing its value.';

-- ------------------------------------------------------------------- backfill

update public.suppliers s
   set head_branch_id = h.head
  from (values
    (110, 110), (1208, 110), (1209, 110),                       -- ArborGen
    (607, 607), (1206, 607),                                    -- Alta Vista
    (119, 119), (1388, 119), (1389, 119),                       -- Calloway's
    (126, 126), (1390, 126), (1391, 126),                       -- Devil Mountain
    (32, 32), (1230, 32), (1231, 32), (1232, 32), (1233, 32),   -- Everde
    (1279, 1279), (73, 1279),                                   -- Klepac
    (91, 91), (1296, 91), (1297, 91), (1298, 91), (1299, 91),   -- Moon Valley
    (1300, 91), (1301, 91), (1302, 91), (1303, 91), (1304, 91),
    (1305, 91), (1306, 91), (1307, 91), (1308, 91), (1309, 91),
    (1310, 91), (1311, 91),
    (645, 645), (1318, 645), (1319, 645), (1320, 645),          -- Newton
    (526, 526), (1348, 526),                                    -- Snapper Creek
    (1358, 1358), (28, 1358), (1359, 1358),                     -- Sunscape
    (1368, 1368), (667, 1368), (1367, 1368),                    -- Tree of Life
    (1369, 1369), (668, 1369),                                  -- Tree Valley
    (1370, 1370), (570, 1370),                                  -- Triangle
    (1379, 1379), (677, 1379),                                  -- Vickery
    (1383, 1383), (1384, 1383),                                 -- Whitfill
    (47, 47), (1387, 47)                                        -- YC
  ) as h(member, head)
 where s.id = h.member;

-- everyone else is a single site, and a single site is its own head
update public.suppliers set head_branch_id = id where head_branch_id is null;

-- --------------------------------------------------------- keep it that way

create or replace function public.suppliers_head_branch()
returns trigger language plpgsql as $$
begin
  if new.head_branch_id is null then
    new.head_branch_id := new.id;
  end if;

  if new.head_branch_id <> new.id then
    if not exists (select 1 from public.suppliers
                    where id = new.head_branch_id and head_branch_id = id) then
      raise exception
        'supplier % cannot take supplier % as its head branch: that row is '
        'itself a branch, and head_branch_id must not chain',
        new.id, new.head_branch_id;
    end if;

    if exists (select 1 from public.suppliers
                where head_branch_id = new.id and id <> new.id) then
      raise exception
        'supplier % is the head branch of other locations and cannot become a '
        'branch itself; move its locations first',
        new.id;
    end if;
  end if;

  return new;
end;
$$;

comment on function public.suppliers_head_branch() is
  'Defaults suppliers.head_branch_id to the row itself and keeps the reference '
  'one level deep in both directions. See 0049_supplier_head_branch.sql.';

create trigger set_head_branch
  before insert or update of head_branch_id on public.suppliers
  for each row execute function public.suppliers_head_branch();

alter table public.suppliers alter column head_branch_id set not null;

create index if not exists suppliers_head_branch_idx
  on public.suppliers (head_branch_id);

-- ------------------------------------------------------------- drop the group

drop index if exists public.suppliers_group_idx;
alter table public.suppliers drop column group_id;
drop table public.supplier_groups;
