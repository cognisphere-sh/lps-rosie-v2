---
name: supplier-onboarding
description: Create and enrich a supplier and its people — every database write on the supplier side belongs to this skill. Covers confirming a supplier is genuinely new before inserting (search_suppliers; several rows for one company are its locations, not duplicates), inserting the suppliers row, onboarding a new location of a known company under its head_branch_id, browser enrichment (website, address, coordinates, phone), availability newsletter signup, the availability_source_type / hosted_availability_url / availability_update_days columns, contacts rows for the main line and for each person (never a name in suppliers.notes), supplier_contacts linking across the locations a person actually covers, is_primary per location, retiring versus deleting, and the contact QA and report block. Use when onboarding a supplier, when the availability-ingestion skill reaches a supplier or farm that has no row, when adding or correcting a supplier's contacts, or when Chris asks to add a nursery. (v1.0.0)
metadata:
  author: lps
  version: "1.0.0"
---

# Supplier onboarding

Create a supplier, enrich its row, and get its people on file. This skill owns
**every database write on the supplier side** — `suppliers`, `contacts` and
`supplier_contacts`. It writes no `inventory`, `inventory_sources` or
`plant_aliases` row.

**Where the boundary is.** You are a task thread. You write supplier-side rows
and **never talk to Chris, Telegram or the supplier directly** — anything you
need from a human goes in your report and the main agent relays it. If you find
yourself deciding *whether* to reply to someone, you are in the wrong skill.

**Don't change this skill on your own.** If you find something wrong, missing or
inefficient in it, put the suggested change in the *Learnings* part of your
report — changes here require Chris's or Bhoumik's approval, and then a version
bump per the `create-skill` skill.

## When you are here, and where you go next

Two ways in:

- **From `availability-ingestion` (§0)** — a drop arrived and either the sender
  matched no supplier at all, or the file named a farm that has no row of its
  own. Onboard what is missing, then **return to `availability-ingestion`** with
  the new `supplier_id`(s); the drop still has to be ingested and that is its
  job, not yours.
- **Directly** — Chris asks for a nursery to be added, or a supplier's contacts
  need adding or correcting, with no drop attached.

**If a supplier you onboard came with availability to ingest — an attached
sheet, a price list, a catalog page — that ingest is the
`availability-ingestion` skill's**, and it runs after you. Don't parse a plant
row here.

## Read before you write

- **`knowledge/files/SCHEMA.md`** — before any query, in particular the
  `head_branch_id` and `supplier_contacts` sections.
- **`workspace/suppliers/[<supplierId>]:<Name>/notes.md`** if it exists — known
  quirks for an existing supplier. Apply them.

**If any input is missing or ambiguous** — you can't tell whether a farm is a new
location or an existing one, a credential is needed, the source is unreadable —
**ask** rather than guessing: put your question(s) in the *Follow-up questions*
part of your report and stop at a safe point. If `availability-ingestion` sent
you, the question goes back through it. You will be re-invoked with answers in
the same session. Ask early rather than guessing.

**Two rules that hold for every write below.** Any contact with the supplier
during onboarding gets a timestamped entry in `suppliers.communication_notes` —
follow the `supplier-communications` skill. And **people go in `contacts`, never
on the supplier row and never in prose**: one row per person plus a
`supplier_contacts` link per location they cover (§4), and `contacts.notes`
describes the *person*. Never write a name, email or phone into `suppliers.notes`
— a 2026-08-05 cleanup had to lift 29 of them back out. A **generic inbox**
(`sales@`, `orders@`, `avail@`) is a contact row like any other, but it is the
company's switchboard, not a person: leave its `name` null and mark it
`title_department = 'Main line'`.

## 1. Confirm the supplier is genuinely new

**Don't re-run the whole search — be the second pair of eyes.** Whoever sent you
here already looked: the main agent in `availability-drop-intake` §1, or
`availability-ingestion` §0 resolving a location. One call to `search_suppliers`
with the name and the sender's domain is enough (the `plant-and-supplier-search`
skill covers reading a result set).

A hit means **stop and report it** rather than creating a duplicate — and
remember that **several hits for one company are usually its locations, not
duplicates**. A company that grows or sells at several sites is several
`suppliers` rows, one per location, tied together by `suppliers.head_branch_id`,
which points at the company's head branch; a head branch, and every single-site
supplier, points at **itself**.

**A location that looks absent is usually a spelling, not a new farm.** Before
concluding a site is missing, resolve its name against the company's existing
locations — match on **city and state**, not just the supplier row's name, and
read the company's own locations page if it still resolves to nothing:

```sql
SELECT s.id, s.name, s.city, s.state
FROM suppliers s
WHERE s.head_branch_id = (SELECT head_branch_id FROM suppliers WHERE id = <known_supplier_id>)
  AND s.is_active
ORDER BY s.id;
```

A name reading `Ft Pierce`, `Bunnell Farm`, `Loc 3` or a bare farm code is
routinely a row that already exists. **Onboarding a duplicate location splits
that farm's catalogue across two `supplier_id`s permanently, and no later ingest
can tell the halves apart.** If it could plausibly be either — a near-match on
name, a code you can't tie to a city — it is ambiguous: **ask, don't onboard.**

**Suspect an unrecorded company?** If a supplier's list, signature or website
shows sites the database doesn't have as rows, or shows that two existing rows
are one company, don't tie them together yourself — report it under *Flags
needing Chris* with the evidence. A wrong head branch multiplies wrong data by
the number of locations under it. Deciding which row is the head branch is
Chris's call, not something to settle mid-onboarding.

## 2. Insert the `suppliers` row

INSERT with whatever you have (`name` is required; add address parts when
present) and **capture the returned `id`**.

- `suppliers` has **no `email` or `phone` column** — the company's own
  switchboard is a `contacts` row like any other (§3).
- Set `category` to one of `Wholesaler`/`Grower`/`Nursery` **only if you actually
  know it — otherwise leave it null; never guess.**
- If this is a **new location of a company already in the database**, set
  `head_branch_id` to that company's head branch and name the row for the site
  (`<Company> - <City or farm name>`). Leave `head_branch_id` alone otherwise — a
  new supplier is its own head branch by default. If it is a new company that
  turns out to run several sites, report it (§1).

## 3. Enrich the row

- **Via the browser** (`scripts/agent/agent-browser`): google the supplier; find
  their **website** (store as a bare domain, e.g. `acostafarms.com` — the UI
  prepends `https://`), full **address / city / state / zip**, **phone**, and
  **latitude / longitude** (read coords off their Google Maps listing or geocode
  the address). UPDATE the row with what you confirm — **never invent values you
  couldn't verify.**
- **Subscribe to their availability newsletter.** While on their website, look
  for an availability / price-list newsletter signup (footer form, "join our
  mailing list", Mailchimp/Constant Contact embed). If found, subscribe with
  Daisy's email **`chris.r@localplantsupply.com`** and record in your report that
  you subscribed (the main agent tells Chris). If signup needs approval or human
  steps, note that instead.
- **Record how their availability reaches us.** Three columns on `suppliers`
  capture it, and each is filled only from something you actually saw:
  - `availability_source_type` — `'Email'` when they send the list (a drop
    landing in the inbox is proof), `'Hosted'` when it lives on a page you
    fetched. A supplier can be both; record the one this drop came through.
  - `hosted_availability_url` — the page a hosted list sits on, when there is one.
  - `availability_update_days` — how often it refreshes, in whole days (7 =
    weekly), **only when the supplier states it** ("updated every Monday", "new
    availability weekly", a dated page footer). Never infer it from two drops
    happening to fall a week apart.

  Leave any of them null when you don't know — null means "not established yet",
  and a guess sends someone chasing a list that isn't there. For an existing
  supplier, fill a null column when a drop reveals it; don't overwrite an
  existing value without evidence it changed.

Do the same enrichment and newsletter check for an **existing** supplier whose
row is missing website/address/coords — don't re-subscribe if their notes say
it's already done.

## 4. Contacts

Getting the right sales/contact person on file, on the right locations, matters —
it is how every later availability request reaches a human instead of a
switchboard.

### 4.1 The rows

- **INSERT a `contacts` row for the supplier's main line** — the general
  `info@`/`sales@` address and the switchboard number — with
  `title_department = 'Main line'` and `name` left null. That row is what makes
  the supplier findable by email next time.
- **INSERT a `contacts` row for each person you know**, with `name` / `email` /
  `phone` / `title_department` filled from what the source actually gives — a
  signature block, a "contact us" page, the sender of the availability email.
  **Leave `name` null unless the source actually names them** — never infer a
  name from the address itself. `bobby.green@` is a fair read, but
  `tynursery.orders@` and `treeoflife.gardencenter@` are not people, and
  `dwinningham@` cannot yield a first name without inventing one. A contact with
  only an email or phone is perfectly valid.
- For an **existing** supplier, check its linked contacts before inserting: add
  the person only if they are genuinely new, correct the existing row if they
  moved role, and retire whoever has left. Never delete.

**Then link them (§4.2).** `contacts` has **no `supplier_id`**: the tie to a
supplier is a `supplier_contacts` row, and a contact with no link is invisible to
every reader.

### 4.2 Linking — one person, however many locations

**A contact can be the point of contact for several nurseries.** That is the
normal shape at a multi-location company: one inside-sales rep quotes across
every farm, while a yard manager answers for one site only.

- **Link, don't duplicate.** Before inserting a person, look for them across
  every location of the company — the same email at a sister location is the
  same person:
  ```sql
  SELECT c.id, c.name, c.email, c.phone, sc.supplier_id, sc.is_primary
  FROM contacts c
  JOIN supplier_contacts sc ON sc.contact_id = c.id AND sc.is_active
  WHERE c.is_active
    AND sc.supplier_id IN (<every location of the company>)
    AND (lower(c.email) = lower('<email>') OR c.phone = '<phone>');
  ```
  Found → add a link, don't insert a second contact row. Not found → insert the
  contact, then link it. If you find two *existing* rows that are plainly the
  same route — same email **and** same phone — report them under *Learnings*;
  merging them is migration work (0036 did the first pass), not something to do
  here. **A shared inbox is not a duplicate person:** two rows on `info@…` with
  different phone numbers are two locations or two people, and merging them would
  delete a working number.
- **Work out how many locations they cover, from what the source says.** Their
  signature, title or the sheet header is the evidence: "Inside Sales — all
  farms" or a company-wide availability list is every location of the company;
  "Yard Manager, Bunnell" or a farm-specific sheet is that one. **When the source
  only shows them at one location, link only that one** — coverage is a fact to
  read, not to assume. Note the evidence in `contacts.notes`.
  ```sql
  INSERT INTO contacts (name, email, phone, title_department, notes)
  VALUES (...) RETURNING id;

  INSERT INTO supplier_contacts (supplier_id, contact_id, is_primary)
  SELECT s.id, <contact id>, false
  FROM suppliers s WHERE s.id = ANY(ARRAY[<the locations they cover>]);
  ```
  `(supplier_id, contact_id)` is unique, so re-linking someone is
  `UPDATE supplier_contacts SET is_active = true WHERE …`, never a second row.
- **`is_primary` is per location.** Flag the one who answers about availability
  *at that location*; **at most one active primary per location**, so promote by
  demoting the incumbent first:
  ```sql
  UPDATE supplier_contacts SET is_primary = false
  WHERE supplier_id = <id> AND is_active AND is_primary;
  UPDATE supplier_contacts SET is_primary = true
  WHERE supplier_id = <id> AND contact_id = <new primary> AND is_active;
  ```
- **Retiring is two different acts.** Someone who stopped covering one farm but
  still covers others: `UPDATE supplier_contacts SET is_active = false WHERE
  supplier_id = <id> AND contact_id = <id>`. Someone who left the company: retire
  every link **and** set `contacts.is_active = false`. Never delete.
- **Editing a contact row changes them everywhere.** A new phone number is right
  to write once. Something true only at one site — "handles the Bunnell pickup
  window" — belongs in that supplier's `notes`, not on the shared person.

## 5. QA before you finish

- **Every new contact has at least one active link**, no person was duplicated at
  a sister location that already had them, and every location has at most one
  active primary:
  ```sql
  SELECT supplier_id, count(*) FROM supplier_contacts
  WHERE is_active AND is_primary AND supplier_id = ANY(ARRAY[<locations>])
  GROUP BY supplier_id HAVING count(*) > 1;   -- expect zero rows
  ```
- **No person landed in `suppliers.notes`** — no name, email or phone in prose on
  the supplier row.
- **A new location points at the right head branch**, and the company's location
  set now reads the way you expect: re-run §1's sister-location query and confirm
  the new row appears once, under the head branch you intended.

## Timestamps

ISO 8601, America/Chicago. "Now" is the timestamp the main agent gives you.
`updated_at` is maintained by trigger on UPDATE.

## Report

**When `availability-ingestion` sent you**, return this as its *Onboarding*
block — it folds your output into its own report and the main agent reads one
report, not two.

**When you were dispatched directly**, this is your whole report: a **compact
structured report**, not a transcript, because the main agent cannot read your
transcript.

- **Onboarding**: new `supplier_id`, its `head_branch_id` when the row is a
  location of a known company, and — when you decided a farm was new rather than
  an existing row — the evidence for that call.
- **Enrichment**: fields set via browser research, including which of the
  availability-source columns you set and on what evidence, and which you left
  null. Newsletter subscribed (or why not).
- **Contacts**: `contacts` rows added and the `supplier_contacts` links you made
  — which locations each covers, on what evidence, and which one you made primary
  where.
- **Follow-up questions**: anything you need to finish (an ambiguous location, a
  credential, a decision). If you stopped early because of one, say exactly where
  you stopped and what remains.
- **Flags needing Chris**: a suspected unrecorded company or head-branch problem,
  two existing rows that look like one route, anything that needs a human call.
- **Errors/issues faced** and how you resolved them.
- **Learnings**: supplier quirks not yet in the supplier's `notes.md`; anything
  incorrect or redundant found in SCHEMA.md, this skill, or other docs;
  **suggested skill/script/database changes** (you never change this skill — they
  go to the daily summary for Chris's/Bhoumik's approval).
