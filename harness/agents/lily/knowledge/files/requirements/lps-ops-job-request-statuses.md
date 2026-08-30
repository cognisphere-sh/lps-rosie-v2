# Use Chris’s LPS Ops job-request lifecycle and history

- Status: staged — lifecycle/history; Closed Lost reason capture deferred
- Route: bhoumik
- Priority: Lifecycle/history is current staged work; Closed Lost reason capture is low-priority follow-on
- Raised: 2026-08-27 by Chris (via nova handoff, then Chris clarification)
- Updated: 2026-08-28

## Problem

LPS Ops needs a clear current state for each customer job request and a durable historical record of completed work and quote cycles. Archived is not useful to Chris: bad/duplicate requests are exceptional deletions; legitimate work ends Closed Won or Closed Lost and remains reportable history.

Quick quote opportunities are now separate from Job Requests: they do not enter Request Management until customer re-engagement to source plants or update installation timing creates a new Request. The Job Request lifecycle therefore drives only active sourcing/availability work, Rosie's JR picker, related availability requests, and JR-thread closure; the source quote remains linked historical context.

## Evidence

- 2026-08-27 — Chris initially named/colors: Active (green), Quote Delivered (blue), Confirmed (purple), Closed Won (teal/dark green), Closed Lost (red), Archived (gray). He later ruled out Archived as a normal outcome. (via Nova/Chris)
- 2026-08-27 — Chris wants Closed Won/Lost in a Job Request Historical view for questions such as requests/dollars created in January and Closed Won last month. Duplicate/bad requests are deleted. (via Chris)
- 2026-08-28 — Chris defined Confirmed: availability/quote work and back-and-forth are complete, the customer has received available items and cost, and has committed to buy. (via Chris)
- 2026-08-28 — Chris corrected Closed Won: it is only after plants are delivered or picked up and the transaction took place, not order-ID creation. (via Chris)
- 2026-08-28 — Bhoumik says customers can add/remove plants or accept substitutions after a first quote, requiring multiple quote deliveries on the same Job Request. He recommends New/In Progress as current labels and retaining quote deliveries as history/milestones rather than using Quote Delivered as a current status. (via Bhoumik)
- 2026-08-28 — Chris decisively chose the sales-pipeline model: Quote Delivered remains a necessary distinct state showing the customer received pricing/availability. On a customer change, the request returns to Active; when the revised quote is sent, it returns to Quote Delivered. Chris considered “Quote and Availability Delivered” but chose the concise label Quote Delivered; it means the complete pricing-and-availability package, with clarifying help text rather than a longer status name. (via Lily)
- 2026-08-28 — Chris confirmed that supplier changes occur regularly after confirmation. Confirmed must surface a supplier-facing Order Details inbox item that carries the request’s information and the same communication/update capability through fulfilment; confirmation does not close supplier availability communication. (via Telegram)
- 2026-08-28 — Chris clarified that about 90% of requests are future projects: LPS can deliver a price quote before checking live nursery availability, which normally happens 7–10 days ahead. He proposed **Availability Updated** for the point when the nursery completes its current availability update and LPS sends that information to the customer for review. (via Telegram)
- 2026-08-29 — Bhoumik proposes an alternative objective lifecycle: New → In Progress → Committed → Closed Lost/Won, with quote deliveries and availability updates as durable mapped sub-events with links, filters and badges. He says recurring cycles make customer-delivery labels subjective current stages. This conflicts with Chris’s stated need for the status itself to track customer receipt of pricing/availability. (via Bhoumik)
- 2026-08-29 — Bhoumik flags that stored supplier price data can be stale. A customer quote before current supplier confirmation risks a price rise after commitment; an updated supplier price list could support a quote without a live availability check only if Chris accepts that commercial policy and defines the verification/communication gate before commitment. (via Bhoumik)
- 2026-08-29 — Chris approved early budgeting quotes from available pricing: contractors need a plant-cost placeholder to bid and understand price/availability can change with install timing. Quote delivery is a customer-facing milestone. Before commitment, LPS must put the later current supplier availability **and price** in front of the customer. (via Telegram)
- 2026-08-29 — Bhoumik demonstrated that a minor customer change makes both “quote delivered” and “needs work” true, so either sales-stage status hides a material fact. Recommended alternative: objective lifecycle plus simultaneously visible dated/filterable milestones/markers for latest quote, latest verified availability, and pending customer change. Chris is deciding whether this preserves the sales-pipeline view he needs. (via Bhoumik/Lily)
- 2026-08-29 — Chris chose sales stages, but redefined them to remove the collision: **Pricing** covers LPS/customer work through pricing, including quote revisions; **Availability** begins closer to planting/when needed and covers LPS/customer consensus on current availability and what the customer will buy. Quote deliveries and supplier submissions are events within their respective stages, not stages. (via Chris)
- 2026-08-29 — Chris’s usual live availability timing is 7–10 days before installation. Current Job Requests have no structured installation/delivery or availability-needed-by date; timing exists only in free-text notes, so Rosie cannot reliably trigger the Availability stage without a new business rule/data source and an override. (via Bhoumik/schema review)
- 2026-08-29 — Bhoumik confirms a quick quote opportunity may use available catalog pricing without supplier confirmation, because it is explicitly indicative and outside Request Management. Its later conversion, not the quote itself, starts sourcing; current supplier price and availability remain required before Confirmed. (via Bhoumik)
- Current requests use Sourcing, Quoted, Closed Won, Closed Lost, Archived; only Sourcing/Quoted count as open, and closed statuses close Rosie's JR thread. (schema/app review, 2026-08-27.)

## What it should do

- Retire Archived as a future job-request outcome. Keep Confirmed (purple), Closed Won (teal/dark green), and Closed Lost (red), with their settled meanings.
- Apply this lifecycle only after a quick quote opportunity explicitly converts into a new Job Request. The prior **Pricing** entry stage is superseded: early budgeting quotes and their revisions live in the separate Quote opportunity workflow. A converted Request enters Request Management for live sourcing/installation work—normally **Availability**, then **Confirmed**, **Closed Won**, or **Closed Lost**. A later supplier re-submission is a separate notification/freshness event, not an automatic stage change.
- Treat the source quick quote, supplier submissions, and LPS’s later delivery of current supplier-verified availability-and-price as durable, dated events linked to the Job Request as applicable. Keep every cycle visible and reportable; never overwrite earlier customer packages.
- Use Confirmed only after the customer commits after receiving the current supplier-verified availability and price package; an early budgeting quote alone cannot satisfy this gate. Confirmation creates/surfaces a supplier-facing Order Details inbox item that carries the request information and retains the same supplier communication and update capability through fulfilment; it does not close related availability communication.
- Use Closed Won only when plants are delivered or picked up and the transaction is complete. Closed Lost is the other completed outcome. Both leave active work and remain in Job Request Historical.
- When a job reaches Closed Won or Closed Lost, close its related availability requests and Order Details communication; do not change line-item or supplier-answer meanings.
- Make history support requests/dollars created in a period and Closed Won requests/dollars in a period, with clear date/total basis.
- Preserve existing legitimate requests and their audit trail through migration. Keep permanent deletion guarded and exceptional for duplicates/bad requests.

## Acceptance criteria

- A quick quote opportunity is distinct from Request Management and can be returned without a Job Request. A customer re-engagement to source plants or update installation timing creates a linked new Request, which enters the Job Request lifecycle at Availability; Archived is not selectable.
- The source quote, supplier submission, and LPS availability-and-price delivery are dated, reviewable events; the early quote remains historical/indicative rather than becoming a verified supplier commitment.
- Confirmed means customer commitment, not fulfillment. It shows the supplier an Order Details inbox item with the carried-forward information and ongoing update/communication capability. Closed Won occurs only at delivery/pickup and transaction completion, not at order creation.
- Completed requests leave active work and Rosie's open JR picker but remain in Job Request Historical for the stated reporting questions.
- Moving a job to Closed Won or Closed Lost closes all related availability requests and the Order Details communication.
- Existing requests map to valid stages without disappearing or losing history; deletion is guarded and only for bad/duplicate requests.

## Deferred follow-on — not an immediate build item

- On a future status/history update, Closed Lost requires and saves one reason: Price, Different Vendor, Unable to Fulfill Request, No Response, or NA; expose it in history/querying then.

## Out of scope

- Changing individual plant-line availability states.
- Changing supplier portal status vocabulary, apart from the agreed parent-job closure behavior.
- Customer/supplier identity metadata and a general chat-status system.

## Open questions

- **Bhoumik:** Define the supplier-change event/notification and Last updated semantics so a re-submission is visibly dated, attributed to the nursery rather than LPS, retains before/after values where changed, and does not alter the Job Request’s customer-facing stage.
- **Bhoumik:** Define the Order Details phase as a carried-forward supplier inbox view with the request’s information and communication/update capability until terminal closure; define durable quote-cycle milestones/history and a safe migration for current Sourcing/Quoted/Archived records. Preserve/report created, quote-delivered, Confirmed/order-created, Closed Won (transaction complete), and Closed Lost dates; handle historic Closed Lost records without a known reason; confirm legacy-chat scope.
- **Bhoumik:** Coordinate the Job Request lifecycle with `quote-opportunity-to-job-request-conversion`: quick quotes are plainly indicative and need no supplier check; after conversion, current supplier-verified price and availability must be delivered to and accepted by the customer before Confirmed.

## Handoff log

- 2026-08-27 — Staged for Bhoumik; workflow/data rather than Nova UI work.
- 2026-08-27 — Archived retired; history/reporting and exceptional deletion added. Closed Lost reasons recorded as deferred.
- 2026-08-28 — Confirmed and Closed Won definitions clarified; prior order-ID-as-Closed-Won interpretation corrected. Closure of related availability requests at terminal closure included.
- 2026-08-28 — Quote delivery recognized as recurring. Chris chose the Active/Quote Delivered sales-pipeline labels; customer changes return the request to Active and revised quote delivery returns it to Quote Delivered. Bhoumik’s quote history/milestone design must preserve every cycle.
