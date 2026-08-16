# Searchable supplier plant-photo catalogue — architecture and rollout plan

**Prepared by:** Nova  
**Date:** 2026-08-02  
**Status:** Planning only; no implementation or database changes made.

## Recommendation

Create the photo catalogue as an **independent domain**, not a column on `inventory`. Inventory rows are versioned/transient; useful photos may predate current availability, show plants not currently stocked, or relate to several inventory rows. Supplier and inventory relationships should therefore be optional, many-to-many links. Use a new **private** storage bucket rather than the existing public `lps` bucket.

## 1. Data model

- **`photo_assets`** — immutable file facts: UUID, private object path, MIME type, byte size, pixel dimensions/orientation, SHA-256, optional perceptual hash, original filename, original/display/thumbnail variants, created timestamp. One physical asset per exact hash.
- **`plant_photos`** — catalogue record: UUID, asset FK, title/caption, optional primary supplier FK, captured/received dates, active flag, rights/license, review status (`pending`, `approved`, `rejected`, `quarantined`), reviewer/review date/reason, provenance summary and timestamps.
- **`plant_photo_subjects`** — one or more plants depicted: verbatim source name, botanical name, common names, cultivar, commercial size text, optional height/width/caliper, normalized name key, confidence, and primary-subject flag. This survives even with no live inventory match.
- **`photo_supplier_links`** — optional many-to-many supplier relationships with type (`source`, `owner`, `offered_by`, `location`) and confidence. Keep `primary_supplier_id` only as a display shortcut.
- **`photo_inventory_links`** — optional many-to-many FK to `inventory(id)`, with link type, confidence, linked/reviewed by and timestamps. Never cascade-delete the photo when inventory is retired/deleted.
- **`photo_tags` + `photo_tag_links`** — controlled tags with slug, label, category and aliases, plus optional freeform tags initially held for review. Suggested categories: habit/form, flower/foliage color, season, condition/quality, production form, location/context, and use.
- **`photo_provenance_events`** — every receipt/import of an asset: supplier, source URL or source-file FK, email/upload/import channel, submitter, received date, source notes and rights assertion. This preserves multiple origins when exact duplicate files collapse to one asset.

Do not create a mandatory canonical-plant FK in phase 1—the current system has normalized keys and aliases but no authoritative canonical plant table. Subjects can use `normalize_plant_key` and `plant_other_names`; a canonical plant entity can be linked later without rewriting assets.

## 2. Storage and metadata

- New private bucket: **`plant-photos`**.
- Stable paths based on IDs, not mutable supplier names: `suppliers/<supplier-id>/photos/YYYY/MM/<photo-uuid>/original.<ext>`; unassigned items under `unassigned/YYYY/MM/...`.
- Generated derivatives beside the original: `display.webp` and `thumb.webp`; preserve originals privately. Store paths in DB, never derive them from user input.
- Validate magic bytes, accepted MIME types and size/dimension limits; normalize orientation. Strip EXIF/GPS from display derivatives. Retain original EXIF only if business-approved and private.
- Store caption/identity/tags in DB, not object metadata, so it is transactional, indexed and auditable.

## 3. Duplicate handling

- Compute SHA-256 before finalization. An exact match reuses `photo_assets`; add a new provenance event/link rather than another object.
- Compute perceptual hash for near-duplicate suggestions (resize/crop/re-encode). Do **not** auto-merge near duplicates—show a reviewer cluster with distance, dimensions and provenance.
- Allow intentionally distinct catalogue records to share one asset when captions, supplier context or subjects differ.

## 4. Search and indexing

Create a denormalized **`plant_photo_search`** row per photo, maintained when subjects/tags/supplier metadata change. Its document should combine botanical/common/cultivar/verbatim names, size, supplier names/aliases, tags and caption.

Expose one RPC, conceptually `search_plant_photos(search, supplier_ids, sizes, tags, status, captured_after, cursor, limit)`, returning approved catalogue records, relevance, thumbnail metadata and aggregated subjects/tags/suppliers.

Indexes:

- PGroonga over the normalized search document; keep the indexed expression byte-identical to the RPC expression.
- B-tree on status, active, primary supplier, captured/received date and link FKs.
- Unique SHA-256 on assets; indexes on tag/supplier/inventory bridges.
- Optional trigram fallback; perceptual-hash candidate lookup only after exact-hash rollout.

Treat plant terms and size as separate semantic constraints so alias + cultivar + size combinations work (`Live oak Boardwalk 30g`) rather than repeating the current whole-query alias limitation. Reuse `normalize_search_text`, `normalize_plant_key` and active `plant_other_names`. Use cursor pagination and bounded limits—never an unbounded empty-query ranking scan.

Both users and Daisy should use the same RPC. Daisy gets a small server-side CLI/tool wrapper returning IDs, names, suppliers, sizes, tags, review/freshness and signed thumbnail URLs; no separate agent-only search logic.

## 5. Provenance, freshness and review

- Track **captured_at**, **received_at**, and **reviewed_at** separately. Freshness is derived from captured date (fallback received date), not a manually edited flag.
- Never expire a photo merely because inventory disappears. Mark relationships stale/retired independently and show age in results.
- Only `approved + active` records appear to ordinary users. Pending/quarantined records are visible to reviewers/Daisy with reasons.
- Review checks: identity/size confidence, supplier relationship, image quality, duplicates, rights/attribution and privacy. Keep an append-only audit trail for metadata/review changes.

## 6. Security/RLS

- Enable RLS on every new table from day one and keep the bucket private. The existing `lps` bucket is public and is unsuitable for controlled photo access.
- Ordinary signed-in users: read approved/active records only. Uploaders: create uploads and read their pending items. Reviewers/admins: metadata, link and status management. Daisy/server service role: controlled ingestion/search.
- The app currently queries with a server secret behind the harness session, so service-role RLS bypass means **API authorization and write whitelists remain mandatory**; RLS is not sufficient by itself.
- Signed-image endpoint must accept a photo ID/variant, resolve the path from an authorized DB row, and issue a short-lived URL. Never sign an arbitrary path supplied by the browser.
- Add upload quotas, file validation, audit fields, and malware scanning/quarantine before approval.

## 7. App/API UX

- New `/photos` responsive grid: one search box plus supplier, size, tags, age and review filters; thumbnail cards show plant identity, supplier, size, captured/received date and freshness.
- Tap opens a lightbox/detail sheet with full-resolution image, all subjects/tags, provenance, rights, linked supplier and linked/current inventory. Preserve current search state on return.
- Supplier profile gains a **Photos** tab. Plant Search later gets a thumbnail/count indicator, but photos remain available even with no inventory link.
- Reviewer batch screen: pending queue, duplicate clusters, suggested supplier/inventory matches, bulk tags, approve/reject/quarantine.
- APIs: paged search/read; upload-init/finalize; metadata/link/review update; authorized variant URL. Keep all Supabase access server-side.

## 8. Migration/backfill and rollout

### Phase 0 — decisions/taxonomy

Approve private-access policy, roles, accepted formats/limits, rights/retention rules, tag vocabulary and whether GPS is ever retained.

### Phase 1 — safe foundation

Asset/catalogue/provenance/subject/link/tag model, private object layout, exact-hash dedupe, derivatives, review workflow and RPC. Pilot with a few suppliers; Daisy/admin only.

### Phase 2 — backfill

Inventory existing photo objects and known supplier folders without moving them initially; calculate hashes/dimensions, infer supplier from stable path/context, create pending subjects/tags. Auto-link inventory only on high-confidence supplier + normalized plant identity + compatible size; queue ambiguous matches for review.

### Phase 3 — user catalogue

Publish approved-only `/photos`, supplier Photos tab and signed thumbnails; monitor search relevance, signing latency, duplicates and review throughput.

### Phase 4 — integration/automation

Plant Search photo indicators, batch supplier uploads, perceptual duplicate review, tag suggestions and optional canonical-plant linkage. Suggestions never auto-approve identity or rights.

## Approval gates / success criteria

Approve before implementation:

1. Private bucket.
2. Optional/many-to-many inventory links.
3. Reviewer roles.
4. Rights/retention policy.
5. Controlled-tag starter set.

Pilot is successful when users and Daisy can find approved photos by botanical/common/cultivar name, supplier, size, name+size and tags; every result has provenance/review state; exact duplicates do not create extra assets; stale inventory links do not remove photos; and no unapproved/private object can be fetched through the app.

---

# Addendum — bulk intake, assisted enrichment, and review

## Decisions recommended

1. Treat every dump as an immutable **intake batch** with one manifest row per source item; do not upload loose photos directly into the approved catalogue.
2. Run a staged pipeline in this order: **security/metadata → exact hash/dedupe → context/EXIF → OCR → selective vision → human review**.
3. AI output is always a suggestion with evidence and field-specific confidence. **Nothing is auto-approved, and size is never inferred from visual scale.**
4. Ship quality-focused batch review before points or leaderboards. Gamification may reward verified accuracy and useful completion, never raw speed.

## Intake channels and provenance

- **Folder/ZIP:** browser drag-and-drop accepts folders and ZIPs while retaining each file’s original relative path. ZIP intake rejects traversal paths, encrypted archives, unsupported types, decompression bombs and configured file/count limits before extraction.
- **Mobile:** multi-select from camera roll/camera into a named batch, with optional supplier/project applied to the batch and editable per photo. Upload continues in the background when the browser permits and clearly resumes after reconnect.
- **Email:** a dedicated intake address creates one batch per message, or conversation if explicitly selected. Preserve message ID, sender, recipients, subject, received date, body/context and attachment names; quarantine unknown senders and links rather than fetching automatically.
- **Shared fields:** batch ID, channel, uploader/source identity, supplier/project supplied by the human, received time and intake notes. Per item preserve original filename, relative folder/ZIP path, archive name, source message ID, file modified time, EXIF capture time/time zone, byte count and immutable original object path.
- Folder names, filenames, email text and batch-level supplier/project are **evidence**, not authoritative plant identity. Never silently replace source values after normalization.

Use resumable, chunked uploads directly to a private quarantine area, keyed by stable batch/item IDs. Persist uploaded ranges and checksums so retries continue rather than restart. A finalize step verifies byte count and server-side SHA-256 before an item enters enrichment. A client hash may skip a known upload, but the server must verify new bytes.

## Dedupe before expensive processing

- Compute MIME/magic-byte validation, dimensions and SHA-256 first. If the hash already exists, reuse the existing physical asset, attach the new provenance event and skip OCR/vision.
- Keep duplicate occurrences visible in the batch manifest so reviewers know every source was accounted for.
- Perceptual hashing and near-duplicate clusters come later. They may suggest same scene/crop, but never auto-merge records with different supplier, project or provenance context.

## Enrichment and confidence model

Build a suggestion set with value, confidence, evidence source, model/version and timestamp **for each field independently**:

- plant/species identity
- cultivar
- commercial size
- supplier
- tags

Evidence sources, cheapest first:

1. Batch assignment, folder path, filename and email/project context.
2. EXIF capture date, orientation and permitted location metadata; strip GPS from user-facing derivatives.
3. OCR from labels, signs, pots, filenames embedded in screenshots and availability sheets.
4. Existing catalogue context: supplier vocabulary, known aliases, nearby files in the same folder/batch and explicit inventory matches.
5. Vision only when earlier evidence leaves a useful unresolved question.

Confidence must not be collapsed into one photo score: supplier can be high-confidence while cultivar is low-confidence. Show why each suggestion exists, such as `OCR: “Platanus mexicana #30”` or `folder: Top Notch/July`.

**Hard rules:**

- No AI suggestion changes catalogue state without a human action.
- Never guess commercial size from apparent plant/pot scale. Suggest size only from explicit OCR/text/context and retain the quoted evidence; otherwise leave it blank.
- Do not upgrade species to cultivar without cultivar-specific evidence.
- Low-confidence or conflicting evidence stays unresolved; `unknown` and `not enough information` are valid outcomes.

## Review lanes and interaction

- **High confidence:** quick-confirm lane. Large image plus evidence and suggested fields; one action confirms only visible values. Random quality-control sampling still applies.
- **Medium confidence:** compare lane. Show top alternatives, OCR crop/text, contextual evidence and current catalogue matches; reviewer edits/chooses field by field.
- **Low/conflicting confidence:** identify lane. Manual entry/search, `unknown`, `not a plant`, `duplicate`, `rights unclear`, or specialist escalation.

Batch UX supports multi-select and scoped actions such as supplier/project, tags, captured date, reject/quarantine and same-plant-as-selected—but not bulk plant identity/size unless every selected thumbnail and evidence is visible and the reviewer explicitly confirms scope. Provide keyboard controls on desktop and swipe actions on mobile, with undo and confirmation for destructive/broad actions. Remember filters/place and allow reviewers to claim separate batch slices.

## Learning, collaboration, and reversibility

- Store suggestions separately from accepted metadata. Every accept, edit, reject and unknown becomes a correction event with before/after values, reviewer, timestamp and evidence.
- Corrections may improve alias dictionaries, prompts, routing and future model evaluation only through a reviewed/versioned release. They must **never silently rewrite previously approved photos**.
- Approved records use versioned metadata. Changes create a new revision; retain prior revisions and provide one-click revert.
- Use item claims/leases or optimistic version checks to prevent reviewers overwriting one another. Show reviewer, comments, status history and conflicts. Admins can reopen and audit batches.

## Lightweight gamification

Start with team progress, not competition: batch completion bar, reviewed/remaining counts, quality streaks and milestones. If points are added, award them after validation for:

- an accepted accurate review
- resolving a medium/low-confidence item
- finding a true duplicate or rights/privacy problem
- useful corrections later confirmed by another reviewer
- completing a coherent batch with low reopen/error rate

Reduce/revoke credit for reverted work; weight quality and difficulty, cap repetitive bulk actions, and do not rank by reviews per minute. Prefer team goals and personal improvement to public speed leaderboards. Allow opt-out and audit whether incentives increase mislabels or overconfident approvals.

## Cost controls

- Metadata, type validation, hashes and existing-context matching run first and cheaply.
- OCR/vision run only for a new unique asset, never each duplicate occurrence.
- Stop enrichment when OCR/context already supplies sufficient explicit evidence for the review lane; do not call vision merely to confirm it.
- Route tasks: local/cheap OCR first; small vision model for labels/general tags; stronger model only for unresolved, high-value medium/low cases. Cultivar identification defaults to human review rather than repeated expensive calls.
- Batch model requests where supported, cache by asset hash + model/prompt version, cap retries/tokens/images and record cost per batch/item/stage.
- Generate small inference derivatives rather than sending originals. Permit budget ceilings and a queue state such as `awaiting_budget` instead of uncontrolled spend.

## Success metrics

Track upload resume success; files accounted for versus manifest; exact dedupe rate and avoided processing cost; median time/cost per unique asset; percentage resolved by context/OCR without vision; field-level suggestion precision/accept/edit/unknown rates; reviewer agreement and reopen/revert rates; approved photos per batch; low-confidence backlog age; provenance/rights completeness; and security/privacy incidents. For gamification, compare error/reopen rates before and after—not just throughput.

## Recommended rollout

### MVP

- Folder/ZIP and mobile multi-select intake into private quarantine.
- Immutable batch/item manifests, resumable uploads, server-verified SHA-256 dedupe and preserved provenance.
- Metadata/EXIF plus OCR; context matching; vision only for unresolved new assets under a budget cap.
- Separate field confidences/evidence, strict no-auto-approval/no-guessed-size rules.
- High/medium/low review lanes, keyboard basics, mobile swipe/undo, batch supplier/project/tag actions.
- Approved-only publish gate, audit log, optimistic conflict protection and revision/revert.
- Team progress and completion milestones only.

### Later phases

- Email ingestion after sender trust, quarantine and rights policies are proven.
- Perceptual duplicate clustering; specialist queues; richer collaborative comments/claims.
- Evaluated active-learning releases from reviewer corrections and smarter model routing.
- Quality-adjusted badges/team challenges after sufficient baseline error data.
- Native/background mobile enhancements and deeper project/inventory matching.

**MVP release gate:** a large interrupted dump can resume; every source file is accounted for; exact duplicates incur no repeat AI cost; reviewers can see evidence and confidently leave fields unknown; no item reaches ordinary users without explicit approval; and every approved value can be traced and reverted.
