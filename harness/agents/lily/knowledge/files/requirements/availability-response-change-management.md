# Keep supplier availability responses visible to LPS

- Status: staged
- Route: bhoumik
- Priority: factual supplier-response visibility; not a new Job/Order workflow
- Raised: 2026-08-27 by Chris (via telegram)
- Updated: 2026-09-11

## Problem

A supplier can revise availability after LPS has quoted a customer or while an order is being coordinated. Chris and Rosie need to be able to see the supplier’s factual response and decide what, if anything, to communicate to the customer. The response must not be confused with the Job/Order lifecycle or silently treated as a customer update.

## Evidence

- 2026-08-27 feedback log, **Availability changes after quote**: Chris gave the late-change case and wants visibility so LPS can respond.
- 2026-08-28 feedback log, **Reviewed availability reaches customer workspace**: Chris ruled out unreviewed automatic customer exposure.
- 2026-09-11 — Bhoumik’s authoritative direction: availability is a supplier response, stored in sourcing notes and distinct from Job/Order status. One plant may have one or more supplier responses; Chris/Rosie decide customer communication. Complex availability-change management is unnecessary. (via Bhoumik)
- 2026-09-11 — Bhoumik resolved the material alerting point: Rosie should surface supplier changes/resubmissions to Chris, who decides the response; the factual supplier response still does not automatically transition Job/Order/customer state. (via Bhoumik)

## What it should do

Retain supplier availability responses as factual sourcing information, including more than one supplier response for a plant where applicable. Make that information visible to Chris and Rosie in the relevant request/order sourcing context, clearly distinguish it from LPS notes and from the Job/Order status, and preserve its supplier/source context.

Rosie surfaces a supplier change or re-submission to Chris with its factual sourcing context. Chris decides manually whether it needs customer communication or another business response. Nothing automatically changes a Job/Order status, notifies a customer, updates a customer workspace, or treats a supplier response as an LPS-approved customer update.

## Acceptance criteria

- Chris/Rosie can read the supplier availability response(s) relevant to a plant in its request/order sourcing context.
- More than one supplier response can be recorded for a plant without replacing the fact that another supplier responded.
- A supplier response is visibly distinct from LPS sourcing commentary and from Job/Order lifecycle status.
- A later supplier response does not automatically change Job/Order status or customer-facing information.
- Rosie surfaces a supplier change/re-submission to Chris with the relevant factual sourcing response(s).
- Chris/Rosie can use the factual response to make and record the appropriate customer communication manually.

## Out of scope

- Automatic Job/Order/customer state transitions from an availability response.
- A separate approval queue, acknowledgement workflow, conflict/override engine, or automatic before→after change-alert system.
- Automatic customer notifications or automatic customer-workspace updates.
- Letting the supplier initiate an order.

## Assumptions

- Sourcing notes are the authoritative location for supplier availability responses under Bhoumik’s direction.
- Chris/Rosie retain the business decision on customer communication and do not need the system to make that decision.

## Open questions

- **Rosie / Bhoumik:** Confirm the reliable event or intake signal Rosie uses to recognize a supplier change/re-submission and surface it to Chris without inventing a new Job/Order status.

## Handoff log

- 2026-08-27 — staged from Chris’s post-quote availability-change use case.
- 2026-09-11 — narrowed to Bhoumik’s authoritative supplier-response/sourcing-notes model; removed automatic transition, review/approval, customer-projection, reconciliation and complex change-management behavior.
- 2026-09-11 — Bhoumik retained Rosie-to-Chris surfacing of supplier changes/resubmissions; Chris owns the resulting business/customer decision.
