-- 0015_extract_contacts_from_notes
--
-- Follow-up to 0014. Before contacts existed, people found in availability
-- emails and supplier websites had nowhere to go, so they were written into
-- `suppliers.notes` as prose. This lifts them into `contacts` rows and trims
-- the sentences whose only content was that person's contact details.
--
-- Scope: all 54 suppliers with non-empty notes were read by hand (48 active +
-- 6 inactive). The 6 inactive ones are duplicate-record tombstones whose notes
-- are pure provenance — left untouched.
--
-- The rule applied, uniformly:
--   * A **named person** and their email/phone/role becomes a `contacts` row.
--   * Notes lose only the text that carried that person's contact details.
--   * Everything else stays: hours, addresses, policies, parsing quirks,
--     business history, and generic/role inboxes (`sales@`, `orders@`), which
--     are the supplier's own contact surface and already live on `suppliers`.
--
-- New rows are `is_primary = false`. Where a supplier had no contact at all,
-- nothing is promoted: `search_suppliers` falls back to the oldest active row,
-- so a supplier still shows a contact without anyone asserting who is *the*
-- point of contact on no evidence.

-- ------------------------------------------------- 0015a: new people from notes

insert into public.contacts (supplier_id, name, email, phone, title_department, notes) values
  -- 13 Verde River Growers — notes listed two commercial sales cells; the
  -- backfilled row crammed both into one phone field. Second number split out.
  (13, null, null, '(928) 821-1832', 'Commercial sales', null),

  -- 29 Tom Dodd Nurseries — five sales contacts named in the weekly
  -- availability email, no emails or phones given.
  (29, 'Lacy Miller',    null, null, 'Sales', null),
  (29, 'Mike Ellison',   null, null, 'Sales', null),
  (29, 'Cailyn Kiernan', null, null, 'Sales', null),
  (29, 'Walt Williams',  null, null, 'Sales', null),
  (29, 'Luke Gearing',   null, null, 'Sales', null),

  -- 41 Becker Tree Farm
  (41, 'Michael Yacobellis', null, '772-932-1205', null, null),
  (41, 'Erik Pariseleti',    null, '772-530-1376', null, null),

  -- 55 Cox Cactus Farm — sales team from the August 2026 newsletter.
  (55, 'Ashley Peterson',     null, '480-751-9344', 'Sales — Phoenix', null),
  (55, 'Ervin Agustin',       null, '480-721-0382', 'Sales — Phoenix', null),
  (55, 'Holly Dean',          null, '480-737-3935', 'Sales — Phoenix', null),
  (55, 'Jesus Navarrete',     null, '480-679-0197', 'Sales — Phoenix', null),
  (55, 'Marcos Evangelista',  null, '480-772-0991', 'Sales — Phoenix', null),
  (55, 'Patrick Solano',      null, '480-698-4534', 'Sales — Phoenix', null),
  (55, 'Veronica Steinbach',  null, '480-851-4601', 'Sales — Phoenix', null),
  (55, 'Hilda Tubbiolo',      null, '520-709-1915', 'Sales — Tucson',  null),
  (55, 'Jose Lopez',          null, '520-297-5664', 'Sales — Tucson',  null),

  -- 66 Athens Tree Farm
  (66, 'Kaleb Sifers', 'ksifers@athenstreefarm.com', '903-675-8881', 'Sales', null),

  -- 68 Sumter Gardens — hjones@ is also the supplier email; the notes name her.
  (68, 'Hannah Jones', 'hjones@sumtergardens.com', null, 'Business manager', null),

  -- 84 Gralan Farms — the other two contacts from the 2026-07-27 email.
  (84, 'Greg Earle',   null, '706-215-0339', null, null),
  (84, 'Alan Shultz',  null, '706-215-0341', null, null),

  -- 85 Island Tropical Foliage — domestic sales team.
  (85, 'Juan Cespedes',  'juan@islandtropicalfoliage.com',     '305-519-9671', 'Domestic Sales', null),
  (85, 'Jennifer Villa', 'jennifer@islandtropicalfoliage.com', '786-423-0040', 'Domestic Sales', null),

  -- 255 Bick Tropical Farms — supplied by Chris 2026-08-03. "Felix Rivero" here
  -- carries a different office, cell and email from the existing "Felix Jr.
  -- Rivero" row, so they are kept separate rather than silently merged; the
  -- ambiguity is recorded on the row instead of resolved on a guess.
  (255, 'Felix Rivero', 'bickfarms@bellsouth.net', '786-412-2306', 'Sales',
        'Office 305-246-3321. Possibly the same person as Felix Jr. Rivero — different office, cell and email on file. Confirm before merging.'),
  (255, 'Noemi Nieto', 'bicktropicalsnoemi@gmail.com', '786-473-5443', 'Accounting',
        'Office 305-246-1440.'),

  -- 437 Moon's Tree Farm
  (437, 'Jacob Anschutz', 'jacob@moonstreefarm.com', '(706) 372-0800', 'Sales associate', null),
  (437, 'Will Clark',     'will@moonstreefarm.com',  '(706) 872-9825', 'Sales associate', null),
  (437, 'Gina Roe',       'gina@moonstreefarm.com',  null,             'Liner-order submissions', null),

  -- 912 T-Y Nursery
  (912, 'Elmer', 'elmer@tynursery.com', null, null, null);

-- ------------------------------- 0015b: details the notes held for existing rows

-- Roles the notes recorded in prose.
update public.contacts set title_department = 'Commercial sales'              where supplier_id = 13  and phone like '%640-7103%';
update public.contacts set title_department = 'Owner/CEO'                     where supplier_id = 21  and name = 'Danielle Payne';
update public.contacts set title_department = 'General Manager'               where supplier_id = 24  and name = 'Colt Wickizer';
update public.contacts set title_department = 'VP'                            where supplier_id = 43  and name = 'Clint Owens';
update public.contacts set title_department = 'Main office'                   where supplier_id = 52  and name = 'Stephanie Carstensen';
update public.contacts set title_department = 'Sales'                         where supplier_id = 66  and name = 'Charlie Rodrigues';
update public.contacts set title_department = 'Inside sales'                  where supplier_id = 68  and name = 'Melissa Hernandez';
update public.contacts set title_department = 'Office Manager'                where supplier_id = 76  and name = 'Wendy Hunter';
update public.contacts set title_department = 'Domestic Sales'                where supplier_id = 85  and name = 'Lilian Hernandez';
update public.contacts set title_department = 'Historical availability POC'   where supplier_id = 204 and name = 'Patti Morris';
update public.contacts set title_department = 'Senior Sales Rep./Management'  where supplier_id = 437 and name = 'Brookelynn Moon Anschutz';
update public.contacts set title_department = 'Owner/grower'                  where supplier_id = 520 and name = 'John Shearouse';

-- 13 Verde River — keep only the first cell on the backfilled row; the second
-- became its own contact above.
update public.contacts set phone = '(928) 640-7103' where supplier_id = 13 and phone like '%640-7103%';

-- Missing email/phone the notes had all along.
update public.contacts set phone = '229-881-0103'                   where supplier_id = 36  and email = 'Bryant.kbtrees@gmail.com';
update public.contacts set email = 'roberta@straightlinetrees.com'  where supplier_id = 46  and name = 'Roberta Vieira';
update public.contacts set email = 'ken@ranprofarms.com'            where supplier_id = 914 and name = 'Ken Howard / Hand Tree Farm';

-- --------------------------------------------------------- 0015c: trim the notes
--
-- Full replacement values rather than regex surgery, so the diff is reviewable.

-- 6 Acosta Farms — Lilly Gonzalez was already a contact row.
update public.suppliers set notes =
'Loading hours are 7:30 AM-4:00 PM Monday-Friday; orders are due 2 days before pickup. Orders requiring phytosanitary inspection are due 7 days before pickup; inspections are held Thursdays.'
where id = 6;

-- 13 Verde River Growers
update public.suppliers set notes =
'Publishes a weekly availability XLSX/PDF by email and mirrors current availability at https://verderivergrowers.com/availability. Newsletter already active.'
where id = 13;

-- 21 Addyson's — the note said only that Danielle Payne is Owner/CEO.
update public.suppliers set notes = null where id = 21;

-- 24 Purtis Creek Farms
update public.suppliers set notes =
'Alternate/general email: sales@purtiscreekfarms.com. Canonical supplier record; duplicate supplier 918 consolidated into 24 on 2026-07-28. July 2026 availability supersedes active historical 2025 lists.'
where id = 24;

-- 36 KB Tree Farms
update public.suppliers set notes =
'Public availability is field-grown B&B tree stock; prices are per tree and one current D.D. Blanchard offering is call-for-price.'
where id = 36;

-- 41 Becker Tree Farm — the note was only the two extra contacts.
update public.suppliers set notes = null where id = 41;

-- 46 Straightline Tree Farm
update public.suppliers set notes =
'2026-07-06: Matlack Tree Farm rebranded as Straightline Tree Farm; emails at @matlacktreefarm.com continue to work; new general sales email sales@straightlinetrees.com.'
where id = 46;

-- 52 Bizon Nursery
update public.suppliers set notes =
'Mailing address: 29895 SW Kinsman Rd, Wilsonville, OR 97070. Farm/loading dock: 17551 Boones Ferry Rd NE, Hubbard, OR 97032.'
where id = 52;

-- 55 Cox Cactus Farm
update public.suppliers set notes =
'Wholesale/commercial grower; not open to the public. Primary North Valley location: 34623 N 7th Ave, Phoenix, AZ 85086. Additional locations listed in the August 2026 newsletter: Tucson at 7550 N Anway Rd, Marana, AZ 85653; West Valley at 3928 S 331st Ave, Tonopah, AZ 85354. Current availability/pricing webpage is password-protected. Newsletter subscription for chris.r@localplantsupply.com is active.'
where id = 55;

-- 66 Athens Tree Farm — the note was only the two sales contacts.
update public.suppliers set notes = null where id = 66;

-- 68 Sumter Gardens
update public.suppliers set notes =
'Availability newsletter is already active via Constant Contact.'
where id = 68;

-- 76 Fish Branch Tree Farm
update public.suppliers set notes =
'Wholesale-only 325-acre tree farm established in 1988. Generic office contact is tree@fishbranchtreefarm.com / (863) 735-2242. Constant Contact pricing/availability newsletter confirmed active at chris.r@localplantsupply.com. Current pricing is distributed as a one-page, three-column landscape PDF; several palms and field-grown Podocarpus are priced per OA or CT foot rather than as flat unit prices.'
where id = 76;

-- 84 Gralan Farms — the note was the contact list plus "Bailey is the current
-- availability contact", which `is_primary` on her row now says.
update public.suppliers set notes = null where id = 84;

-- 85 Island Tropical Foliage — the note was only the domestic sales roster.
update public.suppliers set notes = null where id = 85;

-- 204 Twinwood Farms. Also fixes the one surviving reference to the dropped
-- `poc_email` column anywhere in the database.
update public.suppliers set notes =
'Official profile verified 2026-08-02: 5,000-acre Simonton wholesale sod/tree farm with container nursery, specimen trees, field-grown trees, and contract growing. Website tree availability is static/low-refresh; all listed material and prices must be confirmed directly before quote. Public tree/specimen sales route is the general line 832-648-3889 and info@twinwoodfarms.com; no named tree-sales POC was found. The historical direct email for Patti Morris is preserved in contacts, but current validity was not publicly confirmed.

Verified historical availability POC: Patti Morris sent Twinwood current availability on 2024-05-06. This relationship is historical; her current role/status was not confirmed on the 2026 public site. The 2024 PDF corroborates that the site’s legacy detail block is the Spring 2024 list and shows historical wholesale list prices, but none should be treated as current.'
where id = 204;

-- 255 Bick Tropical Farms
update public.suppliers set notes =
'Chris submitted the Bick Tropical Farms email/availability signup on 2026-08-03. Watch chris.r@localplantsupply.com for confirmation and future availability; alert Chris when the first message arrives.'
where id = 255;

-- 317 Enviro Pro Tree Farm — Lauren was already a contact row.
update public.suppliers set notes =
'Availability is published as a live PlantANT-backed web table; quantities are typically blank and form/status appears in Description. Public website lists office 352-429-1211, sales 352-223-1280, fax 352-429-1199, and Lauren.enviropro@gmail.com.'
where id = 317;

-- 437 Moon's Tree Farm
update public.suppliers set notes =
'Wholesale-only tree grower; farm visits are by appointment. Public availability page publishes separate 2026 catalog, pre-dug sale, root-pruned, and Fall liner/container lists.'
where id = 437;

-- 528 South Coast Grower — drops only the "brochure lists contact Jonny at …"
-- sentence; Jon Bachmann is already a contact row.
update public.suppliers set notes =
'Website availability page embeds PlantANT supplier 1007841 with a directly readable hosted PDF. Specializes in large, rare, and unique specimen trees and palms; services include relocation, installation, brokering, and export.
Jon Bachmann says inventory changes daily and asks buyers to send lists/specifications directly. South Texas field includes 35-year-old Mediterranean Fan Palms, Texas Olives, Roebelenii, Sylvesters, Bismarcks, Queen Palms, and Texas Sabals. Medjool Date Palms and Olives ship from California and Arizona fields.

2026-07-28 inventory: PlantANT list is unpriced (quote required, not free) and dated daily. Website Specimen Inventory provides explicitly currently offered tagged individual specimens (tag ID, dimensions/container or in-ground status, often photo); these may overlap broad PlantANT ranges. Treat website project/gallery pages as references unless they use the explicit View Available/Tag ID pattern.
LPS operating decision 2026-07-29: Treat the hosted PlantANT and tagged specimen inventory as searchable sourcing placeholders, not a high-frequency authoritative availability feed. South Coast appears broker-oriented and prefers buyers to send lists/specifications. Do not spend resources refreshing routinely unless the hosted data demonstrably changes; confirm likely matches directly with Jon Bachmann before quoting.'
where id = 528;

-- 912 T-Y Nursery
update public.suppliers set notes =
'Onboarded from July 2026 availability email.'
where id = 912;

-- ------------------------------------------------------------ deliberately kept
--
-- Notes that name a person but were left alone, because the sentence carries a
-- fact rather than a directory entry:
--   12  Ran-Pro       — what Ken Howard sends, and that the farm has shut down.
--   43  Greenstock    — routing instruction (send to the inbox, copy Clint).
--   59  Green Land    — who distributes the monthly availability.
--   297 Davenport     — who July 2026 availability came from.
--   520 Focal Point   — how to work with John Shearouse (send specs, he searches).
--   914 Hand Tree     — provenance: forwarded by Ken Howard.
-- Generic inboxes were also left on `suppliers.notes` throughout (10 avail@,
-- 27 orders@, 44 previous email on file, 455 previous email on file): they are
-- the company's own contact surface, not a person.
