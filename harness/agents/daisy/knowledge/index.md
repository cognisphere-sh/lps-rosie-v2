# Knowledge index

Cross-thread reference material — schemas, domain facts, lookup tables,
long-term documents. Files live in `files/`; one line each below.

`memory.md` holds cross-thread memory — **episodic events and facts only** — grep
it, don't read it whole. A procedural rule belongs in `1-agent.md` (if it holds
everywhere) or in the skill for that procedure, never here.

## Files

- [files/SCHEMA.md](files/SCHEMA.md) — live Supabase schema. Read before any query. Tables you write: `suppliers`, `inventory`, `inventory_sources`, `plant_aliases`, `plant_photos`. This is a **symlink** to `docs/supabase-schema.md` at the repo root — the single source of truth shared by every agent and by the web app; edit it through the symlink, don't replace it with a copy.
- [files/suppliers.md](files/suppliers.md) — pointer only: per-supplier notes live in `workspace/suppliers/[<supplierId>]:<Name>/notes.md` (directory list in `workspace/suppliers/index.md`).
- [files/supplier-segmentation-and-account-development.md](files/supplier-segmentation-and-account-development.md) — **restricted internal strategy/training IP**: Chris’s complete 2026-08-21 morning working strategy covering original sourcing/outreach cohorts, the unknown app-enum origin, supplier-model distinctions, Texas market focus, account development, retail operations, and the Southwest Wholesale Nursery benchmark lead. Not for external sharing or wholesale copying into supplier profiles.
- `files/brand/` — LPS logo assets (`lps-logo.png`, `lps-logo-transparent.png`).
- `files/credentials/` — **sensitive.** Supplier portal logins (currently Garden Center Plants LLC / Buchholz, supplier 22). Directory is mode `0700`; never print or forward the values.
- `files/plans/` — long-lived plan documents. `photo-storage-and-network-cost-plan.md` — measured cost profile of the photo catalogue and the phases that would cut it, **none implemented**, each with a trigger point (nothing is worth doing at 44 photos). `searchable-photo-catalogue-plan.md` — **partly built**: migration 0051 shipped its MVP as `plant_photos` + the private `plant-photos` bucket + `search_plant_photos`; the seven-table model, the review workflow, perceptual dedupe and bulk intake are not built. The procedure is the `plant-photo-catalogue` skill).
- `files/templates/` — reusable output templates; see its own [index](files/templates/index.md).
- `files/plant-reference-photos/` — Chris-provided plant reference intake, one dated dir per drop, each with its own `index.md` manifest. Reference photos only — not supplier availability, and not linked to `inventory` rows. Since 2026-08-16 these are **catalogued** into `plant_photos` rather than left staged; the manifests record which row each file became. New photos go straight through the `plant-photo-catalogue` skill.

Procedures are **not** knowledge — they are skills. The ingestion SOP is the
`availability-ingestion` skill in `skills/agent/`, which follows
`supplier-onboarding` when a drop needs a supplier or a farm created, alongside
`availability-drop-intake`, `plant-and-supplier-search`,
`plant-photo-catalogue` and `supplier-communications`. Read them from
`<available_skills>`; changes to any of them require Chris's/Bhoumik's approval,
then a version bump.

**A lookup table only one skill reads is not knowledge either** — it travels
with that skill under `artifacts/`. The Gmail label IDs moved out of here on
2026-08-16 for exactly that reason and now live at
`skills/agent/availability-drop-intake/artifacts/gmail-labels.md`. Don't add
them back.
