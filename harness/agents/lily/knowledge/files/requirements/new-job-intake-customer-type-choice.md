# Let Chris identify a homeowner or landscape professional when a new job starts

- Status: drafted — optional intake/Job display follow-on; customer storage contract complete; not newly routed
- Route: nova
- Raised: 2026-08-30 by Chris (via telegram image)
- Updated: 2026-09-11 05:33:52 CDT

## Problem

Chris nearly entered “Retail” as a customer’s company because there was no separate customer-type choice. A clear intake choice should keep classification separate from the real company without implying that selecting a type already activates different pricing or service.

## Evidence

- 2026-08-30 feedback log, **Homeowner or landscape professional**: Chris requested Homeowner / Landscape Professional at new request/job intake, ultimately supporting retail versus contractor treatment.
- 2026-09-11 05:18:33 CDT, **Customer type minimum first**: Bhoumik asks about adding a customer-level type for now. Lily recommends an optional customer-level choice, with Jobs using their linked customer’s current type; no per-job copy or snapshot is required. This is a recommendation, not implementation authorization.

- 2026-09-11 05:33:34 CDT, **Customer type reported done**: Bhoumik reports the minimal item complete. Migration 0090 and application note support the nullable customer-level storage contract with exact values **Homeowner/Retail** and **Landscape Professional**. Current source includes Customer page read/edit controls; no focused-intake control or nested Job type display is present. This optional follow-on must not keep the storage item open.

## What it should do — optional follow-on

Offer a clearly labelled **Customer type** choice between **Homeowner/Retail** and **Landscape Professional** during new request/job intake. Preserve an honest unset state when unknown. Do not require a guess to continue intake or put the category in the company field.

Display the linked customer’s current type in intake and the resulting customer/Job workspace. The UI must make clear that this is a customer-level classification, not a per-Job exception or a promise of a different price. With no linked customer or no known type, show unknown/unset honestly; do not infer a category from a company, address, or previous price.

Use the existing customer-level read/write contract and its exact vocabulary. Job detail currently exposes a customer link but does not embed type, so obtain the current classification through the customer read path rather than implying it is already supplied in the Job response. Do not create local-only type state that appears saved, duplicate the type onto each Job, or add a per-Job snapshot. If a type is corrected, reflect the linked customer’s current classification rather than claiming a historical as-of-Job value.

The choice does **not** activate retail prices, discounts, different payment terms, or separate operational workflows. Those remain unchanged until Chris defines the policy and Bhoumik authorizes it. The persistence blocker is now removed; this optional UI need not wait for commercial policy, but this verification task does not route a new implementation.

## Acceptance criteria

- Chris can identify Homeowner/Retail or Landscape Professional during intake without entering the label as the customer’s company.
- Unknown type remains unset, and intake can continue without guessing.
- The selected or unset state reflects the linked customer’s current persisted type in intake and the customer/Job workspace.
- The UI makes the customer-level scope understandable and offers no per-Job override or historical-snapshot claim.
- Existing unclassified customers are not silently assigned a type.
- Selecting or correcting type makes no automatic pricing, quote, payment, status, or workflow change, and UI copy does not imply otherwise.
- A choice persists through the completed customer-level contract; an unsuccessful save is not presented as durable.

## Separate/deferred work

- Existing company/job/contact display composition belongs to `job-request-display-identity`, already independently routed; no combined title is stored by this choice.
- The earlier Retail naming and EPD/date ideas remain related context, not prerequisites or newly released scope for this minimal control. Timing/fulfillment follows `job-request-install-date-fulfillment`.
- Any later retail/contractor pricing or service behavior belongs to Bhoumik’s staged policy work.

## Out of scope

- Database changes, per-Job copies/snapshots, or migrations performed as part of Nova UI work.
- Defining or activating retail versus contractor pricing, terms, tax, delivery, supplier behavior, or new workflows.
- Inferring/reclassifying existing customers or cleaning company names automatically.

## Assumptions

- The proposed first step is one optional classification on the customer. A different per-Job model would require a new explicit decision, not a UI assumption.
- Pricing-policy answers are not blockers for classification-only display; customer persistence is complete.
- Current Customers read/edit UI exists in source, but production frontend rollout and actual save behavior were not independently exercised by this audit.

## Open questions

- **Lily main:** Decide when to route this remaining optional focused-intake/Job display slice. It is not a blocker to Bhoumik’s completed storage item.

## Handoff log

- 2026-08-30 — Drafted as the visible choice slice, initially bundled with broader type-specific workflow/data dependencies.
- 2026-08-31 — Rosie’s approved naming procedure retained a factual Job name rather than a combined company/job value.
- 2026-09-02 — JR-34/JR-36 clarified independent company/job/contact display composition; that requirement was routed separately to Nova.
- 2026-09-11 05:19:04 CDT — Narrowed this draft to classification only after item-6 review. At that point customer persistence was unapproved; pricing policy, per-Job copies/snapshots, and date/naming changes were removed as prerequisites.
- 2026-09-11 05:33:52 CDT — Bhoumik reports storage complete; migration and source reviewed read-only. Removed the data-contract blocker, recorded actual Homeowner/Retail vocabulary and Customers source UI, and kept focused-intake/Job display as an optional unrouted follow-on. No production writes or new implementation handoff.
