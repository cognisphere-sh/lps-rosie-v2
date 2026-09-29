---
name: database-access
description: Query and write the LPS Supabase database and storage safely. Includes the schema selector, the guarded query CLI and its rules, quoting, upload and signed links, and which helper to use for common reads. Use before any SQL, upload or schema question. (v2.0.0)
metadata:
  author: lps
  version: "2.0.0"
---

# Database access

Supabase is the record of truth. The task skills own business writes and what
needs approval; this skill is the mechanics.

## Schema

```sh
skills/agent/database-access/scripts/schema --list
skills/agent/database-access/scripts/schema inventory inventory_sources suppliers rpc:search_inventory
```

Read only the tables you need, once per task (again only after a schema
change). Names people use: farms/locations → `suppliers`; sources →
`inventory_sources`; aliases → `plant_aliases`; contacts → `contacts` +
`supplier_contacts`. `knowledge/files/SCHEMA.md` is a symlink to the shared
`docs/supabase-schema.md`: fix a verified error through the symlink; never
replace it with a copy.

## Helpers first

| Need | Helper |
|---|---|
| A supplier company: locations, notes, recent sources | `availability-ingestion/scripts/ingest-context` |
| Match parsed rows / write an ingest / QA it | `match-candidates --plan`, `apply-plan`, `qa-check` (same folder) |
| Plant or supplier lookup | `search_inventory`, `search_suppliers` (`plant-and-supplier-search`) |

## Query CLI

`scripts/agent/supabase/query -c '<SQL>'`, `-f /tmp/file.sql`, or stdin;
`--csv` for anything a script reads. No positional SQL.

- Allowed: SELECT, INSERT, UPDATE, WITH, transactions, EXPLAIN, SET/SHOW,
  VALUES, CREATE FUNCTION. Blocked: DELETE, DROP, ALTER, TRUNCATE. Don't try
  to get around the guard; ask Bhoumik for schema or destructive
  work. Being allowed to run a statement is not business permission.
- Quote text with dollar quotes (`$q$it's $5$q$`) and pass SQL in single
  quotes or a file: inside double quotes bash turns `$5` into nothing.
- Real newlines: `E'…\n…'` or a file, not `'\n'`.
- Choose columns, add `LIMIT`, batch related reads; return counts and the
  rows that matter, not whole tables.
- Before an update, read the row; guard on the old values
  (`AND field IS NOT DISTINCT FROM <old>`). Zero rows updated → re-read, don't
  force.
- Never write `name`, `*_key`, `updated_at`, `created_at`, thread refs or
  audit fields.
- Unsure whether a write landed? Read it back before retrying.
- Stale column list? Check `information_schema.columns` and fix the shared
  schema doc.

## Storage

```sh
scripts/agent/supabase/upload --bucket lps --path <key> --file /tmp/file.pdf   # upserts; --no-upsert refuses overwrite
scripts/agent/supabase/sign-url --bucket <bucket> --path <key> --expiry 604800
```

- `lps` is a **public** bucket: nothing confidential there. Plant photos use
  the private `plant-photos` bucket (`plant-photo-catalogue`).
- Database rows store object keys or original URLs, never signed URLs.
- Signed links expire (7 days). For anything someone will review later, link
  the app page instead (Chris, 2026-07-22).
- Credentials come from the environment; never print or pass them.
