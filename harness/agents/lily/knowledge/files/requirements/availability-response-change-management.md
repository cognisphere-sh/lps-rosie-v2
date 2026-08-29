# Keep availability changes visible after a nursery responds

- Status: staged
- Route: bhoumik
- Raised: 2026-08-27 by Chris (via telegram)
- Updated: 2026-08-27

## Problem

Availability that was accurate when LPS sent a customer a quote can change days later. A nursery needs to correct or re-submit its answer, and Chris needs to see exactly what changed before confirmation/order as well as after a request becomes an order. Today a later save replaces the shared answer with no preserved comparison, owner, acknowledgement, or defined relationship to the job-request line.

## Evidence

- 2026-08-27 feedback log, **Availability collaboration and master**: Chris asked who is master when both sides update; today the last save wins and the job-request line is a separate snapshot.
- 2026-08-27 feedback log, **Availability changes after quote**: Chris gave the core case—availability sent to the customer may be accurate today and change four days later. The nursery may notify/re-submit; he wants changed fields highlighted in Requests and confirmed Orders, with Rosie able to tell him.

## What it should do

A nursery may update and re-submit an availability response after its first submission while the request remains open. The system preserves the previously submitted supplier response and the new response sufficiently to identify what changed, who changed it, and when.

For each change, LPS can see the affected request/order, supplier, line, before value and after value. Changed availability is clearly flagged in the relevant pre-confirmation Request and, once applicable, its confirmed Order until Chris acknowledges or resolves it. Acknowledgement is a business action: it says Chris has seen the change; it does not silently erase the supplier’s original or revised response.

Rosie receives a structured signal for a nursery re-submission/change and can message Chris with the affected job/order and what changed. The system must not claim that an LPS edit was a nursery change, or overwrite a nursery response without retaining that distinction.

## Acceptance criteria

- A nursery can revise an already submitted, still-open availability response and re-submit it.
- The later submission preserves enough prior response to show each changed line/field as before → after, with the nursery and time of the change.
- Chris sees a clear changed-availability flag and the field-level differences from both the active Request and, after confirmation, the related Order.
- The flag remains until Chris records an acknowledgement/resolution; a normal page refresh does not clear it.
- Rosie is notified of a nursery re-submission/change and has the job/order and changed fields needed to alert Chris.
- An LPS-entered correction is visibly identified as LPS activity and does not erase or masquerade as the nursery’s submitted response.
- The currently effective response for pricing/fulfilment is explicit; no screen has to guess which of two values is operative.

## Out of scope

- Automatic customer messaging or automatic order cancellation after a change.
- Letting the nursery initiate an order.
- Rebuilding the entire order workflow before confirmed Orders exist.

## Assumptions

- The same availability-change history and acknowledgement behavior must carry from a pre-confirmation Request into its confirmed Order rather than starting over.
- Rosie alerts Chris; Rosie does not decide whether a changed response should be accepted, repriced, or sent to the customer.

## Open questions

- **Chris:** When a nursery revises availability after LPS has quoted the customer, should the change require only acknowledgement, or a distinct decision such as accept/requote/cancel before the request or order can move forward?
- **Bhoumik:** Decide the durable source-of-truth model: preserve supplier submissions separately from LPS overrides, record effective response and acknowledgement, and carry the relationship into Orders.

## Handoff log

- 2026-08-27 — staged for Bhoumik from Chris’s post-quote availability-change use case. No message sent by task instruction.
