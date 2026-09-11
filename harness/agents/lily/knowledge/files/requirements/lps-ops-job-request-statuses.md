# Use Chris’s LPS Ops Job Request sales lifecycle and history

- Status: staged — Sales vocabulary/migration implemented; lifecycle/history follow-through remains
- Route: bhoumik
- Priority: Lifecycle/history is current staged work; Closed Lost reason capture is low-priority follow-on
- Raised: 2026-08-27 by Chris (via nova handoff, then Chris clarification)
- Updated: 2026-09-11

## Problem

LPS Ops needs one clear sales state for each customer Job Request and durable history of quote, availability and completion cycles. Earlier labels—Sourcing, Quoted, Quote Delivered, Pricing, Closed Won and Closed Lost—conflict with Chris’s now-authoritative sales vocabulary. Archived is not useful to Chris: bad/duplicate requests are exceptional deletions; legitimate work ends Won or Lost and remains reportable history.

Quick quote opportunities remain outside Request Management until the customer re-engages for sourcing or timing work. Their later conversion begins a Job Request; an indicative quote must never be mistaken for current supplier-verified availability and price.

## Evidence

- 2026-09-01 feedback log, **Authoritative sales and plant statuses**: Chris defined the exact Sales set as **Active**, **Quote**, **Availability**, **Confirmed**, **Won**, **Lost**.
- 2026-08-28 feedback log: Confirmed means the customer commits only after receiving current supplier-verified availability and price; Won is only after delivery/pickup and transaction completion.
- 2026-08-29 feedback log, **Pricing then availability sales stages**: pricing work and quote revisions precede the Availability stage, where LPS/customer work toward consensus on current availability and purchase.
- Current app audit: current requests use Sourcing, Quoted, Closed Won, Closed Lost and Archived; historic labels/records must survive a migration.

## What it should do

Use this exact ordered Sales vocabulary for a Job Request: **Active**, **Quote**, **Availability**, **Confirmed**, **Won**, **Lost**.

Active is the active working state before the request is in a defined quote or live-availability phase. Quote is the sales phase for pricing work and quote revisions. Availability is the phase for current supplier availability-and-price work and customer consensus. Confirmed means the customer has committed after receiving the current verified package. Won means delivery/pickup and the transaction are complete. Lost is the other completed outcome.

Quote deliveries, supplier submissions, LPS delivery of current supplier-verified availability-and-price, and later supplier changes are durable dated events within the applicable Sales stage, not substitute stages. A supplier re-submission does not automatically change the parent Sales status. At Confirmed, supplier coordination continues through the Order Details context until Won or Lost; terminal status closes related availability and order communication.

Define durable stored values, allowed transitions, reporting/history treatment and a safe mapping for current Sourcing, Quoted, Closed Won, Closed Lost, Archived and any earlier proposed labels. Plant Request and Order statuses are separate domains governed by `availability-status-model-parity` and must never be used as Job Request Sales statuses.

## Acceptance criteria

- A Job Request Sales control, filter, summary and history use only **Active**, **Quote**, **Availability**, **Confirmed**, **Won** and **Lost**, in that wording.
- Quick quote opportunities remain outside Request Management; a converted Job Request enters an appropriate active Sales stage without treating an indicative quote as verified availability.
- Confirmed means customer commitment, not fulfilment; Won occurs only at delivery/pickup and transaction completion.
- Quote deliveries, supplier submissions and current availability-and-price deliveries remain dated/reviewable events without inventing additional Sales statuses.
- Supplier changes do not automatically move the parent Job Request stage.
- Won/Lost leave active work and Rosie's open Job Request picker but remain in Job Request Historical; terminal closure closes related availability/order communication.
- Existing legitimate records map or remain historically legible without disappearance, relabeling their history deceptively, or losing audit information.

## Deferred follow-on — not an immediate build item

- Lost requires and saves one reason: Price, Different Vendor, Unable to Fulfill Request, No Response, or NA; expose it in history/querying then.

## Out of scope

- Individual plant Request or Order statuses.
- Supplier portal selector styling.
- Customer/supplier identity metadata and a general chat-status system.

## Open questions

- **Bhoumik:** Define durable values, permitted transitions and migration/display mapping for Sourcing, Quoted, Closed Won, Closed Lost, Archived, Quote Delivered and Pricing; do not silently collapse historical facts.
- **Bhoumik:** Confirm the entry/transition rule between Active and Quote for a converted Job Request, while preserving the existing separation of quick quote opportunities from Request Management.
- **Bhoumik:** Define quote/availability events, supplier-change notifications, Order Details continuity and terminal closure against this Sales model.

## Handoff log

- 2026-08-27 — staged for Bhoumik; workflow/data rather than Nova UI work.
- 2026-08-28 — Archived retired; history/reporting and exceptional deletion added. Confirmed/Won closure semantics clarified.
- 2026-08-29 — Chris refined the sales flow to Pricing then Availability, with quote deliveries and supplier submissions as events.
- 2026-09-01 — Chris supplied authoritative Sales labels: Active, Quote, Availability, Confirmed, Won, Lost. Requirement revised; durable model and migration remain staged for Bhoumik, with Nova UI mapping held until that contract exists.
- 2026-09-11 — Audit after Bhoumik marked priority item 1 done: current app/schema/docs implement and display the exact six Sales labels, retain legacy archived readability, and enforce documented Active → Quote → Availability → Confirmed progression. This completes the Sales-vocabulary/migration slice; full lifecycle/history requirement remains staged for its separate event/history and deferred Lost-reason acceptance.
