# Supply-Side Schema

Everything the supply side of Rosie stores and how it fits together: suppliers,
their ingested inventory, where each inventory row came from, and the
plant-name mapping that powers search. Database is Supabase/PostgreSQL
(project `lps-rosie`). Migrations live in `scripts/` (the supply restructure is
`scripts/028`–`035`).

```
suppliers 1 ──< inventory_sources 1 ──< inventory >── plant_other_names (by name_key, no FK)
          1 ─────────────────────────< inventory
```

- All tables have RLS enabled with full access for the `authenticated` role
  (single-tenant app). Cron/admin paths use the service-role key.
- Soft deletes everywhere: rows are flipped `is_active = false`, never deleted
  (except `upsertInventory` replace mode, which hard-deletes a supplier's
  inventory rows before re-inserting).

---

## Tables

### `suppliers`

One row per nursery/grower/wholesaler the business buys from.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint (identity) | no | PK |
| `name` | text | no | Display name, e.g. "Acosta Farms Nursery, Inc" |
| `category` | text | yes | One of `Wholesaler`, `Grower`, `Nursery` (fixed list in `actions/supplier-constants.ts`) |
| `address` / `city` / `state` / `zip` | text | yes | Free-text US address parts |
| `phone` / `email` / `fax` | text | yes | Supplier-level contact |
| `poc_name` / `poc_email` / `poc_phone` | text | yes | Point-of-contact person (sparsely populated) |
| `website` | text | yes | Usually a bare domain (`acostafarms.com`); UI prepends `https://` when linking |
| `latitude` / `longitude` | double precision | yes | Geolocation; UI renders a Google Maps link (`google.com/maps?q=lat,lng`) |
| `notes` | text | yes | Free text |
| `is_active` | boolean | no, default true | Soft delete flag; deactivation cascades (see triggers) |
| `created_at` / `updated_at` | timestamptz | yes, default now() | `updated_at` maintained by trigger |

### `inventory`

One row per plant × size × supplier offering, extracted from supplier pricing/
availability files. ~145k rows.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK, `gen_random_uuid()` |
| `supplier_id` | bigint → `suppliers.id` | yes | Owning supplier |
| `source_id` | uuid → `inventory_sources.id` | yes | The file/URL this row was extracted from; null for hand-entered rows |
| `name` | text | no | Plant name, botanical/scientific preferred (e.g. "Quercus virginiana") |
| `name_key` | text, **generated** | — | `normalize_plant_key(name)`; joins to `plant_other_names`, do not write |
| `variety` | text | yes | Cultivar/variety. **Part of a row's identity**: (name, size) alone is NOT unique — thousands of groups differ only by variety |
| `category` | text | yes | Free-text grouping from the source file ("Shade Trees", "Perennials"); null = uncategorized |
| `size` | text | yes | Normalized format: gallons `"15 G"` (`#`/`gal` mean gallons), feet `"6'"`, inches `"24\""`, compounds keep units (`"3' cal"`, `"24\" box"`) |
| `unit_price` | numeric | no | Plain number, USD; lower bound if source gave a range |
| `quantity` | numeric | yes | Available quantity if the source lists one |
| `height` / `width` / `caliper` | text | yes | As printed in the source file |
| `notes` | text | yes | Per-row qualifier ("limited", "B&B only") |
| `image_url` | text | yes | Optional product image |
| `is_active` | boolean | no, default true | Soft delete; only active rows are searched/shown |
| `created_at` / `updated_at` | timestamptz | yes, default now() | `updated_at` maintained by trigger |

There is deliberately **no** common-names column here — other names live in
`plant_other_names` and are derived at read time (see views/functions).

### `inventory_sources`

Provenance: one row per ingested pricing/availability file or URL, per
supplier. Inventory rows link here via `source_id`.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `supplier_id` | bigint → `suppliers.id`, on delete cascade | no | |
| `file_path` | text | no | Either a storage path in the private `lps` bucket (signed on demand, see `getSourceUrl`) or an `http(s)://` URL |
| `notes` | text | yes | Where/how it was sourced |
| `is_active` | boolean | no, default true | A new `replace`-mode upload retires the supplier's other sources |
| `created_at` | timestamptz | no, default now() | A supplier's latest availability date = max(`created_at`) of its active sources |

### `plant_other_names`

1-to-1 mapping rows connecting a plant name to one alternative name (common/
marketing name). Powers bidirectional name search and the derived
"Other Names" UI column. ~25k rows.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint (identity) | no | PK |
| `name` | text | no | Canonical/botanical name, display-cased |
| `other_name` | text | no | One alternative name, display-cased |
| `name_key` / `other_name_key` | text, **generated** | — | `normalize_plant_key()` of each side; all matching/dedup runs on these |

Uniqueness is on `(name_key, other_name_key)` — case/spacing/symbol variants
of a pair are the same pair. A BEFORE INSERT trigger silently drops rows that
are duplicates under the keys, self-pairs, or empty-keyed, so writers can
blind-insert without conflict handling.

---

## Views

### `inventory_enriched`

`inventory.*` plus derived `other_names` (text, comma-separated, alphabetical,
deduped on key). A row's other names are every name connected to its
`name_key` in `plant_other_names`: aliases of it, canonical names it is an
alias of, and sibling aliases through those canonical names — minus itself.

Use this for all reads that display inventory; write to `inventory` directly.
The app's non-search list path queries this view through PostgREST (embedding
`suppliers` and `inventory_sources` works through it).


---

## Functions

### Normalization

| Function | Returns | Purpose |
|---|---|---|
| `normalize_search_text(text)` | text | Search tokenization: lowercase, strip punctuation to spaces, split letter↔digit boundaries ("1G" → "1 g"). The pgroonga document/query normalizer — the concatenation in `search_inventory` must stay byte-identical to the `inventory_pgroonga_idx` index expression or the index is skipped |
| `normalize_plant_key(text)` | text | Identity key for plant names: lowercase **letters only** ("Live-Oak 2" → "liveoak"). Backs the generated `*_key` columns; case/space/number/symbol independent |

### Search (RPCs called by the app)

`search_inventory(search, supplier_ids bigint[], category_filter, fuzzy_ratio real = 0.34, sort_column, sort_direction)`
→ inventory columns + `other_names`, `source` (= `inventory_sources.file_path`), `supplier_name/category/state/city`.

- Active rows only; optional supplier/category filters.
- A row matches if its **document** (name, category, variety, size, height,
  width, caliper, notes — normalized) matches the pgroonga query
  (typo-tolerant; one fuzzy term per query), **or** its `name_key` is
  connected to the query through `plant_other_names` (either side, plus
  sibling aliases), **or** the whole query collapses to the row's `name_key`
  ("LIVEOAK" finds "Live Oak").
- Ordered by pgroonga relevance score, then `updated_at` desc, then the
  whitelisted `sort_column`/`sort_direction`. Rows matched only via the name
  mapping score 0 and sort after direct matches.
- Empty `search` returns all active rows (filters/sort still apply).

`search_suppliers(search, category_filter, fuzzy_ratio real = 0.34, sort_column, sort_direction)`
→ supplier columns incl. `website`, `poc_*`, `latitude`/`longitude`. Same
pgroonga matching over name/contact/address/notes.

### Triggers

| Trigger | Table | When | Does |
|---|---|---|---|
| `trg_cascade_supplier_deactivation` | suppliers | AFTER UPDATE, `is_active` true→false | Deactivates the supplier's `inventory` rows and `inventory_sources` |
| `trg_dedupe_plant_other_names` | plant_other_names | BEFORE INSERT | Returns NULL (skips row) for normalized duplicates, self-pairs, empty keys |
| `handle_updated_at` | suppliers, inventory | BEFORE UPDATE | Stamps `updated_at` (global trigger from `scripts/004`) |

### Indexes that matter

- `inventory_pgroonga_idx` — pgroonga, TokenDelimit, over the normalized
  document expression (must match `search_inventory` exactly).
- `plant_other_names_pgroonga_idx` — pgroonga over `normalize_search_text(name || ' ' || other_name)`.
- Plain btree on the stored keys: `inventory(name_key)`,
  `plant_other_names(name_key)`, `(other_name_key)`, unique
  `(name_key, other_name_key)`. These exist because computing the key
  per-comparison made the enriched view time out (21s → 119ms); if you add a
  new key column, `ANALYZE` afterward or the planner reverts to seq scans.
- `inventory(source_id)`, `inventory_sources(supplier_id)`.

---

## Write paths (who writes what)

- **`upsertInventory` tool** (`lib/tools/upsert-inventory.ts`, admin chat):
  the main ingest. Finds-or-creates the `inventory_sources` row for
  (supplier, file_path), stamps `source_id` on every row written, splits each
  row's `other_names` input into `plant_other_names` pairs.
  `replace` mode deletes the supplier's inventory and retires its other
  sources; `append_update` matches existing rows on (name, size,
  case-insensitive) — beware: that key collapses varieties (see `variety`).
- **Inventory table UI** (`actions/inventory.ts`): single-field edits and
  soft-deletes against `inventory`; `other_names` and `source` are derived and
  not editable there.
- **Suppliers UI / supplier tools**: direct column edits on `suppliers`.

## Conventions recap

- Sizes: `"15 G"`, `"6'"`, `"24\""`, `"3' cal"`, `"24\" box"`; `#` = gallons.
- Plant `name`: botanical preferred; marketing names go to
  `plant_other_names`, never into `inventory.name` alongside it.
- `file_path`: bucket path (no scheme) or full URL; anything without
  `http(s)://` is signed against the `lps` storage bucket for viewing.
- Never write generated `*_key` columns; never match plant names with `=` on
  raw text — use the key columns.

---

## Context tables (do not write)
- `availability_queries` — customer demand queries (Rosie's side): `supplier_id`,
  `availability_data` jsonb, `friendly_id`, `submitted`, `is_processed`.
- `chat_sessions`, `users`, `user_memories`, `custom_commands`.

## Storage buckets
- `lps` — plant photos + supplier price-list source files. Rate-card files go
  under `suppliers/<slug>/rate-cards/<file>` (`<slug>` = kebab-cased supplier
  name, e.g. `austin-plant-supply`). Store the **object key** in
  `inventory_sources.file_path`; the app signs it on demand (see `file_path`
  convention above).
- `chat-attachments` — app chat uploads; not yours.


---

## Per-supplier notes

Learned per-supplier quirks live in `workspace/suppliers/[<supplierId>]:<Name>/notes.md`
(see `workspace/suppliers/index.md` for the name → id map).
