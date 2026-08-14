-- 0048_cascade_source_deactivation.sql
--
-- Retiring an ingested file retires the inventory rows it sourced.
--
-- `inventory.source_id` is a row's provenance, and since 2026-08-14 it names
-- the **most recent drop that contained the row**. Deactivating a source on its
-- own therefore leaves live rows with no reachable source, and the two read
-- paths disagree about them:
--
--   * `search_inventory` joins `inventory_sources` and requires
--     `inv.source_id is null or src.is_active`, so the rows vanish from search.
--   * `inventory_enriched` is a plain projection of `inventory`, so browsing
--     the supplier's catalogue still lists them.
--
-- and the app derives a blank `Ingested` date for them either way. The app's
-- Files tab already retires both together, but a hand-written
-- `update inventory_sources set is_active = false` reopens the same hole. This
-- makes the cascade a property of the table instead of a property of one
-- caller.
--
-- Measured before applying: 1,340 of 2,079 sources are already inactive and
-- **zero** active inventory rows point at an inactive source, across zero
-- suppliers. So this enforces an invariant the data already satisfies — it
-- rewrites nothing on apply, and is not a backfill.
--
-- Scope is deliberately one direction: **deactivation only**. Reactivating a
-- source does not bring its rows back, because there is no record of which of
-- them this trigger retired and which were already retired for their own
-- reasons. Undoing a mistaken retirement is a manual, considered `update`.
--
-- No interaction with the supplier cascade. `cascade_supplier_deactivation`
-- retires the supplier's `inventory` rows *before* its `inventory_sources`
-- rows, so by the time this fires there is nothing left for it to match.

create or replace function public.cascade_source_deactivation()
returns trigger
language plpgsql
as $function$
begin
  update public.inventory
    set is_active = false
    where source_id = new.id and is_active = true;
  return new;
end;
$function$;

comment on function public.cascade_source_deactivation is
  'Retires the inventory rows a deactivated source is the provenance for. Deactivation only — reactivating a source does not restore them.';

create trigger trg_cascade_source_deactivation
  after update of is_active on public.inventory_sources
  for each row
  when (old.is_active = true and new.is_active = false)
  execute function public.cascade_source_deactivation();

-- Rollback: drop trigger trg_cascade_source_deactivation on public.inventory_sources;
--           drop function public.cascade_source_deactivation();
