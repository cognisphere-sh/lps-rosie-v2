-- 0037_fix_newton_spring_and_ycnursery_contacts.sql
--
-- Two contact corrections Bhoumik asked for after the 0036 merge, 2026-08-14.
--
-- ## 1. Newton Nurseries Spring was reading a closed company's inbox
--
-- 0036 flagged this as "a Newton location carrying another farm's contact
-- details". Researching it before changing anything showed that read was half
-- wrong, and the half that was wrong matters:
--
--   * Newton Nurseries **acquired Riley Fuzzel in 2023** — their own release,
--     "Newton Nurseries Acquires Riley Fuzzel, Joining Forces to Expand Their
--     Wholesale Nursery Position in Texas". The site trades as "Riley Fuzzel -
--     Newton Nurseries", 630 Riley Fuzzel Rd, Spring TX 77373.
--   * So the **phone `281-355-5495` is correct** for supplier 1320. It is that
--     site's number and always was; it is not a stray value copied from
--     elsewhere, and it is not being changed here.
--   * The **email is not.** `info@rileyfuzzelfarm.com` is the acquired
--     company's own inbox — Yelp now lists Riley Fuzzel Farm as CLOSED — and
--     Newton routes each site through its own `<city>-sales@newnurseries.com`
--     address (`houston-sales@`, `austin-sales@`, `katy-sales@` are all on
--     file). Availability requests for the Spring yard should not be landing in
--     the old owner's mailbox.
--
-- The fix is therefore narrow: give supplier 1320 its own `Main line` contact
-- carrying the verified phone, and unlink the shared Riley Fuzzel row from it.
-- Supplier 963 keeps that row untouched.
--
-- **No email is written.** `spring-sales@newnurseries.com` is the obvious guess
-- from the three siblings, and a guess is exactly what the SOP forbids — the
-- site returns 403 to us and no source prints the address. A contact with only
-- a phone is valid; a wrong email is a request that vanishes.
--
-- ### Left for Chris, deliberately
--
-- * **963 and 1320 look like one business, before and after the acquisition** —
--   same street address, and Newton's own page for the site is
--   `/rileyfuzzel-spring/`. Collapsing them is a supplier-level decision with
--   inventory, sources and history hanging off both rows, not a contact fix.
-- * **1320's address is stale.** Newton has since relocated the Spring nursery
--   to 21121 N Fwy Service Rd, Spring TX 77388, five minutes from the old site.
--   Which row should carry that address depends on the question above, so
--   neither is touched here.
--
-- ## 2. A phone number stored with a leading colon
--
-- Contact 1782 (Lynn Agee, YC Nursery - Prosper) has `:214-213-0962` — a
-- delimiter that came in with the value. Stripped. **The digits are left
-- exactly as they are:** this row and contact 979 differ in the last digit
-- (…0961 vs …0962), which is either two real lines or a typo, and that is a
-- question for the source, not for a migration.

-- ---------------------------------------------------- 1. Newton Spring (1320)

with newton_spring as (
  insert into public.contacts (name, email, phone, title_department, notes)
  values (
    null, null, '+1(281) 355-5495', 'Main line',
    'Spring yard main line, verified 2026-08-14 against public listings for ' ||
    '"Riley Fuzzel - Newton Nurseries", 630 Riley Fuzzel Rd, Spring TX 77373. ' ||
    'Replaces the shared info@rileyfuzzelfarm.com route (contact 1212), which ' ||
    'is the inbox of the company Newton acquired in 2023 and is now closed. ' ||
    'No email on file: Newton uses <city>-sales@newnurseries.com per site, but ' ||
    'the Spring address is not printed anywhere we can read, so it is left ' ||
    'null rather than guessed.'
  )
  returning id
)
insert into public.supplier_contacts (supplier_id, contact_id, is_primary)
select 1320, id, false from newton_spring;

-- The old route stays live for Riley Fuzzel Farm (963); only the Newton link goes.
update public.supplier_contacts
   set is_active = false
 where supplier_id = 1320 and contact_id = 1212 and is_active;

-- ------------------------------------------------------- 2. the stray colon

update public.contacts
   set phone = btrim(ltrim(phone, ':'))
 where id = 1782 and phone like ':%';
