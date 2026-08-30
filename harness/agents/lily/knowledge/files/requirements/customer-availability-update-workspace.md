# Show approved availability changes in customer job details

- Status: drafted
- Route: nova
- Priority: urgent dependent UI
- Raised: 2026-08-28 by Chris (via telegram)
- Updated: 2026-08-28

## Problem

A customer-facing dynamic Job Request Details workspace needs current availability only after Chris has reviewed a supplier change. Customers must not see an unreviewed nursery update as though LPS has accepted it.

## What it should do

When the approved workflow identifies a supplier availability revision as customer-ready, show the approved update in that customer’s Job Request Details workspace. Clearly distinguish the current approved information from a prior customer-facing availability update, without exposing LPS-only notes, supplier-only context, or unreviewed changes.

## Acceptance criteria

- An unreviewed supplier revision is not visible in the customer workspace.
- After Chris approves an update for customer exposure, the customer workspace shows the approved current availability and when it was updated.
- Chris can tell which supplier revision and review decision produced the customer-facing update.
- LPS-only review notes and supplier/internal details remain absent from the customer workspace.

## Out of scope

- Designing the durable review, approval, provenance, or customer-access model.
- Automatically sending the customer a message.

## Assumptions

- This UI depends on the workflow/data defined by `availability-response-change-management` and the urgent staged `customer-job-request-details-workspace` foundation.

## Open questions

- Blocked by Bhoumik’s review/approval and customer-workspace data model; not independently shippable.

## Handoff log

- 2026-08-28 — drafted for Nova; held pending the staged workflow/data design. No message sent by task instruction.
