# Show when availability was last updated

- Status: routed
- Route: nova
- Raised: 2026-08-27 by Chris (via telegram)
- Updated: 2026-08-29

## Problem

When Chris or a nursery opens an availability request from its job-request details, neither view clearly says when the availability information was last updated. They cannot tell how fresh the answer is without inferring it from the request or submission date.

## Evidence

- 2026-08-27 feedback log, **Availability last updated**: Chris asked for “data for the availability update. Last Updated: time and date” on Job Request Details in both the Nursery Portal and his view.

## What it should do

Keep full dates and availability-line detail in the existing availability-request drawer/detail view, where timestamps already belong. Do **not** move full timestamps onto the compact Job Request card.

Instead, give each availability-request link on that card a compact, scannable attention signal. For the existing Submitted state, show a small round color-coded dot and make the adjacent AR text the same color—not a full status badge. The visual treatment must retain an accessible text/status meaning. Future states can use the same compact pattern for **AR updated** or **Needs review** (with an optional changed-line count when the approved change workflow supplies one). The link opens the existing drawer for full date/time, affected lines and before → after detail.

The detail view remains the authoritative location for the labelled **Last updated** date and time using the availability-update timestamp defined in `availability-last-updated-semantics`.

## Acceptance criteria

- The Job Request card stays compact and scannable; it does not duplicate a full date/time or line-level availability table.
- Chris can see a compact state on each availability-request link—at minimum Submitted where that existing state applies—and open its existing drawer for the detail.
- A submitted AR uses a small round color dot and matching AR text color rather than a full Submitted badge; non-color text or accessible status information preserves its meaning for assistive technology and color-independent use.
- When the approved change workflow provides a pending update, the link can use the same compact pattern for Needs review and optionally show its changed-line count.
- Chris opens the drawer and sees **Last updated** with its date/time, distinguishable from Requested/Sent and Submitted dates, plus the relevant line detail.
- A nursery opens that same availability request in the portal and sees the same availability-update time once the semantics are defined.

## Out of scope

- A dense timestamp/date block or duplicated line detail on the Job Request card.
- A separate last-updated value for every individual line.
- Changing the supplier’s availability answers or request statuses.
- Showing catalogue ingestion dates as though they were a nursery’s answer to this request.

## Assumptions

- One request-level freshness time is what Chris meant, rather than a timestamp beside every line.
- The time should be shown in a human-readable date-and-time format in each view.

## Open questions

- **Bhoumik:** The basic Submitted card signal can use the existing lifecycle state; AR updated / Needs review and changed count depend on the staged availability-change and timestamp semantics.

## Handoff log

- 2026-08-27 — drafted after app/schema review. Not sent to Nova by this task because the display cannot truthfully choose a timestamp until the semantics are decided.
- 2026-08-29 — Bhoumik clarified that AR links already open the timestamped drawer; redirected the card slice to a compact attention state, preserving scanability and avoiding duplicate detail.
- 2026-08-29 — after the Submitted badge release, Bhoumik requested a round color dot plus matching AR text color instead of the full badge, with accessible status meaning retained. Nova already has this UI refinement.
