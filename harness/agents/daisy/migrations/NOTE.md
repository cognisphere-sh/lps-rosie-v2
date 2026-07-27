# Migrations applied by Daisy

> **Historical record — superseded. Not a description of the current schema.**
> `public.rate_charts` has since been renamed to `public.inventory`, and
> `rate_charts` now survives only as a backwards-compatibility *view* over it.
> For the schema as it actually is, read `knowledge/SCHEMA.md` (the shared
> `docs/supabase-schema.md`). This file is kept only to record what was run.

Applied to Supabase project `xyeyiqchadfszewztnrf` (lps-rosie) via the Supabase MCP.

## `0002_supplier_communication_notes.sql`
Applied 2026-07-27. Adds `suppliers.communication_notes` (nullable text) and
column comments separating it from `suppliers.notes`:

- **`notes`** — durable profile facts with no dedicated column (quirks,
  preferences, price-list format, ordering constraints).
- **`communication_notes`** — append-only contact log, one timestamped entry per
  contact.

Additive only: no rewrite, no backfill, no data touched (~910 rows, all
`communication_notes` null on apply).

## `20260701104209_daisy_availability_versioning`
Source: `0001_availability_versioning.sql`. One migration, applied 2026-07-01.

Changes to `public.rate_charts`:
- Renamed `common_name` → `common_names` (comma-separated list of names).
- Added `category text`, backfilled from `rate_chart_sections.name` via the old
  `section_id` (0 nulls across all 1,470 rows).
- Added `is_active boolean NOT NULL DEFAULT true` (all rows active) + index
  `rate_charts_supplier_active_idx (supplier_id, is_active)` for versioned ingestion.
- Dropped `section_id`.

Also dropped the `public.rate_chart_sections` table.

No data lost; category casing left as-sourced (both `TREES` and `Trees` exist).
RLS remains disabled on these tables — not changed here.
