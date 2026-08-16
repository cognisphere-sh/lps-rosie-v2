# plant-photo-catalogue — changelog

## 1.0.0

2026-08-16, with migration 0051 — initial version, covering the photo
catalogue end to end: the intake checklist (hash → dedupe → upload → insert),
the id-based object-path convention in the private `plant-photos` bucket, the
evidence rules for identity/size/supplier (stated or null — size is never
inferred from apparent scale, and a conflict is preserved rather than
reconciled), searching with `search_plant_photos` and filtering over its
result, sharing a photo with a signed URL, and soft-retiring one.

The search half is deliberately thin: `search_plant_photos` is
`search_inventory`'s algorithm over a different document, so this skill states
what differs — the document, the LEFT join to `suppliers` — and points at
`plant-and-supplier-search` for how the ranking thinks, rather than restating
it and letting the two drift.
