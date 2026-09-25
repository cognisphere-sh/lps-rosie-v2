---
name: database-access
description: Read relevant schema and use guarded SQL/storage CLIs. Includes schema selector, query and upload references. Use before database queries or file storage operations. (v1.2.0)
metadata:
  author: lps
  version: "1.2.0"
---

# Database access

1. Read just the required current schema from the shared symlink:

   ```sh
   skills/agent/database-access/scripts/schema --list
   skills/agent/database-access/scripts/schema inventory suppliers rpc:search_inventory
   ```

   The selector prints source text without copying it. Unknown topics fail.
   Use exact table/topic names from `--list`; do not guess aliases such as
   `jobs`, old column names, or RPC signatures from session history. For thread
   evidence select `threads` and `thread_messages` before querying them.
   Reread affected topics after schema changes, not before every identical query.
2. Read [SQL usage](artifacts/query.md) on first use or command errors. Choose
   explicit columns and limits; batch related reads. Use `--csv` for processing
   and return only counts, exceptions and selected records to the model.
   Read recent transcript rows by known thread/id and a bounded sequence or
   time window; expand only for missing evidence. Avoid `to_jsonb(row)`/`SELECT *`
   for jobs, audits or transcripts when a few fields answer the question.
   Use SQL files or quoted stdin for literal text/currency; see the query example.
3. Business writes require the owning task skill, current rows and guarded
   updates. Never write generated/derived columns, audit rows or bypass guards.
   Rosie sets `app.actor = 'rosie'` in every write invocation.
4. For uploads or signed links read [storage](artifacts/storage.md).
5. Verify row counts/saved values or upload status before reporting success.
   For schema discrepancies inspect the catalog and correct the verified
   reference through its shared symlink (the existing schema-maintenance
   exception to shared-doc ownership). Never replace it or keep a private copy.
