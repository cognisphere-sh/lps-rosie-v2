# Use Chris’s LPS Ops Job Request sales lifecycle and history

- Status: staged — current Job stages recorded; separate history follow-through remains
- Route: bhoumik
- Priority: Existing lifecycle/history follow-through; Lost reason capture remains deferred
- Raised: 2026-08-27 by Chris (via nova handoff, then Chris clarification)
- Updated: 2026-09-16T14:47:43-05:00

## Problem

LPS needs a clear sales state and trustworthy history for each Job Request. Quote preparation, customer delivery, supplier responses, customer commitment and supplier order confirmation are different facts even when they relate to the same JR. Historical stage descriptions must not be mistaken for current vocabulary or proof that a direct order-creation path exists.

## Evidence

- 2026-09-01 feedback, **Authoritative sales and plant statuses**: Chris supplied Active, Quote, Availability, Confirmed, Won, Lost. This is historical vocabulary, superseded in the currently inspected source.
- 2026-09-11 05:38:08 CDT, Bhoumik, Telegram289: quick quotes create/reuse a JR without an AR; later explicitly authorized availability work uses that same JR. No conversion or vocabulary build was authorized.
- September 11 source audit established the then-current six-stage model and customer-confirmation event; it did not establish no-AR order creation. Historical evidence: `workspace/threads/main/tasks/status-lifecycle-clarification/audit-2026-09-11.md`.
- 2026-09-16 14:41:27 CDT, Chris, Rosie Telegram main130: JR-59 is an example that “could skip the availability stage and go right to order.” Exact text/provenance is in feedback **JR-59 may skip availability**. The quoted statement is not actual customer acceptance or an order instruction.
- 2026-09-16 bounded source/docs check, Rosie read-only clarification at 14:44:39 and Nova confirmation at 14:47:31 establish the current distinctions below. Evidence: `workspace/threads/main/tasks/status-lifecycle-clarification/audit-2026-09-16.md`.

## Current supported behavior — observed, not a redesign

The inspected current Job stages are **Quote, Availability, Committed, Won, Lost**. Quote is the starting stage; Active and Job Confirmed are retired. Legacy history remains distinct from selectable stages.

- **Quote:** initial quote work on the JR. An explicit quick quote creates/reuses its JR/thread but no AR or supplier contact. A simple price lookup creates neither. This stage alone does not prove that pricing is complete or that the customer received a quote.
- **Availability:** the approved supplier availability request has been delivered. Supplier completion is not the trigger for entering this Job stage. Later authorized sourcing uses the same JR, not a conversion to a second record.
- **Committed:** customer commitment in the accepted-order workflow. The current supported order-creation path requires answered source availability lines and their job allocations. It may advance a Quote-stage job directly to Committed; that is not an ability to create the order without those sources. A status-only customer-confirmation event is not order creation.
- **Won / Lost:** explicit closure, distinct from customer acceptance or supplier confirmation. Chris’s business meaning for Won is completed fulfilment/transaction; this audit does not establish an independent physical-delivery check. Silence is not Lost.

Supplier confirmation belongs to the **Order**, not a separate Job Confirmed stage. Current app Order labels are **New, Processing, Order Ready, Closed Won, Closed Lost**; some current Rosie instructions/docs still call the confirmation outcome “Confirmed.” That source/instruction consistency concern is recorded separately in the audit, not a proposed vocabulary change. The linked JR remains Committed rather than becoming Confirmed.

Quote preparation and actual authorized customer delivery remain distinct. Quick quoting never authorizes an AR; current ordinary-job instructions also require Chris’s explicit AR-send approval. Historical standing APS portal permission must not be carried forward from the September 11 audit. Availability responses are sourcing facts, not automatic customer acceptance or customer-facing sends.

## JR-59 illustration and assumptions

Rosie identifies Chris’s example as Ground and Garden, a 26-line phased request. Chris wants to quote everything and says APS can get everything with lead time. That capability is **Chris-reported**, not independently confirmed stock, a firm supplier commitment or known prices for every line. Phase/timing context may remain notes-first; no new scheduling feature is requested.

Capture the possible direct-to-order business outcome without inventing customer acceptance, creating an order or changing JR-59. The current no-AR order-creation gap is staged within `order-dispatch-and-supplier-response`; this example does not resolve it or authorize a workaround. The existing same-JR quick-quote/optional-later-approved-AR path remains valid.

## Acceptance criteria and existing follow-through

- Job controls and active filters use the current five labels; legacy history remains legible. No restoration of historical Active/Confirmed is requested.
- Explicit quick quote and later explicitly authorized sourcing share one JR/thread and reviewed current lines; no second-record conversion is required.
- A prepared quote is distinguishable from one actually delivered to the customer.
- Customer acceptance, supplier confirmation, order creation and terminal closure remain distinguishable; a displayed stage is not proof that all occurred.
- A possible direct-order example alone neither commits the customer nor confirms stock, places an order or sends supplier/customer communication.
- Won/Lost leave active work while retaining history; shared sourcing/order work must not be closed merely because one linked job ended.
- Earlier quote/availability-delivery history and reporting remain **separate staged follow-through**. A stage audit does not prove a complete durable versioned quote ledger or commission a new event engine.

## Deferred follow-on

- Lost reason capture: Price, Different Vendor, Unable to Fulfill Request, No Response, or NA.
- Chris’s separate Quotes/customer-deal dashboard wish is not an item-7 prerequisite and does not restore the separate quote-record/new-JR assumption.

## Out of scope and limits

- New vocabulary, conversion workflow, verification policy, skills, data, runtime statuses or implementation routing.
- No universal supplier-verification rule is proposed. The existing AR-source constraint is observed implementation; a different direct-order workflow belongs to Bhoumik’s scope decision.
- September 11’s nine local status/filter test passes are historical. The September 16 check inspected source/docs/instructions and owner reports only, including staged source differences. No live DB, deployment, operational send or end-to-end direct order was verified.
- Current source includes order creation and order views. The old “Orders placeholder” finding is superseded; intervening implementation approval/rollout was not established by this audit.

## Handoff log

- 2026-08-27 — staged for Bhoumik; workflow/data rather than Nova UI work.
- 2026-08-28 — Archived retirement, history/reporting and deferred Lost reasons captured; customer commitment and terminal completion distinguished.
- 2026-08-29 — Chris discussed pricing and availability phases and recurring deliveries; retained as historical evidence.
- 2026-09-01 — Chris supplied the then-authoritative six Sales labels.
- 2026-09-11 — Vocabulary/migration slice reported implemented; audit corrected Lily’s earlier universal verified-package gate and separate-record/manual-new-JR assumption. Main reported the same-JR item-7 path supported; future dashboard remained deferred. No implementation/skill changes.
- 2026-09-16T14:47:43-05:00 — Captured JR-59 exact example; bounded current-source/owner check supersedes September 11 capability assumptions. Recorded five Job stages and the separate Order confirmation event; no-AR creation is unsupported by inspected source. Behavioral gap retained in existing order requirement for Bhoumik, without build routing or operational changes.
