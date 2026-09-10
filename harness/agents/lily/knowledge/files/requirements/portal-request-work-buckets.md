# Keep wholesale availability requests in clear work buckets

- Status: routed
- Route: nova
- Raised: 2026-09-03 by Chris (via nova handoff)
- Updated: 2026-09-03

## Problem

The supplier/wholesale availability-request portal currently makes a supplier choose one tab at a time, begins on All, and uses inconsistent or quiet status treatment: New is blue, Processing is unaccented, and Completed is orange. That does not present the real work queue clearly or consistently as requests arrive, are being answered, and are sent back to LPS.

## Evidence

- 2026-09-03 feedback log, **Wholesale request work buckets**: Chris defined New, Processing and Completed as the portal work buckets; he specified the semantic colors, multi-select behavior and truthful queue counts.
- Current app audit: `new`, `processing` and `submitted` already have durable request meanings and transitions. The portal presently filters by one selected tab (`All` by default), while Completed is the visible label for `submitted`.

## What it should do

On the portal’s **By request** view, present the existing open-request states as three selectable work buckets:

- **New** — blue.
- **Processing** — amber/orange.
- **Completed** — green (the existing submitted state, displayed as Completed).

Use the same semantic color on each bucket’s filter/count and on the matching request row/card. Labels, icons, selected state and accessible text must communicate state without relying on color. Red is reserved for errors, blocked work and destructive actions, not normal request completion.

Replace the single-choice tabs with a multi-select bucket filter. New and Processing are selected by default, so the normal landing view is the current open work; Completed starts excluded. The supplier can deliberately include or exclude any bucket, and **Select all** selects all three. Bucket counts always describe the complete current open workload, not only the filtered result. The empty/all-caught-up message must be truthful: distinguish no open requests from no requests in the current selection, and do not say work is caught up merely because active buckets were hidden.

After a supplier submits a request, refresh the list and immediately remove that request from the normal New + Processing selection; it appears only if Completed is selected. Preserve the current request detail, Submit/Re-Submit behavior, closed-request separation, authorization, API responses and existing New → Processing → submitted/Completed semantics.

A bucket selection is a short-lived viewing choice, not a supplier setting. Reset it on each fresh portal visit to New + Processing. This matches the portal’s current non-persistent tab behavior and makes the default work queue predictable; do not store it across visits or devices.

The future wholesale/job top line may show a persisted date and Delivery/Pickup only once Bhoumik’s existing `job-request-install-date-fulfillment` contract supplies those facts. This UI change must not display blank placeholders, infer either value from addresses/notes, or create a non-persisting selector.

## Acceptance criteria

- A supplier opening the portal’s By request view sees New and Processing selected, Completed unselected, and only New/Processing requests in the initial list.
- New is visibly blue, Processing amber/orange and Completed green in both bucket controls/counts and matching request rows/cards; normal completion never uses red.
- Each state remains understandable through its written label and programmatic state/selection information without color perception.
- The supplier can select multiple buckets independently; Select all includes New, Processing and Completed; counts remain global and accurate as selections change.
- Completing/submitting a request refreshes the list and removes it immediately from the default active selection; selecting Completed reveals it.
- Empty states accurately distinguish no open requests, no requests in the selected buckets, and an actually empty active queue.
- A fresh portal visit resets the filter to New + Processing; one supplier’s temporary selection is not persisted as an account/device preference.
- Existing status writes, permitted actors, Submit/Re-Submit behavior, closed-request access and portal authorization behave exactly as before.
- No date or Delivery/Pickup information is invented or shown until its approved persisted contract exists.

## Out of scope

- Changing stored availability-request statuses, transitions, permissions, APIs or supplier access.
- The separate Request-versus-Order plant-status model and migration in `availability-status-model-parity`.
- Closed-request workflow or the closed-request destination.
- Adding date, Delivery/Pickup, payment, tax, gate or other wholesale/job facts before the staged contract.

## Assumptions

- Chris’s “Completed” is presentation for the existing supplier-submitted request state, not a new stored terminal status.
- “Wholesale request” here means the current supplier portal’s availability-request work queue; it does not establish a distinct wholesale-supplier workflow.
- Resetting the filter per fresh visit is preferred over persistence because the portal is a short operational queue and has no existing preference convention; Chris can overturn this if power users need a remembered deliberate view.

## Open questions

- None for the safe UI slice. If Chris intends different state meanings or transitions, that is a Bhoumik workflow decision rather than a Nova UI change.

## Handoff log

- 2026-09-03 — routed to Nova: UI-only bucket/filter and semantic presentation refinement; preserve the existing status/API contract.
- 2026-09-03 — Nova accepted: safe UI-only work is being routed; stored transitions/APIs remain untouched, with technical review and real-browser visual QA blocking deployment.
- 2026-09-03 — Nova technical review blocked deployment despite 236/236 automated checks: light-theme semantic colors lack contrast; refresh can apply stale responses or swallow failure; page-level rendered evidence is missing. Nova is remediating; visual gate remains required afterward.
