-- 0038_retire_riley_fuzzel_farm.sql
--
-- Riley Fuzzel Farm (963) is Newton Nurseries Spring (1320) under its old name.
-- Bhoumik's call, 2026-08-14, after 0037 surfaced the pair.
--
-- **Newton acquired Riley Fuzzel in 2023** and the site now trades as "Riley
-- Fuzzel - Newton Nurseries". Both rows were created on 2026-08-05 by the same
-- backfill from two different angles — 963 from a source list (Wholesale
-- Nurseries Texas::R118), 1320 from the duplicate re-screen — and both landed on
-- the same street address, which is what gave it away. Neither has ever been
-- contacted or ingested from.
--
-- **Nothing is lost by retiring 963.** It has 0 inventory rows, 0
-- `inventory_sources`, 0 `availability_queries`, and empty `notes` /
-- `communication_notes`. Its one contact is `info@rileyfuzzelfarm.com`, the
-- acquired company's own inbox, which Yelp now lists as closed — 0037 already
-- took that route off the Newton row and gave 1320 its own `Main line`.
--
-- Soft delete, per the schema's convention. `trg_cascade_supplier_deactivation`
-- does the rest: it retires the supplier's `supplier_contacts` link, and then
-- contact 1212 itself, since 963 was its last active location.
--
-- 1320 also picks up the address it should have had. Newton relocated the
-- Spring yard from 630 Riley Fuzzel Rd to **21121 N Fwy Service Rd, Spring TX
-- 77388**, about five minutes away; the phone `(281) 355-5495` came with it and
-- is unchanged, so the contact 0037 wrote is still correct.
--
-- **Not touched, on purpose:**
--   * `latitude` / `longitude` stay null on 1320. 963 has coordinates, but they
--     are for the *old* Riley Fuzzel Rd site, so copying them across would put
--     the pin in the wrong place. Better null than wrong — a real geocode of
--     the new address is enrichment work.
--   * `category` stays `Other`. All three backfilled Newton rows (1318, 1319,
--     1320) carry it while the older Houston row says `Nursery`; that is a gap
--     across the whole set, not something specific to this merge, and fixing
--     only one of the three would make the group less consistent, not more.

-- ------------------------------------------------- the surviving row (1320)

update public.suppliers
   set address = '21121 N Fwy Service Rd',
       zip     = '77388',
       notes   = concat_ws(E'\n\n',
         nullif(btrim(coalesce(notes, '')), ''),
         'Formerly Riley Fuzzel Farm, acquired by Newton Nurseries in 2023 and '
         || 'trading as "Riley Fuzzel - Newton Nurseries". The duplicate row for '
         || 'the old identity (supplier 963) was retired on 2026-08-14. '
         || 'Relocated from 630 Riley Fuzzel Rd, Spring TX 77373 to 21121 N Fwy '
         || 'Service Rd, Spring TX 77388, keeping the same phone; coordinates '
         || 'are null because the ones on the retired row point at the old site.')
 where id = 1320;

-- ------------------------------------------------------- retire the old row
--
-- One statement: the notes land with the flag, and the AFTER UPDATE cascade
-- sees a row that already explains itself.

update public.suppliers
   set is_active = false,
       notes = concat_ws(E'\n\n',
         nullif(btrim(coalesce(notes, '')), ''),
         'Retired 2026-08-14: this is Newton Nurseries Spring (supplier 1320) '
         || 'under its pre-acquisition name. Newton Nurseries acquired Riley '
         || 'Fuzzel in 2023; both rows were created by the 2026-08-05 backfill '
         || 'at the same street address. No inventory, sources or queries were '
         || 'attached. Use 1320.')
 where id = 963;
