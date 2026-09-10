# Make every pricing answer traceable and dependable

- Status: staged
- Route: bhoumik
- Raised: 2026-09-09 by Chris (via Rosie escalation)
- Updated: 2026-09-09

## Problem

Chris cannot rely on a pricing answer when an agent makes a confident claim without reconciling the exact current source row and any conflicting evidence. In the Palo Verde incident, Rosie initially reported no APS 48-inch Palo Verde and an agent then misread/misattributed Chris’s photo as **Palo Verde Desert Museum 48 inch Box** at **$2,395**. Bhoumik’s challenge and Rosie’s first read-only reconciliation found no active or inactive 48-inch inventory row; Daisy then verified the current APS PDF is unchanged and lists **48-inch Desert Museum Palo Verde at $2,499**. The manually evidenced $2,395 was retained as an exact inventory offering but flagged confirmation-required because it conflicts with the current PDF. Chris said, “Uhh you’re not ready for showtime. Please escalate this. Your ability to pricing seems often error prone.”

The catalogue already retains an offering’s source and ingestion date, and agents have careful search guidance, but a pricing answer has no durable, reviewable control that connects the requested item, the matched offering (or verified no-match), the price, all relevant source evidence, and conflict state. A search miss, photo reading, or one source can therefore be presented as a settled fact despite contrary evidence.

## Evidence

- 2026-09-09, **APS Palo Verde price missed**, **Palo Verde photo reading corrected**, and **Palo Verde source conflict clarified** in `feedback.md`: an initial no-price claim, a $2,395 photo misread, and later source reconciliation exposed conflicting evidence—current APS PDF $2,499 versus manually evidenced $2,395—requiring confirmation rather than a settled-price answer.
- 2026-08-25 and 2026-09-03, **One-gallon sedge price** and **Recurring APS sedge pricing match**: the same APS pricing correction had to be rediscovered for Berkeley Sedge 1 G.
- Current Rosie procedure says a catalogue listing prices a line but is not availability confirmation; it requires the mapped inventory row in supplier handoffs. Current inventory retains per-offering source and ingestion provenance, but that evidence is not governed as part of a pricing-answer outcome.

## What it should do

Define a durable pricing-lookup and answer control for supplier catalogue pricing.

For every price used or reported, retain and make reviewable the requested plant/size, the exact offering selected, supplier, displayed price, source evidence, source/ingestion date, and whether it is a catalogue listing, supplier-confirmed price, or another explicitly approved basis. Where evidence conflicts, retain each source and price, mark the offering confirmation-required, and prevent either value being represented as settled. A price from a different plant, cultivar, grade, or size must be identified as such and cannot be silently represented as an exact match.

For a no-price/no-match conclusion, require a bounded verification outcome rather than a confident absence based only on one search result: either the relevant current source was checked and contains no exact offering, or the response is marked unresolved and routed for source-data review. Preserve the underlying source evidence, conflict and correction history so an APS spreadsheet correction is not rediscovered job by job.

Bhoumik should decide the durable record, rules for source freshness/completeness, exception and correction workflow, ownership between catalogue ingestion and job pricing, and how this integrates with indicative versus supplier-verified quoting. Rosie and Daisy own any resulting agent procedure changes.

## Acceptance criteria

- A price answer or applied price can be traced to the exact supplier offering and source evidence, including when that source was ingested.
- An exact product/size request cannot be answered as unavailable or unpriced solely because one indexed search produced no match when its relevant current source has not been verified.
- A non-exact offering is visibly treated as a different offering or unresolved option, not as the requested product’s price.
- A verified price finding or verified no-match such as APS Palo Verde is retained and available to later pricing work without relying on Chris to re-send or an agent to re-interpret a spreadsheet photo.
- Chris and LPS can tell whether a quoted price is a catalogue/listing price, supplier-confirmed price, other explicitly approved basis, or confirmation-required because source evidence conflicts.
- A detected mismatch or missing indexed offering has a clear owner and outcome: corrected source data, documented no-match, or explicit unresolved/needs-review state.
- The controls do not claim current availability from a price-list entry and do not bypass the existing supplier-confirmation and customer-quote controls.

## Out of scope

- Changing a supplier’s published price, contacting a supplier, or treating a spreadsheet listing as current availability.
- A blanket alias/equivalence engine; the existing scoped APS Berkeley Sedge correction remains separate.
- A UI-only confidence badge without durable source, correction, and workflow semantics.
- Replacing the immediate focused-Job routing and urgent-pricing workflow requirements.

## Assumptions

- The Palo Verde photo is not reliable enough by itself to establish a price; the reconciliation establishes that its prior $2,395 reading was wrong. The durable process must verify the actual source row rather than rely on chat-photo interpretation.
- A catalogue price may support an indicative quote under Chris’s existing policy, while current supplier availability and price remain required before commitment.

## Open questions

- **Bhoumik:** What source freshness threshold and verification steps should distinguish a usable catalogue price from an unresolved or stale one?
- **Bhoumik:** Should a failed exact lookup automatically create a source-data review item, and who owns its resolution when the source is an APS spreadsheet?
- **Chris:** Beyond this immediate safeguard, what customer-facing wording best distinguishes an indicative catalogue price from a verified current price, if any change is needed?

## Handoff log

- 2026-09-09 — Staged for Bhoumik as a pricing-data/workflow reliability control. Rosie and Daisy received owner-review recommendations for immediate search and uncertainty safeguards; no other agent’s procedure was modified.
- 2026-09-09 — Rosie and Daisy confirmed the safeguards fit their current procedures. Both require Chris’s or Bhoumik’s explicit approval before any skill edit.
- 2026-09-10 — Corrected the incident evidence after Rosie’s Bhoumik-challenged, read-only reconciliation: $2,395 was initially a photo misread/misattribution rather than a settled missing/deleted record. Daisy then verified a current APS PDF 48-inch line at $2,499 and retained manually evidenced $2,395 as an exact, confirmation-required offering because the sources conflict. Requirement remains staged because it directly reinforces exact-source-row verification and explicit conflict handling for both price and no-price claims.
