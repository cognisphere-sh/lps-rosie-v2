---
name: supplier-onboarding-and-ingestion
description: Onboard a supplier and ingest one availability drop (price list, availability sheet, website catalog, or photo) into Supabase end-to-end — every database write in the ingestion path belongs to this skill. Covers resolving which location each row belongs to when one source carries several locations of a group, onboarding a new suppliers row with browser enrichment and newsletter signup, contacts/supplier_contacts linking and is_primary rules, source conversion (markitdown/pdftoppm), parsing and normalization of name/size/size_std/price/dimensions, notes vs internal_notes, the plant_other_names alias quality bar, provenance in inventory_sources, updating existing inventory rows in place and inserting only genuinely new ones (nothing is retired), post-ingestion QA, and the report contract. Use when ingesting supplier availability, onboarding a new supplier, or fixing/reviewing inventory rows written by an ingest. (v2.0.0)
metadata:
  author: lps
  version: "2.0.0"
---

# Supplier onboarding & availability ingestion

Onboard a supplier and ingest one availability drop (price list, availability
sheet, website catalog, or photo) into Supabase. This procedure is normally run
by a **task thread** dispatched from the `availability-drop-intake` skill, and it
owns **every database write in the ingestion path** — onboarding, contacts,
parsing, and all `inventory` / `inventory_sources` / `plant_other_names` rows.

**Where the boundary is.** The main agent coordinates: it identifies the
supplier, briefs you, digests your report, and labels the email. It never writes
a row. You write every row and never talk to Chris, Telegram or the supplier
directly — anything you need from a human goes in your report and the main agent
relays it. If you find yourself deciding *whether* to reply to someone, you are
in the wrong skill.

**Don't change this skill on your own.** If you find something wrong, missing,
or inefficient in it, put the suggested change in the *Learnings* part of your
report — changes here require Chris's or Bhoumik's approval, and then a version
bump per the `create-skill` skill.

## Your inputs

Your brief follows the **dispatch contract in the `availability-drop-intake`
skill (§2)** — the supplier the main agent resolved, the source material, the
ThreadId, and the current timestamp. Read the brief rather than re-deriving any
of it. Two things to read before you write anything:

- **`knowledge/SCHEMA.md`** — before any query.
- **`workspace/suppliers/[<supplierId>]:<Name>/notes.md`** if it exists — this
  supplier's known quirks and parsing tricks. Apply them.

**If any input is missing or ambiguous** — you can't tell which supplier or
location the drop belongs to, a credential is needed, the source is unreadable —
**ask the main agent**: put your question(s) in the *Follow-up questions* part of
your report and stop at a safe point. You will be re-invoked with answers in the
same session. Ask early rather than guessing.

**Two rules that hold for every write below.** Any contact with the supplier
during onboarding or ingestion gets a timestamped entry in
`suppliers.communication_notes` — follow the `supplier-communication-log` skill.
And **people go in `contacts`, never on the supplier row and never in prose**:
one row per person plus a `supplier_contacts` link per location they cover
(§0.3); `contacts.notes` describes the *person*. Never write a name, email or
phone into `suppliers.notes` — a 2026-08-05 cleanup had to lift 29 of them back
out. A **generic inbox** (`sales@`, `orders@`, `avail@`) is a contact row like
any other, but it is the company's switchboard, not a person: leave its `name`
null and mark it `title_department = 'Main line'`.

## 0. Locations, onboarding and contacts

### 0.1 Which location does each row belong to?

**One source file is not one supplier.** A company that grows or sells at
several sites is several `suppliers` rows — one per location — tied together by
`suppliers.group_id` → `supplier_groups`; a single-site supplier has `group_id`
NULL. Everde, Moon Valley, Newton and thirteen others are stored that way, and
they send **one availability file covering several of their farms**. So the unit
of mapping is the **availability row**, not the file: every parsed offering gets
its own `supplier_id`, and one drop can legitimately write to five suppliers.

Read the `supplier_groups` / `supplier_contacts` sections of SCHEMA.md, then do
this **before parsing** — it decides where every row goes.

1. **Is this supplier part of a group?** One query, from whatever supplier id
   the brief gave you:

   ```sql
   SELECT s.id, s.name, s.city, s.state
   FROM suppliers s
   WHERE s.group_id = (SELECT group_id FROM suppliers WHERE id = <supplier_id>)
     AND s.group_id IS NOT NULL AND s.is_active
   ORDER BY s.id;
   ```

   No rows → single location, every offering maps to that one `supplier_id`.
   Carry on at §0.2.

2. **Where does the file say a location?** Look in the sheet header, a tab or
   page per farm, a "Ship from" / "Grown at" / "Farm" column, a section heading,
   the branch in the sender's signature, or the email body. Take the **most
   specific** statement that covers a given row — a per-row column beats a
   section heading, a section heading beats the file header:

   - **Per-row or per-column location** → map each row to the location named on
     it. Rows in the same file going to different `supplier_id`s is the normal
     shape here, not an error.
   - **Per-section / per-tab / per-page location** → treat each section as its
     own set of rows for its own location.
   - **One location for the whole file** → every offering maps to that location,
     and to no other.
   - **No location named anywhere → every active location in the group gets its
     own copy of every offering.** Everde with five active locations means the
     same 900 offerings written five times, 4,500 rows, each with its own
     `supplier_id`, its own `inventory_sources` row (§3) and its own upsert pass
     (§4). That is what a company-wide availability list means: any of their
     sites can supply it.

   A location named in the file that the group doesn't have is a **new
   location**: onboard it as a new supplier (§0.2) with the same `group_id`, and
   say so in your report.

3. **Never guess a location from the sender's address or the file name.** If the
   mapping is ambiguous — a location name that matches no row, two plausible
   matches, a sheet that looks per-farm but isn't labelled, some rows labelled
   and some not — **ask the main agent** and stop. Don't fall back to "all
   locations" to resolve an ambiguity; that is a different claim from "the file
   named none". A row written to the wrong farm claims stock at a nursery that
   never offered it, and nothing downstream can tell.

4. **Suspect an unrecorded group?** If a supplier's list, signature or website
   shows sites the database doesn't have as rows, don't create a group yourself
   — report it under *Flags needing Chris* with the evidence. A wrong group
   multiplies wrong data by the number of locations in it.

Carry the resulting **row → `supplier_id` mapping** through §2 and §4; §5 checks
it. Report the per-location counts separately — one total hides a location that
silently got nothing.

### 0.2 Onboarding (only when the supplier is new)

- **Confirm before you insert — don't re-run the search.** The main agent already
  looked this supplier up (`availability-drop-intake` §1); your job is the second
  pair of eyes on a brief that says "new". One call to `search_suppliers` with
  the name and the sender's domain is enough. A hit means **stop and report it**
  rather than creating a duplicate — and remember that several hits for one
  company are usually its locations, not duplicates (§0.1). If it is genuinely
  new, carry on.
- INSERT the `suppliers` row with whatever you have (`name` is required; add
  address parts when present). `suppliers` has **no `email` or `phone` column** —
  the company's own switchboard is a `contacts` row like any other. Set
  `category` to one of `Wholesaler`/`Grower`/`Nursery` **only if you actually
  know it — otherwise leave it null; never guess.** Capture the returned `id`.
  If this is a **new location of a company already in the database**, set
  `group_id` to that company's group and name the row for the site
  (`<Company> - <City or farm name>`). If it is a new company that turns out to
  run several sites, report it — creating a `supplier_groups` row is Chris's
  call (§0.1 step 4), not something to do mid-ingest.
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
  `dwinningham@` cannot yield a first name without inventing one. A contact
  with only an email or phone is perfectly valid.
- **Then link them (§0.3).** `contacts` has **no `supplier_id`**: the tie to a
  supplier is a `supplier_contacts` row, and a contact with no link is invisible
  to every reader. Getting the right sales/contact person on file, on the right
  locations, matters — it is how every later availability request reaches a human
  instead of a switchboard.
- For an **existing** supplier, check its linked contacts before inserting: add
  the person only if they are genuinely new, correct the existing row if they
  moved role, and retire whoever has left. Never delete.

- **Enrich via the browser** (`scripts/agent/agent-browser`): google the
  supplier; find their **website** (store as a bare domain, e.g.
  `acostafarms.com` — the UI prepends `https://`), full **address / city /
  state / zip**, **phone**, and **latitude / longitude** (read coords off
  their Google Maps listing or geocode the address). UPDATE the row with what
  you confirm — never invent values you couldn't verify.
- **Subscribe to their availability newsletter.** While on their website,
  look for an availability / price-list newsletter signup (footer form,
  "join our mailing list", Mailchimp/Constant Contact embed). If found,
  subscribe with Daisy's email **`chris.r@localplantsupply.com`** and record
  in your report that you subscribed (the main agent tells Chris). If signup
  needs approval or human steps, note that instead.
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

  Leave any of them null when you don't know — null means "not established
  yet", and a guess sends someone chasing a list that isn't there. For an
  existing supplier, fill a null column when a drop reveals it; don't overwrite
  an existing value without evidence it changed.
- Do the same enrichment/newsletter check for an **existing** supplier whose
  row is missing website/address/coords — don't re-subscribe if their notes
  say it's already done.

### 0.3 Linking contacts — one person, however many locations

**A contact can be the point of contact for several nurseries.** That is the
normal shape at a multi-location company: one inside-sales rep quotes across
every farm, while a yard manager answers for one site only.

- **Link, don't duplicate.** Before inserting a person, look for them across the
  whole group — the same email at a sister location is the same person:
  ```sql
  SELECT c.id, c.name, c.email, c.phone, sc.supplier_id, sc.is_primary
  FROM contacts c
  JOIN supplier_contacts sc ON sc.contact_id = c.id AND sc.is_active
  WHERE c.is_active
    AND sc.supplier_id IN (<every location in the group>)
    AND (lower(c.email) = lower('<email>') OR c.phone = '<phone>');
  ```
  Found → add a link, don't insert a second contact row. Not found → insert the
  contact, then link it. If you find two *existing* rows that are plainly the
  same route — same email **and** same phone — report them under *Learnings*;
  merging them is migration work (0036 did the first pass), not something to do
  mid-ingest. **A shared inbox is not a duplicate person:** two rows on
  `info@…` with different phone numbers are two locations or two people, and
  merging them would delete a working number.
- **Work out how many locations they cover, from what the source says.** Their
  signature, title or the sheet header is the evidence: "Inside Sales — all
  farms" or a company-wide availability list is every location in the group;
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
  supplier_id = <id> AND contact_id = <id>`. Someone who left the company:
  retire every link **and** set `contacts.is_active = false`. Never delete.
- **Editing a contact row changes them everywhere.** A new phone number is right
  to write once. Something true only at one site — "handles the Bunnell pickup
  window" — belongs in that supplier's `notes`, not on the shared person.

## 1. Acquire and convert the source

- **Text-based PDFs:** use `scripts/agent/markitdown <file>` as the primary extractor and inspect its Markdown tables/continuation lines before parsing. Do not default to `pdftotext` or write an ad hoc custom PDF parser merely because fixed-width text looks usable. If MarkItDown leaves wrapped/ambiguous rows, preserve the extracted evidence and resolve it with visual row-level review rather than a heuristic that can silently cross or drop cells.
- **Scanned/image-only PDFs:** `pdftotext` cannot OCR pixels unless the file already contains a hidden text layer. Render with `pdftoppm -png`, then use image reading/OCR/vision with page- and row-level visual checks. `pdftotext -layout` may be used only as a diagnostic/fallback when an actual text layer exists, not as the primary parser for scans.
- **Other attachments:** use `scripts/agent/markitdown <file>` for xlsx/docx and supported office formats. Avoid one-off custom parsers when the standard converter preserves the source structure; if conversion remains ambiguous, retain raw evidence and flag the affected rows instead of guessing.
- If the email **body** contains a URL that may hold the availability (link to a price list / catalog / sheet), open it with `markitdown` or `scripts/agent/agent-browser` — don't treat a bare link as unparseable. If the URL is a downloadable file, download it and check its contents before deciding it's irrelevant.
- Intermediate files (converted markdown, page images, parse chunks) go to `/tmp` — they are not records.

## 2. Parse and normalize

One logical row per **plant × size offering**. Normalize every line:

- **Size** (`inventory.size` **and** `inventory.size_std`) — see **Size
  standard** below. Write both, always, in the same INSERT: `size` is the
  container as the supplier printed it, `size_std` is the one standardized
  bucket it belongs to. The app's size filter is built from `size_std`, so a row
  you leave unmapped is invisible to every size checkbox — and `size` still has
  to be clean, because it is what the table cell shows and what search reads.
- **Name** (`inventory.name`): one column carries the whole identity, written as
  **`Name [scientific name, variant, cultivar]`**.
  - `Name` is the plant name **as the source prints it**, in full — including any
    cultivar, selection, form, or trade name that is part of that printed name.
    Don't invent a name the source doesn't give, and don't strip anything it does.
  - Append the bracket when the source also gives a **scientific/botanical name**
    and/or a **variant / cultivar / trade name**, in that order: both →
    `Forest Pansy Redbud [Cercis canadensis, Forest Pansy]`; scientific name only →
    `Eastern Redbud [Cercis canadensis]`; variant only →
    `Forest Pansy Redbud [Forest Pansy]`. Neither → no bracket at all.
  - There is **no `variety` column** — the variant lives in the bracket. Size is
    still its own column and never goes in the name.
  - Put the **common name first** whenever the source prints one, even if it also
    prints the botanical name: `Redbud, Forest Pansy [Cercis canadensis, Forest
    Pansy]`, not `Cercis canadensis [Forest Pansy]`. The name is the only place a
    printed common name is kept, so dropping it loses it permanently — it cannot
    be recovered later without reparsing the source.
- **Aliases** (`plant_other_names`): an alias exists for exactly one reason — so a
  search finds the row when the user types **another name the same plant is known
  by**. Insert `(inventory.name, other_name)` pairs, where `other_name` is a
  genuine common name, the botanical/scientific name, an accepted synonym, an
  abbreviation, or a spelling variant.
  **Both sides must be printed in the source you are ingesting, for the same
  offering** — the botanical name beside the common name, a synonym in the same
  cell, a spelling variant of that line. **Never supply the other side from your
  own knowledge, from the web, or from another supplier's list.** If the source
  prints one name, insert nothing; the identity is already searchable through
  `inventory.name`. This is not a style preference: alias 44255
  (`Yucca gloriosa` ↔ `Yucca, Soft Leaf`, retired by migration 0028) was created
  exactly that way and put nine wrong rows across four suppliers into Chris's
  "soft leaf yucca" search. Soft-leaf yucca is *Yucca recurvifolia*; the source
  that printed the label printed that botanical name too, right there on the row.
  **Quality bar — an alias is a liability, not a freebie.** Since migration
  0026 (2026-08-12), search and the displayed *Also known as* use only pairs
  **directly incident** to a row's own identity — search no longer hops through
  a shared hub to sibling names. A bad pair still wrongly equates two plants in
  both directions, and cleanups keep having to retire them: a 2026-07-31 audit
  retired most of the directory, and the focal audits behind migrations 0021
  (Abelia, 15 edges) and 0025 (Crape Myrtle, 66 edges) retired hub/cultivar
  pairs that were causing false positives in cultivar searches. **When in
  doubt, insert nothing** — a missing alias costs one search; a wrong one
  corrupts many. Before inserting, every pair must pass all of these:

  - **Attested by this source, on this line.** You can quote the line that
    prints both names. A botanical name you know but the source doesn't print
    belongs in `inventory.name`'s bracket (see *Name* above), where it is
    already searchable — not in a pair. **A pair you cannot quote a line for
    does not ship.**
  - **Never two line items from the same list.** If both names appear as
    separate offerings in this drop — or in any drop from this supplier — they
    are two products, not two names for one. A supplier does not price the same
    plant twice under different names in one availability sheet. Check before
    inserting; this is what 44255 got wrong.
  - **Same plant, not a relative.** Both sides must name the *same* plant. Never
    a species ↔ one of its cultivars, never sibling cultivars, and never two
    different species — `Cercis canadensis` ↔ `Cercis mexicana` is wrong, they
    are different plants. Genuine renames are fine (`Sedum spectabile` ↔
    `Hylotelephium spectabile`). Where taxonomies disagree, **the trade wins**:
    if the two names are sold as different products they are different plants,
    however a botanist would classify them.
  - **No cultivar, selection, variant, trade name or patent code in
    `other_name`** — not `'Forest Pansy'`, `Merlot Redbud`, `PP21929`,
    `Kaleidoscope™`. Those identify one selection. They are already searchable
    inside `inventory.name`, so the alias adds nothing and costs cross-matches.
  - **Nothing generic.** A label that fits many plants — `Oak`, `Grass`, `Maple`,
    `Redbud`, `Perennial`, `Native`, `Shade Tree` — is a category, not a name.
    Text search already finds a name containing "Maple"; an alias only wires
    unrelated plants together. Rule of thumb: if it would fit more than a couple
    of distinct plants in the catalogue, don't insert it.
  - **A name, not data.** Never a size, grade, container or form code (`15 G`,
    `B&B`, `M/S`, `STD`, `Clump`), a price, a quantity, a SKU, a zone or shipping
    note, or a truncated fragment of a longer name.
  - **Not redundant.** Skip it if it differs from `inventory.name` only by
    punctuation, casing, spacing, or a size/form suffix — those already match.

  New pairs are `is_active = true` (the default). Inactive pairs are historical
  and power neither search nor display; **never reactivate one** to "restore" a
  name, and never re-add a pair a cleanup retired.
- **Price**: `unit_price` is nullable; use the lower bound if the source gives a range. Store `NULL` when the supplier provides no price, and preserve a numeric zero only when the source explicitly prints zero. Never coerce a missing/blank price to `0`, and never silently reinterpret legacy zero rows without source-level review. Missing price does not make an inventory row invalid or free. Record "price on request / not printed" in `internal_notes` (it is your reading of the source, not something the supplier wrote). Stock counts go in `quantity`.
- **Combined sizes with one shared quantity**: create one inventory row for each printed size (for example, a `3 G/5 G` offer becomes separate `3 G` and `5 G` rows). Copy the source's shared quantity to both rows; quantities are tentative sourcing signals. State in each row's dated `internal_notes` that the quantity is the supplier's shared/tentative count across the combined sizes and that you split the offering, so reviewers do not add the copied values together as guaranteed stock. (Approved by Bhoumik, 2026-07-31.)
- **Two note columns, and they are not interchangeable.** Every row can carry
  both; keep each one's content in its own column.
  - **`notes` — what the supplier said.** Their verbatim row description,
    availability status, lead time, per-row qualifier ("limited", "coming soon",
    "B&B only"). Date it: `Available as of 2026-07-01. Lead time 2 wks.` This is
    evidence, so it is written from the source and nothing else.
  - **`internal_notes` — what you concluded.** Why you split a combined size,
    that a quantity is the supplier's shared/tentative count, that no price was
    printed, a parse caveat, a QA exception, anything a later reader would
    otherwise have to re-derive from the file. Date these too, and **append**
    rather than clobber on a later drop.

  A reviewer must be able to tell "the supplier says two weeks" from "we guessed
  two weeks". Putting your reasoning in `notes` destroys that, and putting the
  supplier's words in `internal_notes` hides the evidence. Rows written before
  2026-08-14 have a mix of both in `notes` — leave them; the split applies to
  what you write from now on.
- **Dimensions — write the source string and numeric standard together.** Preserve `height` / `width` / `caliper` as printed. Also write `height_std` in feet and `width_std` / `caliper_std` in inches when the measurement is unambiguous. For a range, use its **lower number** (`10-12 ft` → `height_std = 10`; `2.5-2.75 in` → `caliper_std = 2.5`) while preserving the full range string. Convert explicit inches in height ÷ 12, explicit feet in width/caliper × 12, and exact mixed feet+inches by addition. Fractions/decimals are allowed. Leave the standard value `NULL` for inequalities, conflicting units, combined/multiple dimensions, malformed/nonpositive/descending values or anything requiring a guess. A manual source-string edit clears the companion standard value until reviewed; never leave a stale numeric value. The source's own grouping (e.g. `Shade Trees`) is **not** stored — there is no `category` column on `inventory`.
- To check "does the system already know this plant?", call the `search_inventory` RPC — typo-tolerant, follows the alias graph.

### Size standard

(Expanded 2026-08-05, **approved by Bhoumik** — the previous one-line rule
covered unit spelling only, and the column had drifted to 2,769 distinct values
across 69k active rows. Migration 0019 applied the spelling half retroactively.)

**`size` is the container or grade the plant is sold in — nothing else.**

**1. Canonical units.** Write these forms and only these:

| Unit | Canonical | Accepts |
| --- | --- | --- |
| Gallons | `15 G` (space before `G`) | `#15`, `15gal`, `15 GAL`, `15G`, `15 Gallon` |
| Inches | `24"` | `24 inch`, `24 in`, `24 IN.` |
| Feet | `6'` | `6ft`, `6 feet`, `6 foot` |

Drop leading zeros (`024 Inch Box` → `24" Box`). Compounds keep both units and
take no spaces around the slash: `15 G/17"`, `24" box`, `3' cal`. `45 G / 28"`
is `45 G/28"`.

**The database has the reference implementation: `normalize_size(text)`.** Run
your parsed value through it and store what it returns, rather than hand-applying
the table above — it is the same function migration 0019 used, so old and new
rows agree. Read its output before storing: it is a regex, not a judge.

**One exception it gets wrong:** `#` means gallons *except* on a box, which the
trade sizes in inches. `#24 Box` is a 24-inch box, not 24 gallons. Write `24"
box` and leave `#` off. Twelve legacy rows with this shape were deliberately
left unconverted for source review.

**2. Words are valid sizes** when that is genuinely how the supplier sells the
plant — `B&B`, `Field Grown`, `Bare Root`, `Quart`, `Plug`, `Six Pack`,
`Boxed`. Use Title Case and the singular (`Quart`, not `QUARTS`/`QT`/`quart`);
`B&B` and other established trade abbreviations stay upper case. A bare
`Gallon` with no number is **not** a size — find the number or leave `size`
null.

**3. What does NOT go in `size`:**

- **Height, width and caliper.** They have their own columns. A `size` of
  `5-6'`, `2-2.5"` or `B&B 4-5'` is a parsing miss — the container belongs in
  `size`, `5-6'` in `height`, `2-2.5"` in `caliper`. If the source gives only a
  height grade and no container, `size` is null and `height` carries it.
- **Form, grade and condition codes** — `STD`, `TRUE`, `NS`, `CG`, `Bush`,
  `Multi-Trunk`, `Specimen`, `Clump`. These describe the plant, not its
  container. They are the supplier's own words about the plant, so they go in
  the row's dated `notes`.
- **Counts and pack quantities** — `(6ct)`, `18 Plants`, `12ct`. The count goes
  in `quantity`; the tray/flat itself is the size (`1801`, `128`, `10" Pot`).
- **Anything you had to guess.** Leave `size` null rather than invent a
  container. Null means "the source didn't say", which is a fact; a wrong size
  is a wrong offering.

**4. Legacy rows still violate 3.** Qualifier-carrying values (`6 G; Bush`,
`3 G TRUE`, `1 G <24"`) remain. Do **not** bulk-fix them as a side effect of an
ingest — that is a separate job against the original sources. Follow this
standard for the rows you write, and report anything egregious you notice under
*Learnings*. The 2026-08-13 `size_std` backfill (migration 0030) moved the
whole-value height/width/caliper misfits out of `size` into their own columns;
what is left is mostly container-plus-qualifier compounds.

### The standard bucket — `size_std`

`size` keeps the supplier's own spelling. `size_std` says which **one**
container that is, so the app can offer a single checkbox per real size instead
of one per spelling. Write it for every row that has a `size`.

**The vocabulary.** The database enforces the shape, not a fixed list:

| Bucket | Shape | Notes |
| --- | --- | --- |
| Pots | `<N>" Pot` | `4" Pot`, `8" Pot`, `3.5" Pot`. **Open set.** Only for diameters with no gallon equivalent — see rule 3 |
| Gallons | `<N>G` | `1G`, `15G`, `2G`, `35G`, `2.5G`. **Open set** — write the number the source printed. Never round to a "nicer" size |
| Boxes | `<N>" Box` | `24" Box`, `108" Box`. **Open set.** Always inches; `9' box` → `108" Box` |
| Word grades | `Bare Root`, `Liners`, `Plug`, `Trays`, `B&B`, `Field Grown`, `Grow Bags`, `Root Pruned` | exactly these strings |
| Catch-all | `other` | a real container the standard has no bucket for |

Anything else is rejected by `inventory_size_std_check`.

**Mapping, first rule that matches wins:**

1. **Says "box"** → `<N>" Box` from the box's inch number. `45 G/24" BOX` →
   `24" Box`: the box is the trade unit, the gallon figure is its volume.
   `Boxed` with no number is not a box → `other`.
2. **Has a gallon quantity** → `<N>G`. The pot-diameter half of a compound is
   dropped (`15 G/17"` → `15G`, `45 G/28"` → `45G`) and qualifiers are ignored
   (`6 G; Bush` → `6G`). Two different gallon sizes in one value (`3 G/5 G`) is
   a parse miss — split it into two rows per the *combined sizes* rule above,
   each with its own bucket.
3. **Names a burlapped root ball** — `B&B`, `BB`, `balled and burlapped` →
   `B&B`. The burlap *is* the container, so a height or caliper printed with it
   (`B&B; 3-4' HT`, `4 - 5'; B&B`) is the plant's size: bucket `B&B` and put the
   measurement in `height`/`caliper` with its `*_std`. A genuinely different
   container named alongside still wins by its own priority (`15 G B&B` → `15G`,
   `24" Box B&B` → `24" Box`).
4. **A bare diameter in inches** is one of three things, and the plant names
   decide which:
   - it **has a gallon equivalent** → that gallon, which is the pairing the
     trade prints: 6"→`1G`, 10"→`3G`, 12"→`5G`, 14"→`7G`, 17"→`15G`, 20"→`20G`,
     21"→`25G`, 28"→`45G`, 30"→`60G`, 32"→`65G`, 36"→`100G`, 42"→`150G`,
     48"→`200G`, 60"→`300G`;
   - it is an **unlabelled box** → `<N>" Box`. Desert and palm growers print a
     bare `24"`/`36"`/`48"` meaning a box; the supplier's other boxed rows and
     large specimen plant names give it away. Never write `36" Pot` for a boxed
     tree;
   - otherwise it is a **pot** → `<N>" Pot` (`4" Pot`, `8" Pot`, `3.5" Pot`).
     This is the annual / perennial / tropical end of the catalogue.

   A diameter attached to **merchandise** rather than a plant — the row names a
   planter, bowl, basket or tool — is `other`, never a pot.
5. **Word grades** map case- and plural-insensitively: `BR`/`bareroot` →
   `Bare Root`; `LNR`/`Rooted Liner` → `Liners`; anything naming a plug →
   `Plug`; cell trays and flats identified by a cell count or tray code
   (`128`, `1801`, `40 CEL`, `Flat`) → `Trays`; `FG`/`In Ground` →
   `Field Grown`; `Fabric Bag` → `Grow Bags`; `RP` → `Root Pruned`.
6. **Everything else that is still a container** → `other`. `Quart`,
   `Six Pack`, `10" Hanging Basket`, `Specimen` all land here. **`other` is a
   correct answer, not a failure** — it means "a real container the standard has
   no bucket for". Never invent a nearby bucket to avoid it.

`size_std` is `NULL` only when `size` is `NULL`. If the source printed no
container, both stay `NULL` — that is a fact, and §3's *anything you had to
guess* rule still holds.

## 3. Stash the source and create provenance

- File drop → upload: `scripts/agent/supabase/upload --bucket lps --path suppliers/<slug>/rate-cards/<file> --file <local>` (`<slug>` = kebab-cased supplier name, e.g. `austin-plant-supply`). Website → use the page URL.
- One `inventory_sources` row per file/URL in the drop; capture each `id`:
  ```sql
  INSERT INTO inventory_sources (supplier_id, file_path, notes)
  VALUES (<supplier_id>, '<object key or URL>', '<where/how sourced>') RETURNING id;
  ```
- **One per file × location.** `inventory_sources.supplier_id` is a single
  location, so a drop that §0.1 mapped to several gets a row per location
  pointing at the **same** `file_path` — upload the file once. Keep the ids per
  location; §4 stamps each row with its own location's source id, and mixing
  them up attributes one farm's stock to another. Say in `notes` that the file is
  the group's shared list.
- **Never retire a supplier's previous sources.** Live `inventory` rows still
  point at them, and an inactive source blanks the app's derived
  `ingestion_date` for every row that references it.
- `file_path` is the bucket **object key** (e.g. `suppliers/<slug>/rate-cards/<file>`, no scheme — the app signs it on demand) or a full `http(s)://` URL. Never store a signed URL.

## 4. Write to `inventory` — update what exists, insert what doesn't

An ingest **refreshes** a supplier's availability; it does not replace it.
**Nothing is retired.** For each parsed offering, find the row it already has and
update it; insert only when there is no such row. An offering the supplier has
stopped listing simply isn't touched — it keeps `is_active = true` and its older
`source_id`. That is the staleness signal: "when did we last see this row" is
answered by its `source_id`, not by a flag.

**1. Pull the nearest existing rows, then decide — never match on a key.**

An exact key (`name_key` + `size`) looks decisive and isn't. Suppliers respell,
re-punctuate, add a cultivar, move a plant between containers, and switch between
the botanical and common name between drops. Every one of those makes an existing
offering look brand new to a key, and the ingest silently duplicates it. So the
procedure is: **retrieve the closest candidates, look at them, and decide.**

```bash
skills/agent/supplier-onboarding-and-ingestion/scripts/match-candidates \
  --supplier <supplier_id> --entries /tmp/<thread>-parsed.json
```

Feed it your parsed offerings as a JSON array — `name` required, plus `size`,
`unit_price`, `quantity`, `height`, `width`, `caliper` when you have them, so the
output puts your entry and its candidates side by side. For a multi-location drop
run it **once per `supplier_id`** in the §0.1 mapping, with only that location's
entries. `--help` documents the rest; the defaults are the ones to use.

For each entry it returns up to five of that supplier's **active** rows plus the
single best **retired** one, ranked by trigram similarity on the plant identity
with a size-agreement bonus, showing only the columns that distinguish one
offering from another — `id`, `name`, `size`/`size_std`, `unit_price`,
`quantity`, `height`/`width`/`caliper`, `is_active`, and `dupes` (how many
identical rows collapsed into that line). Notes are deliberately not fetched:
they are long and they never tell two offerings apart.

**The `SUGGEST` line is a sort aid, not a decision.** It buckets by score alone
and knows nothing about the plant. You decide, per entry:

| What you see | Do |
|---|---|
| One clear match — same plant, same container, price/quantity moved as a new drop would | **Update it** (step 2) |
| Best candidates are all a *different* plant, a different container, or nothing came back | **Insert** (step 3) |
| The only good match is `INACTIVE` | **Reactivate and update it** — the supplier dropped this plant and brought it back; never insert a second copy |
| Two or more candidates are equally plausible **and materially different** (different price or printed name) | **Touch none of them.** Report the plant, size and candidate ids under *Flags needing Chris* |
| Several candidates are the *same* offering — same printed name and price, differing only by `dupes` or a stale quantity | **Update the top one, leave the rest**, and list them under *Duplicates found* |

Two things that decide most of the judgement calls:

- **A high score is not identity.** `Abies concolor [Blue Select]` and
  `Abies concolor [Candicans]` are different plants that score close together;
  sibling cultivars are the classic trap. Read the name, don't read the number.
- **No candidates does not mean new.** If the supplier prints the botanical name
  where they used to print the common one (or the reverse), similarity on the
  identity key finds nothing. Before inserting, check with
  `search_inventory('<the other name>')` filtered to this supplier — the
  `plant-and-supplier-search` skill covers it.

**Expect the duplicate row of that table on established suppliers.** As of
2026-08-14, 5,714 `(supplier_id, name_key, size, height, width, caliper)` groups
across 77 suppliers cover more than one active row — about 13,500 rows, roughly
two-thirds of them same-price duplicates left behind by the old
replace-and-retire model. That is a cleanup backlog, not a parse failure, and no
ingest resolves it: update one, report the rest.

**2. Update the matched row** with this drop's values: `source_id` = the new
source id **for that row's location**, `unit_price`, `quantity`, `size`,
`size_std`, `height`/`width`/`caliper` and their `*_std`, `image_url` if the
drop has one, and `is_active = true`. Notes follow §2's split:

- **`notes` is replaced** with this drop's supplier text, dated. The row now
  describes the current offering, and the previous drop's file is still in
  storage as evidence. If this drop says nothing about the row, leave `notes` as
  it is rather than blanking it.
- **`internal_notes` is appended to**, never clobbered — your earlier caveats
  about this row are still true.

`updated_at` is maintained by trigger; don't write it.

**3. Insert a genuinely new offering** with the normalized fields from §2,
stamping `supplier_id` and `source_id`. `id` defaults to `gen_random_uuid()`;
**never write `name_key`** — it's a generated column, and never match plant names
with `=` on raw text (join on `name_key` / `normalize_plant_key()`).

**4. Insert only approved active alias pairs into `plant_other_names`** as
defined in §2: scientific names and true synonyms/spelling variants, never
cultivar/selection/trade-name aliases. A BEFORE INSERT trigger silently drops
duplicates and self-pairs, so blind-insert without conflict handling; new valid
pairs use `is_active = true` (default).

**Do not run a retirement pass.** No `UPDATE inventory SET is_active = false` and
no `UPDATE inventory_sources SET is_active = false` as part of an ingest.
Retiring an offering is a deliberate, separately approved act — if a supplier
tells you an item is discontinued, record that in `notes` and raise it under
*Flags needing Chris* rather than flipping the flag mid-ingest.

**A brand-new supplier's first ingest** finds nothing to match, so it is all
inserts.

**Multi-location: run steps 1–4 once per `supplier_id`** in the §0.1 mapping,
each with its own source id. The parsed values are the same; the `supplier_id`,
the `source_id` and the row each one matches are not — a location is refreshed
only by its own rows, and a location this drop didn't cover keeps everything it
had. Record the per-location counts separately in your report; one total hides a
location that silently got nothing.

## 5. Post-ingestion QA — required before commit

Treat extraction and writing as untrusted until the drop passes source-to-database QA. Run these checks **before committing the transaction whenever possible**; if a material check fails, roll back and report the exception instead of publishing partially verified data. Because §4 updates rows in place, a bad parse now overwrites good data rather than sitting alongside it — QA matters more under this model, not less.

- **Re-open the original source with the approved primary converter** and compare it to the staged/database output — not only to an intermediate CSV made by the same extraction logic.
- **Reconcile counts:** source offering count versus rows **updated + inserted**, totals by page/section, priced/unpriced rows, quantities, photos, and distinct source ids. The two numbers should account for every source offering between them. Explain every exclusion, deduplication, split combined size, and ambiguous multi-match you skipped; a matching grand total alone is insufficient.
- **Sanity-check the update/insert split.** A repeat drop from an established supplier should be mostly updates with a few inserts. **Mostly inserts means you took `match-candidates` at face value on entries you should have looked at** — a supplier who respelled or re-sized their list produces exactly that shape — and you have just duplicated the catalogue. Stop and investigate before committing: re-run `match-candidates` on a handful of the inserted entries and read the candidates you passed over.
- **Check source coverage:** review representative rows from every page/section and **100% of risky rows** — wrapped/multi-line names or descriptions, blank prices, continuation lines, repeated names/sizes, SALE/COMING SOON/LIMITED/READY statuses, dimensions, calipers, quantities, footnotes, and page breaks.
- **Verify row boundaries:** each raw description/status/spec belongs to the correct plant row and no neighboring cell was crossed, truncated, or silently dropped. Until a dedicated raw-description column exists, preserve the supplier's full verbatim row description in dated `inventory.notes`, then derive `height`, `width`, `caliper`, `quantity`, and availability status separately without replacing the raw evidence.
- **Check the note split:** nothing you concluded ended up in `notes`, no supplier text ended up in `internal_notes`, and no row's `internal_notes` was clobbered by this drop.
- **Validate normalization:** no malformed names/sizes, no zero price presented as free, no guessed missing values, no unsafe cultivar/species alias edges, and no source dimensions left only in notes when they can be mapped unambiguously to structured fields. For every populated human-readable dimension, verify its `*_std` companion uses the approved unit/lower-bound rule or is deliberately `NULL` with an ambiguity reason; never publish a stale standard value after changing its source string.
- **Every row with a `size` has a `size_std`**, and it is one the standard
  allows. Run it and expect zero rows:
  ```sql
  SELECT size, count(*) FROM inventory
  WHERE source_id = ANY(ARRAY[<new source ids>]::uuid[])
    AND size IS NOT NULL AND size_std IS NULL
  GROUP BY size;
  ```
  Then list `SELECT size_std, count(*) … GROUP BY size_std` for the drop and read
  it: a bucket you did not expect from this supplier's sheet (a stray `100G` in a
  perennial list, everything collapsing to `other`) is a parse miss, not a
  quirk. A `size` that turned out to be a height/width/caliper belongs in that
  column with its `*_std`, leaving both `size` and `size_std` `NULL`.
- **Verify every alias pair you wrote — mechanically, not by eye.** For each new
  pair run `search_inventory('<other_name>')` and `search_inventory('<the row's
  name>')` and list the identities each returns. If either returns an identity
  that is not the plant you just ingested, the pair is wrong: retire it before
  committing. Report every pair with the verbatim source line that attests both
  sides. "It looked like a synonym" is not evidence and does not pass.
- **Check the row → location mapping from §0.1.** Every row this drop touched now
  carries one of the new source ids, so group by supplier and compare against
  what §0.1 said should happen:
  ```sql
  SELECT supplier_id, count(*) FROM inventory
  WHERE source_id = ANY(ARRAY[<all new source ids>]::uuid[])
  GROUP BY supplier_id ORDER BY supplier_id;
  ```
  - **No location named in the file** → one group per active location, all with
    **equal counts**, none skipped, none outside the group.
  - **The file named locations per row/section** → the per-supplier counts match
    the counts you parsed for each of those locations, and no location the file
    never mentioned appears at all.
  - **One location named for the whole file** → exactly one `supplier_id`, and it
    is the one named.
- **Check the contact links you wrote.** Each new contact has at least one
  active link, no person was duplicated at a sister location that already had
  them, and every location has at most one active primary:
  ```sql
  SELECT supplier_id, count(*) FROM supplier_contacts
  WHERE is_active AND is_primary AND supplier_id = ANY(ARRAY[<locations>])
  GROUP BY supplier_id HAVING count(*) > 1;   -- expect zero rows
  ```
- **Compare against what was there before:** inspect price/quantity/spec changes on the rows you updated, plants that are new to this supplier, and duplicate inflation. Spot-check several important searches afterwards to confirm exact identities rank correctly without sibling-cultivar leakage.
- **Record QA evidence in the report contract:** converter used, source counts versus updated/inserted counts, pages/sections checked, risky-row count and result, ambiguous multi-matches skipped, search spot-checks, and whether the transaction committed or rolled back. Do not report an ingest as Catalogued without this QA summary.

## Recording availability status

`inventory.notes` carries the supplier's per-row qualifiers and their
**last-known availability** — always with a date, e.g. `Available as of
2026-07-01. Lead time 2 wks.` §4 replaces it with the current drop's text, so
the date on it is the date of the drop it came from; a row nobody refreshed keeps
its older dated status, which is the point. Stock counts go in `quantity`, and
your own reading of the row goes in `internal_notes`.

If the supplier says an item is **out or discontinued**, record that in `notes`
and raise it under *Flags needing Chris*. **Don't flip `is_active = false`
yourself** — retiring an offering is a deliberate act outside an ingest (§4).

## Timestamps

ISO 8601, America/Chicago. "Now" is the timestamp the main agent gives you.
`updated_at` is maintained by trigger on UPDATE.

## Report contract — what you return to the main agent

This is the **canonical definition** of the report; the
`availability-drop-intake` skill (§4) says what the main agent does with each
part. Return a **compact structured report**, not a transcript — the main agent
uses it for the thread summary, the daily note, and anything Chris needs to see,
and it cannot read your transcript. Include:

- **Onboarding** (when performed): new `supplier_id`, its `group_id` when the
  row is a location of a known company, fields set via browser research —
  including which of the availability-source columns you set and on what
  evidence, and which you left null — `contacts` rows added and the
  `supplier_contacts` links you made (which locations each covers, on what
  evidence, and which one you made primary where), newsletter subscribed (or why
  not).
- **Locations**: which location(s) this drop was written to and how the mapping
  was decided — the name the source gave per row/section, the one name it gave
  for the whole file, or "no location named → all N in the group". Say which
  locations in the group you did **not** write to.
- **Result**, **per location** when the drop covered several, never as one total:
  supplier_id, source ids + `file_path`s created, **rows updated**, **rows
  inserted**, rows reactivated, ambiguous multi-matches skipped, alias pairs
  added. Nothing was retired — if you believe something should be, it goes under
  *Flags needing Chris* instead.
- **Duplicates found**: keys where several active rows carried the same price and
  printed name (§4 step 1). Give the plant, size and row ids, and say which one
  you updated. These are a cleanup backlog, not something to fix mid-ingest.
- **Follow-up questions**: anything you need from the main agent to finish
  (missing/ambiguous inputs, credentials, a decision). If you stopped early
  because of one, say exactly where you stopped and what remains.
- **Flags needing Chris**: missing prices, unclear sizes/specs, plants that
  didn't map, suspected duplicates/typos in the source.
- **Errors/issues faced** and how you resolved them.
- **Learnings**: supplier quirks or parsing tricks not yet in the supplier's
  `notes.md`; anything incorrect/redundant found in SCHEMA.md, this skill, or
  other docs; **suggested skill/script/database changes** (you never change this
  skill — they go to the daily summary for Chris's/Bhoumik's approval).
- **Suggested status label**: `Catalogued` / `Failed` / `Not Availability` / `Escalated`.
