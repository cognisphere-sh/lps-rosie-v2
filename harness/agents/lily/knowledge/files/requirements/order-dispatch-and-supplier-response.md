# Send initial orders simply and receive supplier responses

- Status: staged — deferred pending sourcing stabilisation
- Route: bhoumik
- Priority: deferred; not ready to build
- Raised: 2026-08-28 by Chris (via telegram)
- Updated: 2026-09-11

## Current disposition

2026-09-11 05:55:18 — Bhoumik deferred item 8 (Telegram 293, 05:54:49 CDT): wait until the sourcing workflow is stabilised; do not get into order management yet. This supersedes the earlier urgent order-dispatch priority. The requirements below preserve Chris’s future intent, not current implementation instructions.

Do not start new order implementation, skills or routing. Existing supplier availability requests, quoting, customer communication and implemented sourcing behavior remain untouched. Revisit this scope only when Bhoumik authorizes reconsideration after sourcing stabilisation; elapsed time alone does not reactivate it.

## Problem

Once a customer commits, LPS needs to place an order with the supplier without waiting for a full customer/supplier workspace. Chris expects the first version to be a plain-text, simply formatted email containing the order details. Suppliers may reply by email or in the portal; those responses need to remain part of the same order coordination rather than becoming disconnected messages.

## Evidence

- 2026-08-28 feedback log, **Initial order dispatch and replies**: Chris said the order will likely go as a plain-text, simply formatted email with details; the supplier can respond by email or in the portal. A link to Order Details is a future enhancement.
- 2026-08-28 feedback log, **Confirmed carries supplier communication**: confirmed work continues through fulfilment with supplier communication/updates.
- 2026-08-28 — Chris replied to the mandatory-email-content question with `photo_111.jpg`: a compact job-details workspace showing the job/customer name, Demand & Availability subtotal and item count, availability-state counts, and per-line fulfilled/needed quantity, size/name, unit price and total. Its circled header actions include email, message and document controls. (via telegram image)

## Retained future behavior — deferred

When a job reaches the approved customer-commitment point, create the order coordination work and send the supplier a clear plain-text, simply formatted email with the order details. The email action belongs in the job/order details workspace alongside the existing communication/document actions; it uses the current, approved order details rather than requiring a supplier Order Details link. Keep email replies and portal responses associated with that order’s supplier coordination so LPS can act on either channel.

A future Order Details link may be added to the supplier-facing message, but the initial workflow must work without it. A portal response and an email reply are response channels, not separate orders; both preserve who responded, when, and what they said.

## Acceptance criteria for future review

- Chris can move a committed job into order coordination and send a plain-text, simply formatted order email from its job/order details workspace.
- The initial email identifies the job/customer and lists each ordered item’s quantity, size/name, unit price and line total, with the order subtotal; its content is based on the current approved order detail.
- The initial supplier email is usable without an Order Details link.
- A supplier email reply is ingested into the correct order’s supplier coordination history.
- A supplier portal response is associated with that same order coordination history.
- LPS can see the channel, sender and time for each supplier response and can distinguish it from LPS’s own message.
- A later Order Details link, if introduced, enhances rather than replaces the email/reply workflow.

## Out of scope

- Requiring a supplier to use the portal.
- Customer-facing order workspace or automatic customer notifications.
- Replacing Chris’s approval/review gate for customer-facing availability changes.

## Assumptions

- Confirmed remains customer commitment; Closed Won remains fulfilment/transaction completion.
- Rosie coordinates supplier responses but does not send unapproved supplier communications.

## Open questions — parked until reconsideration

- **Bhoumik:** Decide when sourcing is stable enough to reconsider order management. No order-identity or reply-ingestion design is requested now.
- When reopened, revisit safe order/supplier correlation for email and portal replies, including ambiguous replies, and validate the retained email-content assumptions with Chris. The screenshot did not settle delivery/pickup destination/window, PO/reference, supplier contact name or requested confirmation date; do not pursue those questions during this deferral.

## Handoff log

- 2026-08-28 — staged from Chris’s initial order-channel direction. No message sent by task instruction.
- 2026-08-28 — Interpreted Chris’s screenshot as a compact job/order workspace and email action: job/customer context; quantities, plant/size, price, line totals and subtotal are the core first-email layout. Delivery/reference fields remain unconfirmed.
- 2026-09-11 05:55:18 — Recorded Bhoumik’s Telegram 293 decision at 05:54:49 CDT: item 8 deferred pending sourcing stabilisation. Removed urgent/build-ready priority; retained Chris’s future requirements. No new implementation, skills or routing; existing availability, quoting and customer communication remain unchanged.
