# Keep availability changes visible after a nursery responds

- Status: staged
- Route: bhoumik
- Priority: urgent foundation for customer details and order coordination
- Raised: 2026-08-27 by Chris (via telegram)
- Updated: 2026-08-27

## Problem

Availability that was accurate when LPS sent a customer a quote can change days later. A nursery needs to correct or re-submit its answer, and Chris needs to see exactly what changed before confirmation/order as well as after a request becomes an order. Today a later save replaces the shared answer with no preserved comparison, owner, acknowledgement, approval, or defined relationship to the job-request line. A future customer Job Request Details workspace must not expose that raw supplier change before Chris has reviewed it.

## Evidence

- 2026-08-27 feedback log, **Availability collaboration and master**: Chris asked who is master when both sides update; today the last save wins and the job-request line is a separate snapshot.
- 2026-08-27 feedback log, **Availability changes after quote**: Chris gave the core case—availability sent to the customer may be accurate today and change four days later. The nursery may notify/re-submit; he wants changed fields highlighted in Requests and confirmed Orders, with Rosie able to tell him.
- 2026-08-28 feedback log, **Confirmed-order availability closure conflict**: Bhoumik proposed closing all availability requests when a job becomes Confirmed/an Order is created; that would prevent nursery re-submission during the exact confirmed-Order period Chris needs to monitor.
- 2026-08-28 feedback log, **Confirmed carries communication through fulfilment**: Chris resolved the timing. Confirmed surfaces a supplier Order Details inbox item that carries request information and the same update/communication capability through fulfilment; it closes only at Closed Won/Lost.
- 2026-08-28 feedback log, **Future quote versus live availability**: a future-project price quote may precede a live check by 7–10 days. The initially proposed Job Request state Availability Updated means the nursery completed current availability and LPS sent it to the customer for review; it is not a replacement for the supplier request’s own submission state. Chris subsequently recast this as a delivery event within the Availability stage.
- 2026-08-29 feedback log, **Budgeting quotes are allowed**: early quotes are indicative placeholders for contractor bidding. The later customer update before commitment must contain current supplier availability and price.

## What it should do

A nursery may update and re-submit an availability response after its first submission while the request remains open. At Confirmed, its work transitions into the supplier’s order coordination, carrying forward the request information and the same update/communication capability through fulfilment. Initial order dispatch is a plain-text, simply formatted email; email reply and portal response must both remain associated with this coordination. A supplier-facing Order Details link is a later enhancement, not a prerequisite. It ends only at Closed Won/Lost, not at order creation. The system preserves the previously submitted supplier response and the new response sufficiently to identify what changed, who changed it, and when.

For each change, LPS can see the affected request/order, supplier, line, before value and after value. Once LPS sends a completed live availability update and current supplier price to the customer, it is a durable delivery event within the Job Request’s Availability stage; it is distinct from the originating indicative quick-quote opportunity and from the supplier’s own request/submission status. A later supplier re-submission does not automatically change the Job Request stage: it is a separate, dated supplier-change event, surfaced by notification and Last updated freshness. Changed availability is clearly flagged in the relevant pre-confirmation Request and, once applicable, its confirmed Order until Chris acknowledges or resolves it. Acknowledgement is a business action: it says Chris has seen the change; it does not silently erase the supplier’s original or revised response.

Rosie receives a structured signal for a nursery re-submission/change and can message Chris with the affected job/order and what changed. Chris reviews the change and explicitly approves the customer-facing availability update before it is pushed into the dynamic customer Job Request Details workspace. The system must not claim that an LPS edit was a nursery change, overwrite a nursery response without retaining that distinction, or expose an unreviewed supplier revision to the customer.

## Acceptance criteria

- A nursery can revise an already submitted availability response from the confirmed Order Details inbox item through fulfilment, until Closed Won/Lost.
- The later submission preserves enough prior response to show each changed line/field as before → after, with the nursery and time of the change.
- Chris sees a clear changed-availability flag and the field-level differences from both the active Request and, after confirmation, the related Order.
- The flag remains until Chris records an acknowledgement/resolution; a normal page refresh does not clear it.
- A supplier change triggers a Chris review state; it is not customer-visible merely because the supplier re-submitted.
- After Chris approves a customer-facing update, the dynamic customer Job Request Details workspace receives that approved version and can be traced back to the supplier change and Chris’s review decision.
- Rosie is notified of a nursery re-submission/change and has the job/order and changed fields needed to alert Chris.
- An LPS-entered correction is visibly identified as LPS activity and does not erase or masquerade as the nursery’s submitted response.
- The currently effective response for pricing/fulfilment is explicit; no screen has to guess which of two values is operative.

## Out of scope

- Automatic customer exposure, customer messaging, or automatic order cancellation after a change.
- Letting the nursery initiate an order.
- Rebuilding the entire order workflow before confirmed Orders exist.

## Assumptions

- The same availability-change history and acknowledgement behavior must carry from a pre-confirmation Request into its confirmed Order rather than starting over.
- Rosie alerts Chris; Rosie does not decide whether a changed response should be accepted, repriced, or sent to the customer.
- Chris’s approval is required before a supplier revision becomes customer-facing; a customer-workspace update is a separate approved projection, not the live supplier record.

## Open questions

- **Bhoumik:** Define the durable supplier-change event/notification and availability freshness semantics: date/time, supplier versus LPS actor, affected line and before/after values, with no automatic Job Request status transition.
- **Bhoumik:** Decide the durable source-of-truth model: preserve supplier submissions separately from LPS overrides, record effective response, acknowledgement and Chris’s customer-exposure approval, and carry the relationship into Orders and the customer workspace.

## Handoff log

- 2026-08-27 — staged for Bhoumik from Chris’s post-quote availability-change use case. No message sent by task instruction.
- 2026-08-28 — Added Chris’s explicit review gate: a supplier change notifies/reaches Chris first; only an approved update is pushed to the future dynamic customer Job Request Details workspace.
