# Give Chris big-specimen photos for manual Pixel cleanup

- Status: staged — manual workaround agreed; automation/integration and new media/data work parked
- Route: bhoumik — future workflow/automation only; no immediate paid-editing decision needed
- Raised: 2026-09-17 by Chris (initially via Daisy, then directly in Lily Telegram)
- Updated: 2026-09-17T09:23:07-05:00

**Current disposition:** Chris offered to clean selected big-specimen photos himself on his Pixel. This is the agreed low-complexity option, not a deployed automatic pipeline. The earlier editing-tool/owner decision is no longer a blocker for this manual option.

## Problem

Supplier photos of big specimen plants can carry labels, promotional badges and supplier contact details that Chris does not want in the sharing image. He wants natural-looking cleanup, but does not need an editing integration for now: he can use Magic Eraser on his Pixel. Small routine “bread and butter” items are explicitly excluded.

## Evidence

- Chris Telegram1224 via Daisy, approximately2026-09-17T09:03-05:00: “Are you able to edit photos like these? If we get supplier emails with phtotos we would want to remove as much labeling and supplier info as possible. TLike the phone number.”
- Reference inspected in place: boxed tree with SPECIAL badge, `60" BOX LACEBARK ELM` label and phone/delivery footer. Broad top cropping would sacrifice canopy context. Labels beyond the phone number can be removed when the result stays natural and faithful.
- Chris1226/1228 via Daisy: “we dont want the editing to be obvious”. Obvious cover patches do not meet the quality requirement.
- Chris directly in Lily Telegram342, 2026-09-17T09:21:02-05:00:

  > ok. you could always serve them up to me, i can use my pixel to magic erase.
  >
  > only big specimen materials, not small bread and butter items.

- Parent acknowledged this manual, big-specimen-only option in Telegram343. Nova's completed official-doc finding—no supported Google Photos Magic Eraser API—remains reference context, not a reason to pursue another paid integration now.

## What it should do

- For a selected big-specimen plant photo, make that photo available to Chris for his own Pixel cleanup. Use known specimen context or Chris's explicit selection, not a guessed size/price threshold or a new plant classification system. Do not bulk-forward incoming photos.
- Use Chris's returned edit as the candidate sharing copy, keeping it simply associated with the original file and internal source context. Do not overwrite the original or create a new archive/database workflow for this manual option.
- Preserve the actual plant appearance, condition and useful physical size/container context. Label artwork may be removed; its source-stated plant/size information can remain internally or in an approved truthful caption, not necessarily burned into the image. Do not infer measurements or current availability.
- Keep the natural-finish requirement: no obvious blur/cover patches or misleading invented branches, foliage, trunk, condition or size evidence. A Pixel-returned edit is not exempt from fidelity review. If a natural-looking result would hide or invent meaningful plant evidence, retain that limitation and prefer a clean original rather than claim it is accurate; no supplier outreach is automatically authorized.
- Keep customer delivery/publication separate. A returned edit is not blanket permission to send, publish, remove copyright/license notices or reveal internal source information. Normal Rosie/Chris send controls and applicable image-reuse permissions remain.

## Acceptance criteria

- Chris can receive the selected big-specimen photo for manual Pixel editing without waiting for a paid image API, plugin or catalogue redesign.
- Small routine items do not enter this cleanup work by default; ambiguous material is not silently classified using a made-up size/dollar cutoff. Explicit Chris selection or established specimen context defines the case.
- A returned image is identifiable as the edited copy of the correct original; the original and source context remain internally retrievable with a simple file/note association, not an overwritten image.
- The candidate sharing image looks natural while faithfully depicting the actual plant. Removed name/size labeling does not erase the source-stated information internally or from an approved caption. Unresolved artifacts or misleading plant changes are not described as a successful cleanup.
- Receiving the original or returned edit triggers no bulk forwarding, automatic customer send, catalogue publication, public gallery or new routing. Existing send approval remains separate.

## Out of scope

- Small “bread and butter” material, new taxonomy, guessed specimen size/value thresholds or speculative supplier-wide cleanup.
- Automated ingestion/editing/forwarding, paid-tool evaluation, new Photos/API integration, tool installs, authentication, billing or image uploads to a new provider.
- New media tables, archive pipelines, review queues, Photos-page redesign or public gallery; no dependency on the separate catalogue intake/review backlog.
- Plant beautification, invented hidden plant detail, copyright/license-notice removal without permission or blanket redistribution rights.
- Supplier outreach, supplier/order ownership changes, a Rosie-to-Daisy coordination handoff, or skill/code changes. Any future agent-owned procedure change still needs the relevant approval and owner.

## Assumptions

- Chris's Pixel offer is sufficient for the immediate manual option; consumer Magic Eraser access does not require an LPS API integration. No edited file has yet been returned or tested in this task.
- “Big specimen” is an operational context or Chris selection, not a new product category to persist. No objective cutoff was supplied.
- External audience remains unresolved. Preparing/returning a file for Chris does not establish a customer/public marketing use or publication rights.
- Existing communication owners continue; no new cleanup helper owner or automatic route is assigned. Future automation remains a separate Bhoumik decision if raised again.

## Open questions

- Audience/reuse scope for any actual external send remains pending with parent Telegram340; do not repeat the question or block this recorded manual direction on a general publishing policy.
- Future automation/new media work is parked, not an active decision to chase. Revisit only with separate approval; no paid-editing-integration decision is needed for the manual workaround.

## Handoff log

- 2026-09-17T09:04:45-05:00 — Initial original/cleaned-copy/review workflow staged for Bhoumik; no Nova build or actual image edit/send.
- 2026-09-17T09:05:55-05:00 — Chris's natural-finish clarification superseded cover-if-feasible acceptance. Nova already owned API feasibility research.
- 2026-09-17T09:10:45-05:00 — Parent clarified labeling scope includes SPECIAL/name/size artwork where faithful, with information retained internally or an approved caption; simple files preferred, no coordination handoff.
- 2026-09-17T09:12:53-05:00 — Nova's no-supported-Magic-Eraser-API finding incorporated; separate paid candidates were evaluation-only and untested. Parent notified Chris/Bhoumik in Telegram341; no integration/test/spend approved.
- 2026-09-17T09:21:56-05:00 — Chris342/parent343 agreed the narrower manual Pixel option for big specimens only. Automated editing/integration and new media/data work parked; earlier immediate tool/owner decision superseded. Daisy main and Nova main informed internally with successful delivery; no demand for skills/code changes, no duplicate Telegram, no actual photo transfer/edit/publication performed by this task.
- 2026-09-17T09:23:07-05:00 — Nova acknowledged integration/evaluation parked and research complete, with no further work, code/skill/routing change or duplicate Telegram.

## References

- Feedback log September17: **Remove supplier details from photos**, **Photo cleanup must look natural**, **Magic Eraser is not an API**, **Pixel cleanup for big specimens**.
- Reference image: `../daisy/plugins/telegram/inbox/photo_1224.jpg` (agent-root-relative, inspected without copying).
- Existing catalogue context: Daisy `plant-photo-catalogue`/`availability-ingestion`, current `../../../app/app/photos/page.tsx` and photo sections in `../../../docs/app/README.md` / `../../../docs/supabase-schema.md`. Catalogue stores normalized reference images, not a guaranteed original archive, and shows supplier/provenance; no new schema is implied by the manual option.
- Separate parked integration research: `../nova/workspace/threads/main/tasks/photo-eraser-api-feasibility/notes.md` (agent-root-relative). No model IDs/prices frozen; reverify only if a later evaluation is approved.
- Related but separate: `catalog-photo-intake-review.md`, `catalog-photo-upload-page.md`.
