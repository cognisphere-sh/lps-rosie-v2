# Add catalog photos from the Photos page

- Status: staged
- Route: nova
- Raised: 2026-08-26 by Chris (via nova handoff)
- Updated: 2026-08-26

## Problem

Chris cannot tell where to add a photo to the catalog. The current Photos page lets him browse, correct and remove existing photos, but gives him no visible starting point for a new one. Sending a photo to Daisy should remain possible, but should not be the only route people can discover.

## Evidence

- 2026-08-26, feedback log: **Where to add catalog photos** — Chris asked whether an add button belongs on the catalog page or whether he should use Daisy or Lily.
- App review on 2026-08-26: `/photos` has browse, lightbox edit and delete controls, but no add control.

## What it should do

- Put a clear primary **Add photo** action on the Photos catalog page.
- Open an intake experience from that action where Chris can select one or more image files and provide any information he knows: plant name, supplier, size, a short description, tags and when the photo was taken.
- Make it clear which information is optional and that unknown details can be left blank rather than guessed.
- Show each submitted item as awaiting review, with a plain explanation that it will appear in the catalog after the review workflow is complete.
- Direct Chris to Daisy chat as an alternative when he would rather send a photo with context conversationally; Lily is not a photo-intake destination.
- This interface must use the review/publishing workflow in `catalog-photo-intake-review`; it must not imply that a submitted file is already a live catalog photo.

## Acceptance criteria

- Chris opens **Photos** and can find an **Add photo** action without asking an agent.
- Chris can choose one or more photos and enter only the details he knows, then submit them.
- Chris sees confirmation for each submission and can tell it is awaiting review rather than already in the public catalog.
- The screen gives Chris a clear secondary option to send a photo to Daisy with context.
- Existing photo search, view, edit and delete behavior remains available.

## Out of scope

- Changing a supplier's availability or claiming that a photo means the plant is in stock.
- Downloading images from supplier websites.
- Making Lily an operational photo-upload channel.
- Deciding the storage, normalization or database design for submitted images.

## Assumptions

- `/photos` is the appropriate business home because it is already the catalog Chris uses to browse and maintain photos.
- The button and intake screen can be delivered as UI/UX work, while actual review status and publishing are governed by the staged workflow requirement.

## Open questions

- Chris: Should an identified photo go live immediately, or should Daisy review every new upload before it appears in the catalog? Until answered, show all direct uploads as awaiting Daisy review.

## Handoff log

- 2026-08-26 — routed to Nova for the Photos-page entry point and intake experience; persistence and review workflow are separately staged for Bhoumik.
- 2026-08-26 — Nova accepted the approved UI/UX work and began assessment of `/photos`; it will not create fake submission persistence while the backend workflow is staged.
- 2026-08-26 — Nova made no code changes: no durable multi-image intake, submission/status retrieval, approval/publishing handoff, or confirmed Daisy convergence exists. The UI cannot honestly meet its acceptance criteria until the staged workflow supplies those capabilities; Nova will resume after that contract ships.
