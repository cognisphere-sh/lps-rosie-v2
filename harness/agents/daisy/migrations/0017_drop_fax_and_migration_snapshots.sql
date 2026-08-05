-- 0017_drop_fax_and_migration_snapshots
--
-- Closes out the 0014–0016 contact normalization.
--
-- 1. `suppliers.fax` was the last contact field on the table. It goes, leaving
--    `suppliers` describing the company and nothing else: name, category,
--    address, coordinates, website, notes, communication_notes.
-- 2. The two rollback snapshots taken during 0015/0016 are dropped now that the
--    change has settled.
--
-- The 12 fax numbers are preserved first. They go into the `notes` of the
-- supplier's main-line contact rather than its `phone`, because a fax number in
-- `phone` renders as a `tel:` link in the app and dials a fax machine.
--
-- Nothing in the app, the search RPC or the pgroonga document ever referenced
-- `fax`, so no index or function rebuild is needed here.

-- ---------------------------------------------------- 0017a: preserve the faxes

with target as (
  select distinct on (s.id) s.id as supplier_id, c.id as contact_id, btrim(s.fax) as fax
  from public.suppliers s
  join public.contacts c on c.supplier_id = s.id
  where s.fax is not null and btrim(s.fax) <> ''
  -- Prefer the main line, then the primary, then the oldest row.
  order by s.id,
           (c.title_department = 'Main line') desc nulls last,
           c.is_primary desc,
           c.id asc
)
update public.contacts c
set notes = nullif(concat_ws(' ', c.notes, 'Fax: ' || t.fax || '.'), '')
from target t
where c.id = t.contact_id;

-- ------------------------------------------------------------- 0017b: drop them

alter table public.suppliers drop column fax;

drop table public.suppliers_notes_pre_contact_extraction;
drop table public.suppliers_contact_pre_move;
