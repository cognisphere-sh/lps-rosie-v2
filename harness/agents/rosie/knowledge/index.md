# Knowledge index

Cross-thread reference material — schemas, domain facts, lookup tables,
long-term documents. Files live in `files/`; one line each below.

`memory.md` holds cross-thread memory — grep it, don't read it whole.

## Files

- `files/SCHEMA.md` — the database schema (symlink to the repo's
  `docs/supabase-schema.md`, shared with every agent and the app). Read before
  any query; fix it in place when you find a discrepancy.
- `files/templates/` — quote templates (see the `quote-generation` skill).
  `lps-quote-template.html` is the default. `austin-plant-supply-logo-quote-template.pdf` is the verified current APS visual original (Daisy, 2026-08-18); `austin-plant-supply-modern-quote-template.html` is the approved editable APS-branded template rebuilt from it (logo, current header, no status column; Bhoumik approved 2026-08-18). `austin-plant-supply-quote-template.html` is stale and must not be used.
