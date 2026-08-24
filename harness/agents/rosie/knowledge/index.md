# Knowledge index

Cross-thread reference material — schemas, domain facts, lookup tables,
long-term documents. Files live in `files/`; one line each below.

`memory.md` holds cross-thread memory — grep it, don't read it whole.

## Files

- `files/SCHEMA.md` — the database schema (symlink to the repo's
  `docs/supabase-schema.md`, shared with every agent and the app). Read before
  any query; fix it in place when you find a discrepancy.
- `files/templates/` — quote templates (see the `quote-generation` skill).
  `austin-plant-supply-modern-quote-template.html` is the default for APS quotes: the approved editable APS-branded template (logo, current header, no status column; Bhoumik approved 2026-08-18; Chris made it the default 2026-08-24). `austin-plant-supply-logo-quote-template.pdf` is its verified current APS visual original. `lps-quote-template.html` is legacy for APS work; `austin-plant-supply-quote-template.html` is stale and must not be used.
