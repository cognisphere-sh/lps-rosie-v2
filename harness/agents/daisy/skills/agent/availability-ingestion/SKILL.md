---
name: availability-ingestion
description: Ingest supplier availability with provenance and QA. Includes source checks, location/name/size normalization, matching and task references. Use for drops, backfills, manual intake or inventory repairs. (v2.5.0)
metadata:
  author: lps
  version: "2.5.0"
---

# Availability ingestion

Run on the company's `suppliers.daisy_thread_id`. This skill owns inventory,
sources and aliases; `supplier-onboarding` owns supplier/contact rows and
`plant-photo-catalogue` owns photo records. No supplier sends from ingestion.

Load each reference when its step is reached. Skip inapplicable branches;
repairs load only the affected field rules, writes and QA.

1. **Identify receipt:** [intake](artifacts/intake.md), relevant schema through
   `database-access`, and supplier notes. Read the email body as source evidence.
   Log arrivals with `supplier-communications` → transcript. Default is current
   receipt. Only explicit historical/backfill work reads [historical](artifacts/historical.md);
   manual handoffs read [manual receipt](artifacts/manual-receipt.md). An old
   printed date alone does not make a manual handoff historical.
2. **Resolve location:** [locations](artifacts/locations.md). Missing suppliers
   or farms go through `supplier-onboarding`; return with actual farm IDs.
3. **Check for change before conversion:** [source check](artifacts/source-check.md).
   Fingerprint the complete effective source, including body amendments and
   attachments. Skip expensive parsing only after a matching successful receipt
   for the same location scope and rules. A changed body is a changed source.
4. **Acquire/parse:** [acquisition](artifacts/acquisition.md). One logical
   plant × size offering. Always apply [names](artifacts/names.md),
   [values, dimensions and notes](artifacts/values-notes.md),
   [sizes](artifacts/sizes.md) and [size buckets](artifacts/size-buckets.md).
   Read [aliases](artifacts/aliases.md) only if inserting/reviewing aliases.
   Never write derived names/keys or manufacture identity from outside knowledge.
5. **Persist:** [provenance](artifacts/provenance.md), [writes](artifacts/writes.md).
   Use `scripts/match-candidates` once per farm; review candidates before deciding
   update versus insert. New stated values replace older ones; omitted fields
   stay unchanged. Ingestion retires nothing.
6. **Verify before commit:** [QA](artifacts/qa.md). Compare with original source,
   reconcile counts per location and inspect all risky rows. Roll back material
   failures. Never mark a failed/partial ingest successfully fingerprinted.
7. **Finish:** attached plant images use [photos](artifacts/photos.md), then
   `plant-photo-catalogue`; image URLs stay URLs. Follow [completion](artifacts/completion.md)
   for labels, per-location counts, caveats, internal web summary and coordinator
   report. Record the source fingerprint only after all scoped work succeeds.

Resolve routine gaps from evidence without inventing data; park identity/location
blockers and continue independent work. Minor decisions stay on the supplier's
internal panel; urgent blockers go to main. Use `create-skill` for procedural
feedback, authorization and version bumps.
