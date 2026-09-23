---
name: database-access
description: Read relevant schema and use guarded SQL/storage CLIs. Includes schema selector, query and upload references. Use before database queries or file storage operations. (v1.0.0)
metadata:
  author: lps
  version: "1.0.0"
---

# Database access

1. Read just the required current schema from the shared symlink:

   ```sh
   skills/agent/database-access/scripts/schema --list
   skills/agent/database-access/scripts/schema inventory suppliers rpc:search_inventory
   ```

   The selector prints source text without copying it. Unknown topics fail.
   Reread affected topics after schema changes, not before every identical query.
2. Read [SQL usage](artifacts/query.md) on first use or command errors. Choose
   explicit columns and limits; batch related reads. Use `--csv` for processing
   and return only counts, exceptions and selected records to the model.
3. Business writes require the owning task skill, current rows and guarded
   updates. Never write generated/derived columns, audit rows or bypass guards.
   Rosie sets `app.actor = 'rosie'` in every write invocation.
4. For uploads or signed links read [storage](artifacts/storage.md).
5. Verify row counts/saved values or upload status before reporting success.
   For schema discrepancies inspect the catalog and correct the verified
   reference through its shared symlink (the existing schema-maintenance
   exception to shared-doc ownership). Never replace it or keep a private copy.
