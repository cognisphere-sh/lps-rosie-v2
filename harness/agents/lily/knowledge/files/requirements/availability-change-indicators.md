# Show supplier-response state without crowding requests

- Status: drafted
- Route: nova
- Raised: 2026-08-27 by Chris (via telegram)
- Updated: 2026-09-11

## Problem

Chris needs compact request/order cards to remain scannable while still being able to find supplier availability information.

## What it should do

Keep the compact availability-request link state on the Job Request card—for example, Submitted—and open the existing availability-request drawer/detail for supplier response information. The drawer clearly separates supplier availability responses/sourcing notes from LPS commentary and Job/Order status.

## Acceptance criteria

- A compact card shows the existing availability-request lifecycle state without duplicating dates or line detail.
- Opening its drawer/detail shows the supplier response information and its sourcing context.
- Supplier response information is not presented as a Job/Order status or a customer-approved update.

## Out of scope

- Needs-review badges, changed-line counts, automatic before→after alerts, or acknowledgement actions.
- Building the sourcing-note data model or customer communication workflow.

## Assumptions

- This is a UI-only follow-on to Bhoumik’s sourcing-notes response model; it does not require a new availability-change workflow.

## Open questions

- Hold until Bhoumik confirms the supplier-response detail payload already available to the drawer.

## Handoff log

- 2026-09-11 — narrowed from a pending-change indicator after Bhoumik rejected the complex change-management workflow.
