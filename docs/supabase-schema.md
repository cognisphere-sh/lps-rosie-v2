# Supabase schema — single source of truth

**This file is the one authoritative description of the database.** The web app
(`app/`) and every harness agent read it; nothing else in this repo should
restate table or column definitions.

- Project: `xyeyiqchadfszewztnrf` (`lps-rosie`), Postgres via Supabase.
- Agents reach it through `harness/agents/<agent>/knowledge/SCHEMA.md`, which is
  a **symlink to this file**. Add the same symlink for any new agent that needs
  database access — do not copy the content.
- The app reads it through `app/lib/queries.ts` with the project's secret key,
  server-side only.

Last verified against the live database on 2026-08-12 by direct catalog
introspection; the contact/location tables were re-verified on 2026-08-14 after
migrations 0033–0034, the plant identity / alias half on 2026-08-14 after
migration 0040, the source-deactivation invariant on 2026-08-14 after
migration 0048, the supplier head-branch column on 2026-08-15 after
migration 0049, the photo catalogue on 2026-08-16 after migration 0051, and
the customer/job-request tables on 2026-08-17 when migrations 0055 and 0056
created them, and the web-chat tables (`threads`, `thread_messages`) on
2026-08-26 when migrations 0078–0080 created them.
**If you find a discrepancy, fix this file in the same change.**

Applied migrations live in `harness/agents/daisy/migrations/`.

---

## Shape

```
suppliers 1 ──< suppliers                  (a company's locations; head_branch_id, self-referencing)

suppliers 1 ──< inventory_sources 1 ──< inventory >── plant_aliases (by identity key, no FK)
          1 ─────────────────────────< inventory
          1 ─────────────────────────< supplier_contacts >───────────── 1 contacts
          1 ─────────────────────────< availability_queries
          1 ─────────────────────────< plant_photos   (optional; SET NULL, never cascade)
                                       plant_photos >── plant_aliases (by identity key, no FK)

users 1 ──< chat_sessions 1 ──< availability_queries
      1 ──< user_memories (1:1)
      1 ──< custom_commands

customers 1 ──< job_requests 1 ──< job_request_items      (customer_id nullable; SET NULL)
                job_requests 1 ──< job_request_changelog >── 1 job_request_items (item_id nullable)

threads 1 ──< thread_messages                              (web-chat transcripts, one thread per (agent, thread id))
threads 1 ──  suppliers.rosie_thread_ref / daisy_thread_ref, customers.rosie_thread_ref,
              job_requests.rosie_thread_ref                (derived FKs, trigger-maintained; SET NULL)
```

> **The catalogue has since been rebuilt.** Verified 2026-08-18: `inventory`
> holds **37,988 active rows**, `inventory_sources` **432 active**, and
> `plant_aliases` has grown to **898**. The two wipes below are history, not the
> current state — read them for what they say about cascades and backups, not
> for row counts.
>
> **The catalogue was emptied again on 2026-08-16**, at Bhoumik's request and
> by the same hard delete: `inventory` (26,340 rows) and `inventory_sources`
> (173) are **empty**. `plant_aliases` was kept — all 432 rows survive — but
> every one of the 431 that carried a `source_id` had it nulled, because the
> foreign key has no cascade and a retired alias is a deliberate blocklist that
> deleting would re-open. **The alias table therefore has no provenance left**;
> `source_line` still holds each pair's verbatim evidence. `suppliers` (1,383)
> and `contacts` (1,854) were untouched. **No backup schema was taken**, so the
> 2026-08-16 state is not restorable from the database.
>
> The 2,050 supplier availability files under `suppliers/` in the `lps` bucket
> were deleted in the same pass (1.63 GB), so **there is no re-ingest path
> either** — and `backup_20260814`'s rows now carry `file_path`s that point at
> deleted objects. The bucket's other 23 objects are work products, not
> availability data, and were kept: `daisy_shared/`, the `inventory/` plant
> photos, `brand/lps-logo-transparent.png` and the favicon.
>
> **The catalogue was reset once before, on 2026-08-14.** `inventory`,
> `inventory_sources` and `plant_aliases` were **deleted outright** — not
> soft-deleted — at Bhoumik's request, then re-ingestion began. The wipe removed
> 238,748 inventory rows, 2,113 sources and 127 aliases; suppliers, contacts and
> their links were untouched. A row-for-row copy of all three tables is in the
> `backup_20260814` schema (73 MB, not exposed to PostgREST); restoring means
> `insert … select` in the order sources → inventory → aliases, which is the
> order their foreign keys require. Live catalogue counts are intentionally not
> pinned here while the rebuild is changing them.

Row counts at last stable verification (2026-08-12; suppliers and contacts
re-counted 2026-08-14): `suppliers` 1,383 (1,375 active),
`availability_queries` 125, `users` 2, `contacts` 1,844
(**1,813 active** — 20 retired by the 0036 merge, one by the 0038 cascade),
`supplier_contacts` 1,843 links (1,831
active) — 47 contacts backfilled from the retired `poc_*` columns on 2026-08-05,
29 lifted out of `suppliers.notes`, and the rest moved from `suppliers.email` /
`suppliers.phone` when those columns were dropped the same day.
**Re-counted 2026-08-18:** `suppliers` 1,403 (1,395 active), forming **1,335
companies** — 22 head branches carry 60 other locations between them (82 rows in
all), and the other 1,313 suppliers are their own head.

Links now outnumber active contacts, which is the point: 13 contacts hold 2–6
locations each.

### Two conventions that apply everywhere

- **Soft deletes.** Rows are flipped `is_active = false`, not deleted. Only
  active rows are searched or shown.
- **Derived columns.** Every `*_key` is `normalize_plant_key()` of the text
  beside it, and `inventory.name` is composed from its three name parts. The
  database maintains all of them — some as `GENERATED ... STORED`, some by
  trigger. **Never write a derived column**, and never match plant names with
  `=` on raw text; compare the key columns.

---

## Core tables

### `suppliers`

One row per nursery / grower / wholesaler — and, for a company that operates at
several sites, **one row per location** (see `head_branch_id` below).

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint identity | no | PK |
| `name` | text | no | Display name, e.g. "Acosta Farms Nursery, Inc" |
| `head_branch_id` | bigint → `suppliers.id` | no | The company's head branch. **A head branch, and every single-site supplier, points at itself** — never null, never a chain. See below |
| `category` | text | yes | **CHECK**: `Grower` \| `Wholesale Supplier` \| `Retail` \| `Broker/Platform` (migration 0067, from Chris's 2026-08-21 tag direction). Null = evidence insufficient — an unclassified supplier, **or a row that is not a plant supplier at all** (the workbook's luxury-builder and non-plant cohorts; their `notes` say so) |
| `address` / `city` / `state` / `zip` | text | yes | Free-text US address parts |
| `website` | text | yes | Usually a bare domain (`acostafarms.com`) — prepend `https://` when linking |
| `latitude` / `longitude` | double precision | yes | Google Maps link: `google.com/maps?q=lat,lng` |
| `notes` | text | yes | **Durable profile facts** — see below |
| `communication_notes` | text | yes | **RETIRED** (migration 0063, 2026-08-19): frozen archive of the old contact log. Its `supplier_messages` successor was itself dropped 2026-08-23 (migration 0066). Never written again — see below |
| `availability_source_type` | text | yes | **CHECK**: `Email` \| `Hosted` — how the availability list reaches us. Null = not established yet |
| `availability_update_days` | integer | yes | **CHECK**: `> 0`. How often the supplier refreshes it, in days (7 = weekly). Null = unknown |
| `hosted_availability_url` | text | yes | The page a hosted list lives on. Bare domains occur — prepend `https://` when linking |
| `is_lps_partner` | boolean | no, default false | TRUE = an **LPS Partner**: they answer **availability requests in the supplier portal** (`/partner/<id>`, migration 0062). FALSE = reached only through our own channels. Not a login — portal auth is a deliberately deferred step. Independent of whether daisy has *onboarded* them into the database; renamed from `is_onboarded` 2026-08-25 (migration 0074), which projected it from `search_suppliers` so Supplier Search can filter on it |
| `daisy_thread_id` | text | yes | Daisy's dedicated harness thread for this supplier's **company** — `supplier-<slug of head-branch name>` (`-<head id>` only on a slug collision). One thread per head branch: every location row carries the head's value. It onboards the supplier and handles all availability ingestion and communication; the router thread (and per-supplier gws rules) send supplier traffic here. Added 2026-08-23 (migration 0064) |
| `rosie_thread_id` | text | yes | Rosie's dedicated harness thread for the company — the **same `supplier-<slug>` value** as `daisy_thread_id` (thread ids are per-agent namespaces, so the shared string names two distinct threads), one per head branch. All order-side coordination with the supplier runs there: availability requests, follow-ups, portal-save notifications. Set with `daisy_thread_id` at onboarding. Added 2026-08-23 (migration 0068) |
| `rosie_thread_ref` / `daisy_thread_ref` | bigint → `threads.id` ON DELETE SET NULL | yes | **Derived** from the two text columns by the `suppliers_link_threads` trigger — writing a text id upserts the `threads` row for (agent, id) and links it. Never write these. Added 2026-08-26 (migration 0078) |
| `is_active` | boolean | no, default true | Soft delete; deactivation cascades (see triggers) |
| `created_at` / `updated_at` | timestamptz | yes, default `now()` | `updated_at` maintained by trigger |

#### `notes` holds facts, never contact history

`notes` is what is **true about** a supplier — "won't quote under 10 units",
"prices exclude freight", "sends XLSX with two header rows", "closed Fridays":
free prose, edited in place as facts change, for anything that has no
dedicated column. What was **said with** a supplier does not belong here: the
agents record each exchange in their own thread notes
(daisy's `supplier-communications` skill).

Until 2026-08-19 the said-with half was `suppliers.communication_notes`, an
append-only prose log. Migration 0063 migrated its entries into the
`supplier_messages` transcript and froze the column; migration 0066
(2026-08-23) dropped that transcript again (rows snapshotted to
`supplier_messages_backup_20260823`). The column still holds the pre-0063 text
as an archive, and **nothing may write it again**.
(The customer side followed on 2026-08-25: migration 0073 dropped
`customers.communication_notes` outright — it was empty — and rosie's customer
thread carries that history now.)

Live category distribution (post-0067 reclassification, 2026-08-23): Grower
810, Wholesale Supplier 400, Retail 79, Broker/Platform 6, NULL 100. The NULLs
are mostly the workbook's luxury-builder (88) and non-plant (5) cohorts — not
plant suppliers, said on each row's `notes` — plus a handful with insufficient
evidence. Per-supplier rationale for the reclassification:
`harness/agents/daisy/migrations/artifacts/0067_supplier_type_review.csv`.

#### The three availability columns

Added 2026-08-05 (migration 0018) to make structured what used to be prose in
`notes` ("sends an XLSX every Monday", "avail is on their site"). All 910 rows
start null, and **null means nobody has established it yet, not "none"** — an
empty `availability_source_type` is a to-do, not an assertion that the supplier
has no availability list.

Nothing constrains `hosted_availability_url` to `availability_source_type =
'Hosted'` rows. A supplier that both emails a sheet and publishes one is real,
and a half-filled row is the normal state while someone is still working out
how a supplier publishes. Don't add a cross-column constraint without checking
the data first.

These three are **not** in the suppliers search document, so searching "Hosted"
does not find hosted suppliers — filter or sort on the column instead (the app's
Suppliers table does; `search_suppliers` accepts all three as `sort_column`).

**No way of contacting a supplier lives on this table.** `poc_name` /
`poc_email` / `poc_phone` were dropped 2026-08-05 (migration 0014), then `email`
/ `phone` (0016), then `fax` (0017). Email and phone live in `contacts` below;
**fax numbers are not stored** (Bhoumik, 2026-08-05). The supplier's own main
line is represented as a contact row with
`title_department = 'Main line'`. What remains here describes the **company**:
who it is, where it is, what it sells, what is true about it.

This is why **you cannot look a supplier up by email against this table any
more.** Match through `contacts.email`, or just use `search_suppliers`, which
searches contacts as one of its branches.

#### `head_branch_id` — a company's locations

A company that operates at several sites is **several `suppliers` rows, one per
location**, and one of them is the **head branch**: the row at the company's
business office. Every other location points at it through `head_branch_id`,
and **the head branch points at itself**. Replaced the `supplier_groups` table
on 2026-08-15 (migration 0049); there is no separate company table.

Two consequences worth internalising:

- **`head_branch_id` is never null.** A single-site supplier is its own head,
  which is the same statement as "this company has one location". There is no
  "unknown" value — the column always answers.
- **It never chains.** A branch may only point at a row that is its own head,
  enforced by the `set_head_branch` trigger in both directions (you cannot
  point at a branch, and you cannot demote a head that still has locations).

So a company's locations are one query, from any one of them:

```sql
SELECT id, name, city, state FROM suppliers
WHERE head_branch_id = (SELECT head_branch_id FROM suppliers WHERE id = <any location>)
  AND is_active ORDER BY id;
```

**Each location stays its own row.** That is what `inventory`,
`inventory_sources` and the contact links hang off, and it is what a buyer
picks: stock, prices and pickup are per site. The head branch names the company
and is where its switchboard and company-level contacts sit — Everde's head is
supplier 32, the Houston corporate office; Glen Flora, Mill Creek, Bunnell and
Canal Point are farms pointing at it.

That set is not recoverable from names. Everde alone spans `Everde Growers`
(the unsuffixed Houston row), `Everde Growers - Glen Flora Farm` and
`EVERDE GROWERS - BUNNELL`; Newton uses no dash (`Newton Nurseries Katy`) and
Calloway's uses an em dash.

The first 16 companies were identified by hand from a shared brand **and** a
shared website domain (0033), and their heads were chosen from the contacts on
file and confirmed against each company's published head-office address (0049,
which lists all 16 with reasons); more have been tied together since — 22 as of
2026-08-18. Three of them — ArborGen, Calloway's and Moon
Valley — have no head-office row at all, so their head is a stand-in worth
revisiting if that office is ever onboarded. Families matching only half the
test are listed at the bottom of `0033_supplier_locations.sql` for someone to
confirm, along with three sets of same-city rows that look like duplicates
wanting a merge rather than locations. Tying two suppliers together is a
judgment call: a wrong one fans a supplier's availability out to a nursery that
never offered it (see the ingestion skill, §2a).

### `contacts`

One row per person or inbox — the sales rep, the availability desk, whoever
answers. Replaced `suppliers.poc_*`, which could only hold one.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint identity | no | PK |
| `name` | text | yes | **Usually null, and that is correct.** Most rows are an inbox nobody named. Don't invent a name to fill it |
| `email` / `phone` | text | yes | How to reach this contact |
| `title_department` | text | yes | Free text as the supplier gives it — "Sales Manager", "Availability desk". `'Main line'` marks a row migrated from the old `suppliers.email`/`phone` |
| `notes` | text | yes | Durable facts about **the contact** (best time to call, which lists they own). **Do not store fax numbers here or anywhere else in supplier/contact data.** |
| `is_active` | boolean | no, default true | Soft delete — the person is gone. Not the same as ending one link |
| `created_at` / `updated_at` | timestamptz | no, default `now()` | `updated_at` maintained by trigger |

**There is no `supplier_id` and no `is_primary` here.** Both moved to
`supplier_contacts` on 2026-08-14 (migration 0034): one rep covers several
locations of the same company, so neither the supplier nor "is this the one who
answers" is a property of the person. A row in this table is a person or an
inbox and nothing more. Editing it changes them at **every** location they
cover.

### `supplier_contacts`

Which contacts cover which locations. One row per (supplier, contact) pair.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint identity | no | PK |
| `supplier_id` | bigint → `suppliers.id` ON DELETE CASCADE | no | The location |
| `contact_id` | bigint → `contacts.id` ON DELETE CASCADE | no | The person or inbox |
| `is_primary` | boolean | no, default false | This **location's** default contact — see below |
| `is_active` | boolean | no, default true | They no longer cover this location; they may still cover others |
| `created_at` / `updated_at` | timestamptz | no, default `now()` | `updated_at` maintained by trigger |

Unique on `(supplier_id, contact_id)` — link someone twice and the insert is
rejected, so re-linking is an UPDATE back to `is_active = true`, not a second row.

**Two levels of `is_active`, and they say different things:**

| | means | set it when |
|---|---|---|
| `contacts.is_active = false` | the person is gone | they left the company entirely |
| `supplier_contacts.is_active = false` | they stopped covering this location | their territory changed |

A contact is visible for a supplier only when **both** are true. Deactivating a
supplier cascades to its links, and retires the contact itself only if that was
their last active link.

**At most one active primary per location**, enforced by the partial unique
index `supplier_contacts_one_primary_idx (supplier_id) WHERE is_primary AND
is_active`. Promoting someone therefore means **demote the incumbent first,
then promote** — the other order trips the index. The flag is per link: the same
person can be primary at one of a company's nurseries and not at another. A
retired link keeps its `is_primary` flag as history; because the index only
covers active rows, that never blocks the current primary.

Reading a supplier's contacts means joining, not selecting:

```sql
SELECT c.*, sc.is_primary
FROM supplier_contacts sc
JOIN contacts c ON c.id = sc.contact_id AND c.is_active
WHERE sc.supplier_id = <id> AND sc.is_active
ORDER BY sc.is_primary DESC, c.id;
```

`notes` here is about the person. Anything that was *said to* them is still an
appended entry in `suppliers.communication_notes` — the split is the same one
`suppliers.notes` vs `communication_notes` makes, and it matters for the same
reason.

There is deliberately no uniqueness on `email`: the same person can legitimately
be listed twice with different roles, and dedupe is a judgment call, not a
constraint. One such pair exists on purpose — supplier 255 has both
`Felix Jr. Rivero` and `Felix Rivero` with different office, cell and email,
flagged in the second row's `notes`. Confirm before merging them.

0034 backfilled exactly one link per pre-existing contact and merged nothing;
migration 0036 then merged the unambiguous duplicates the old `supplier_id`
column had forced — **33 rows into 13**, so Jim Ord is one contact with six
links rather than six contacts. The rule was narrow on purpose: same normalized
email **and** same normalized phone, with no field of one contradicting the
other. `'Main line'` counts as provenance, not a title, so it never blocks a
merge and yields to a real title.

**Matching on email alone is wrong**, and that is the trap to remember here. A
shared company inbox is not a duplicate person: `info@calloways.com` sits on
three rows with three phone numbers and two different named managers. Since the
phone lives on the contact and not on the link, merging those would delete two
working numbers. Twelve such groups were left alone — they are listed at the
bottom of `0036_merge_duplicate_contacts.sql`, and `contacts_merge_map` plus
the `contacts_pre_merge` / `supplier_contacts_pre_merge` snapshots make every
merge that did happen reversible.

**Only ~230 of 973 rows have a name, and that is the expected shape.** The table
holds *contact routes*, not just people: 0016 moved every `suppliers.email` and
`suppliers.phone` in here, and most of those are an inbox (`info@`, `sales@`)
with no identifiable owner. A row needs only one of name / email / phone.

Where a name was recoverable from an address it was taken from a **hand-curated
allowlist of the values actually present**, never a pattern — a `first.last`
regex matches `tynursery.orders` and `treeoflife.gardencenter`, and a
first-name regex matches `howdy` and `fieldgrown`. Those ~160 guessed rows each
carry `Name inferred from the email address; unverified.` in their `notes`, so a
guess is never mistaken for a confirmed fact. **Don't infer a name from an
address anywhere else** — leave it null and let someone who knows fill it in.

`suppliers.notes` keeps hours, addresses, policies, parsing quirks and business
history; 29 people were lifted out of that prose on 2026-08-05 and must not go
back. Locations with contacts but no flagged primary are normal: nobody is
promoted without evidence of who actually answers, and readers fall back to the
oldest active link.

### `inventory`

One row per plant × size × supplier offering, extracted from supplier pricing /
availability files.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK, `gen_random_uuid()`. Constraint is still named `plants_pkey` |
| `supplier_id` | bigint → `suppliers.id` ON DELETE CASCADE | yes | Owning supplier |
| `source_id` | uuid → `inventory_sources.id` | yes | File/URL this row came from; null for hand-entered rows |
| `name` | text | no | **Derived.** The whole plant identity: the three parts below joined by ` - ` — `Forest Pansy Redbud - Cercis canadensis - Forest Pansy`. Written by trigger; do not write it. **Part of a row's identity** — (name, size) alone is NOT unique |
| `common_name` | text | yes | The common name **exactly as the source prints it**. NULL when the source prints none |
| `botanical_name` | text | yes | The botanical / scientific name **exactly as the source prints it**. NULL when the source prints none |
| `cultivar_variety_trade_name` | text | yes | **Everything the printed name carries that the two above don't** — cultivar, variety, selection, trade name — exactly as printed, **comma-separated** when there is more than one. Never a size, dimension, form or grade code. NULL when the source prints none |
| `name_key` | text **generated stored** | — | `normalize_plant_key(name)`. Do not write |
| `common_name_key` / `botanical_name_key` | text | — | **Derived by trigger**: `normalize_plant_key()` of the part beside each, NULL when that part is. Do not write |
| `cultivar_keys` | text[] | — | **Derived by trigger**: one `normalize_plant_key()` per name in `cultivar_variety_trade_name`, split on `,` (`;` and `|` tolerated; never `-` or `/`). What `cultivar` alias edges match against, by overlap (`&&`). NULL when the column is. Do not write |
| `size` | text | yes | The container/grade sold **as the supplier printed it**, normalized by `normalize_size()`: gallons `"15 G"`, feet `"6'"`, inches `"24\""`, compounds keep units (`"3' cal"`, `"24\" box"`, `"15 G/17\""`). `#`/`gal` mean gallons — **except on a box, sized in inches**. Word sizes (`"B&B"`, `"Field Grown"`, `"Quart"`) are valid. Height/width/caliper, form codes (`STD`, `Bush`) and pack counts do **not** belong here. See the `availability-ingestion` skill's *Size standard* |
| `size_std` | text | yes | Standardized container for `size` — see below. **CHECK**: `<N>" Pot` \| `<N>G` \| `<N>" Box` \| `Bare Root` \| `Liners` \| `Plug` \| `Trays` \| `B&B` \| `Field Grown` \| `Grow Bags` \| `Root Pruned` \| `other`. `NULL` when `size` is |
| `unit_price` | numeric(10,2) | yes | USD; lower bound if the source gave a range. `NULL` means the supplier provided no price; never coerce missing to zero |
| `quantity` | numeric | yes | Available quantity if the source lists one |
| `height` / `width` / `caliper` | text | yes | Human-readable measurement as printed in the source; preserved for display/evidence |
| `height_std` | double precision | yes | Standardized height in **feet**; lower bound for a range; `NULL` when unknown/ambiguous |
| `width_std` / `caliper_std` | double precision | yes | Standardized width/caliper in **inches**; lower bound for a range; `NULL` when unknown/ambiguous |
| `notes` | text | yes | **Supplier-stated** facts no other column captures: per-row qualifiers ("limited", "B&B only"), lead times, ordering constraints, supplier item codes / yard locations, future-availability windows. **Never** receipt/ingest dates ("available as of" — staleness is the row's `source_id`), source-file names, or verbatim row restatements; most rows carry none (rule tightened + old boilerplate cleaned 2026-08-23, migration 0065). Not our commentary |
| `internal_notes` | text | yes | **Ours.** Parse caveats, why a combined size was split, that a quantity is the supplier's shared/tentative count, QA exceptions. Never what the row already answers (a missing price or quantity, `updated_at`, when the drop was ingested). Appended, not clobbered. Added 2026-08-14 (migration 0039) |
| `image_url` | text | yes | Optional product image, as a **link on someone else's server** — the address of a photo on the supplier's own page, written as-is. Never a copy: a photo we were *given* as a file goes to `plant_photos`, and the two never describe the same image |
| `is_active` | boolean | no, default true | Soft delete |
| `created_at` / `updated_at` | timestamptz | yes, default `now()` | `updated_at` maintained by trigger |

Price semantics are intentionally strict: `NULL` means no price was printed or
provided, while a numeric value is the supplier's printed price. On 2026-08-04,
all 28,998 legacy zero-price placeholders were migrated to `NULL` with explicit
approval. Future numeric zeroes are valid only when the supplier explicitly
prints zero. `rate_charts` and `search_inventory` pass
`unit_price` through unchanged, including `NULL`.

#### `size` vs `size_std`

`size` is evidence — the string the supplier printed, kept verbatim (after unit
canonicalization) because it is what the table cell shows and what search reads.
`size_std`, added 2026-08-13 by migration 0030, is the **one bucket** that
container belongs to, and is what the app's size filter selects on. The pair
works exactly like `height`/`height_std`.

The pot, gallon and box families are **open sets** — the constraint checks the
shape (`<N>" Pot`, `<N>G`, `<N>" Box`), not a fixed list — so a supplier who
starts selling 12G needs no migration. The number is the one the source printed;
nothing is rounded to a neighbouring size.

The three numbered families do not overlap, and which one a bare diameter joins
is a judgment about the row, not the string:

- A compound drops its pot-diameter half (`15 G/17"` → `15G`), and a bare
  diameter that **has** a gallon equivalent maps onto it (a 17" pot is also
  `15G`; 6"→`1G`, 10"→`3G`, 12"→`5G`, 14"→`7G`, 20"→`20G`, 21"→`25G`, 28"→`45G`,
  30"→`60G`, 32"→`65G`, 36"→`100G`, 42"→`150G`, 48"→`200G`, 60"→`300G`). One
  checkbox therefore covers every spelling of a 15-gallon container.
- A diameter with **no** gallon equivalent is `<N>" Pot` — `4" Pot`, `8" Pot`,
  `3.5" Pot`. This is the annual/perennial/tropical end of the catalogue.
- A bare diameter that is really a **box** is `<N>" Box`, even unlabelled: desert
  growers print `36"` for a 36-inch box, and the plant names and the supplier's
  other rows are what distinguish it from a pot.

`B&B` is its own bucket — balled-and-burlapped field-dug stock, where the burlap
*is* the container. Measurements printed alongside it (`B&B; 3-4' HT`) are the
plant's size, not a second container.

`other` is a real answer, not a failure: it means a container the standard has
no bucket for (`Quart`, `10" Hanging Basket`, `Six Pack`). `NULL` means no
container is known. The full mapping rules live in the `availability-ingestion` skill's *Size standard*,
and the app's ordering of the vocabulary is `app/lib/size-std.ts`.

**State after the 0031/0032 backfills (2026-08-13, active rows only — describes
the catalogue that was deleted on 2026-08-14, kept as the standard's measured
baseline):** 54,815
of 62,572 rows carry a `size_std` across 66 buckets — `1G` 8,986, `3G` 7,445,
`15G` 5,099, `5G` 4,358, `Trays` 3,814, `other` 3,326, `B&B` 3,224, `4" Pot`
1,483 — and roughly 1,300 distinct printed size strings collapse onto them. The
remaining 7,757 rows are `NULL` in both columns. `other` is down to 5.3% of the
mapped rows and is now mostly quarts, six-packs, hanging baskets and decorative
pottery. **Retired rows were deliberately not backfilled**, so `size_std IS
NULL` on an inactive row means "never mapped", not "no container". The same
migration moved 6,705 misfiled height/width/caliper values out of `size` into
their own columns with paired `*_std`; where the dimension column already held a
genuinely different value the row was left intact and only bucketed `other`, so
a 4" pot on a 6"-tall grass still records both facts.

Dimension semantics follow the same evidence rule: the source strings are never
replaced by numeric projections. A range stores its approved conservative lower
number in `*_std`; explicit height inches convert to feet, explicit
width/caliper feet convert to inches, and exact mixed/fractional values retain
full precision. Inequalities, conflicting/combined units, malformed or guessed
measurements remain `NULL`. Active range filters exclude `NULL`. Editing a
human-readable dimension without a reviewed paired standard clears its
companion so stale numeric evidence cannot survive.

#### `notes` vs `internal_notes`

Split by migration 0039 (2026-08-14). `notes` is evidence — what the supplier
printed or said about the offering, dated. `internal_notes` is commentary — what
we concluded, split, guessed at, or flagged while ingesting it. Keeping them
apart means a later reader can tell "the supplier says 2-week lead time" from
"we copied this quantity across two sizes because the sheet shared it". Neither
is a substitute for `workspace/suppliers/[<id>]:<Name>/notes.md`, which is the
agent's own working memory about the *supplier*, not about a row.

`internal_notes` only earns a line when a later reader could not get the same
fact from the row. Observations the row already answers — a missing price or
quantity (`unit_price` / `quantity` is `NULL`), when it was last touched
(`updated_at`), when the drop landed or which file it came from (`source_id`,
`inventory_sources.created_at`), a restatement of the size or the name — are
not written at all. The `availability-ingestion` skill states
the rule and QA-checks it before an ingest commits.

Both are carried by `inventory` **and** by `search_inventory`. 0039
left `internal_notes` out of the RPC to avoid dropping and recreating it, and
the app compensated with a per-page hydration read; 0040 had to recreate the
function anyway, so the column went in and that hydration was deleted.

Rows written before 0039 have a mix of both kinds in `notes`; they were
deliberately not reclassified, so the split describes what is written from now
on.

#### The three name parts, and why `name` is derived

Added 2026-08-14 by migration 0040. Before it, one `name` column carried the
whole identity and the ingestion SOP asked writers to assemble the bracket by
hand. The parts are now their own columns and `name` is the composition:

```
common_name                 = 'Forest Pansy Redbud'
botanical_name              = 'Cercis canadensis'
cultivar_variety_trade_name = 'Forest Pansy'
name  (derived)             = 'Forest Pansy Redbud - Cercis canadensis - Forest Pansy'
```

`compose_plant_name()` joins the non-empty parts with **` - `**, in the order
common, botanical, cultivar (migration 0043 — 0040 wrapped the tail in brackets
instead). The separator is a spaced dash for two reasons: the comma is no longer
available, because `cultivar_variety_trade_name` is itself comma-separated; and
spacing is what distinguishes it from the hyphen inside a name like `KN30-8`.

Delimiter changes here are cheap and safe by construction: `normalize_plant_key()`
keeps letters only, and `normalize_search_text()` maps all punctuation to spaces,
so bracket and dash forms share one identity key and one token array — they
differ only in whitespace-run length, which `TokenDelimit` ignores. No row's
membership in any search result moves, and the pgroonga document and index need
no rebuild.

`trg_inventory_derive_identity` composes `name` and derives the three part keys
on every insert and update, so **anything written to `name` on a row that has
parts is silently overwritten**. A row with all three parts NULL keeps whatever
`name` it was given: that is every pre-0040 row, and every hand-entered one.
The head of the composition is the common name when there is one, else the
botanical name, else the cultivar; the rest goes in the bracket in that order.

**Each column carries only what the source explicitly prints.** A part the
source doesn't print is NULL, and NULL is a fact, not a gap to fill from
knowledge.

`cultivar_variety_trade_name` is the **residual**: whatever the printed name
carries that the common and botanical name don't. Cultivar, variety, selection
and trade name all land in it, because sources do not distinguish them reliably
and guessing which is which loses information. A row printing
`Acer palmatum 'Wolff' - Emperor 1®` stores `Wolff, Emperor 1®`.

**The comma is load-bearing.** Migration 0041 splits on it to build
`cultivar_keys`, one identity key per name, and that array is what a `cultivar`
alias edge and the app's Cultivar filter match against. Two names run together
with a dash key as one string that matches neither, and the row silently stops
answering searches for either — which is why the ingestion SOP mandates the
comma and QAs for it. Size, dimensions, form and grade codes never enter the
column however the source prints them inline.

**No rows were backfilled.** All 235,976 existing rows have NULL in all three
parts, by instruction — Bhoumik is dropping the catalogue and re-ingesting it.
Deriving the parts from the existing `name` was not attempted: 0005 tried
exactly that from the alias graph and abandoned it, and the SOP requires each
part to be what the *source* printed.

There is also no `category` column (the source's own grouping is not tracked)
and no separate `variety` column — variety shares
`cultivar_variety_trade_name`. Both were dropped 2026-07-31, along with the
rollback table that briefly held their pre-change values, so the change is
irreversible and the old category values no longer exist anywhere.

### `inventory_sources`

Provenance: one row per ingested pricing / availability file or URL, per supplier.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `supplier_id` | bigint → `suppliers.id` ON DELETE CASCADE | no | |
| `file_path` | text | no | Either an object key in the `lps` bucket or a full `http(s)://` URL |
| `notes` | text | yes | Where/how it was sourced |
| `is_active` | boolean | no, default true | Soft delete. **Ingestion no longer retires a supplier's previous sources** (2026-08-14) — live `inventory` rows still point at them, so retiring one would orphan its provenance. Retiring one deliberately (the app's Files tab) takes those rows with it, see below |
| `created_at` | timestamptz | no, default `now()` | Immutable LPS ingestion timestamp; not the source's printed/effective availability date |

Since 2026-08-14 an ingest **updates** the rows it finds again and inserts the
ones it doesn't, instead of inserting a whole new version and retiring the old
one. A row's `source_id` therefore points at the **most recent drop that
contained it**, which makes it the staleness signal: an offering the supplier
has stopped listing keeps its older `source_id` and its older derived
`ingestion_date` while everything they still sell moves forward. Nothing is
retired automatically — dropping an offering for good is a deliberate act.

**Deactivating a source is that deliberate act, and it cascades** (2026-08-14,
migration 0048). `trg_cascade_source_deactivation` retires every active
`inventory` row whose `source_id` is the file being retired, so direct SQL and
the app's Files tab preserve the same invariant: no live row points at an
inactive source. Because a row moves to the newest source that lists it, an
offering re-listed by a later drop survives retirement of the older source.

The cascade is **one way**. Reactivating a source does not restore its rows,
because the database does not record which rows the trigger retired versus
which were already inactive. Undoing a mistaken retirement is a manual,
considered inventory update. Live catalog introspection and a rollback-only
fixture verified the trigger after apply.

The app derives an inventory row's `ingestion_date` by joining its `source_id`
to an **active** source's `created_at`; manual/source-less rows remain blank. A
supplier's `last_ingestion_date` is max(`created_at`) across its active sources
only (Bhoumik decision, 2026-08-04). Neither value is duplicated into the
`inventory` or `suppliers` tables. Source/effective date is a separate future
domain field and must not be inferred from a filename.

### `plant_aliases`

Name equivalences. A row says **"these two strings name the same thing"** — an
undirected edge between two names, with no kinds and no subtypes. Added
2026-08-14 by migration 0040, replacing `plant_other_names`; the `alias_type`
column was dropped 2026-08-15 by migration 0050.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint identity | no | PK |
| `name` | text | no | One name, display-cased |
| `other_name` | text | no | The other name, display-cased |
| `name_key` / `other_name_key` | text **generated stored** | — | `normalize_plant_key()` of each side, NULL when empty; all matching runs on these |
| `source_id` | uuid → `inventory_sources.id` | yes | The drop this pair was read out of |
| `source_line` | text | yes | The **verbatim line** from that source printing both names. The SOP's evidence rule; a pair with no quotable line does not ship |
| `is_active` | boolean | no, default true | Soft delete. Inactive pairs power neither search nor display **and block re-insertion** |
| `created_at` / `updated_at` | timestamptz | no, default `now()` | `updated_at` maintained by trigger |

**Nothing constrains what a pair can reach.** `search_inventory` partitions the
query into spans and substitutes the opposite endpoint of every active incident
edge. A bad species↔cultivar pair therefore makes a cultivar query reach the
generic species and every sibling selection. The direct, reviewed
exact-equivalence evidence bar is the *only* protection; never infer an edge
from botanical knowledge.

> **Why `alias_type` is gone.** It carried two jobs. Migration 0045 removed the
> first — once aliases expanded the query rather than matching a column, an
> expanded span had no column to be restricted to, so a `plant` edge and a
> `cultivar` edge already reached identically. The second was choosing which
> identity part a pair hung off for the **Also known as** display, and 0050
> removed that display. With no reader left the column was dropped in the same
> migration. It never influenced retrieval, so dropping it changed no result;
> what is gone is the record of which kind of equivalence a source asserted.

An alias still exists for exactly one reason: so a search finds the row when the
user types another name the same thing is known by. **Both sides must be printed
in the source being ingested**, never supplied from the writer's own knowledge —
the rule the ingestion skill enforces, and the one alias 44255 broke.

Uniqueness is on `(name_key, other_name_key)` — case, spacing and symbol
variants of a pair are the same pair. A BEFORE INSERT trigger
silently drops duplicates, self-pairs and empty-keyed rows, so writers can
blind-insert without conflict handling.

> **Two holes the old table had, and what happened to them.** It rejected a
> duplicate `(name_key, other_name_key)` in one orientation only, so the
> mirrored pair inserted cleanly and a retired edge could come back reversed —
> **168 such rows existed**. `dedupe_plant_aliases()` now rejects both
> orientations. And because it checks regardless of `is_active`, a retired pair
> is a genuine blocklist: the property 0010 lost when it *deleted* the pairs it
> retired instead of keeping tombstones.
>
> The old table also recorded no provenance at all, which is why 0028's culprit
> had to be attributed by reading id ordering. `source_id` and `source_line` fix
> that, and the ingestion skill writes both.

**The table starts empty.** Its 13,700 predecessors mapped whole composed
identities, which a part-level table cannot express; the directory is being
re-ingested with the rest of the catalogue. Before adding any cleanup rule to a
future audit, read the REJECTED RULES section of
`harness/agents/daisy/migrations/0008_alias_quality_audit.sql` — four plausible
rules were built, measured and thrown out there for destroying genuine data.

### `plant_photos`

The searchable plant photo catalogue. One row per catalogued photo. Added
2026-08-16 by migration 0051, from the plan in daisy's
`knowledge/files/plans/searchable-photo-catalogue-plan.md`.

**A photo is an independent record, not a column on `inventory`.** Its supplier
is optional, it may show a plant nobody currently stocks, and nothing about it
is retired when inventory or a supplier is. A catalogued photo says *this is
what this plant looks like* — never *this supplier has it in stock*.

**Every row here is a file someone handed us** — an email attachment, a Telegram
photo, a file given to an agent. An image that lives on someone else's server is
**never downloaded to make a row**: the URL is captured instead, in
`inventory.image_url` when it belongs to an offering and otherwise in the
ingest's report. **`inventory.image_url` is a link, `plant_photos` is a copy**,
and the two never describe the same image.

**The catalogue is a reference library, not an archive** (decided 2026-08-16).
What is stored is a normalised copy, not the file as received: EXIF orientation
baked into the pixels, all metadata dropped (GPS included), long edge capped at
2048px, re-encoded to WebP —
`skills/agent/plant-photo-catalogue/scripts/prepare-photo`. Measured on a
4032×3024 phone photo, 7.9 MB → 819 kB. Migration 0053 made this a rule the
bucket enforces rather than a convention: it accepts `image/webp` only.

That is why `sha256` describes the **source** file rather than the stored
object. Keying on our own output would break dedupe the day the encoder settings
change. One-row-per-object is guaranteed by `plant_photos_object_idx` instead —
unique on `(storage_bucket, storage_path)` — which is what it was always for.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK, `gen_random_uuid()`. Also names the object — see `storage_path` |
| `storage_bucket` | text | no, default `plant-photos` | |
| `storage_path` | text | no | Object key inside that bucket, `suppliers/<supplier-id>/YYYY/MM/<id>.<ext>` or `unassigned/YYYY/MM/<id>.<ext>`. `YYYY/MM` is when it was **received**. Built from ids, never from a supplier name |
| `mime_type` / `byte_size` / `image_width` / `image_height` | text / bigint / int / int | yes | File facts, recorded at intake |
| `sha256` | text | yes | Exact-duplicate key, **unique where not null** — the hash of the file we were **handed**, not of the object stored. Photos are normalised before upload (below), so the two differ; keying on the source is what makes a re-sent photo still collide with the row we hold. The same file arriving twice is one row with a second origin appended to `source` |
| `supplier_id` | bigint → `suppliers.id` ON DELETE SET NULL | yes | **Optional**, and only when a source said so. Never guessed |
| `common_name` / `botanical_name` / `cultivar_variety_trade_name` | text | yes | The same three-part identity `inventory` carries, each holding only what a source printed |
| `name` | text | yes | **Derived** — `compose_plant_name()` of the three parts, by trigger |
| `name_key` | text **generated stored** | — | `normalize_plant_key(name)`, byte-identical to `inventory.name_key` so the two tables **join on identity** (added 2026-08-16, migration 0052). A **whole-identity** key, not a plant-name one — `windmillpalmtrachycarpusfortunei`, not `windmillpalm`. To find a *plant*, use the part keys or the RPC |
| `common_name_key` / `botanical_name_key` / `cultivar_keys` | text / text / text[] | yes | **Derived** by the same trigger, same rules as `inventory` |
| `size` / `size_std` | text | yes | Only from an explicit statement — a printed label, a price list, or someone saying so. **Never inferred from apparent scale in the frame** |
| `height` / `width` / `caliper` | text | yes | Same rule. Stated, or null |
| `tags` | text[] | no, default `{}` | Lowercased, trimmed, deduped and sorted by trigger |
| `caption` | text | yes | What is visibly in the frame |
| `notes` | text | yes | What is *not* established, and any conflict between sources — preserved, never reconciled |
| `source` | text | yes | Verbatim provenance: who, which channel, which message, when |
| `captured_at` | timestamptz | yes | When the photo was **taken**, if known. Null rather than guessed |
| `is_active` | boolean | no, default true | Soft delete. Retired rows leave search and `/photos` at once; the object stays in the bucket |
| `created_at` / `updated_at` | timestamptz | no, default `now()` | When we **received** it, and when the row last changed. `updated_at` by trigger |

Three timestamps, three different facts: a photo taken last spring and sent
yesterday is not fresh. Freshness is read off `captured_at` falling back to
`created_at` — there is no manually edited flag.

**Identity and size are `inventory`'s columns, deliberately.** Same three name
parts, same derived `name`, same `name_key` / `common_name_key` /
`botanical_name_key` / `cultivar_keys`, same `size` / `size_std` pair. That is
what puts photos on the `plant_aliases` graph — the RPC expands query spans
through the same edges — and what lets a cultivar filter written for one table
work unchanged on the other. **The one remaining difference is dimensions:**
`inventory` also carries numeric `height_std` / `width_std` / `caliper_std`
backing its range filters; photos carry only the raw text, because nothing
captures a measured value for a photo yet. Adding them is three columns and
three partial indexes mirroring `inventory_supplier_*_std_idx`.

> **What migration 0051 deliberately deferred.** The plan's phase-1 shape is
> seven tables — a separate `photo_assets`, many-to-many subjects / supplier
> links / inventory links / tags, and `photo_provenance_events` — plus a review
> workflow (`pending`/`approved`/`quarantined`), perceptual hashing and
> generated `display.webp` / `thumb.webp` derivatives. **None of that exists.**
> One photo carries one subject, at most one supplier and a `text[]` of tags.
> The columns that make the larger model reachable without a rewrite are here:
> `sha256`, `source`, and the three separate timestamps. There is **no approval
> gate** — a catalogued photo is visible to every signed-in user immediately.

### `customers`

One row per customer — the **person**; their company is an attribute. Added
2026-08-17 by migration 0055. Owned by the **rosie** agent: rosie writes the
customer and job-request tables (and, since 2026-08-23, the
availability-request pair); daisy writes the supplier and inventory tables.
Each only reads the other's, with one shared surface: `suppliers.notes`, where
rosie also records coordination preferences.

Contact routes are **inline** (`email`/`phone` on the row), deliberately unlike
suppliers — a job request comes from a person, and the `contacts` + link-table
split can be introduced by migration if multi-contact customers ever appear.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint identity | no | PK |
| `name` | text | no | The person's name. Never guessed from an email address |
| `company` | text | yes | |
| `email` / `phone` | text | yes | Inline, unlike suppliers |
| `address` / `city` / `state` / `zip` | text | yes | Free-text US address parts |
| `notes` | text | yes | **Durable facts**, edited in place — same split as suppliers. There is no contact-log column beside it: `communication_notes` was **dropped 2026-08-25** by migration 0073 (empty on every row), the same move the supplier side made in 0063 — what was *said* lives in the rosie thread below |
| `rosie_thread_id` | text | yes | Rosie's dedicated harness thread for this customer — `customer-<slug of name>` (`-<id>` on a collision with a different customer), minted by rosie on first contact. One conversation per customer across all their job requests, and **the contact history** since 0073. Added 2026-08-23 (migration 0068) |
| `rosie_thread_ref` | bigint → `threads.id` ON DELETE SET NULL | yes | **Derived** from `rosie_thread_id` by the `customers_link_threads` trigger. Never write. Added 2026-08-26 (migration 0078) |
| `is_active` | boolean | no, default true | Soft delete. No deactivation cascade — retiring a customer is a deliberate act, and their requests keep their history |
| `created_at` / `updated_at` | timestamptz | no, default `now()` | `updated_at` by trigger |

### `job_requests`

One row per customer job request. Added 2026-08-17 by migration 0055; owned by
rosie. The app's users edit these rows in the UI **concurrently with the
agent** — that is why the changelog below exists, and why agents re-read a row
immediately before updating it.

**`customer_id` is nullable: an anonymous request is a real request.** One
received before the sender is known carries its identity clues in
`customer_notes` and is mapped later by a plain `UPDATE`. The FK is `SET NULL`
so nothing about a customer row's lifecycle can silently take requests with it.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint identity | no | PK |
| `customer_id` | bigint → `customers.id` ON DELETE SET NULL | yes | **Nullable** — anonymous intake, mapped later |
| `name` | text | yes | **What the job is called** — "Riverbend patio planting". Written by rosie at intake and editable in the app; NULL renders as `JR-<id>`, which is an unnamed request's real name. Never generated from the id. Added 2026-08-18 (migration 0059) |
| `status` | text | no, default `sourcing` | **CHECK**: `sourcing` \| `quoted` \| `closed_won` \| `closed_lost` \| `archived`. Underscore spellings match `chat_sessions.status`. `closed_won` is the future convert-to-order hook (order tables are deferred); `archived` is a terminal status while `is_active` stays the soft delete |
| `billing_address` / `billing_city` / `billing_state` / `billing_zip` | text | yes | |
| `shipping_address` / `shipping_city` / `shipping_state` / `shipping_zip` | text | yes | |
| `customer_notes` | text | yes | **The customer's words, verbatim.** Evidence — never edited. Holds only what the structured columns don't: constraints, deadlines, conditions — not the plants, the address or the identity |
| `sourcing_notes` | text | yes | **Ours.** Free text, edited in place. At request level it holds what changed about the *job* ("Delivery date 8/22 → 8/29"); a line's sourcing detail belongs on the line. Named `internal_notes` until migration 0061 |
| `external_notes` | text | yes | Written to be **shown to the customer** |
| `rosie_thread_ref` | bigint → `threads.id` ON DELETE SET NULL | yes | **Derived**: the `threads` row for (rosie, `jr-<id>`), linked on insert by `job_requests_link_threads`. The thread **closes with the job** (`threads.closed_at`, set when `status` becomes `closed_won` / `closed_lost` / `archived` or `is_active` goes false; cleared when it comes back) and is **deleted with it** (`job_requests_drop_thread`, transcript cascades). Excluded from the changelog. Never write. Added 2026-08-26 (migrations 0078–0080) |
| `is_active` | boolean | no, default true | Soft delete |
| `created_at` / `updated_at` | timestamptz | no, default `now()` | `updated_at` by trigger |

### `job_request_items`

One row per line item on a job request. Added 2026-08-17 by migration 0055;
owned by rosie.

**`name` is the customer's verbatim ask; `size` preserves that ask with gallon
notation normalized to `G`** ("30 gal or larger" → "30 G or larger") —
evidence, not classification, so there is deliberately no `size_std` and no
copy of the inventory size CHECK. Matching against inventory happens through
the search RPCs and key columns, downstream.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint identity | no | PK |
| `job_request_id` | bigint → `job_requests.id` ON DELETE CASCADE | no | |
| `name` | text | no | The plant as the customer asked for it |
| `size` | text | yes | Verbatim ask. No `size_std` — see above |
| `quantity` | numeric | yes | **CHECK**: null or `> 0`. **Demand** — what the customer asked for |
| `available_quantity` | numeric | yes | **CHECK**: null or `>= 0`. **Avail** — how many we can actually supply (migration 0056). NULL = not answered yet (renders as a dash, never zero); 0 = confirmed unavailable; below `quantity` = partial cover, which is where the UI's derived "Partial" pill comes from. Deliberately not clamped to `quantity` — a supplier may offer more than was asked |
| `unit_price` | numeric(10,2) | yes | NULL = not priced yet; **never 0** — same rule as `inventory.unit_price` |
| `total` | numeric(12,2) | — | **`GENERATED ALWAYS AS (quantity * unit_price) STORED`** — never write it. NULL until both parts exist |
| `status` | text | no, default `pending` | **CHECK**: `pending` \| `available` \| `alternative_proposed` \| `unavailable`. Narrowed from seven words by **migration 0058**: `sourcing` described an activity rather than a state and is already recorded, in more detail, by `internal_notes`; `confirmed` was a stronger `available` nothing distinguished; a dropped line is `unavailable` with the reason in the notes, and a line entered in error is deactivated rather than statused. Existing rows were remapped (`sourcing`→`pending`, `confirmed`→`available`, `cancelled`→`unavailable`) — only the first had any |
| `customer_notes` | text | yes | The customer's words about this line, verbatim — and **only what no other column holds**. Not a restatement of `name`/`size`/`quantity`: constraints, preferences and conditions, not the ask (`job-requests` skill, §4) |
| `sourcing_notes` | text | yes | **The sourcing sheet** — free text, edited in place, a terse line per supplier (`APS: $26/unit, availability requested`). Updated rather than appended to: the changelog holds what a line said before. Free text is allowed; nothing enforces the shape. Named `internal_notes` until migration 0061 |
| `external_notes` | text | yes | **Customer-visible.** A quantity change or a substitution is **named** here in the same change that makes it — what the customer is being offered, never why (`job-requests` §4). Sizes are written `XX G` |
| `is_active` | boolean | no, default true | Soft delete |
| `created_at` / `updated_at` | timestamptz | no, default `now()` | `updated_at` by trigger |

### `job_request_changelog`

The audit trail for the two tables above, added by the same migration.
**Written only by the `log_job_request_changes()` trigger** — an agent or the
app never inserts into it, and rows are immutable (no `updated_at`, no
`is_active`, nothing edits them). Because it is a trigger, the UI's edits and
the agents' edits are both captured without either write path cooperating.

**Reading convention (agents):** whenever you load a request or an item to act
on it, load its **last 5 changelog entries** too
(`ORDER BY created_at DESC, id DESC LIMIT 5`) — that is how you see what
changed under you since you last looked.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint identity | no | PK |
| `job_request_id` | bigint → `job_requests.id` ON DELETE CASCADE | no | Set for item-level entries too (the item's request) |
| `item_id` | bigint → `job_request_items.id` ON DELETE CASCADE | yes | NULL = a request-level entry |
| `actor` | text | no | `coalesce(current_setting('app.actor', true), current_user)`. A writer that opens its session with `SET app.actor TO '<name>'` is named; otherwise the role still separates agent scripts (`postgres`) from the app (`service_role`) |
| `action` | text | no | **CHECK**: `insert` \| `update` |
| `changes` | jsonb | no | On insert: the row's non-null fields. On update: `{col: {"old": …, "new": …}}` per changed column, `updated_at` excluded. Generated `total` appears with its real values (the trigger is AFTER). A no-op update writes no row |
| `created_at` | timestamptz | no, default `now()` | |

### `availability_requests`

One availability ask, from one job request to one **LPS Partner**
(`suppliers.is_lps_partner`). Added 2026-08-19 by migration
0062. Created by the app (Job Requests page → selection bar) or by rosie's
per-supplier thread (her `supplier-coordination` skill — since 2026-08-23 she
owns order-side supplier coordination, the portal included; before that the
writer was daisy's retired `availability-requests` skill). Answered by the
supplier in their portal, whose Submit wakes rosie via the `supplier-events`
webhook.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint identity | no | PK. Rendered `AR-<id>` |
| `job_request_id` | bigint → `job_requests.id` ON DELETE CASCADE | no | |
| `supplier_id` | bigint → `suppliers.id` ON DELETE CASCADE | no | |
| `share_customer_details` | boolean | no, default false | Whether the portal shows the supplier who the job is for (customer name/company/contact routes and shipping address). Default is not to |
| `status` | text | no, default `new` | **CHECK**: `new` \| `processing` \| `submitted` \| `closed` (`processing` added 2026-08-26, migration 0075). `new` = waiting on them, and **re-set by trigger whenever a line is added** to a request they had already started; `processing` = they have answered at least one line in their portal since; `submitted` = they pressed **Submit** there; `closed` = we are done with it (an admin act) |
| `submitted_at` | timestamptz | yes | Stamped by the portal's Submit, and left alone by everything else — the portal's button reads **Re-Submit** off it |
| `lps_notes` | text | yes | **LPS's job-level note to the supplier** — delivery window, site constraints, what matters across the lines. Written by rosie at share time; rendered on the portal's request card; never supplier-writable. Added 2026-08-23 (migration 0071) |
| `is_active` | boolean | no, default true | Soft delete |
| `created_at` / `updated_at` | timestamptz | no, default `now()` | `updated_at` by trigger |

### `availability_request_items`

The lines shared with the supplier — one or more of the job request's lines,
**snapshotted at share time**: `name`, `size`, `quantity` are *copied*, not
joined, because what we asked a supplier is evidence — a later edit to the job
request must not silently rewrite the question they are answering.
`mapped_inventory_id` and `unit_price` are seeded the same moment, from that
supplier's own `inventory` row where it answers the line unambiguously; the
other three answer columns are never seeded.

**The mapping and the price it produced are two columns, not one.**
`mapped_inventory_id` is the row our look-up found; `unit_price` is what we
copied off it. Keeping both is what lets a seeded price be traced to its
source, and lets the supplier's answer be read against the row we thought
answered the line — the snapshot rule does not apply to it, because it is a
pointer at live data rather than evidence of what we asked.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint identity | no | PK |
| `availability_request_id` | bigint → `availability_requests.id` ON DELETE CASCADE | no | |
| `job_request_item_id` | bigint → `job_request_items.id` ON DELETE SET NULL | yes | The traceback; SET NULL so a deleted line doesn't take the supplier's answer with it |
| `name` / `size` / `quantity` | text / text / numeric | no / yes / yes | **The ask, snapshotted.** `quantity` CHECK: null or `> 0` |
| `mapped_inventory_id` | uuid → `inventory.id` ON DELETE SET NULL | yes | **The mapped plant** — this supplier's own catalogue row our look-up matched to the line (same plant, same size, unambiguously), and what `unit_price` was seeded from. **NULL is the normal, interesting case**: nothing on their list mapped, which is the line they are most likely to surprise us on. It is outside `AR_ITEM_COLUMNS` and outside `updateARItem()`'s answer whitelist (`{changes: {mapped_inventory_id}}` is still refused) — it is read by `listPortalItemLines()` and written by `setARItemMapping()`, a separate entry point precisely so a mapping cannot ride in on an answer write or the reverse. **Two writers**: rosie's supplier thread at share time, and **the supplier themselves**, in the portal's *By item* view, where dragging a line onto one of their own catalogue rows sets it (the row must belong to their own company, checked through `head_branch_id`). That makes it the one column of ours a supplier can move — it says *which of my rows this ask is about*, never what they are answering. `createAvailabilityRequest()` is not one — the app's dialog still seeds a price without recording the row, so a priced-but-unmapped line is an app-made request rather than a contradiction, and every pre-0077 line is NULL. Not backfilled — a mapping says *this is the row we asked from*, which a later re-run search cannot reconstruct. SET NULL because the catalogue is re-ingested and has twice been reset outright; a partial index covers the non-null rows. Added 2026-08-26 (migration 0077) |
| `status` | text | yes | **The supplier's answer** — CHECK: `available` \| `can_order` (ETA in `notes`) \| `diff_size_qty_sub` (a different size, quantity or plant; what, in `notes`) \| `arriving_soon` (when, in `notes`) \| `unavailable`. `arriving_soon` added and `substitute` renamed `diff_size_qty_sub` on 2026-08-26 (migrations 0075/0076). **NULL = not answered yet** (renders as "Set status", never a guess). The **only** column that says a line was answered — `unit_price` may be ours (below) |
| `available_quantity` | numeric | yes | CHECK: null or `>= 0`. The portal fills it from `quantity` on `available` and clears it on `unavailable`; `diff_size_qty_sub` asks for it |
| `unit_price` | numeric(10,2) | yes | CHECK: null or `> 0` — same never-0 rule as everywhere. **Seeded at share time** from `mapped_inventory_id`'s row, so they confirm or correct a number rather than typing one; ours until `status` is theirs. Seeded *only* where a row mapped, but a mapped row with no price still leaves this NULL |
| `notes` | text | yes | The supplier's note about this line — substitute, ETA, conditions |
| `lps_notes` | text | yes | **LPS's brief note to the supplier about this line** — the substitute and price the inventory data mapped ("Substitute ok: Muskogee Crape Myrtle 30 G @ \$265/unit"), a special request from the customer, or a customer note worth the supplier's eyes. A few words; written at share time; rendered under the plant name in the portal; not in the portal PATCH whitelist, so never supplier-editable. Added 2026-08-23 (migration 0070; semantics broadened + request-level sibling by 0071) |
| `is_active` | boolean | no, default true | Soft delete |
| `created_at` / `updated_at` | timestamptz | no, default `now()` | `updated_at` by trigger |

### `threads`

One row per **(agent, cognisphere thread id)** — the web-chat side of a
harness thread. Added 2026-08-26 (migration 0078), when the webchat plugin's
per-agent JSONL transcripts and `read.json` moved here. **The pair is the
natural key, never the id alone**: `supplier-<slug>` names one conversation
under rosie and a different one under daisy (migration 0068).

Rows come from two writers. The webchat plugin upserts the row for any thread
it records a message on (`link_thread()`); the entity triggers upsert it the
moment a `*_thread_id` text column is written, so every minted id has a row
whether or not anything was ever said on it (~2,700 rows, ~20 with a
transcript). A row with `last_seq IS NULL` has no transcript and is not shown
anywhere.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint identity | no | PK — what the entities' `*_thread_ref` columns point at |
| `agent` | text | no | `rosie` \| `daisy` \| `nova` |
| `thread_id` | text | no | The cognisphere thread id: `main`, `router`, `jr-<id>`, `supplier-<slug>`, `customer-<slug>`, `<parent>-§-[TASK]-§-<slug>`. UNIQUE with `agent` |
| `web_read_id` / `portal_read_id` | integer | no, default 0 | The two read cursors (were `read.json` `web` / `portal`): the newest `seq` the team's panel / the supplier's portal has seen. Moved by the plugin only |
| `pending_since` | timestamptz | yes | The "working…" indicator's plugin half: set when a web message is handed to the agent, NULL on the agent's first reply. The plugin clears every row of its agent on start |
| `last_seq` / `last_at` / `last_role` / `last_sender` / `last_text` | — | yes | **Preview of the newest message**, maintained by the `thread_messages_preview` trigger (`last_text` is the first 120 chars). What the app's bell reads — one Realtime event per message, no transcript query |
| `closed_at` | timestamptz | yes | **Closed with its job request** (migration 0080): set by `job_requests_close_thread` when the job goes `closed_won` / `closed_lost` / `archived` or inactive, cleared when it reopens. The transcript stays; the thread leaves the picker and the bell. Only job threads close |
| `created_at` / `updated_at` | timestamptz | no, default `now()` | `updated_at` by trigger |

### `thread_messages`

The transcript — one row per web-chat message, exactly the JSONL row shape
the plugin used to append. Added 2026-08-26 (migration 0078). Written by the
webchat plugin only; the app never inserts here (a browser send goes through
the plugin, because that is what wakes the agent).

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint identity | no | PK |
| `thread_id` | bigint → `threads.id` ON DELETE CASCADE | no | |
| `seq` | integer | no | The per-thread message id the plugin allocates (the panel's `id`). UNIQUE with `thread_id`; restarts at 1 on a reset |
| `role` | text | no | **CHECK**: `user` \| `agent` |
| `text` | text | no, default `''` | Markdown |
| `files` | jsonb | no, default `[]` | `[{name,label,mime,size,dir}]` — the **bytes stay on the agent's disk** (`plugins/webchat/inbox/`, `state/outbox/`), served by the plugin |
| `sender_name` | text | yes | Portal messages carry the supplier's name; panel messages get theirs from the session |
| `portal` | boolean | no, default false | Portal-visible: what the supplier typed, or a `--portal` reply. The portal is served ONLY these rows |
| `created_at` | timestamptz | no, default `now()` | The message's own timestamp (the JSONL `at`) |

Both tables are in the `supabase_realtime` publication: the app server holds
one subscription on `threads` and relays changes to browsers over SSE
(`docs/app/README.md`, *Agent chat*).

### `supplier_messages` — removed

The broker↔supplier chat transcript (added 2026-08-19 by migrations 0062/0063)
was **dropped 2026-08-23 by migration 0066**, together with the app's
Conversation tab and portal chat — supplier exchanges are recorded by the
agents (daisy's `supplier-communications` skill) rather than in a table. The
213 rows live on in `supplier_messages_backup_20260823`;
`suppliers.communication_notes` remains the frozen pre-0063 archive.

---

## Views

### `inventory_enriched` — removed

Dropped 2026-08-15 by migration 0050, together with the `plant_alias_names()`
function behind it. Its one contribution over `inventory` was the derived
`other_names` column (**Also known as**), which was NULL for 90% of active rows
(28,444 of 31,560) and could not be indexed — `plant_alias_names()` is `STABLE`
and reads a second table, so an `ilike` on it meant evaluating the function for
every candidate row.

**Read `inventory` directly.** Every other column the view carried was a
passthrough, so callers move over with no projection change, and PostgREST
embedding (`select=*,suppliers(name,city,state)`) works the same on the table.

### `rate_charts`

Backwards-compatibility view: a plain `SELECT` of the pre-rename `inventory`
columns (no `name_key`; no `category`/`variety` either, since those columns are
gone). `inventory` used to be called `rate_charts`. **Do not build anything new
on it** — nothing reads it, and it is a candidate for removal.

---

## Functions

### Normalization

| Function | Returns | Purpose |
|---|---|---|
| `normalize_search_text(text)` | text | Search tokenization: lowercase, punctuation → spaces, split letter↔digit boundaries ("1G" → "1 g"). The pgroonga document/query normalizer — the concatenation in `search_inventory` must stay byte-identical to the two `inventory_search_*_idx` expressions or the indexes are skipped |
| `normalize_plant_key(text)` | text | Identity key for plant names: lowercase **letters only** ("Live-Oak 2" → "liveoak"). Backs the generated `*_key` columns |
| `normalize_identity_token_key(text)` | text | Legacy 0057 identity signature: normalized tokens sorted and joined. Retained for compatibility after 0081 replaced that exact-identity branch; current quoted search does not call it |
| `compose_plant_name(text, text, text)` | text | The SOP name format: the non-empty parts joined by ` - `, in the order common, botanical, cultivar; NULL when all three are empty. What `trg_inventory_derive_identity` writes into `inventory.name` — and, since 0051, `plant_photos.name` too |
| `plant_photo_document(name, size, caption, tags, notes)` | text | The searchable text of a photo, IMMUTABLE. **The single definition** behind both `plant_photos_search_*` indexes and `search_plant_photos` — which is why the photo side cannot drift the way the inventory side can, where the same concatenation is repeated in five places |
| `normalize_size(text)` | text | Size-string normalizer — canonicalizes units/spacing/leading zeros (`"1G"` → `"1 G"`, `"024 Inch Box"` → `"24\" Box"`). **Nothing calls it automatically** (no trigger, no default): ingestion applies it, and migration 0019 applied it to the 38,090 legacy rows that had drifted |

### Search RPCs

```
search_inventory(search text = '', fuzzy_ratio real = 0.34)
```
**Two parameters, and neither is a filter.** Filtering, supplier scoping and
sorting are the caller's job, applied as SQL over the result. The function
answers one question: which rows answer this query, and how well.

**One outer pair of straight double quotes selects literal substring mode**
(migration 0081): `"Italian Cypress"` matches those characters together and in
that order, case-insensitively, in `name`, `common_name`, `botanical_name`, or
`cultivar_variety_trade_name`. Size and notes do not qualify a row in quoted
mode. It does not normalize punctuation/internal whitespace, expand aliases,
split tokens, accept partial spellings, or run fuzzy matching. `%`, `_`, and
`\\` are escaped before `ILIKE`
and therefore remain literal; apostrophes and inner `"` characters are ordinary
data because the RPC never interpolates the term into SQL. All matches receive
`relevance = 1` and tie-break on `updated_at DESC, name ASC`.

The outer quotes must wrap the entire trimmed query. Whitespace at the query and
inner-phrase edges is trimmed; internal whitespace is preserved. Empty or
whitespace-only quoted input returns zero rows. A missing opening or closing
quote remains on the unchanged broad path. With a complete outer pair, any
additional quote is part of the literal inner phrase (`"""` searches for one
`"`).

**Unquoted input is unchanged broad discovery.** It executes the 0050
IDF-weighted partial/fuzzy body and intentionally keeps related tail matches.

Returns the inventory columns — including `common_name`, `botanical_name`,
`cultivar_variety_trade_name`, `cultivar_keys` and `internal_notes` — plus
`source`, `supplier_name`, `supplier_category`, `supplier_state`,
`supplier_city`, `size_std`, `height_std`, `width_std`, `caliper_std`, and
**`relevance`**. 30 columns (`other_names` left with migration 0050).

**The projection is the filter surface.** PostgREST applies `.eq()` / `.in()` /
`.gte()` / `.overlaps()` in an outer query, *before* its own `range()`, so a
filtered page and its `count` describe the same set.

#### What unquoted discovery matches

The broad-mode **document is `name + size + notes`**, normalized. The three name parts are
inside `name`, which is composed from them. Height, width and caliper are
deliberately *not* in it — they are filter columns, not search text.

Two pgroonga indexes over that identical expression, because one cannot do both
jobs, each targeted explicitly via `pgroonga_condition(..., index_name => …)`:

| Index | Tokenizer | Job |
|---|---|---|
| `inventory_search_ngram_idx` | `TokenBigramSplitSymbolAlphaDigit` | exact **and substring** — `sycamor` *and* `ycamor` both find `sycamore` |
| `inventory_search_word_idx` | `TokenDelimit` | gives fuzzy a whole-word lexicon for edit distance |

Both are needed. **Fuzzy is useless on a bigram lexicon** — measured, the
substitution typo `mvskogee` returns 0 rows through the ngram index and 188
through the word index. Substring alone only catches truncations, never a
substitution or a transposition.

#### How it ranks

1. The query is normalized and partitioned into **groups**, longest span first
   (≤ 6 words), so `live oak` is one concept rather than two words. A span
   shaped like a **size** becomes one *phrase* group — see below.
2. A span that names an alias carries the other side of every edge it touches as
   an **alternative**. A group matches if any alternative does, and contributes
   its weight **once** — an alias can never double-count.
3. Per group, `df` is how many active rows match it, and
   `idf = ln(1 + (N − df + 0.5) / (df + 0.5))`.
4. Retrieval is every group OR'd — one scan per index, ~17 ms.
5. `relevance = Σ idf(g)` over the groups a row matched — **coverage weighted by
   rarity**. Per-row matching is cheap string work: substring (covering exact,
   prefix and suffix) or `word_similarity >= 0.6` (covering typos).

Term frequency is deliberately **binary** — BM25 with k1 → 0. Repetition in a
plant name carries no information: a row whose notes say "maple" five times is
not a better answer than one named "Maple". That is also why there is no
`avgdl` and no length normalization to keep fresh.

**A typed size ranks, it does not filter.** `15g` normalizes to the two tokens
`15` and `g`, which are near-useless on their own — `g` is in 63% of active rows
and `15` matches any 15 anywhere, so `15g Live Oak` once returned 42,099 rows
with 5 G, 45 G and 200 G all tied against 15 G. A size span is therefore taken
as a single phrase group (`"15 g"`, df 5,220 rather than 11,722), which carries
a real weight. Phrase groups match on a **token boundary** and skip the fuzzy
path — a typo in a number is meaningless — so ` 15 g ` accepts `15 G` and
`15 G/17"` and rejects `115 G` and `150 G`. Their alternatives are the spellings
a *document* can hold, not the ones a user types: the only gallon spelling in
the corpus is `g` and `24" Box` normalizes to `24 box`, so a gallon span expands
to `N g`/`N gal`/`N gallon`/`N gallons` and a box span to
`N box`/`N inch box`/`N in box`. `15g Live Oak` now returns 6,935 rows, every
top row a 15 G live oak, with the 1,728 other sizes kept and ranked below.

Worked example, `crape myrtle muskogee` (`crape myrtle` is one group because an
alias names it):

| relevance | rows | matched | example |
|---|---|---|---|
| 10.38 | 178 | both groups | `Crape Myrtle - 'Muskogee'` |
| 5.82 | 10 | the rare group only | `CrapeM Muskogee` — a typo'd source row |
| 4.55 | 567 | the generic group only | `Catawba Crape Myrtle` |

> ### ⚠ Result sets are large, and that is the design
>
> Retrieval is OR, so every generic Crape Myrtle appears — ranked last.
> `Crape Myrtle Muskogee` returns **755** rows where the previous gated version
> returned 116, and `Live Oak` returns **1,792** against 302. The first page is
> better and the tail is longer. If the old tightness is wanted back, the
> principled form is a floor on `relevance` — require the highest-IDF group to
> match — not a reinstated gate.
>
> An **empty search now returns zero rows immediately** rather than walking the
> catalogue, so the old "never call it with an empty search" footgun is gone.
> Listing is still `inventory`'s job — the app's browse path reads the table
> directly, filtered, counted and paginated in SQL.

```
search_suppliers(search text = '', category_filter text = null, fuzzy_ratio real = 0.34,
                 sort_column text = null, sort_direction text = null)
```
Same pgroonga matching (including the trailing-word prefix match) over name /
address / notes, and the same ordering rule. Returns active suppliers. It no
longer returns `phone` or `email` — those columns are gone; the equivalents are
`primary_contact_phone` / `primary_contact_email` below.

It returns the three availability columns as of migration 0018, and
`is_lps_partner` as of 0074 — the function has a fixed return type, so **any new
`suppliers` column has to be added here before the app can read it through
search.** `is_lps_partner` is projected so the Supplier Search page can filter
on it over the whole match set rather than over the page it happens to hold; it
is not in the `sort_column` whitelist.

Its returned columns include `primary_contact_name`, `primary_contact_email` and
`primary_contact_phone`, resolved by a `LEFT JOIN LATERAL` over
`supplier_contacts` joined to `contacts` (both active, `sc.is_primary desc,
c.id asc` — so a supplier with contacts but no flagged primary still reports its
oldest one). These replaced the `poc_*` columns on 2026-08-05; 0034 moved the
join onto the link table.

It does **not** return `head_branch_id` — the return type is fixed, so a
multi-location column would have to be added here before search could carry it.

A supplier also matches **through its contacts**: contact name / email / phone /
title text is searched separately and folded in as a `supplier_id` list, the
same way the trigram fallback is. Since 0034 that list comes from the links, so
a contact who covers four farms lights up all four. That keeps `suppliers_pgroonga_idx` usable for
the main branch — an index expression cannot read another table, so contact text
can never live in the suppliers document. Contact-only matches score 0 and
therefore sort after direct matches.

**This branch is now the only way to find a supplier by email or phone**, since
0016 moved both off `suppliers`. It works — searching a full address returns its
supplier — but it scores 0, so an email search ranks below any name match.

**`sort_column` is whitelisted inside `search_suppliers`; anything else is
ignored.** `search_inventory` no longer takes one — sorting is applied over its
result by the caller (0045).

- `search_suppliers`: `name`, `category`, `primary_contact_name`,
  `primary_contact_email`, `primary_contact_phone`,
  `website`, `address`, `city`, `state`, `zip`, `notes`,
  `availability_source_type`, `availability_update_days`,
  `hosted_availability_url`, `created_at`, `updated_at`.

```
search_plant_photos(search text = '', fuzzy_ratio real = 0.34)
```
The **unquoted discovery algorithm** used by `search_inventory`, over the photo
catalogue, added 2026-08-16 by migration 0051. Two parameters, neither a filter;
supplier scoping, size/tag filtering and sorting are applied as SQL over the
result. Query groups, alias expansion, size-as-a-phrase-group and
`relevance = Σ idf` behave as described above. Migration 0081 changes only
`search_inventory`: `search_plant_photos` has no literal quoted-mode contract.

Returns the `plant_photos` columns plus `supplier_name`, `supplier_category`,
`supplier_city`, `supplier_state` and `relevance` — 33 columns (`name_key`
joined the projection with migration 0052). **The projection is the filter
surface**, and the return type is fixed, so a new column has to be added here
before PostgREST can read or filter on it.

Two things differ from `search_inventory`, both deliberate:

- **The document is `name + size + caption + tags + notes`**, via
  `plant_photo_document()`. Dimensions are out of it — filter columns, not
  search text — as on `inventory`.
- **Suppliers join `LEFT`**, because a photo's supplier is optional. An inner
  join would hide every unattributed photo. `supplier_name` is therefore null
  on those rows rather than the row being absent.

An empty search returns zero rows, as with `search_inventory`. Listing is the
table's job — the app's `/photos` grid reads `plant_photos` directly when there
is no query, which is the normal way to browse a photo catalogue.

### Other

`execute_readonly_query(query text) → jsonb` — generic read-only query helper.

```
plant_photo_reclaimable(older_than_days int = 30)
```
Objects in the `plant-photos` bucket that **no active catalogue row points at**,
older than the grace period — added 2026-08-16 by migration 0054. Returns
`object_name`, `reason` (`retired` for a soft-deleted photo's tombstoned object,
`orphan` for one with no row at all), `age_days`, `byte_size`, `photo_id` and
`photo_name`.

**An object belonging to an active photo can never be returned**, which is the
one property the function exists to guarantee — the sweep asks the database
rather than diffing two lists in a script. `SECURITY DEFINER` with a locked
`search_path`, because `storage.objects` is not reachable through PostgREST
otherwise, and granted to **`service_role` only**: `authenticated` has no reason
to enumerate bucket contents. Read by
`skills/agent/plant-photo-catalogue/scripts/reclaim-orphans`, which is dry-run
by default.

**`log_job_request_changes()`** (0055) — the trigger function behind
`job_request_changelog`; see that table and §Triggers. Not called directly.

---

## Triggers

| Trigger | Table | When | Does |
|---|---|---|---|
| `trg_cascade_supplier_deactivation` | suppliers | AFTER UPDATE OF `is_active`, true→false | Deactivates the supplier's `inventory` rows, `inventory_sources` and `supplier_contacts` links — plus any contact left with no active link at all |
| `trg_cascade_source_deactivation` | inventory_sources | AFTER UPDATE OF `is_active`, true→false | Deactivates every active `inventory` row whose `source_id` is that file. One way: reactivating the source does not restore them |
| `trg_inventory_derive_identity` | inventory | BEFORE INSERT OR UPDATE | Trims the three name parts, composes `name` from them, derives `common_name_key` / `botanical_name_key` and the `cultivar_keys` array |
| `trg_plant_photos_derive_identity` | plant_photos | BEFORE INSERT OR UPDATE | The same derivation as above, plus folding `tags` to trimmed lowercase, deduped and sorted |
| `trg_dedupe_plant_aliases` | plant_aliases | BEFORE INSERT | Skips normalized duplicates **in either orientation**, self-pairs, empty keys |
| `set_head_branch` | suppliers | BEFORE INSERT OR UPDATE OF `head_branch_id` | Defaults `head_branch_id` to the row's own id, and rejects a value that would chain — pointing at a branch, or demoting a head that still has locations |
| `trg_job_requests_changelog` / `trg_job_request_items_changelog` | job_requests, job_request_items | AFTER INSERT OR UPDATE | One function, `log_job_request_changes()`: writes the audit entry into `job_request_changelog` (full non-null row on insert, old/new diff on update, no-op updates skipped) |
| `availability_request_items_reopen` | availability_request_items | AFTER INSERT | `availability_request_reopen_on_new_line()`: puts the parent request back to `new` when it was `processing` or `submitted`. Adding a line to a request the supplier already worked on is a new question, and it must reach their portal's New tab whoever added it — the app or an agent script. `closed` is left alone; `submitted_at` is untouched, so the portal's button still reads *Re-Submit*. Added 2026-08-26 (migration 0075) |
| `handle_updated_at` | suppliers, supplier_contacts, inventory, contacts, plant_aliases, plant_photos, users, chat_sessions, availability_queries, customers, job_requests, job_request_items, availability_requests, availability_request_items, threads | BEFORE UPDATE | Stamps `updated_at` (`moddatetime`). Deliberately not on `thread_messages` — messages are append-only and never updated |
| `suppliers_link_threads` / `customers_link_threads` / `job_requests_link_threads` | suppliers, customers, job_requests | BEFORE INSERT (OR UPDATE OF the `*_thread_id` columns) | `link_thread(agent, id)`: upserts the `threads` row for the text id and sets the derived `*_thread_ref` FK. Job requests link `jr-<id>` on insert. Migration 0078 |
| `job_requests_drop_thread` | job_requests | AFTER DELETE | Deletes the job's `threads` row (transcript cascades). Migration 0079 |
| `job_requests_close_thread` | job_requests | AFTER INSERT OR UPDATE OF `status`, `is_active` | Sets `threads.closed_at` when the job is `closed_won` / `closed_lost` / `archived` or inactive; clears it otherwise. Migration 0080 |
| `thread_messages_preview` | thread_messages | AFTER INSERT | Copies the row into the thread's `last_*` preview columns (forward only) |

## Indexes that matter

- `inventory_search_ngram_idx` — pgroonga, `TokenBigramSplitSymbolAlphaDigit`,
  over `normalize_search_text(name || size || notes)`. Exact and **substring**
  matching. **Must match `search_inventory`'s concatenation exactly.**
- `inventory_search_word_idx` — pgroonga, `TokenDelimit`, over the **identical**
  expression. Exists solely to give fuzzy a whole-word lexicon; the two are told
  apart with `pgroonga_condition(..., index_name => …)`.
  (`inventory_pgroonga_idx` and `inventory_trgm_idx` were dropped by 0046 —
  superseded, and their document included the dimension columns.)
- `inventory_supplier_height_std_idx`, `inventory_supplier_width_std_idx`,
  `inventory_supplier_caliper_std_idx` — partial btrees on
  `(supplier_id, *_std)` for active, non-null rows; support supplier-page range
  filtering without adding numeric values to the text-search document.
- `inventory_supplier_size_std_idx` — the same shape for `size_std`, backing the
  app's size facet. `size_std` is deliberately **not** in the pgroonga document:
  the raw `size` already carries every spelling a search could type.
- `plant_aliases_name_key_idx` / `plant_aliases_other_key_idx` — btrees used to
  find the opposite endpoint when a normalized query span names an alias. Query
  expansion filters `is_active` and nothing else. The older
  `plant_aliases_pgroonga_idx` remains present but the current 0046 search body
  resolves normalized endpoint keys rather than querying that expression.
- `inventory_common_name_key_idx`, `inventory_botanical_name_key_idx` — partial
  btrees on the two scalar part keys where they are non-null, and
  `inventory_cultivar_keys_idx`, a GIN index over the `cultivar_keys` array.
  They support identity-key review and direct lookups; since 0045 they do not
  constrain alias-expanded search. The parts are deliberately **not** in the
  pgroonga search document separately: derived `name` already composes all
  three.
- `suppliers_pgroonga_idx` — pgroonga over the supplier document (name, address,
  city, state, zip, category, notes). **Must match the concatenation in
  `search_suppliers` exactly.** Every contact field it used to carry —
  `poc_name`, then `email` and `phone` — has moved to the contacts index below.
- `contacts_pgroonga_idx` — pgroonga over
  `normalize_search_text(name || email || phone || title_department)`. Backs
  `search_suppliers`'s contact branch, and must stay byte-identical to it.
- `supplier_contacts_one_primary_idx` — partial unique on `(supplier_id) WHERE
  is_primary AND is_active`. Demote before you promote. (Was
  `contacts_one_primary_idx` until 0034.)
- `supplier_contacts(supplier_id, is_active)` — a location's contacts;
  `supplier_contacts(contact_id, is_active)` — a contact's locations, which is
  the direction the profile's "also covers" line reads.
- `suppliers(head_branch_id)` — a company's locations.
- Btree on the stored keys: `inventory(name_key)`, `plant_aliases(name_key)`,
  `(other_name_key)`, unique `(name_key, other_name_key)`. These exist because
  computing the key per-comparison made alias resolution time out (21s → 119ms).
  If you add a key column, `ANALYZE` afterward or the planner reverts to seq scans.
- `inventory(source_id)`, `inventory(supplier_id, is_active)`,
  `inventory_sources(supplier_id)`.
- `plant_photos_search_ngram_idx` / `plant_photos_search_word_idx` — the same
  pgroonga pair, over `normalize_search_text(plant_photo_document(…))`. Because
  both the indexes and `search_plant_photos` call that one IMMUTABLE function,
  the byte-identical-expression trap the `inventory_search_*` pair lives with
  cannot arise here. **Change the function and both indexes must be rebuilt.**
- `plant_photos_object_idx` — unique `(storage_bucket, storage_path)`: one
  catalogue row per object. `plant_photos_sha256_idx` — unique on `sha256`
  where non-null: one row per distinct file. `plant_photos_name_key_idx` — the
  same shape as `inventory_name_key_idx`, for joining the two on identity.
- `plant_photos_supplier_idx`, `plant_photos_active_created_idx` (backs the
  no-query grid), `plant_photos_size_std_idx`, and GIN on `cultivar_keys` and
  `tags` for the app's tag filter.
- The job-request set (0055): `customers_active_created_idx (is_active,
  created_at DESC)` and partial `customers_email_idx` (the intake find-by-email
  path); `job_requests_customer_idx (customer_id, is_active)`; partial
  `job_requests_status_idx` / `job_request_items_status_idx` (active rows);
  `job_request_items_request_idx (job_request_id, is_active)`;
  `job_request_changelog_request_idx (job_request_id, created_at DESC)` and
  partial `job_request_changelog_item_idx` backing the last-5-entries fetch.

## Extensions

`pgroonga`, `pg_trgm`, `moddatetime`, `pgcrypto`, `uuid-ossp`,
`pg_stat_statements`, `supabase_vault`, `plpgsql`.

---

## Security: RLS is ON for every table

Enabled 2026-08-05 by `harness/agents/daisy/migrations/0011_enable_rls.sql`.
Before that, RLS was disabled on the five tables marked below and the `anon`
key was a full read-write handle on the whole database, `users` (which stores
Gmail OAuth tokens) included.

| Table | RLS | Policy |
|---|---|---|
| `suppliers` | enabled | `authenticated` full access |
| `inventory` | enabled | `authenticated` full access |
| `availability_queries` | enabled | `authenticated` full access (added 2026-08-05) |
| `chat_sessions` | enabled | Per-user via `auth.uid()` |
| `users` | enabled | Per-user via `auth.uid()` |
| `inventory_sources` | enabled | `authenticated` full access |
| `plant_aliases` | enabled | `authenticated` full access (replaced `plant_other_names` 2026-08-14) |
| `threads` / `thread_messages` | enabled | **No policies** — secret-key callers only (the webchat plugin, the app server). Added 2026-08-26 (migration 0078) |
| `plant_photos` | enabled | `authenticated` full access (added 2026-08-16, migration 0051) |
| `contacts` | enabled | `authenticated` full access |
| `supplier_contacts` | enabled | `authenticated` full access (added 2026-08-14) |
| `custom_commands` | enabled | Per-user via `auth.uid()` |
| `user_memories` | enabled | Per-user via `auth.uid()` |
| `customers` | enabled | `authenticated` full access (added 2026-08-17, migration 0055) |
| `job_requests` | enabled | `authenticated` full access (added 2026-08-17, migration 0055) |
| `job_request_items` | enabled | `authenticated` full access (added 2026-08-17, migration 0055) |
| `job_request_changelog` | enabled | `authenticated` full access (added 2026-08-17, migration 0055). Its real write-protection is that only the trigger writes it in practice |
| `availability_requests` | enabled | `authenticated` full access (added 2026-08-19, migration 0062) |
| `availability_request_items` | enabled | `authenticated` full access (added 2026-08-19, migration 0062) |

**`anon` now reaches no application table at all** — verified against the live
REST API, every table and both views return `[]`.

Who bypasses RLS, and why nothing broke:

- **Agents** connect via `scripts/agent/supabase/query` as the `postgres` role,
  which holds `BYPASSRLS`. They see and write everything, exactly as before.
- **This app** queries server-side with the secret key (`service_role`, also
  `BYPASSRLS`). Unchanged — see `app/lib/supabase.ts`.
- **`authenticated`** (the old `lps-rosie` app's logged-in users) keeps full
  access to the catalogue and per-user access to its own chat/user rows.

> ### Views must stay `security_invoker`
>
> `rate_charts` is owned by `postgres`, which has `BYPASSRLS`. A Postgres view
> runs with its **owner's** rights unless it is declared
> `security_invoker = true`, so with the default setting it would have handed
> `anon` the entire catalogue straight back and enabling RLS on `inventory`
> would have achieved nothing. The migration sets the flag. **Any view recreated
> over these tables must set it too** — `CREATE OR REPLACE VIEW` does not carry
> the option over on its own. (`inventory_enriched` was the other view this
> applied to until migration 0050 removed it.)

Enabling RLS did **not** loosen the rule about browser keys: the app still
queries only from server components and gates every page behind the harness
session (`app/proxy.ts`). Do not add a `NEXT_PUBLIC_` Supabase key.

---

## Storage buckets

- `lps` — **public.** Supplier price-list source files and the older plant
  photos. Rate-card files go under `suppliers/<slug>/rate-cards/<file>`
  (`<slug>` = kebab-cased supplier name). Store the **object key** (no scheme)
  in `inventory_sources.file_path`; a full URL is also accepted there.
  Agent-shared files go under `daisy_shared/YYYY-MM-DD/<filename>` (rosie's
  under `rosie_shared/YYYY-MM-DD/<filename>`).
- `chat-attachments` — **public.** App chat uploads.
- `plant-photos` — **private**, added 2026-08-16 with migration 0051. The photo
  catalogue's bytes, keyed by `plant_photos.storage_path`. Since migration 0053
  it accepts **`image/webp` only, up to 8 MB**: everything written to it is a
  normalised copy (see `plant_photos` above), so the narrow type list is what
  enforces the pipeline — uploading a source file fails with `InvalidMimeType`.
  The 8 MB ceiling is a backstop, not a target; a 2048px WebP is under 1 MB.
  The objects predating 0053 are JPEGs and stay readable — the limits gate
  uploads only, and they are deliberately not backfilled. **No storage policy
  exists**, so only the secret key and `postgres` reach the objects at all.
  Nothing reclaims an object automatically when its photo is retired; see
  `plant_photo_reclaimable()` above and the skill's sweep.

> Because `lps` and `chat-attachments` are public, treat anything uploaded to
> them as world-readable. Pre-signed URLs still work there and remain the
> convention for sharing files with users, but they are a courtesy, not an
> access control.
>
> `plant-photos` is the exception, and signing is load-bearing rather than
> polite. The app serves every image through `/api/photos/<id>/image`, which
> takes a **photo id** and reads the path from the row — a client never supplies
> a storage path, so the endpoint cannot be turned into a signing oracle for the
> bucket. Agents use `scripts/agent/supabase/sign-url`.

---

## Context tables (agents: read, don't write)

- `availability_queries` — customer demand queries: `supplier_id`,
  `availability_data` jsonb, `friendly_id` (unique), `submitted`, `is_processed`,
  `is_bulk`, `chat_session_id`.
- `chat_sessions` — `session_type` CHECK (`customer` | `admin`), `status` CHECK
  (`active` | `quote_delivered` | `confirmed` | `closed_won` | `closed_lost` |
  `archived`), `messages` jsonb, `metadata` jsonb.
- `users` — `type` CHECK (`user` | `customer` | `supplier`),
  `default_communication_channel` CHECK (`email` | `phone` | `whatsapp`),
  `gmail_access_level` CHECK (`full` | `limited`), unique `email`,
  `auth_id` → `auth.users(id)`. Holds Gmail OAuth tokens — never select these
  columns into a log or a message.
- `user_memories` (1:1 with users), `custom_commands`.

---

## Conventions recap

- Sizes: `"15 G"`, `"6'"`, `"24\""`, `"3' cal"`, `"24\" box"`; `#` = gallons
  (but a box is inches). Run values through `normalize_size()`; keep height,
  caliper, form codes and pack counts out of `size`. Write `size_std` alongside
  it — `<N>G`, `<N>" Box`, a word grade, or `other`; never both a size and a
  measurement in `size`.
- Plant identity: write `common_name`, `botanical_name` and
  `cultivar_variety_trade_name`, each holding **only what the source printed**;
  `name` is composed from them by trigger and is never written by hand, nor is
  any `*_key`. `plant_aliases` holds equivalences, typed: `plant` for two names
  of the same plant, `cultivar` for two names of the same selection. Get the
  type right — it is what keeps a selection's name off generic rows.
- `file_path`: object key or full URL; anything without `http(s)://` is a key in
  the `lps` bucket.
- Never write generated `*_key` columns.
- A **photo** is a reference record, not an availability record. Its supplier,
  size and dimensions are written only when a source stated them — size is never
  inferred from apparent scale — and a conflict between two sources is preserved
  in `notes`, never reconciled. Retiring a supplier or an inventory row does not
  retire a photo.
- `suppliers.notes` = facts about the supplier; `suppliers.communication_notes`
  = an append-only log of contact with them. Never append contact history to
  `notes`, and never overwrite `communication_notes`.
- Every contact route goes in `contacts` — people and inboxes alike, one row
  each — and a `supplier_contacts` link per location they cover, at most one
  active `is_primary` per location. `suppliers` carries no email or phone.
  `contacts.notes` describes the contact; what was said to them is still an
  entry in `suppliers.communication_notes`.
- A multi-location company is one `suppliers` row per site, tied together by
  `head_branch_id` (a head branch points at itself). Availability naming no
  location goes to **every** location of that company; availability naming one
  goes to that row alone.
- Never infer a person's name from an email address. `contacts.name` is
  nullable precisely so you don't have to (and `customers.name` waits for a
  real name rather than a guess).
- Per-supplier quirks live in **`suppliers.notes`** (edited in place; the old
  `workspace/suppliers/` dirs are read-only legacy since 2026-08-23), and
  per-customer quirks in **`customers.notes`** the same way.
- The job-request tables carry **three notes columns each**: `customer_notes`
  (the customer's words, verbatim, never edited), `internal_notes` (ours,
  append-only, timestamped — on an item it is the sourcing log), and
  `external_notes` (written to be shown to the customer — a quantity change or
  substitution is explained there in the same change). Supplier names and
  supplier pricing never go in a customer-visible field.
- **`customer_notes` is the remainder, not a transcript.** Whatever a structured
  column already holds — plant, size, quantity, address, identity — lives there
  and only there; the note carries what has nowhere else to go. A note that
  restates a column is a sign the column was filled wrong.
- **An item's status is where the line stands, not what is being done about
  it.** Since migration 0058 there are four: `pending`, `available`,
  `alternative_proposed`, `unavailable`. Progress — who was asked, what came
  back — is `internal_notes`, which says more than a status word could.
- A line item carries **two quantities**: `quantity` is the customer's demand and
  `available_quantity` is what we can supply. "Partial" is not a status — it is
  `available_quantity < quantity`, derived where it is displayed so a stored word
  can never contradict the figures beside it.
- Never write `job_request_items.total` (generated) and never insert into
  `job_request_changelog` (trigger-written). A writer that wants the changelog
  to name it opens its session with `SET app.actor TO '<name>'`.
- **Job requests are hard-deleted, not retired.** The app's `/requests` page
  issues a real `DELETE` on `job_requests` and `job_request_items` rather than
  clearing `is_active`, because an availability request is read in the supplier
  portal by supplier id and would outlive a merely retired job. The FKs above do
  the rest: lines, changelog entries and availability requests (with their items)
  cascade from the request; a deleted **line** cascades only its changelog,
  since `availability_request_items.job_request_item_id` is ON DELETE SET NULL
  so the supplier's answer survives without it. `log_job_request_changes()`
  fires on INSERT/UPDATE only, so a delete leaves no entry — and would have
  nothing to leave it on.
