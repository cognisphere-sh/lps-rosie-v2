# database-access — changelog

## 2.0.0 — 2026-09-29

Plain-language rewrite (Daisy audit). `system_prompts/1.1-supabase.md` and
`artifacts/query.md`, `artifacts/storage.md` merged here (one read). Added a
helper table, common topic names (last week's `schema` errors were guessed
names like `farms`, `sources`), bash `$` quoting, and "link the app, not an
expiring signed URL, for later review" (Chris 2026-07-22). `scripts/schema`
now suggests close topic names.

## 1.0.0

- Add targeted table/RPC schema selection and move database command reference out of always-loaded prompts.
