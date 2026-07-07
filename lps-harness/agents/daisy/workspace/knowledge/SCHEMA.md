# Database Schema Reference

Live Supabase schema for the **LPS** plant-supply platform (project
`xyeyiqchadfszewztnrf`, Postgres 13-era PostgREST). All tables are in `public`.
Read this before writing any query. If you find a discrepancy, verify against
the live catalog (see the Supabase section of your prompt) and update this file.

Daisy owns two tables: **`suppliers`** (onboarding) and **`rate_charts`** (the
availability / price-list rows, one active version per plant+size per supplier).
The rest are context, not yours to write.

## Common mistakes — read first

- PKs are **`id`**, not `<entity>_id`. `suppliers.id` is `bigint` **identity**
  (auto — omit `id` on INSERT). `rate_charts.id` is a `uuid` — pass
  `gen_random_uuid()` on INSERT (pgcrypto is available).
- `rate_charts` has **both** `supplier_id` (`bigint` FK → `suppliers.id`, use
  this) and a legacy nullable `supplier_id_uuid` (leave null).
- Category is a plain `text` column (`rate_charts.category`) — **there is no
  sections table** (it was dropped; see migrations/0001).
- `common_names` (plural) is a **comma-separated list** of common names in one
  `text` column, e.g. `"Columbine, Granny's Bonnet"`. Split/join on `, `.
- `is_active boolean` marks the current version. Reads should filter
  `WHERE is_active`. Old versions are kept (never deleted), just `is_active=false`.
- There is no structured "availability" column. Availability / inventory status
  and seller notes live in `rate_charts.notes` (free text, always date-stamped).
- `unit_price` is `numeric` (dollars), not cents.
- `suppliers.category` is CHECK-constrained to exactly `Wholesaler` | `Grower` |
  `Nursery` — any other value is rejected. `suppliers.is_active` marks live sellers.
- `rate_charts.source` records where a rate-chart row came from — the storage
  path/URL of the uploaded price-list file, or a web URL (see ingestion pattern).

## Tables

### `suppliers` — the sellers you onboard
One row per seller/grower. `id` bigint identity PK.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | bigint identity PK | auto |
| `name` | text | Supplier / nursery name. Your main match key. |
| `category` | text nullable, CHECK | one of `Wholesaler` \| `Grower` \| `Nursery`. Set on onboarding. |
| `is_active` | boolean, default true | live seller flag. |
| `email` | text nullable | Primary contact email — match inbound sender against this. |
| `poc_name` | text nullable | Point-of-contact person. |
| `phone` | text nullable | |
| `address`,`city`,`state`,`zip` | text nullable | |
| `notes` | text nullable | Free-form onboarding notes. |
| `created_at`,`updated_at` | timestamptz | default now(); bump `updated_at` on edits. |

### `rate_charts` — the availability / price-list rows (THE availability data)
One row per plant + size **version** for a supplier. `id` **uuid** PK.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | pass `gen_random_uuid()` on INSERT |
| `supplier_id` | bigint FK → suppliers.id | owning supplier (use this) |
| `category` | text nullable | category name, e.g. `TREES`, `SHRUB`, `PALMS` (replaces the old sections table) |
| `name` | text | plant name (botanical/primary), **without** size |
| `common_names` | text nullable | **comma-separated** list of aliases, e.g. `"Columbine, Granny's Bonnet"` |
| `size` | text nullable | normalized size, e.g. `15G`, `24" box`, `6'` |
| `unit_price` | numeric **NOT NULL** | USD dollars; use `0` for "Call for price" items (never null — the column has a DB NOT NULL constraint despite the nullable label) |
| `variety`,`height`,`width`,`caliper` | text nullable | spec fields |
| `image_url` | text nullable | public/signed URL of a photo in the `lps` bucket |
| `notes` | text nullable | inventory / availability status + seller notes, always date-stamped (e.g. `Available as of 2026-07-01`). **Carried forward** onto the new version at re-ingest. |
| `source` | text nullable | where this row came from: the uploaded price-list's `lps` storage URL (`suppliers/<slug>/rate-cards/<file>`) or a web URL. Carried forward with `notes`. |
| `is_active` | boolean, default true | current version. Reads filter `WHERE is_active`. Superseded versions are `false`, never deleted. |
| `supplier_id_uuid` | uuid nullable | legacy — leave null |
| `created_at`,`updated_at` | timestamptz | |

### Context tables (do not write)
- `availability_queries` — customer demand queries (Rosie's side): `supplier_id`,
  `availability_data` jsonb, `friendly_id`, `submitted`, `is_processed`.
- `chat_sessions`, `users`, `user_memories`, `custom_commands`.

## Storage buckets
- `lps` (public) — plant photos + supplier price-list source files. Rate-card
  files go under `suppliers/<slug>/rate-cards/<file>` (`<slug>` = kebab-cased
  supplier name, e.g. `austin-plant-supply`).
- `chat-attachments` (public) — app chat uploads; not yours.

## Versioned ingestion pattern (per supplier)
Each new availability drop for an **existing** supplier fully supersedes their
current active rows — it does not edit them in place:

0. **Stash the source.** If the drop came as a file (PDF/xlsx/image), upload it:
   `scripts/agent/supabase/upload --bucket lps --path suppliers/<slug>/rate-cards/<file> --file <local> --public-url`
   and keep the printed URL. If it came from a website, use that page URL. This
   value goes into every row's `source` below.
1. New row per incoming line: `INSERT ... (id = gen_random_uuid(), supplier_id,
   category, name, common_names, size, unit_price, ..., source = '<url>',
   is_active = true)`, copying `notes` (and any inventory status) forward from
   the matching old active row — match on `(supplier_id, lower(name), size)`.
2. Then disable the previous version:
   `UPDATE rate_charts SET is_active = false, updated_at = now()
    WHERE supplier_id = <id> AND is_active AND id <> ALL(<new ids>)`.

Net effect: exactly one active version per plant+size per supplier at a time;
prior versions stay as history (`is_active = false`). Reads use `WHERE is_active`.
Do a **new supplier's** first ingest as plain inserts (nothing to carry/disable).
