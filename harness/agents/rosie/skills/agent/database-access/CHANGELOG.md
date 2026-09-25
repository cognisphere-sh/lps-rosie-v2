# database-access — changelog

## 1.2.0

- Merge customer requirements/outcomes into `note_for_customer` and supplier instructions/responses into `note_for_supplier` across headers and items. Preserve current sourcing constraints, exclude spacing and unrelated non-sourcing content, and use the new schema/RPC contract.

## 1.1.0 — 2026-09-24

- Use file/stdin SQL for literal currency and text; require current schema topics and bounded column/transcript reads to avoid shell failures and stale-column retries.

## 1.0.0

- Add targeted table/RPC schema selection and move database command reference out of always-loaded prompts.
