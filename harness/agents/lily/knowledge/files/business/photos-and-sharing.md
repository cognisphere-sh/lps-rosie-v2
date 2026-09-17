# Big-specimen plant photos and sharing

Updated: 2026-09-17T09:23:07-05:00.

## Current direction

- 2026-09-17T09:21:56-05:00 — Chris wants labeling/supplier contact details removed from **big specimen** photos, not “small bread and butter items”. He offered: “ok. you could always serve them up to me, i can use my pixel to magic erase.” Parent343 acknowledged this manual option. Known specimen context or explicit Chris selection is enough; he supplied no size/value cutoff and requested no new taxonomy. Source: direct Chris Telegram342 at09:21:02, feedback **Pixel cleanup for big specimens**.
- 2026-09-17T09:21:56-05:00 — The agreed immediate option uses Chris's Pixel, the returned edited copy and the retained original/source with a simple association. It is not a deployed automatic email-forwarding/editing/ingestion pipeline. Paid-tool integration/evaluation and new media/data work are parked; there is no immediate Bhoumik integration decision to chase. This is another concrete example of choosing limited human work over a larger technical solution.
- 2026-09-17T09:21:56-05:00 — Natural finish remains core: “we dont want the editing to be obvious” (Chris1226/1228 via Daisy). Label artwork, including SPECIAL/name/size text, may go if the result remains faithful; source-stated information can remain internally or in an approved truthful caption rather than burned into the image. The actual plant, condition, useful container/size context and internal source evidence must not be misrepresented. A clean original is preferable if removal requires inventing plant detail; obtaining one from a supplier is not automatically authorized.
- 2026-09-17T09:21:56-05:00 — Audience/reuse scope is still unresolved; parent340 already asks audience. A returned edit is not permission for customer delivery, public marketing, copyright/license-notice removal or catalogue publication. Rosie retains coordination and separately approved customer sends. No cleanup-helper ownership/routing change or Rosie-to-Daisy handoff follows.

## Existing support and limits

- 2026-09-17T09:04:45-05:00 — Daisy's `plant-photo-catalogue` owns catalogue writes and receives supplied plant images via `availability-ingestion`. The catalogue treats photos as reference material, never stock confirmation; source-stated identity/size and provenance matter. It normalizes supplied images to private WebP references, strips embedded metadata including GPS and deduplicates; it is explicitly not a guaranteed original-file archive.
- 2026-09-17T09:21:56-05:00 — `/photos` edits descriptions, not pixel overlays, and displays supplier/provenance. A normal catalogue link is not a supplier-neutral sharing substitute. These limits do **not** justify new media tables/archive/review machinery for the agreed manual option. Earlier catalogue-intake/review and upload-page proposals remain separate.
- 2026-09-17T09:12:00-05:00 — Nova's official-doc research found no supported Google Photos Magic Eraser/editing API. Separate paid OpenAI/Gemini APIs were potential evaluation candidates, not selected tools or tested results; masks do not guarantee unchanged plant material. Account/quality/privacy/cost acceptance was not tested and no authentication, uploads, edits, billing or implementation occurred. This research is now parked reference material; consumer Pixel editing does not depend on it.
- 2026-09-17T09:23:07-05:00 — Daisy and Nova were informed internally of the narrowed manual direction, with no demand to change skills/code/routing. Nova acknowledged research complete and no further integration/evaluation work. Future automation requires separate approval.

## Sources

- `../feedback.md`: September17 photo-cleanup entries; current requirement `../requirements/supplier-photo-cleanup.md`.
- Parent Telegram341 staged initial tool/workflow idea; Chris342 and parent343 supersede the immediate tool decision with the manual Pixel option.
- Reference inspected without copying: `../daisy/plugins/telegram/inbox/photo_1224.jpg` (agent-root-relative).
- Read-only current-source context: Daisy `plant-photo-catalogue` / relevant `availability-ingestion` sections; Rosie `quote-generation` / `customer-coordination` sharing boundaries; `../../../app/app/photos/page.tsx` and photo sections of `../../../docs/app/README.md` / `../../../docs/supabase-schema.md`.
- Nova's dated evidence/cost/access/privacy/lifecycle report: `../nova/workspace/threads/main/tasks/photo-eraser-api-feasibility/notes.md` (agent-root-relative); no model/price commitments retained here.
