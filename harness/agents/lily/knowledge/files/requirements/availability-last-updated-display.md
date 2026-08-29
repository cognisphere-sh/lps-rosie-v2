# Show when availability was last updated

- Status: drafted
- Route: nova
- Raised: 2026-08-27 by Chris (via telegram)
- Updated: 2026-08-27

## Problem

When Chris or a nursery opens an availability request from its job-request details, neither view clearly says when the availability information was last updated. They cannot tell how fresh the answer is without inferring it from the request or submission date.

## Evidence

- 2026-08-27 feedback log, **Availability last updated**: Chris asked for “data for the availability update. Last Updated: time and date” on Job Request Details in both the Nursery Portal and his view.

## What it should do

On the detail view of the same availability request in both Chris’s LPS view and the Nursery Portal, show a clearly labelled **Last updated** date and time using the availability-update timestamp defined in `availability-last-updated-semantics`.

The two audiences see the same time for the same request. The timestamp identifies freshness of the availability response; it is not the date the request was sent or merely the date it was opened.

## Acceptance criteria

- Chris opens an availability request from a job request and sees **Last updated** with its date and time.
- A nursery opens that same availability request in the portal and sees the same **Last updated** date and time.
- The label is distinguishable from Requested/Sent and Submitted dates.
- The displayed time follows the approved availability-update semantics after a new answer or qualifying update.

## Out of scope

- A separate last-updated value for every individual line.
- Changing the supplier’s availability answers or request statuses.
- Showing catalogue ingestion dates as though they were a nursery’s answer to this request.

## Assumptions

- One request-level freshness time is what Chris meant, rather than a timestamp beside every line.
- The time should be shown in a human-readable date-and-time format in each view.

## Open questions

- Blocked by `availability-last-updated-semantics`: whether the time means a nursery’s most recent answer/update only, or any latest change to the request including an LPS-entered answer.

## Handoff log

- 2026-08-27 — drafted after app/schema review. Not sent to Nova by this task because the display cannot truthfully choose a timestamp until the semantics are decided.
