# Mark changed availability in Requests and Orders

- Status: drafted
- Route: nova
- Raised: 2026-08-27 by Chris (via telegram)
- Updated: 2026-08-27

## Problem

Chris needs to notice when a nursery’s later availability update changes information that was previously used on a Request or confirmed Order.

## Evidence

- 2026-08-27 feedback log, **Availability changes after quote**: Chris wants changed fields highlighted in both Requests and confirmed Orders.

## What it should do

When the approved availability-change workflow supplies a pending nursery change and its before/after values, clearly mark the affected Request or Order. On a compact Job Request card, use only a small **Needs review** state and optional changed-line count beside the relevant availability-request link; do not duplicate dates or line differences there. Opening the existing availability-request drawer/detail view shows the changed line fields as before → after and provides the acknowledgement/resolution action.

## Acceptance criteria

- Chris can scan Requests and Orders and identify records with unacknowledged nursery availability changes without crowding the compact card.
- The relevant availability-request link shows Needs review and, when available, the changed-line count.
- Opening the existing drawer/detail shows the affected supplier, line, changed fields, prior value and new value.
- The change remains visibly pending until the workflow records acknowledgement/resolution.
- LPS edits and nursery submissions are labelled differently.

## Out of scope

- Deciding which change is effective or writing the audit/reconciliation data.
- Customer communication automation.

## Assumptions

- This UI consumes the source-of-truth/change data defined by `availability-response-change-management`.

## Open questions

- Blocked by the staged workflow/data requirement; not independently shippable before Bhoumik defines the payload and acknowledgement behavior.

## Handoff log

- 2026-08-27 — drafted for Nova but held pending Bhoumik’s workflow/data design. No message sent by task instruction.
- 2026-08-29 — constrained the card presentation to a compact attention signal; full timestamps and field differences remain in the existing AR drawer/detail.
