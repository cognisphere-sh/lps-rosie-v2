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

Last verified against the live database on 2026-07-27 by direct catalog
introspection. **If you find a discrepancy, fix this file in the same change.**

Applied migrations live in `harness/agents/daisy/migrations/`.

---

## Shape

```
suppliers 1 ──< inventory_sources 1 ──< inventory >── plant_other_names (by name_key, no FK)
          1 ─────────────────────────< inventory
          1 ─────────────────────────< availability_queries

users 1 ──< chat_sessions 1 ──< availability_queries
      1 ──< user_memories (1:1)
      1 ──< custom_commands
```

Row counts at last verification: `suppliers` 909 (905 active), `inventory`
183,795 (**74,089 active**), `inventory_sources` 1,834, `plant_other_names`
27,616, `availability_queries` 123, `users` 2.

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
| `phone` / `email` / `fax` | text | yes | Supplier-level contact |
| `poc_name` / `poc_email` / `poc_phone` | text | yes | Point-of-contact person (sparsely populated) |
| `website` | text | yes | Usually a bare domain (`acostafarms.com`) — prepend `https://` when linking |
| `latitude` / `longitude` | double precision | yes | Google Maps link: `google.com/maps?q=lat,lng` |
| `notes` | text | yes | **Durable profile facts** — see below |
| `communication_notes` | text | yes | **Append-only contact log** — see below |
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

### `inventory`

One row per plant × size × supplier offering, extracted from supplier pricing /
availability files.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK, `gen_random_uuid()`. Constraint is still named `plants_pkey` |
| `supplier_id` | bigint → `suppliers.id` ON DELETE CASCADE | yes | Owning supplier |
| `source_id` | uuid → `inventory_sources.id` | yes | File/URL this row came from; null for hand-entered rows |
| `name` | text | no | Plant name, botanical/scientific preferred ("Quercus virginiana") |
| `name_key` | text **generated stored** | — | `normalize_plant_key(name)`; joins to `plant_other_names`. Do not write |
| `variety` | text | yes | Cultivar. **Part of a row's identity** — (name, size) alone is NOT unique |
| `category` | text | yes | Free-text grouping from the source file ("TREES", "PERENNIAL"); 291 distinct values, ~50k active rows have none |
| `size` | text | yes | Normalized: gallons `"15 G"`, feet `"6'"`, inches `"24\""`, compounds keep units (`"3' cal"`, `"24\" box"`). `#`/`gal` mean gallons |
| `unit_price` | numeric(10,2) | **no** | USD; lower bound if the source gave a range |
| `quantity` | numeric | yes | Available quantity if the source lists one |
| `height` / `width` / `caliper` | text | yes | As printed in the source |
| `notes` | text | yes | Per-row qualifier ("limited", "B&B only") |
| `image_url` | text | yes | Optional product image |
| `is_active` | boolean | no, default true | Soft delete |
| `created_at` / `updated_at` | timestamptz | yes, default `now()` | `updated_at` maintained by trigger |

There is deliberately **no** common-names column — alternative names live in
`plant_other_names` and are derived at read time.

### `inventory_sources`

Provenance: one row per ingested pricing / availability file or URL, per supplier.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `supplier_id` | bigint → `suppliers.id` ON DELETE CASCADE | no | |
| `file_path` | text | no | Either an object key in the `lps` bucket or a full `http(s)://` URL |
| `notes` | text | yes | Where/how it was sourced |
| `is_active` | boolean | no, default true | A `replace`-mode upload retires the supplier's other sources |
| `created_at` | timestamptz | no, default `now()` | A supplier's latest availability date = max(`created_at`) of its active sources |

### `plant_other_names`

Mapping rows connecting a plant name to one alternative (common / marketing)
name. Powers bidirectional name search and the derived "Other Names" column.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint identity | no | PK (constraint named `plant_common_names_pkey`) |
| `name` | text | no | Canonical/botanical name, display-cased |
| `other_name` | text | no | One alternative name, display-cased |
| `name_key` / `other_name_key` | text **generated stored** | — | `normalize_plant_key()` of each side; all matching runs on these |

Uniqueness is on `(name_key, other_name_key)` — case/spacing/symbol variants of a
pair are the same pair. A BEFORE INSERT trigger silently drops duplicates,
self-pairs and empty-keyed rows, so writers can blind-insert without conflict
handling.

---

## Views

### `inventory_enriched`

Every `inventory` column plus derived `other_names` (text, comma-separated,
alphabetical, deduped on key). A row's other names are every name connected to
its `name_key` in `plant_other_names` — aliases of it, canonical names it is an
alias of, and sibling aliases through those — minus itself.

Read through this view whenever you display inventory; **write to `inventory`
directly**. PostgREST embedding works through it
(`select=*,suppliers(name,city,state)`), including ordering the parent rows by an
embedded to-one column.

### `rate_charts`

Backwards-compatibility view: a plain `SELECT` of the pre-rename `inventory`
columns (no `name_key`, no `other_names`). `inventory` used to be called
`rate_charts`. **Do not build anything new on it.**

---

## Functions

### Normalization

| Function | Returns | Purpose |
|---|---|---|
| `normalize_search_text(text)` | text | Search tokenization: lowercase, punctuation → spaces, split letter↔digit boundaries ("1G" → "1 g"). The pgroonga document/query normalizer — the concatenation in `search_inventory` must stay byte-identical to the `inventory_pgroonga_idx` expression or the index is skipped |
| `normalize_plant_key(text)` | text | Identity key for plant names: lowercase **letters only** ("Live-Oak 2" → "liveoak"). Backs the generated `*_key` columns |
| `normalize_size(text)` | text | Size-string normalizer |

### Search RPCs

```
search_inventory(search text = '', supplier_ids bigint[] = null, category_filter text = null,
                 fuzzy_ratio real = 0.34, sort_column text = null, sort_direction text = null)
```
Returns the inventory columns plus `other_names`, `source` (=
`inventory_sources.file_path`), `supplier_name`, `supplier_category`,
`supplier_state`, `supplier_city`.

- Active rows only; optional supplier / category filters.
- A row matches if its **document** (name, category, variety, size, height,
  width, caliper, notes — normalized) matches the pgroonga query
  (typo-tolerant), **or** its `name_key` is connected to the query through
  `plant_other_names`, **or** the whole query collapses to the row's `name_key`
  ("LIVEOAK" finds "Live Oak").
- Ordered by pgroonga relevance desc, **then the whitelisted sort column**, then
  `updated_at` desc, then `name` asc. Relevance always wins — `sort_column` only
  breaks ties within a score, it does not reorder the result set. With an empty
  `search` the score term is a constant, so it degenerates to `updated_at` desc,
  `name` asc. Alias-only matches score 0 and sort after direct matches.

```
search_suppliers(search text = '', category_filter text = null, fuzzy_ratio real = 0.34,
                 sort_column text = null, sort_direction text = null)
```
Same pgroonga matching over name / contact / address / notes, and the same
ordering rule. Returns active suppliers.

**`sort_column` is whitelisted inside each function; anything else is ignored.**

- `search_suppliers`: `name`, `category`, `poc_name`, `poc_email`, `poc_phone`,
  `website`, `email`, `phone`, `address`, `city`, `state`, `zip`, `notes`,
  `created_at`, `updated_at`.
- `search_inventory`: `name`, `other_names`, `category`, `size`, `unit_price`,
  `quantity`, `height`, `width`, `caliper`, `variety`, `notes`, `source`,
  `created_at`, `updated_at`, `supplier_name`, `supplier_category`,
  `supplier_state`, `supplier_city`.

> ### ⚠️ Do not call `search_inventory` with an empty `search`
>
> With no query there is nothing to rank, and the function walks all ~74k active
> rows — it **exceeds the statement timeout** and the call fails. A
> `category_filter` alone narrows it enough to return, but still takes seconds.
>
> To list rather than search, read `inventory_enriched` directly with an
> `ORDER BY` and a `LIMIT`; that returns in well under a second. This is what
> `browseInventory()` in `app/lib/queries.ts` does.

### Other

`execute_readonly_query(query text) → jsonb` — generic read-only query helper.

---

## Triggers

| Trigger | Table | When | Does |
|---|---|---|---|
| `trg_cascade_supplier_deactivation` | suppliers | AFTER UPDATE OF `is_active`, true→false | Deactivates the supplier's `inventory` rows and `inventory_sources` |
| `trg_dedupe_plant_other_names` | plant_other_names | BEFORE INSERT | Skips normalized duplicates, self-pairs, empty keys |
| `handle_updated_at` | suppliers, inventory, users, chat_sessions, availability_queries | BEFORE UPDATE | Stamps `updated_at` (`moddatetime`) |

## Indexes that matter

- `inventory_pgroonga_idx` — pgroonga, `TokenDelimit`, over the normalized
  document expression. **Must match `search_inventory`'s concatenation exactly.**
- `inventory_trgm_idx` — gin/`pg_trgm` over the same expression (fuzzy fallback).
- `plant_other_names_pgroonga_idx` — pgroonga over
  `normalize_search_text(name || ' ' || other_name)`.
- `suppliers_pgroonga_idx` — pgroonga over the supplier document.
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

## Security: RLS is OFF on the main tables

This is the single most important operational fact about this database.

| Table | RLS | Note |
|---|---|---|
| `suppliers` | **disabled** | Policies exist but are **inert** |
| `inventory` | **disabled** | Policies exist but are **inert** |
| `availability_queries` | **disabled** | No policies |
| `chat_sessions` | **disabled** | Policies exist but are inert |
| `users` | **disabled** | Policies exist but are inert |
| `inventory_sources` | enabled | `authenticated` full access |
| `plant_other_names` | enabled | `authenticated` full access |
| `custom_commands` | enabled | Per-user via `auth.uid()` |
| `user_memories` | enabled | Per-user via `auth.uid()` |

Because RLS is disabled on `suppliers` and `inventory`, **there is no anon-key
read path that is safe to expose to a browser** — an anon key would read the
whole catalogue. The app therefore queries only from server components using the
secret key, and gates every page behind the harness session (`app/proxy.ts`).
Do not add a `NEXT_PUBLIC_` Supabase key.

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

- Sizes: `"15 G"`, `"6'"`, `"24\""`, `"3' cal"`, `"24\" box"`; `#` = gallons.
- Plant `name`: botanical preferred; marketing names go to `plant_other_names`,
  never into `inventory.name` alongside it.
- `file_path`: object key or full URL; anything without `http(s)://` is a key in
  the `lps` bucket.
- Never write generated `*_key` columns.
- `suppliers.notes` = facts about the supplier; `suppliers.communication_notes`
  = an append-only log of contact with them. Never append contact history to
  `notes`, and never overwrite `communication_notes`.
- Per-supplier quirks live in daisy's
  `workspace/suppliers/[<supplierId>]:<Name>/notes.md` (see
  `workspace/suppliers/index.md` for the name → id map).
