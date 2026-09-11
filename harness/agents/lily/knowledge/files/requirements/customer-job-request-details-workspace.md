# Give customers a current job request details workspace

- Status: staged
- Route: bhoumik
- Priority: urgent foundation for near-term app utility
- Raised: 2026-08-28 by Chris (via telegram)
- Updated: 2026-08-28

## Problem

Chris needs to share compact, current request/order details with customers soon. The customer workspace cannot be treated as future polish: it is the safe place to show the customer the approved job details and availability while keeping supplier revisions and LPS review context private.

## What it should do

Provide a dynamic customer-facing Job Request Details workspace linked to the customer’s request/order. It presents the current customer-approved job/order details and availability, with a clear update time. It shows only availability information Chris or Rosie deliberately publishes for the customer; it does not automatically receive supplier-driven changes or raw sourcing notes.

## Acceptance criteria

- A customer can open their job’s current details in a customer-scoped workspace.
- The workspace shows compact current request/order details, including the approved availability information relevant to the customer.
- It identifies when the customer-facing details were last updated.
- An unreviewed supplier revision and LPS-only notes are never exposed there.
- A deliberately published availability update can be shown without exposing internal sourcing history to the customer.

## Out of scope

- Letting the customer edit supplier availability responses.
- Automatic exposure of raw supplier communications.

## Assumptions

- Nova owns the customer-facing screen once Bhoumik establishes the customer access, approved-projection and review/approval workflow.

## Open questions

- **Bhoumik:** Define customer access/scoping and the approved customer-facing detail projection, including its relationship to an order after Confirmed.

## Handoff log

- 2026-08-28 — staged as urgent after Chris said sharing compact request/order details with customers needs to be available soon, not future polish. No message sent by task instruction.
