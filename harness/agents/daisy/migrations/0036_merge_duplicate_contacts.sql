-- 0036_merge_duplicate_contacts.sql
--
-- Merge duplicate contacts into one row with several links (Bhoumik,
-- 2026-08-14). The follow-up to 0034, which created `supplier_contacts` but
-- deliberately merged nothing.
--
-- Until 0034, `contacts.supplier_id` allowed a person exactly one supplier, so
-- a rep who sells for six nurseries was entered six times. Those rows then
-- drift: one gets a new phone number, another gets a title, and nothing says
-- they are the same person. This migration folds 33 rows into 13, keeping every
-- link, so Jim Ord is one contact with six links instead of six contacts.
--
-- **The rule, and why it is this narrow.** Two rows merge only when they share
-- a normalized email **and** a normalized phone, and no field of one
-- contradicts the other (at most one distinct non-null name; `'Main line'` is
-- provenance from 0016, not a title, so it never counts as a conflict). Nothing
-- is merged on a name match, a fuzzy match, or an email match alone.
--
-- That last exclusion is the important one. **A shared inbox is not a duplicate
-- person.** `info@calloways.com` appears three times with three different
-- phones and two different managers — Laurie at Arlington South and Nathan at
-- Mansfield are two people who share a company address. Merging on email alone
-- would collapse them into one and throw away two phone numbers, because the
-- phone lives on the contact, not on the link. Twelve such groups (28 rows)
-- were left exactly as they are; they are listed at the bottom of this file.
--
-- Every merge is reversible from `contacts_pre_merge` / `supplier_contacts_pre_merge`
-- and the map in `contacts_merge_map`, all created below.

-- ------------------------------------------------------------------- the map
--
-- Explicit, not computed: 33 rows were read one by one before this list was
-- written, and a rule re-evaluated at apply time could pick up a row nobody
-- looked at. Survivor = the lowest id in each group (the oldest row).

create table if not exists public.contacts_merge_map (
  merged_id   bigint primary key,
  survivor_id bigint not null,
  matched_on  text not null
);

insert into public.contacts_merge_map (merged_id, survivor_id, matched_on) values
  -- jimord@me.com / 918-625-2823 — one rep, six unrelated nurseries
  (1049, 982, 'email+phone'), (1058, 982, 'email+phone'), (1082, 982, 'email+phone'),
  (1083, 982, 'email+phone'), (1154, 982, 'email+phone'),
  -- kenhoward1004@gmail.com / 214.869.8366 — Sales Representative, five nurseries
  (43, 9, 'email+phone'), (1821, 9, 'email+phone'), (1822, 9, 'email+phone'),
  (1823, 9, 'email+phone'),
  -- one person across two locations of the same company
  (1647, 986,  'email+phone'),  -- Jana Dean, Klepac ×2
  (1731, 1107, 'email+phone'),  -- Nick Morris, Snapper Creek ×2
  (1594, 1592, 'phone'),        -- Everde Bunnell + Canal Point main line
  -- one route at two suppliers that are not (yet) a recorded group
  (1628, 210,  'email+phone'),  -- Hawkins TX + SC
  (1078, 786,  'email+phone'),  -- New Life NJ + MI
  (1099, 809,  'email+phone'),  -- Rusty Mangrum + Samuel I. Minder
  (1639, 214,  'email+phone'),  -- Ken Thomson, J&K + Ximena
  (1696, 1212, 'email+phone'),  -- Riley Fuzzel Farm + Newton Nurseries Spring
  (1711, 1644, 'phone'),        -- "Rocky", suppliers 1277 + 1333
  (1825, 1727, 'phone'),        -- Mike Hollenbeck, Shiloh + Sharp Tree Farm
  -- the only pair that was duplicated *within* one supplier
  (1754, 1013, 'phone');        -- Tree of Life Garden Center (1366) ×2

-- -------------------------------------------------------------- the snapshots

create table if not exists public.contacts_pre_merge as
select c.* from public.contacts c
where c.id in (select merged_id from public.contacts_merge_map)
   or c.id in (select survivor_id from public.contacts_merge_map);

create table if not exists public.supplier_contacts_pre_merge as
select sc.* from public.supplier_contacts sc
where sc.contact_id in (select merged_id from public.contacts_merge_map)
   or sc.contact_id in (select survivor_id from public.contacts_merge_map);

-- Snapshots hold the same data as the tables they came from, so they get the
-- same lock-down: RLS on and no policy at all, which leaves them visible only
-- to the BYPASSRLS roles. Same shape as the 0015 / 0016a snapshots.
alter table public.contacts_merge_map           enable row level security;
alter table public.contacts_pre_merge           enable row level security;
alter table public.supplier_contacts_pre_merge  enable row level security;

-- ------------------------------------------------------ fill the survivor in
--
-- A merge must not lose a fact. The survivor takes any `name` it lacks and any
-- real `title_department` it lacks — and `'Main line'` yields to a real title,
-- because it only ever meant "this row came from the old `suppliers.email`
-- column". Notes are concatenated, never replaced, and the merge itself is
-- recorded in them so the row explains its own history.

with agg as (
  select m.survivor_id,
         min(c.name) filter (where c.name is not null) as name,
         min(c.title_department) filter (
           where c.title_department is not null and c.title_department <> 'Main line'
         ) as title,
         string_agg(nullif(btrim(coalesce(c.notes, '')), ''), E'\n\n') as notes,
         array_agg(m.merged_id order by m.merged_id) as merged_ids
    from public.contacts_merge_map m
    join public.contacts c on c.id = m.merged_id
   group by m.survivor_id
)
update public.contacts s
   set name = coalesce(s.name, agg.name),
       title_department = case
         when s.title_department is null then agg.title
         when s.title_department = 'Main line' and agg.title is not null then agg.title
         else s.title_department
       end,
       notes = concat_ws(E'\n\n',
         nullif(btrim(coalesce(s.notes, '')), ''),
         agg.notes,
         'Merged from contact ' || array_to_string(agg.merged_ids, ', ') ||
         ' on 2026-08-14 (migration 0036) — same email and phone, one row per '
         || 'supplier from before contacts and suppliers were linked.')
  from agg
 where s.id = agg.survivor_id;

-- ------------------------------------------------------------ move the links
--
-- Order matters. `(supplier_id, contact_id)` is unique, so where the survivor
-- and a merged row both link to the same supplier — contacts 1013 and 1754,
-- both on Tree of Life Garden Center — the two links have to be folded into one
-- before anything is repointed, or the repoint trips the constraint.

update public.supplier_contacts keep
   set is_primary = keep.is_primary or dup.is_primary,
       is_active  = keep.is_active  or dup.is_active
  from public.supplier_contacts dup
  join public.contacts_merge_map m on m.merged_id = dup.contact_id
 where keep.contact_id = m.survivor_id
   and keep.supplier_id = dup.supplier_id;

delete from public.supplier_contacts dup
 using public.contacts_merge_map m
 where dup.contact_id = m.merged_id
   and exists (
     select 1 from public.supplier_contacts keep
      where keep.contact_id = m.survivor_id and keep.supplier_id = dup.supplier_id
   );

update public.supplier_contacts sc
   set contact_id = m.survivor_id
  from public.contacts_merge_map m
 where sc.contact_id = m.merged_id;

-- --------------------------------------------------------- retire the copies
--
-- Soft delete, per the schema's convention, and the row says where it went.
-- It now has no links, so nothing reads it either way.

update public.contacts c
   set is_active = false,
       notes = concat_ws(E'\n\n',
         nullif(btrim(coalesce(c.notes, '')), ''),
         'Merged into contact ' || m.survivor_id || ' on 2026-08-14 (migration 0036).')
  from public.contacts_merge_map m
 where c.id = m.merged_id;

-- --------------------------------------------------- deliberately NOT merged
--
-- Same email, **different phone per row** — a shared company inbox, not one
-- person entered twice. The phone lives on the contact, so merging any of these
-- would delete a working number. Left as they are:
--
--   info@calloways.com          3 rows — Main line, Laurie (Arlington South),
--                                        Nathan (Mansfield): three phones,
--                                        two named managers, one inbox
--   webstore@devilmountainnursery.com  3 — three sites, three phones
--   treeoflife_nursery@yahoo.com       3 — three RGV sites, three phones
--   mike@triangletrees.net             3 — one unverified inferred name, one
--                                          real person at an unrelated supplier,
--                                          one main line
--   austinsales@vickerygreenhouse.com  2 — main line vs Pat Berry (CEO)
--   treevalleynursery@yahoo.com        2 — Manuel Diaz (Owner) vs main line
--   info@arborgen.com                  2 — 888 vs 877 number
--   info@everde.com                    2 — 800 vs 713 number
--   lagee@ycnursery.com                2 — Lynn Agee, …0961 vs …0962 (and the
--                                          second is stored as ":214-213-0962")
--   info@bayougardens.com              2 — two different Houston nurseries
--   info@bvtreefarm.com                2 — Brazos Valley vs Brazos Bend
--   sales@cpnsy.com                    2 — Faith Nursery vs Country Pines
--
-- Worth a look from Chris rather than a merge: `info@rileyfuzzelfarm.com` and
-- its phone sit on **Newton Nurseries Spring** (1320) as well as Riley Fuzzel
-- Farm (963). The two rows really are one route, so they merge here — but a
-- Newton location carrying another farm's contact details looks like a
-- data-entry error on the Newton row, not a genuine shared rep.
