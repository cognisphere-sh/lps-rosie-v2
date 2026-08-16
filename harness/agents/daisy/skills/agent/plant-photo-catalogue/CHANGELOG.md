# plant-photo-catalogue — changelog

## 1.3.0

2026-08-16, with `availability-ingestion` 1.1.0 — photos now arrive mostly from
ingests rather than by hand, so the skill says what that changes.

New *Where photos come from* section, in §1 next to the field rules. An ingest
supplies the two things a bare file can't carry — the supplier its §0 resolved,
**only** when the drop mapped to exactly one location, and the drop's provenance
string — while everything about how the row is written stays here.

The half worth the words is **rights**. A photo a supplier sent us was sent to
us to use; a photo we fetched off their website is their work held without a
licence anyone stated. Fine for an internal reference catalogue, not fine to
assume forever — so a fetched photo is tagged **`web`** (now a required tag, not
a descriptive one) with the exact image URL in `source`, which makes the whole
set removable in one query if a supplier ever objects. Watermarked and
stock-licensed images are not catalogued at all, and crawling a site for a
gallery during an ingest is out.

Also restated here because it is a `plant_photos` rule and not an ingest one:
the rest of a drop is not evidence about the photo in it. No inherited size from
the sheet's size column, no inventory link, identity from the photo's own
evidence only.

## 1.2.0

2026-08-16 — new §4, *What app users can change under you*. The `/photos`
lightbox gained an edit form, so a catalogued photo's metadata is no longer
Daisy's alone: a signed-in user can change the three name parts, size,
height/width/caliper, tags, caption and notes, and `updated_at` moving with no
note is now normal.

What they cannot touch is the half that matters for trust — `supplier_id`,
`captured_at`, `source`, `storage_path`, `sha256` and everything derived — so
the section says that plainly rather than leaving Daisy to wonder whether her
provenance line survived.

It also carries the repair their edits create: editing `size` in the app nulls
`size_std` (the same rule that invalidates a standardized dimension when its
source text is hand-edited), dropping the photo out of the Size filter until
someone sets the bucket. The query that finds those rows is included.

## 1.1.0

2026-08-16, with migration 0052 — states the identity/size parity with
`inventory` explicitly rather than leaving it implied: the same three name
parts, the same derived `name` and keys, the same `size` / `size_std`, and the
new `name_key`, with the worked join that answers "is there a photo of this
inventory row?". Calls out that `name_key` keys the **whole composed identity**,
so the bare `normalize_plant_key('Crape Myrtle')` matches nothing — the part
keys or the RPC answer the same-plant question — and that
`height_std`/`width_std`/`caliper_std` are the one column set photos do not
have.

Adds `cultivar_keys` to the worked filter example, matching the Cultivar
dropdown the `/photos` page gained, and notes that filtering is on the
normalized key rather than the display name.

Retiring gains the fact that app users can now soft-delete any photo from the
grid, so a missing photo should be checked for `is_active = false` before the
insert is assumed to have failed.

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
