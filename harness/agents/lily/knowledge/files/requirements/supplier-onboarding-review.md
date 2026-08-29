# Keep supplier-qualification decisions out of Telegram

- Status: staged
- Route: bhoumik
- Raised: 2026-08-28 by Chris (via Daisy handoff)
- Updated: 2026-08-28

## Problem

Chris needs to qualify a large set of potential suppliers jointly with Daisy. Telegram can move a manual batch of ten, but decisions and their reasons disappear into chat and cannot reliably be found, resumed, or used to choose the next suppliers. Original-list provenance is mostly unavailable: of 91 Texas-service holds, one is confirmed to be from the original group and 90 are unknown, so that uncertainty must remain visible rather than being silently treated as a negative.

## Evidence

- 2026-08-28, **Supplier qualification in Telegram**: Chris asked whether Telegram is an efficient place to jointly qualify suppliers; the immediate review needs supplier, location, current Type, original-list provenance when available, Texas-service evidence, and a recommendation.
- Daisy reports that Type/tag migration is complete, but original-list membership is confirmed for only 1 of 91 Texas-service holds; 90 remain unknown.

## What it should do

Provide an Onboarding Review area under Suppliers where Chris and Daisy can work through candidate suppliers in small batches and return to past decisions. For each reviewed supplier, it should show the supplier and location, current Type, any known original-list provenance, Texas-service evidence, and the resulting recommendation with its reason. Unknown evidence must be shown as unknown.

It should let the team distinguish suppliers to pursue now, retain for later, and resolve by a call, then resume the review without relying on Telegram history. The short-term process remains Daisy presenting ten suppliers at a time in Telegram; this requirement does not change Daisy's workflow yet.

## Acceptance criteria

- Chris can open an Onboarding Review section from Suppliers and see suppliers awaiting or previously given a qualification decision.
- Each review visibly shows supplier, location, current Type, original-list provenance when known (otherwise “unknown”), and Texas-service evidence.
- Chris and Daisy can record a recommendation and its reason, and see it after leaving and returning to the app.
- The review can identify the next small group of undecided suppliers without re-reading Telegram.
- A supplier with no confirmed original-list membership is never presented as excluded solely because the evidence is missing.

## Out of scope

- Replacing Telegram for the immediate ten-at-a-time manual review.
- Changing Daisy's supplier-onboarding or availability-ingestion workflow.
- Reconstructing or guessing original-list membership for the 90 unknown Texas-service holds.
- Automatically contacting suppliers or changing LPS Partner status.

## Assumptions

- “Current Type” means the already-migrated supplier Type shown in the app.
- “Texas-service evidence” is evidence for serving Texas, not a promise to supply every Texas project.
- The initial outcome set is pursue now, retain for later, and needs call; Chris can revise it.

## Open questions

- Chris: Are **pursue now**, **retain for later**, and **needs call** the complete set of review outcomes, and is a free-text reason enough for each, or does he need a fixed reason list?

## Handoff log

- 2026-08-28 — staged for Bhoumik because retaining decisions, reasons, and review state is a new supplier workflow/data capability; no independently shippable UI slice was sent to Nova.
