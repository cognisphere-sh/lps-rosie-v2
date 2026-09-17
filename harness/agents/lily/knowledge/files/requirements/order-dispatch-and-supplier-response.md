# Send initial orders simply and receive supplier responses

- Status: staged — historical dispatch-scope deferral; current no-AR order gap awaits Bhoumik’s decision
- Route: bhoumik
- Priority: no new build authorized by this capture
- Raised: 2026-08-28 by Chris (via telegram)
- Updated: 2026-09-16T14:56:19-05:00

## Current disposition

**2026-09-16T14:47:43-05:00:** Current source includes supplier order creation and views; order management is not accurately described as absent or merely a placeholder. The prior sourcing-first hold below records an older prioritization decision, not an as-built assessment. Intervening implementation approval/rollout history and live deployment were not verified here.

**Historical decision, 2026-09-11 05:55:18:** Bhoumik deferred item 8 (Telegram293, 05:54:49 CDT): wait until sourcing stabilises before expanding order management. That superseded the earlier urgent dispatch priority. The email/reply behavior below remains retained intent, not newly commissioned work or a claim that none of it now exists.

Chris’s JR-59 illustration does not itself lift that hold, accept a customer order or authorize new implementation. A bounded current-source/owner check established the narrower **no-AR order-creation gap** below; Bhoumik decides whether/when to address it. No new build, RPC, skill or operational routing was authorized. Existing pricing, sourcing, quoting and implemented Orders remain untouched.

## Problem

Once a customer commits, LPS needs to place an order with the supplier without waiting for a full customer/supplier workspace. Chris expects the first version to be a plain-text, simply formatted email containing the order details. Suppliers may reply by email or in the portal; those responses need to remain part of the same order coordination rather than becoming disconnected messages.

## Evidence

- 2026-08-28 feedback log, **Initial order dispatch and replies**: Chris said the order will likely go as a plain-text, simply formatted email with details; the supplier can respond by email or in the portal. A link to Order Details is a future enhancement.
- 2026-08-28 feedback log, **Confirmed carries supplier communication**: confirmed work continues through fulfilment with supplier communication/updates.
- 2026-08-28 — Chris replied to the mandatory-email-content question with `photo_111.jpg`: a compact job-details workspace showing the job/customer name, Demand & Availability subtotal and item count, availability-state counts, and per-line fulfilled/needed quantity, size/name, unit price and total. Its circled header actions include email, message and document controls. (via telegram image)
- 2026-09-16 14:41:27 CDT — Chris, Rosie Telegram main130, described JR-59 as an example that “could skip the availability stage and go right to order.” Exact quote/provenance: feedback **JR-59 may skip availability**; source/report: `workspace/threads/main/tasks/status-lifecycle-clarification/audit-2026-09-16.md`.
- 2026-09-16 14:47:31 CDT — Nova’s independent read-only check confirmed no supported creation path without answered AR sources and their job allocations. Skipping a displayed Job stage is possible; skipping the source records is not supported by the inspected contract. Rosie supplied no alternate supported route/approval.

## Narrow gap — direct order without an availability request

**Illustration, not operational authorization:** Rosie identifies JR-59 as Ground and Garden, a 26-line phased request. Chris wants a quote for everything and says APS can get everything with lead time. This is Chris-reported capability, not confirmed on-hand stock, firm supplier timing, complete pricing or customer acceptance. Preserve phases/timing as notes where appropriate; no new scheduling product is requested.

**Observed constraint:** The current supported order workflow consumes answered source availability lines allocated to the job. It can move a Quote-stage job to Committed, but cannot create that order without those source records. A change of the Job label alone is not order creation. This is a source-confirmed limitation, not Lily proposing a universal supplier-verification gate or permission to invent responses.

**Staged behavior for Bhoumik’s decision:** If he approves a direct-order path for genuinely accepted lead-time work, Chris should be able to proceed on the same JR without creating an availability request merely to satisfy the system. Capture that possibility here, without choosing an implementation or prescribing new commercial rules.

Conditional acceptance checks for that narrow scope, **not launch/build approval**:
- An explicitly customer-accepted, authorized direct-order case can use the same JR without a fabricated AR, supplier response or second-JR conversion.
- A quote-only remark such as message130 creates no order or customer commitment; supplier/customer sends retain their existing authorization.
- Missing prices, quantities, timing or supplier commitments remain visibly unresolved rather than invented; Chris-reported procurability is not presented as confirmed stock.
- The existing optional, explicitly approved AR path remains usable on the same JR.

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

- Current Job commitment is **Committed**, not Confirmed. Job stages are Quote, Availability, Committed, Won, Lost. Supplier confirmation belongs to the Order; the current app labels its progression New, Processing, Order Ready, Closed Won, Closed Lost. Older skill/docs Confirmed wording is not a new Job stage or no-AR permission.
- Customer acceptance, supplier confirmation and fulfilled/closed work are distinct facts. The JR-59 illustration establishes none of them.
- Rosie coordinates supplier responses but does not send unapproved supplier communications.
- Source implementation is not proof of live deployment, successful end-to-end execution or the approval history of newer order features.

## Open questions — parked until reconsideration

- **Bhoumik:** Decide whether/when the source-confirmed no-AR direct-order gap merits work, separately from the older deferred email/reply slice. Current source already implements Orders; no blanket absence claim or automatic build request follows.
- **Bhoumik, if reopening the older slice:** Reconcile its sourcing-first hold with intervening order work and identify remaining email/reply scope. No order-identity or reply-ingestion design is requested by this capture.
- When reopened, revisit safe order/supplier correlation for email and portal replies, including ambiguous replies, and validate the retained email-content assumptions with Chris. The screenshot did not settle delivery/pickup destination/window, PO/reference, supplier contact name or requested confirmation date; do not pursue those questions during this deferral.

## Handoff log

- 2026-08-28 — staged from Chris’s initial order-channel direction. No message sent by task instruction.
- 2026-08-28 — Interpreted Chris’s screenshot as a compact job/order workspace and email action: job/customer context; quantities, plant/size, price, line totals and subtotal are the core first-email layout. Delivery/reference fields remain unconfirmed.
- 2026-09-11 05:55:18 — Recorded Bhoumik’s Telegram 293 decision at 05:54:49 CDT: item 8 deferred pending sourcing stabilisation. Removed urgent/build-ready priority; retained Chris’s future requirements. No new implementation, skills or routing; existing availability, quoting and customer communication remain unchanged.
- 2026-09-16T14:47:43-05:00 — Added JR-59 exact-provenance example and bounded current-source/owner findings. Corrected the old disposition’s as-built implication: Orders exist in source, but no supported no-AR creation route was found. Narrow behavioral gap staged here for Bhoumik without a duplicate requirement, implementation handoff, new verification policy or operational changes.
- 2026-09-16T14:56:19-05:00 — Lily main reported notification complete via Telegram339 to Chris/Bhoumik: JR-59 captured as a quote-to-approved-order option where a separate AR adds no value; the current distinction between skipping the displayed Availability stage and still requiring AR-backed lines was explained. The narrow no-AR option awaits Bhoumik’s decision, not a build instruction. Rosie pricing continues; no customer acceptance/order instruction was inferred. No further routing until a decision.
