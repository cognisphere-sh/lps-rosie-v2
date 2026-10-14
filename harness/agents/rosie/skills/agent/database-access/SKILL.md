---
name: database-access
description: Read and write the LPS database safely. Includes read-only helpers (job-snapshot, ar-snapshot), the guarded note writer (set-note), the schema selector, the data-model map, SQL rules and file storage. Use before any database query, write or upload. (v2.5.0)
metadata:
  author: lps
  version: "2.5.0"
---

# Database access

Paths are relative to the agent root. Use a helper first; it is one call
instead of several hand-written queries.

| Need | Command |
|---|---|
| Everything about a job: row, lines, recent changes, candidates, order lines | `skills/agent/database-access/scripts/job-snapshot <jobId> [--item <id>] [--changes N]` |
| One AR: header, its job, lines (candidates), answers, job lines | `skills/agent/database-access/scripts/ar-snapshot <arId>` |
| Change a note safely (guarded; text from a file) | `skills/agent/database-access/scripts/set-note --table T --id N --field F ...` (see `--help`) |
| A plant's price and all its listed sizes | `skills/agent/plant-and-supplier-search/scripts/aps-price "<name>" --size "3 G"` |
| Render a quote from saved rows | `skills/agent/quote-generation/scripts/quote-job <jobId>` |
| Table or function details | `skills/agent/database-access/scripts/schema <table> rpc:<function>` (`--list` for names) |

- Don't read `knowledge/files/SCHEMA.md` whole; use `schema`.
- Read the [data model](artifacts/data-model.md) once per task if you're
  unsure how tables link, and for the write rules.
- Read [SQL rules](artifacts/query.md) before writing your own SQL or after a
  query error.
- Uploads and signed links: [storage](artifacts/storage.md).
- Business rules and approvals live in the task skills (`job-requests`,
  `supplier-coordination`). Being able to run a statement is not permission.
- Verify row counts and saved values before reporting success.
