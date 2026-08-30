# Define and retain the availability-update time

- Status: staged
- Route: bhoumik
- Raised: 2026-08-27 by Chris (via telegram)
- Updated: 2026-08-27

## Problem

Chris needs a trustworthy Last updated date and time for availability on an individual request. The current timestamps do not unambiguously provide that meaning: the request timestamp changes when the request itself is changed, while line timestamps can change for either nursery or LPS activity. A timestamp that says only “Last updated” would otherwise make a request look newly updated when it was only changed internally, or fail to move after a later nursery line update.

## Evidence

- 2026-08-27 feedback log, **Availability last updated**: Chris asked for availability-update data, “Last Updated: time and date,” in the Nursery Portal and his Job Request Details view.
- Current behavior review, 2026-08-27: **Submitted** is already the completion signal—the nursery presses Submit, which marks the request Submitted and records a submission time. It does not say when a later qualifying availability update occurred.
- 2026-08-27 feedback log, **Availability collaboration and master**: Chris asked whether concurrent nursery and LPS updates reflect on both sides and which side is master. Today the shared answer is last-save-wins, while the underlying JR line is a separate snapshot and does not reconcile automatically.

## What it should do

Define one request-level availability-update time and make it reliably available to both views. It represents a supplier/nursery re-submission or availability update and is accompanied by a notification to Chris/Rosie; it must not be treated as a Job Request status change.

The decision must state which events advance it and whose activity counts. At minimum, distinguish a nursery updating an availability answer from LPS creating, routing, closing, or otherwise editing a request. The chosen meaning must remain valid when the nursery updates another line after the request has already entered Processing.

Define the rule for concurrent LPS and nursery changes to the same answer, including whether LPS is allowed to overwrite a nursery-provided answer and what the reader is told when that happens. Decide separately whether a completed supplier answer should update or be reconciled into the original job-request line; today the two are intentionally separate snapshots.

It must remain separate from the request’s Sent/Requested time and from **Submitted**, which continues to mean the nursery has completed and handed back the request.

## Acceptance criteria

- The business can state in one sentence what **Last updated** means and which action changes it.
- A qualifying availability update records a date and time that both views can read for the request.
- A later qualifying nursery update on any line advances the request’s availability-update time.
- Non-qualifying LPS administration does not make the displayed availability freshness look newer.
- When both sides can change an answer, the documented rule determines whose saved value is shown and avoids silently presenting an LPS overwrite as a nursery update.
- The relationship between supplier answers and the original job-request line is explicit; no one assumes they synchronize automatically.
- The completion state remains **Submitted** with its submission date/time; Last updated is not treated as proof of completion.

## Out of scope

- Redefining the New / Processing / Submitted / Closed request lifecycle.
- Treating a catalogue ingestion date as an answer to a specific availability request.
- A historical timeline of every individual edit.

## Assumptions

- Chris wants freshness of the nursery’s availability response, not simply the last database modification to any related record.
- One request-level value is sufficient for the first release.

## Open questions

- **Bhoumik:** Confirm the exact qualifying supplier events and durable event/time design, retaining the supplier-versus-LPS actor distinction; Chris has decided that supplier updates drive notification/freshness and do not change the customer-facing Job Request stage.
- **Chris:** When LPS and a nursery both edit the same availability answer, should the latest save simply win, should one side be protected, or should an LPS change be recorded as an override?
- **Chris:** After the nursery completes an answer, should its values update the original job-request line automatically, or remain a separate supplier response for Chris to review?
- **Bhoumik:** Once Chris confirms the meaning, decide whether the existing activity timestamps can truthfully support it or whether the workflow must retain a dedicated availability-update event/time and conflict/override provenance.

## Handoff log

- 2026-08-27 — staged for Bhoumik after review. No message sent by this task’s instruction; awaiting the single semantics clarification before a durable behavior is chosen.
