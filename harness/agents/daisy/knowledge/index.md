# Knowledge index

Reference material shared by every thread. Procedures are skills, not
knowledge; a lookup table only one skill uses lives in that skill.

`memory.md` holds facts and events (grep it; don't read it whole). Rules go
in `system_prompts/1-agent.md` or the owning skill (`create-skill` says where).

## Files

- [files/SCHEMA.md](files/SCHEMA.md) — live Supabase schema. A **symlink** to
  the shared `docs/supabase-schema.md`; read it with
  `skills/agent/database-access/scripts/schema`, fix it through the symlink,
  never replace it with a copy.
- [files/suppliers.md](files/suppliers.md) — pointer: supplier quirks live in
  `suppliers.notes` in Supabase; `workspace/suppliers/` is read-only legacy.
- [files/supplier-segmentation-and-account-development.md](files/supplier-segmentation-and-account-development.md)
  — **restricted internal strategy (Chris's IP)**, 2026-08-21: sourcing and
  outreach cohorts, supplier types, Texas market focus, account development,
  the Southwest Wholesale Nursery benchmark. Not for sharing or copying into
  supplier records.
- `files/brand/` — LPS logos (`lps-logo.png`, `lps-logo-transparent.png`).
- `files/credentials/` — **sensitive** supplier portal logins (Garden Center
  Plants / Buchholz, supplier 22). Never print or forward them.
- `files/plans/` — `photo-storage-and-network-cost-plan.md` (cost phases, none
  built); `searchable-photo-catalogue-plan.md` (MVP built as `plant_photos`;
  the rest not built).
- `files/templates/` — output templates; see its [index](files/templates/index.md).
- `files/plant-reference-photos/` — Chris's early reference photo drops, each
  with an `index.md` saying which `plant_photos` row each file became. New
  photos go through `plant-photo-catalogue`.
