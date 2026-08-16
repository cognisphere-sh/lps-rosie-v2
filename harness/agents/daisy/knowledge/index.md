# Knowledge index

Cross-thread reference material — schemas, domain facts, lookup tables,
long-term documents. Files live in `files/`; one line each below.

`memory.md` holds cross-thread memory — **episodic events and facts only** — grep
it, don't read it whole. A procedural rule belongs in `1-agent.md` (if it holds
everywhere) or in the skill for that procedure, never here.

## Files

- [files/SCHEMA.md](files/SCHEMA.md) — live Supabase schema. Read before any query. Tables you write: `suppliers`, `inventory`, `inventory_sources`, `plant_other_names`. This is a **symlink** to `docs/supabase-schema.md` at the repo root — the single source of truth shared by every agent and by the web app; edit it through the symlink, don't replace it with a copy.
- [files/gmail-labels.md](files/gmail-labels.md) — Gmail label IDs (reference only; *which* label to apply is the `availability-drop-intake` skill). Also records that the `gws` CLI is a global binary on PATH, not under `scripts/gws/`.
- [files/suppliers.md](files/suppliers.md) — pointer only: per-supplier notes live in `workspace/suppliers/[<supplierId>]:<Name>/notes.md` (directory list in `workspace/suppliers/index.md`).

Procedures are **not** knowledge — they are skills. The ingestion SOP is the
`availability-ingestion` skill in `skills/agent/`, which follows
`supplier-onboarding` when a drop needs a supplier or a farm created, alongside
`availability-drop-intake`, `plant-and-supplier-search` and
`supplier-communications`. Read them from `<available_skills>`; changes to any of
them require Chris's/Bhoumik's approval, then a version bump.
