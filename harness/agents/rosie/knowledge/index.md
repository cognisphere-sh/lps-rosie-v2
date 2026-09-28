# Knowledge index

Cross-thread reference material — schemas, domain facts, lookup tables,
long-term documents. Files live in `files/`; one line each below.

`memory.md` holds cross-thread memory — grep it, don't read it whole.

## Files

- `files/SCHEMA.md` — the database schema (symlink to the repo's
  `docs/supabase-schema.md`, shared with every agent and the app). Read only
  the part you need with `skills/agent/database-access/scripts/schema
  <table>`; fix it in place when you find a discrepancy.
- `files/price-rules.md` — Chris's standing plant price rules and same-plant
  names. Check before asking Chris about any price.
- Quote formats live in `../skills/agent/quote-generation/`.
