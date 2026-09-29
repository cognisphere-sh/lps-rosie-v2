# database-access — changelog

## 2.0.1 — 2026-09-29

`scripts/schema` suggests close topic names for an unknown one (`sources` →
`inventory_sources`). Shared byte-for-byte with Daisy's copy; no procedure
change.

## 2.0.0 — 2026-09-28

- Rewrite. New helpers: `job-snapshot`, `ar-snapshot`, `set-note` (guarded note writes from files), shared `_db.py`, offline tests. Data-model map added (from the removed `1.1-supabase.md` prompt and job-requests writes). SQL rules: no `DO` (use WHERE NOT EXISTS), typed NULLs, common wrong columns.

## 1.2.0

- Merge customer requirements/outcomes into `note_for_customer` and supplier instructions/responses into `note_for_supplier` across headers and items. Preserve current sourcing constraints, exclude spacing and unrelated non-sourcing content, and use the new schema/RPC contract.

## 1.1.0 — 2026-09-24

- Use file/stdin SQL for literal currency and text; require current schema topics and bounded column/transcript reads to avoid shell failures and stale-column retries.

## 1.0.0

- Add targeted table/RPC schema selection and move database command reference out of always-loaded prompts.
