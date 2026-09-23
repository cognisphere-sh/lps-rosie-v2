# plant-photo-catalogue — changelog

## 1.7.0

- Split photo intake, lookup/sharing, retirement and concurrent-edit references; keep existing normalization and reclamation scripts.

## 1.6.2

2026-08-24 (harness 0.10.1). Description rephrased to the tightened spec —
"what's included" is a brief sketch rather than an exhaustive contents list,
and partial applicability moved under "use when". No procedural change.

## 1.6.1

2026-08-18. **Description rewritten short** — what the skill covers, then when
to use it. It had grown to 1455 characters, past pi's 1024-character cap, so
the tail of it (retiring, reclaiming bytes, half the trigger phrases) was at
risk of never reaching the agent at all. The procedure itself is unchanged.

## 1.6.0

2026-08-16, with migration 0054 — the orphan sweep, closing the last open piece
of lever D in the cost plan. New `scripts/reclaim-orphans` deletes bucket
objects no active row points at; §3 gains *Reclaiming the bytes behind retired
photos*.

The safety rule lives in `plant_photo_reclaimable()` rather than the script, so
**an object belonging to an active photo can never be a candidate** however it
is called. The script is a thin HTTP client over that, dry run by default.

The section separates the two kinds because they are not equally safe to sweep.
An `orphan` — an upload whose insert failed — is housekeeping nobody has ever
seen. A `retired` object is someone's undo, and deleting it makes the retirement
permanent: the row keeps its `storage_path`, so reactivating that photo later
gives a broken image with no way back.

That warning is written from an actual incident rather than caution: a
`--older-than-days 0 --delete --force` run intended for two test orphans took a
real retired photo with it, and it was restorable only because the intake
original was still on disk. `--reason orphan` exists because of it.

## 1.5.0

2026-08-16, with migration 0053 — **the catalogue is a reference library, not
an archive**, decided by Bhoumik. Step 1 is now one command,
`scripts/prepare-photo`, and what gets stored is its output rather than the file
we were handed.

It bakes EXIF orientation into the pixels, drops all metadata, caps the long
edge at 2048px and re-encodes to WebP. Measured on a 4032x3024 phone photo:
**7.9 MB → 819 kB, 89.6% smaller**, correctly rotated, GPS gone. On an
already-recompressed Telegram photo the saving is a more modest 11%, which is
the honest range — the win is on phone drops.

Dropping GPS is a privacy change as much as a size one: a photo taken at a
supplier's site carries their coordinates, and the catalogue has no use for
them.

**`sha256` now means the file we were handed, not the object we stored.** The
distinction only appears once normalisation exists, and getting it wrong would
quietly break dedupe: the same photo re-sent next month must still collide with
the row we hold, and it would not if the key described our own output — which
changes the day the quality or size settings do. One consequence is written
down: the unique index on `sha256` no longer guarantees one row per object;
`plant_photos_object_idx` does, and always did.

The bucket enforces the pipeline rather than the skill merely describing it —
`image/webp` only, 8 MB ceiling — so uploading the original now fails with
`InvalidMimeType`. That error means step 1 was skipped, and the failure-modes
table says so.

Retiring gains the reclaim audit: retired photos' objects are never reclaimed
automatically, and the query separates them from true orphans (an upload whose
insert failed). Deleting stays a deliberate act — how long a deleted photo's
bytes are kept is still undecided.

## 1.4.0

2026-08-16 — the admission rule, stated plainly: **every row in `plant_photos`
is a file someone handed us.** 1.3.0 allowed a photo fetched from a website in
under a `web` tag with rights unresolved; that is reversed, and the tag and its
removal query are gone with it.

A photo that exists as a URL is not catalogued here — the URL is captured
instead, in `inventory.image_url` when it belongs to a row, otherwise in the
report. Never download an image in order to insert it. The section says what to
do when someone hands you a URL and asks for "that photo", including the case
that resolves it: if they send you the file, it is an attachment and this skill
applies normally.

This is what keeps the schema honest — `sha256` describes bytes we hold and
`storage_path` points at an object the app can sign, with no rows where either
is a fiction.

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
