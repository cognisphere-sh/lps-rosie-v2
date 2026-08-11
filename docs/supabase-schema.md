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

Last verified against the live database on 2026-08-05 by direct catalog
introspection. **If you find a discrepancy, fix this file in the same change.**

Applied migrations live in `harness/agents/daisy/migrations/`.

---

## Shape

```
suppliers 1 ──< inventory_sources 1 ──< inventory >── plant_other_names (by name_key, no FK)
          1 ─────────────────────────< inventory
          1 ─────────────────────────< contacts
          1 ─────────────────────────< availability_queries

users 1 ──< chat_sessions 1 ──< availability_queries
      1 ──< user_memories (1:1)
      1 ──< custom_commands
```

Row counts at last verification (2026-08-05): `suppliers` 1,382 (1,376 active),
`inventory` 210,270 (**69,042 active**), `inventory_sources` 1,984 (757 active),
`plant_other_names` 13,487 (13,477 active), `availability_queries` 123,
`users` 2, `contacts` 1,789 (1,780 active) across 1,378 suppliers — 47 backfilled
from the retired `poc_*` columns on 2026-08-05, 29
lifted out of `suppliers.notes`, and the rest moved from `suppliers.email` /
`suppliers.phone` when those columns were dropped the same day.

### Two conventions that apply everywhere

- **Soft deletes.** Rows are flipped `is_active = false`, not deleted. Only
  active rows are searched or shown.
- **Generated key columns.** `name_key` / `other_name_key` are
  `GENERATED ... STORED` from `normalize_plant_key()`. Never write them, and
  never match plant names with `=` on raw text — compare the key columns.

---

## Core tables

### `suppliers`

One row per nursery / grower / wholesaler.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint identity | no | PK |
| `name` | text | no | Display name, e.g. "Acosta Farms Nursery, Inc" |
| `category` | text | yes | **CHECK**: `Wholesaler` \| `Grower` \| `Nursery` \| `Other` |
| `address` / `city` / `state` / `zip` | text | yes | Free-text US address parts |
| `website` | text | yes | Usually a bare domain (`acostafarms.com`) — prepend `https://` when linking |
| `latitude` / `longitude` | double precision | yes | Google Maps link: `google.com/maps?q=lat,lng` |
| `notes` | text | yes | **Durable profile facts** — see below |
| `communication_notes` | text | yes | **Append-only contact log** — see below |
| `availability_source_type` | text | yes | **CHECK**: `Email` \| `Hosted` — how the availability list reaches us. Null = not established yet |
| `availability_update_days` | integer | yes | **CHECK**: `> 0`. How often the supplier refreshes it, in days (7 = weekly). Null = unknown |
| `hosted_availability_url` | text | yes | The page a hosted list lives on. Bare domains occur — prepend `https://` when linking |
| `is_active` | boolean | no, default true | Soft delete; deactivation cascades (see triggers) |
| `created_at` / `updated_at` | timestamptz | yes, default `now()` | `updated_at` maintained by trigger |

#### `notes` vs `communication_notes` — don't mix them

These two are easy to confuse and the distinction is the whole point of having
both. Putting contact history in `notes` buries the quirks; rewriting `notes`
loses the history.

| | `notes` | `communication_notes` |
|---|---|---|
| Holds | What is **true about** the supplier | What was **said to** the supplier |
| Examples | "Won't quote under 10 units", "prices exclude freight", "sends XLSX with two header rows", "closed Fridays" | "Emailed asking for the July availability list" |
| Shape | Free prose, **edited in place** as facts change | **Append-only**, newest entry last, never rewrite past entries |
| Use it for | Anything that has no dedicated column and stays true across conversations | One entry per contact, every time |

**Every entry in `communication_notes` starts with a timestamp and records the
channel, what was sent/received, why, and the identifier needed to find the
conversation again** (Gmail thread id, harness ThreadId, phone number). Format:

```
[2026-07-27 14:32 America/Chicago] email · gmailThreadId=19f378a886691d3c
Asked for the July availability list — their last one is 3 weeks old and the
15G Live Oak price looked stale against the June sheet. Awaiting reply.
```

Append with a read-modify-write; there is no `array_append` here, it is plain
text:

```sql
UPDATE suppliers
SET communication_notes = coalesce(communication_notes || E'\n\n', '') || $1
WHERE id = $2;
```

Live category distribution: Grower 569, Nursery 185, Other 151, Wholesaler 1,
NULL 3.

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

### `contacts`

One row per person at a supplier — the sales rep, the availability desk, whoever
answers. Replaced `suppliers.poc_*`, which could only hold one.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint identity | no | PK |
| `supplier_id` | bigint → `suppliers.id` ON DELETE CASCADE | no | Owning supplier |
| `name` | text | yes | **Usually null, and that is correct.** Most rows are an inbox nobody named. Don't invent a name to fill it |
| `email` / `phone` | text | yes | How to reach this contact |
| `title_department` | text | yes | Free text as the supplier gives it — "Sales Manager", "Availability desk". `'Main line'` marks a row migrated from the old `suppliers.email`/`phone` |
| `notes` | text | yes | Durable facts about **the contact** (best time to call, which lists they own). **Do not store fax numbers here or anywhere else in supplier/contact data.** |
| `is_primary` | boolean | no, default false | The supplier's default contact — see below |
| `is_active` | boolean | no, default true | Soft delete; supplier deactivation cascades here |
| `created_at` / `updated_at` | timestamptz | no, default `now()` | `updated_at` maintained by trigger |

**At most one active primary per supplier**, enforced by the partial unique
index `contacts_one_primary_idx (supplier_id) WHERE is_primary AND is_active`.
Promoting someone therefore means **demote the incumbent first, then promote** —
the other order trips the index. A retired contact keeps its `is_primary` flag
as history; because the index only covers active rows, that never blocks the
current primary.

`notes` here is about the person. Anything that was *said to* them is still an
appended entry in `suppliers.communication_notes` — the split is the same one
`suppliers.notes` vs `communication_notes` makes, and it matters for the same
reason.

There is deliberately no uniqueness on `(supplier_id, email)`: the same person
can legitimately be listed twice with different roles, and dedupe is a judgment
call, not a constraint. One such pair exists on purpose — supplier 255 has both
`Felix Jr. Rivero` and `Felix Rivero` with different office, cell and email,
flagged in the second row's `notes`. Confirm before merging them.

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
back. Suppliers with contacts but no flagged primary are normal: nobody is
promoted without evidence of who actually answers, and readers fall back to the
oldest active row.

### `inventory`

One row per plant × size × supplier offering, extracted from supplier pricing /
availability files.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK, `gen_random_uuid()`. Constraint is still named `plants_pkey` |
| `supplier_id` | bigint → `suppliers.id` ON DELETE CASCADE | yes | Owning supplier |
| `source_id` | uuid → `inventory_sources.id` | yes | File/URL this row came from; null for hand-entered rows |
| `name` | text | no | The whole plant identity: `Name [scientific name, variant]`, e.g. `Forest Pansy Redbud [Cercis canadensis, Forest Pansy]`. `Name` is as the source prints it; either bracket part is omitted when the source doesn't give it. **Part of a row's identity** — (name, size) alone is NOT unique |
| `name_key` | text **generated stored** | — | `normalize_plant_key(name)`; joins to `plant_other_names`. Do not write |
| `size` | text | yes | The container/grade sold, normalized by `normalize_size()`: gallons `"15 G"`, feet `"6'"`, inches `"24\""`, compounds keep units (`"3' cal"`, `"24\" box"`, `"15 G/17\""`). `#`/`gal` mean gallons — **except on a box, sized in inches**. Word sizes (`"B&B"`, `"Field Grown"`, `"Quart"`) are valid. Height/width/caliper, form codes (`STD`, `Bush`) and pack counts do **not** belong here; ~2,671 legacy active values still violate that. See the SOP's *Size standard* |
| `unit_price` | numeric(10,2) | yes | USD; lower bound if the source gave a range. `NULL` means the supplier provided no price; never coerce missing to zero |
| `quantity` | numeric | yes | Available quantity if the source lists one |
| `height` / `width` / `caliper` | text | yes | Human-readable measurement as printed in the source; preserved for display/evidence |
| `height_std` | double precision | yes | Standardized height in **feet**; lower bound for a range; `NULL` when unknown/ambiguous |
| `width_std` / `caliper_std` | double precision | yes | Standardized width/caliper in **inches**; lower bound for a range; `NULL` when unknown/ambiguous |
| `notes` | text | yes | Per-row qualifier ("limited", "B&B only") |
| `image_url` | text | yes | Optional product image |
| `is_active` | boolean | no, default true | Soft delete |
| `created_at` / `updated_at` | timestamptz | yes, default `now()` | `updated_at` maintained by trigger |

Price semantics are intentionally strict: `NULL` means no price was printed or
provided, while a numeric value is the supplier's printed price. On 2026-08-04,
all 28,998 legacy zero-price placeholders were migrated to `NULL` with explicit
approval. Future numeric zeroes are valid only when the supplier explicitly
prints zero. `inventory_enriched`, `rate_charts`, and `search_inventory` pass
`unit_price` through unchanged, including `NULL`.

Dimension semantics follow the same evidence rule: the source strings are never
replaced by numeric projections. A range stores its approved conservative lower
number in `*_std`; explicit height inches convert to feet, explicit
width/caliper feet convert to inches, and exact mixed/fractional values retain
full precision. Inequalities, conflicting/combined units, malformed or guessed
measurements remain `NULL`. Active range filters exclude `NULL`. Editing a
human-readable dimension without a reviewed paired standard clears its
companion so stale numeric evidence cannot survive.

There is deliberately **no** common-names column — alternative names live in
`plant_other_names` and are derived at read time. There is also no `category`
column (the source's own grouping is not tracked) and no `variety` column — the
cultivar is part of `name`. Both were dropped 2026-07-31, along with the rollback
table that briefly held their pre-change values, so the change is irreversible
and the old category values no longer exist anywhere.

### `inventory_sources`

Provenance: one row per ingested pricing / availability file or URL, per supplier.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `supplier_id` | bigint → `suppliers.id` ON DELETE CASCADE | no | |
| `file_path` | text | no | Either an object key in the `lps` bucket or a full `http(s)://` URL |
| `notes` | text | yes | Where/how it was sourced |
| `is_active` | boolean | no, default true | A `replace`-mode upload retires the supplier's other sources |
| `created_at` | timestamptz | no, default `now()` | Immutable LPS ingestion timestamp; not the source's printed/effective availability date |

The app derives an inventory row's `ingestion_date` by joining its `source_id`
to an **active** source's `created_at`; manual/source-less rows remain blank. A
supplier's `last_ingestion_date` is max(`created_at`) across its active sources
only (Bhoumik decision, 2026-08-04). Neither value is duplicated into the
`inventory` or `suppliers` tables. Source/effective date is a separate future
domain field and must not be inferred from a filename.

### `plant_other_names`

Mapping rows connecting a plant name to one alternative name. Powers
bidirectional name search and the derived "Other Names" column.

An alias exists for exactly one reason: so a search finds the row when the user
types **another name the same plant is known by** — a genuine common name, the
botanical/scientific name, an accepted synonym, an abbreviation, or a spelling
variant. `other_name` must **never** carry a cultivar, selection, variant, trade
name or patent code; those identify one selection rather than the plant, and
linking them makes every sibling cultivar match every other one. The cultivar is
already searchable inside `inventory.name`.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint identity | no | PK (constraint named `plant_common_names_pkey`) |
| `name` | text | no | Canonical/botanical name, display-cased |
| `other_name` | text | no | One alternative name, display-cased. No cultivars/trade names |
| `name_key` / `other_name_key` | text **generated stored** | — | `normalize_plant_key()` of each side; all matching runs on these |
| `is_active` | boolean | no, default true | Inactive pairs are history: they power neither search nor display |

Uniqueness is on `(name_key, other_name_key)` — case/spacing/symbol variants of a
pair are the same pair. A BEFORE INSERT trigger silently drops duplicates,
self-pairs and empty-keyed rows, so writers can blind-insert without conflict
handling.

**13,429 pairs, all active** — the 2026-07-31 cleanup and quality audit retired
78,807 and they were then deleted outright. An alias must name the *same plant*
— never a cultivar, never a generic category label ("Oak", "Grass"), never a
size/grade code. Search hops between siblings, so one bad pair pollutes a whole
neighbourhood; the ingestion SOP's rule is "when in doubt, insert nothing".
Before adding any cleanup rule, read the REJECTED RULES section of
`harness/agents/daisy/migrations/0008_alias_quality_audit.sql`.

> The dedupe trigger rejects a duplicate `(name_key, other_name_key)` **whether
> or not the existing row is active**. While retired rows existed they doubled as
> a blocklist; now that they are deleted, nothing at the database level stops a
> bad alias being re-inserted. Keeping the directory clean is the ingestion
> SOP's job.

---

## Views

### `inventory_enriched`

Every `inventory` column plus derived `other_names` (text, comma-separated,
alphabetical, deduped on key). A row's other names are every name connected to
its `name_key` through an **active** pair in `plant_other_names` — aliases of it,
canonical names it is an alias of, and sibling aliases through those — minus
itself.

Read through this view whenever you display inventory; **write to `inventory`
directly**. PostgREST embedding works through it
(`select=*,suppliers(name,city,state)`), including ordering the parent rows by an
embedded to-one column.

### `rate_charts`

Backwards-compatibility view: a plain `SELECT` of the pre-rename `inventory`
columns (no `name_key`, no `other_names`; no `category`/`variety` either, since
those columns are gone). `inventory` used to be called `rate_charts`. **Do not
build anything new on it.**

---

## Functions

### Normalization

| Function | Returns | Purpose |
|---|---|---|
| `normalize_search_text(text)` | text | Search tokenization: lowercase, punctuation → spaces, split letter↔digit boundaries ("1G" → "1 g"). The pgroonga document/query normalizer — the concatenation in `search_inventory` must stay byte-identical to the `inventory_pgroonga_idx` expression or the index is skipped |
| `normalize_plant_key(text)` | text | Identity key for plant names: lowercase **letters only** ("Live-Oak 2" → "liveoak"). Backs the generated `*_key` columns |
| `normalize_size(text)` | text | Size-string normalizer — canonicalizes units/spacing/leading zeros (`"1G"` → `"1 G"`, `"024 Inch Box"` → `"24\" Box"`). **Nothing calls it automatically** (no trigger, no default): ingestion applies it, and migration 0019 applied it to the 38,090 legacy rows that had drifted |

### Search RPCs

```
search_inventory(search text = '', supplier_ids bigint[] = null,
                 fuzzy_ratio real = 0.34, sort_column text = null, sort_direction text = null,
                 height_min float8 = null, height_max float8 = null,
                 width_min float8 = null, width_max float8 = null,
                 caliper_min float8 = null, caliper_max float8 = null)
```
Returns the inventory columns plus `other_names`, `source` (=
`inventory_sources.file_path`), `supplier_name`, `supplier_category`,
`supplier_state`, `supplier_city`, `height_std`, `width_std`, and `caliper_std`.
The six optional dimension bounds are inclusive and run in PostgreSQL before
ranking/result caps or supplier pagination; active bounds exclude null standards.
There is no `category_filter` — the column it
filtered was dropped 2026-07-31. (`search_suppliers` keeps its own, over
`suppliers.category`.)

- Active rows only; optional supplier filter.
- Only **active** `plant_other_names` pairs participate in matching and in the
  derived `other_names`.
- A row matches if its **document** (name, size, height,
  width, caliper, notes — normalized) matches the pgroonga query
  (typo-tolerant, and the query's trailing word is also **prefix-matched** when
  it is ≥ 3 chars — typing "Mexican Sycamor" finds "Mexican Sycamore"), **or**
  its `name_key` is connected to the query through `plant_other_names`, **or**
  the whole query collapses to the row's `name_key` ("LIVEOAK" finds "Live
  Oak"). Prefix search resolves through the pgroonga index lexicon, so it
  only works when the planner uses the index (migration
  `040_search_prefix_match`).
- Ordered by pgroonga relevance desc, **then the whitelisted sort column** with
  `NULLS LAST` in either direction, then `updated_at` desc, then `name` asc.
  Relevance always wins — `sort_column` only
  breaks ties within a score, it does not reorder the result set. With an empty
  `search` the score term is a constant, so it degenerates to `updated_at` desc,
  `name` asc. Alias-only matches score 0 and sort after direct matches.

```
search_suppliers(search text = '', category_filter text = null, fuzzy_ratio real = 0.34,
                 sort_column text = null, sort_direction text = null)
```
Same pgroonga matching (including the trailing-word prefix match) over name /
address / notes, and the same ordering rule. Returns active suppliers. It no
longer returns `phone` or `email` — those columns are gone; the equivalents are
`primary_contact_phone` / `primary_contact_email` below.

It returns the three availability columns as of migration 0018 — the function
has a fixed return type, so **any new `suppliers` column has to be added here
before the app can read it through search.**

Its returned columns include `primary_contact_name`, `primary_contact_email` and
`primary_contact_phone`, resolved by a `LEFT JOIN LATERAL` over `contacts`
(active only, `is_primary desc, id asc` — so a supplier with contacts but no
flagged primary still reports its oldest one). These replaced the `poc_*`
columns on 2026-08-05.

A supplier also matches **through its contacts**: contact name / email / phone /
title text is searched separately and folded in as a `supplier_id` list, the
same way the trigram fallback is. That keeps `suppliers_pgroonga_idx` usable for
the main branch — an index expression cannot read another table, so contact text
can never live in the suppliers document. Contact-only matches score 0 and
therefore sort after direct matches.

**This branch is now the only way to find a supplier by email or phone**, since
0016 moved both off `suppliers`. It works — searching a full address returns its
supplier — but it scores 0, so an email search ranks below any name match.

**`sort_column` is whitelisted inside each function; anything else is ignored.**

- `search_suppliers`: `name`, `category`, `primary_contact_name`,
  `primary_contact_email`, `primary_contact_phone`,
  `website`, `address`, `city`, `state`, `zip`, `notes`,
  `availability_source_type`, `availability_update_days`,
  `hosted_availability_url`, `created_at`, `updated_at`.
- `search_inventory`: `name`, `other_names`, `size`, `unit_price`,
  `quantity`, `height`, `width`, `caliper`, `notes`, `source`,
  `created_at`, `updated_at`, `supplier_name`, `supplier_category`,
  `supplier_state`, `supplier_city`. Sorting the human-readable `height`,
  `width` or `caliper` output uses its numeric `*_std` companion with nulls last.

> ### ⚠️ Do not call `search_inventory` with an empty `search`
>
> With no query there is nothing to rank, and the function walks all ~74k active
> rows — it **exceeds the statement timeout** and the call fails.
>
> To list rather than search, read `inventory_enriched` directly with an
> `ORDER BY` and a `LIMIT`; that returns in well under a second. This is what
> `searchPlantGroups()` in `app/lib/queries.ts` does when the term is empty.

### Other

`execute_readonly_query(query text) → jsonb` — generic read-only query helper.

---

## Triggers

| Trigger | Table | When | Does |
|---|---|---|---|
| `trg_cascade_supplier_deactivation` | suppliers | AFTER UPDATE OF `is_active`, true→false | Deactivates the supplier's `inventory` rows, `inventory_sources` and `contacts` |
| `trg_dedupe_plant_other_names` | plant_other_names | BEFORE INSERT | Skips normalized duplicates, self-pairs, empty keys |
| `handle_updated_at` | suppliers, inventory, contacts, users, chat_sessions, availability_queries | BEFORE UPDATE | Stamps `updated_at` (`moddatetime`) |

## Indexes that matter

- `inventory_pgroonga_idx` — pgroonga, `TokenDelimit`, over the normalized
  document expression. **Must match `search_inventory`'s concatenation exactly.**
- `inventory_trgm_idx` — gin/`pg_trgm` over the same expression (fuzzy fallback).
- `inventory_supplier_height_std_idx`, `inventory_supplier_width_std_idx`,
  `inventory_supplier_caliper_std_idx` — partial btrees on
  `(supplier_id, *_std)` for active, non-null rows; support supplier-page range
  filtering without adding numeric values to the text-search document.
- `plant_other_names_pgroonga_idx` — pgroonga over
  `normalize_search_text(name || ' ' || other_name)`. Note it does not cover
  `is_active`, which the search filters on separately.
- `suppliers_pgroonga_idx` — pgroonga over the supplier document (name, address,
  city, state, zip, category, notes). **Must match the concatenation in
  `search_suppliers` exactly.** Every contact field it used to carry —
  `poc_name`, then `email` and `phone` — has moved to the contacts index below.
- `contacts_pgroonga_idx` — pgroonga over
  `normalize_search_text(name || email || phone || title_department)`. Backs
  `search_suppliers`'s contact branch, and must stay byte-identical to it.
- `contacts_one_primary_idx` — partial unique on `(supplier_id) WHERE is_primary
  AND is_active`. Demote before you promote.
- `contacts(supplier_id, is_active)`.
- Btree on the stored keys: `inventory(name_key)`, `plant_other_names(name_key)`,
  `(other_name_key)`, unique `(name_key, other_name_key)`. These exist because
  computing the key per-comparison made the enriched view time out (21s → 119ms).
  If you add a key column, `ANALYZE` afterward or the planner reverts to seq scans.
- `inventory(source_id)`, `inventory(supplier_id, is_active)`,
  `inventory_sources(supplier_id)`.

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
| `plant_other_names` | enabled | `authenticated` full access |
| `contacts` | enabled | `authenticated` full access |
| `custom_commands` | enabled | Per-user via `auth.uid()` |
| `user_memories` | enabled | Per-user via `auth.uid()` |

**`anon` now reaches no application table at all** — verified against the live
REST API, every table and both views return `[]`.

Who bypasses RLS, and why nothing broke:

- **Agents** connect via `scripts/agent/supabase/query` as the `postgres` role,
  which holds `BYPASSRLS`. They see and write everything, exactly as before.
- **This app** queries server-side with the secret key (`service_role`, also
  `BYPASSRLS`). Unchanged — see `app/lib/supabase.ts`.
- **`authenticated`** (the old `lps-rosie` app's logged-in users) keeps full
  access to the catalogue and per-user access to its own chat/user rows.

> ### The views must stay `security_invoker`
>
> `inventory_enriched` and `rate_charts` are owned by `postgres`, which has
> `BYPASSRLS`. A Postgres view runs with its **owner's** rights unless it is
> declared `security_invoker = true`, so with the default setting these two
> would have handed `anon` the entire catalogue straight back and enabling RLS
> on `inventory` would have achieved nothing. The migration sets the flag on
> both. **Any view recreated over these tables must set it too** — `CREATE OR
> REPLACE VIEW` does not carry the option over on its own.

Enabling RLS did **not** loosen the rule about browser keys: the app still
queries only from server components and gates every page behind the harness
session (`app/proxy.ts`). Do not add a `NEXT_PUBLIC_` Supabase key.

---

## Storage buckets

Both buckets are **public** — an object key is directly fetchable, no signing
required.

- `lps` — plant photos and supplier price-list source files. Rate-card files go
  under `suppliers/<slug>/rate-cards/<file>` (`<slug>` = kebab-cased supplier
  name). Store the **object key** (no scheme) in `inventory_sources.file_path`;
  a full URL is also accepted there. Agent-shared files go under
  `daisy_shared/YYYY-MM-DD/<filename>`.
- `chat-attachments` — app chat uploads.

> Because `lps` is public, treat anything uploaded to it as world-readable.
> Pre-signed URLs still work and remain the convention for sharing files with
> users, but they are a courtesy, not an access control.

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
  caliper, form codes and pack counts out of `size`.
- Plant `name`: `Name [scientific name, variant]` — the printed name in full,
  plus the scientific name and cultivar/trade name when the source gives them.
  `plant_other_names` holds only other names for the *same plant* (common,
  scientific, synonyms) — never a cultivar or trade name.
- `file_path`: object key or full URL; anything without `http(s)://` is a key in
  the `lps` bucket.
- Never write generated `*_key` columns.
- `suppliers.notes` = facts about the supplier; `suppliers.communication_notes`
  = an append-only log of contact with them. Never append contact history to
  `notes`, and never overwrite `communication_notes`.
- Every contact route goes in `contacts` — people and inboxes alike, one row
  each, at most one active `is_primary` per supplier. `suppliers` carries no
  email or phone. `contacts.notes` describes the contact; what was said to them
  is still an entry in `suppliers.communication_notes`.
- Never infer a person's name from an email address. `contacts.name` is
  nullable precisely so you don't have to.
- Per-supplier quirks live in daisy's
  `workspace/suppliers/[<supplierId>]:<Name>/notes.md` (see
  `workspace/suppliers/index.md` for the name → id map).
