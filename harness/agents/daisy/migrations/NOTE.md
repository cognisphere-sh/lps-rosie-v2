# Migrations applied by Daisy

Applied to Supabase project `xyeyiqchadfszewztnrf` (lps-rosie) via the Supabase MCP.

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
