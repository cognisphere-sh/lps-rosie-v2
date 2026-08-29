# Review submitted catalog photos before publishing

- Status: staged
- Route: bhoumik
- Raised: 2026-08-26 by Chris (via nova handoff)
- Updated: 2026-08-26

## Problem

A direct catalog-photo intake needs a reliable way to receive a file, preserve what Chris actually knows about it, match it to a plant without inventing facts, and decide when it becomes a searchable catalog photo. The current catalog contains live, reviewed reference photos only; it has no intake or review state.

## Evidence

- 2026-08-26, feedback log: **Where to add catalog photos** — Chris asked where to put a catalog photo; the requested primary path is from the Photos page, with Daisy chat secondary.
- Schema and Daisy workflow review on 2026-08-26: a catalog photo is an independent reference record, not a stock claim; supplier, identity and size are optional and only recorded when stated. Daisy's photo-catalogue workflow owns current catalog-photo writes, but it has no direct-app submission/review queue.

## What it should do

- Receive photos submitted from the Photos page and retain their original intake context and the details Chris supplied.
- Treat every direct submission as awaiting review until a responsible reviewer approves it, rejects it, or asks for correction.
- Let the reviewer match the photo to an existing plant identity when the evidence supports it, or leave the identity incomplete/unmatched when it does not. Never infer a supplier, plant identity, size or dimensions from the image alone.
- Let the reviewer associate a supplier only when Chris or another source explicitly identified one.
- On approval, normalize and deduplicate the image, preserve provenance, and publish one catalog-photo record that is searchable and visible in Photos.
- On rejection or correction request, keep the item out of the live catalog and give Chris an understandable outcome.
- Allow photos sent to Daisy chat to enter the same review and publishing path, so direct and conversational intake follow one standard.

## Acceptance criteria

- A photo submitted from the Photos page does not appear in the live photo catalog until approved.
- A reviewer can see the submitted file, its source/context, supplied details and current review outcome.
- A reviewer can approve a photo with a confirmed plant match, approve it with incomplete identity, or send it back/reject it without making up missing plant or supplier details.
- An approved photo is searchable in Photos and retains its provenance; it does not claim supplier availability.
- Re-sending the same file does not create duplicate live catalog photos.
- A photo sent through Daisy chat is subject to the same review and publishing rules as one added from Photos.

## Out of scope

- Treating a photo as proof of current supplier inventory or price.
- Importing an image solely from a third-party URL.
- Automatically identifying plants, suppliers, sizes or dimensions from image appearance.
- Designing the Photos-page layout or wording (routed separately to Nova).

## Assumptions

- Daisy is the appropriate operational reviewer because Daisy already owns catalog-photo intake and every live catalog-photo write.
- The existing normalization, duplicate protection and provenance rules continue to apply once a submission is approved.
- Chris's answer can change whether all submissions require review or only ones with incomplete information; the safe default is review for all direct submissions.

## Open questions

- Chris: Should an identified photo go live immediately, or should Daisy review every new upload before it appears in the catalog?
- Bhoumik: Who should have final approval rights, and should a correction request return to Chris in the app, Daisy chat, or both?

## Handoff log

- 2026-08-26 — staged for Bhoumik: this introduces intake/review/publishing workflow and likely persistence beyond the current live-photo catalog. Nova is separately routing the Photos-page UI.
