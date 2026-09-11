# Use Chris’s LPS Ops Job Request sales lifecycle and history

- Status: staged — Sales vocabulary/migration and item-7 workflow supported; separate history follow-through remains
- Route: bhoumik
- Priority: Existing lifecycle/history follow-through; Lost reason capture remains deferred
- Raised: 2026-08-27 by Chris (via nova handoff, then Chris clarification)
- Updated: 2026-09-11

## Problem

LPS needs a clear sales state and trustworthy history for each Job Request. The exact Sales vocabulary is already implemented; earlier proposed labels or a separate quote-to-new-JR conversion must not be mistaken for prerequisites. Quote preparation, customer delivery, supplier responses and customer commitment are different facts even when they occur on the same JR.

## Evidence

- 2026-09-01 feedback log, **Authoritative sales and plant statuses**: Chris supplied **Active, Quote, Availability, Confirmed, Won, Lost**.
- 2026-08-28 discussions distinguished customer commitment from transaction completion at delivery/pickup. Those historical discussions are retained in the raw feedback log; Lily’s later universal supplier-verification gate is not an implemented requirement.
- 2026-09-11 05:38:08 CDT, Bhoumik, Telegram 289: quick quotes create/reuse a JR without an AR; later explicit availability work uses the same JR. No conversion or vocabulary build was authorized.
- Current source/skill audit and Rosie’s read-only reply at 05:40:53 support that one-JR workflow. `job-requests` §§1/4/6/7, `quote-generation` §§1/4, `supplier-coordination` §§2/4 and migrations 0088/0089 establish the current boundaries. Detailed citations: `workspace/threads/main/tasks/status-lifecycle-clarification/audit-2026-09-11.md`.

## Current supported behavior — preserve, do not redesign

Use the exact ordered Sales labels **Active, Quote, Availability, Confirmed, Won, Lost**. Legacy Archived records remain historically readable, not a selectable new stage.

- **Active:** a real JR has been recorded; processing has not yet occurred. An explicit quick quote creates/reuses this JR and its thread. A simple price lookup creates neither JR nor AR.
- **Quote:** completed pricing work or actual quote sharing advances Active to Quote. Even a completed no-match lookup is pricing work; this label alone does not prove customer delivery. Quick quoting creates no AR or supplier contact.
- **Availability:** delivery of a supplier availability request through a partner portal or an actually sent email advances Active/Quote to Availability. A prepared public link is not an email send; supplier completion is not this Sales-stage trigger. Later Chris-instructed sourcing uses the same JR.
- **Confirmed:** explicit customer acceptance records commitment. Current policy and implementation permit confirmation from Active, Quote or Availability **without requiring an AR or universally verified supplier package**. This does not establish supplier stock/price verification, place an order or close the Job.
- **Won / Lost:** explicit closure. Chris’s business meaning for Won remains fulfilment and completed transaction, not order-ID creation; no automatic physical-delivery check was established by the audit. Silence is not an automatic Lost outcome.

Repeated pricing/quote events do not regress Availability or Confirmed or reopen terminal Jobs. Supplier input updates factual sourcing/AR information and internal alerts, not parent Sales status or customer acceptance. The event hooks implement these automatic transitions; generic admin edits validate vocabulary, not a universal evidence/transition matrix.

Chris authorization for customer sends and supplier email remains unchanged. Existing standing authorization for ordinary APS private portal requests does not make a quick-quote request an authorization to publish an AR.

Confirmed keeps existing supplier ARs open. Terminal closure closes ARs, revokes public links and closes the JR thread; authorized reopening restores recorded AR stages and fresh public links. Customer/supplier correspondence threads are not the JR thread. A separate supplier Order Details workspace is not created merely by setting Confirmed; the audited Orders page remains a placeholder.

## Acceptance criteria and existing follow-through

- Sales controls and active filters use the six exact labels; legacy history remains legible.
- Explicit quick quote and later explicit sourcing share one JR/thread and reviewed current lines; no second-record conversion is required and quoting alone creates no AR.
- Quote preparation and actual authorized customer delivery remain distinguishable.
- Explicit customer confirmation is distinct from supplier verification, order placement and closure; do not assert an unimplemented mandatory AR gate.
- Supplier changes do not automatically move Sales status or send customer-facing information.
- Won/Lost leave active work while retaining historical records; related AR closure and public-link revocation follow the current lifecycle.
- Earlier requested quote/availability delivery history and historical reporting remain **separate staged follow-through**. The current stage hook audits stage changes but is not proof that every repeated quote event has a durable versioned record. No new event engine is commissioned by this reconciliation.

## Deferred follow-on — not a current prerequisite

- Lost reason capture: Price, Different Vendor, Unable to Fulfill Request, No Response, or NA.
- Chris’s future separate Quotes/customer-deal dashboard wish. It is not required for item 7 and must not reinstate a separate quote-record/new-JR conversion assumption.

## Out of scope

- New Sales vocabulary, conversion workflow or stricter confirmation policy.
- Individual plant Request/Order status definitions and supplier portal selector styling.
- Changes to agent skills, code, data, runtime statuses, deployment or external-send authorization.

## Open scope / evidence limits

- **Bhoumik, only if he wants a policy change:** any stricter requirement for supplier verification before Confirmed needs his explicit decision. It is not current enforcement and not an item-7 blocker.
- The separate historical-reporting/event-history and Order Details requests remain subject to their own scope decisions; do not represent them as shipped from a Sales-status audit.
- Nine local status/filter tests passed in the read-only audit. No live JR/AR, production query, customer/supplier send or deployment verification was performed. Source and current instructions support item 7; end-to-end live execution was not tested.

## Handoff log

- 2026-08-27 — staged for Bhoumik; workflow/data rather than Nova UI work.
- 2026-08-28 — Archived retirement, history/reporting and deferred Lost reasons captured; customer commitment and terminal completion distinguished.
- 2026-08-29 — Chris discussed pricing and availability phases and recurring deliveries; retained as historical evidence.
- 2026-09-01 — Chris supplied the authoritative six Sales labels.
- 2026-09-11 — Vocabulary/migration slice reported implemented. Later current-source audit clarified this is event-driven progression, not a mandatory passage through every stage or a universal verified-package confirmation gate.
- 2026-09-11 05:49:31 CDT — Reconciled Bhoumik’s one-JR correction throughout the requirement. Main has told Bhoumik item 7 is supported and no new vocabulary/conversion is needed. Earlier separate-record and manual-new-JR prerequisites are superseded; future dashboard remains deferred. No implementation or agent-skill changes.
