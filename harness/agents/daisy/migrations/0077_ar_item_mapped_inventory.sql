-- 0077: availability_request_items.mapped_inventory_id — the supplier's own
-- catalogue row our look-up mapped to this line.
-- Applied 2026-08-26 (Bhoumik, via Supabase MCP).
--
-- The mapping already existed, but only as prose: the jr thread named the
-- inventory row it found at that supplier, the supplier thread seeded
-- `unit_price` from it, and the row itself was never written down. This column
-- keeps it, so a seeded price can be traced to what it was seeded from and a
-- supplier's answer read against the row we thought answered the line.
--
-- Nullable and stays nullable — most lines map to nothing (that is the
-- interesting case, the one a supplier surprises us on). ON DELETE SET NULL
-- because inventory is re-ingested and has twice been reset outright; losing
-- the catalogue row must not take the ask with it.

alter table public.availability_request_items
  add column mapped_inventory_id uuid
    references public.inventory(id) on delete set null;

create index availability_request_items_mapped_inventory_idx
  on public.availability_request_items (mapped_inventory_id)
  where mapped_inventory_id is not null;

comment on column public.availability_request_items.mapped_inventory_id IS
  'The `inventory` row our look-up mapped to this line — this supplier''s own catalogue offering for the plant at that size, and what `unit_price` was seeded from at share time. NULL = nothing on their list mapped (or the row is gone). Ours, never supplier-writable.';
