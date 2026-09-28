# Keep Berkeley Sedge 1 G priced on the APS price sheet

- Status: staged
- Route: bhoumik
- Raised: 2026-08-25 by Chris (via rosie)
- Updated: 2026-09-03

## Problem

APS can carry the requested cultivar but have its price only represented by a generic line. Berkeley Sedge, 1 gallon is the immediate case: Chris needs it listed on APS’s price sheet at APS’s existing 1 G Sedge price, so the known correction remains available instead of being rediscovered on each Job Request.

The requested cultivar must remain exact for availability, supplier requests, orders, and fulfilment. This is a persistent APS price-sheet correction, not a claim that Berkeley Sedge and generic sedge are the same plant.

## Evidence

- 2026-08-25, **One-gallon sedge price** in `feedback.md`: Chris said, “Basically any sedge can be mapped to a 1g sedge price,” then clarified, “1g sedge variety has the same price.” Berkeley Sedge on JR-10 was available but lacked an exact APS price.
- 2026-09-03, **Recurring APS sedge pricing match**: Chris said “this recurring plant-name matching issue keeps happening” while requesting the JR-37/AR-19 correction: Berkeley Sedge, 1 gallon, at APS’s 1 G Sedge price.
- 2026-09-03, **Simple APS Berkeley Sedge correction**: Chris clarified the desired solution is to add Berkeley Sedge 1 gallon as an APS price-sheet line item at that price—not to force a complex alias/equivalence mechanism.

## What it should do

Maintain an APS price-sheet entry for **Berkeley Sedge, 1 gallon** at APS’s established **1 G Sedge** price. The entry must persist for later APS pricing work while retaining Berkeley Sedge as the requested cultivar.

## Acceptance criteria

- APS’s price sheet contains a Berkeley Sedge, 1 gallon entry at the APS 1 G Sedge price.
- A later APS availability request or price prefill for Berkeley Sedge, 1 gallon can use that maintained APS price-sheet entry without re-entering the correction for that Job Request.
- Availability requests, supplier-facing requests, orders, and fulfilment retain **Berkeley Sedge** as the requested item.
- The price-sheet correction does not change generic sedge pricing, non-sedge pricing, other sedge sizes, or another supplier’s prices.
- An APS confirmed price can still replace or correct the prefilled price where the normal workflow allows it.

## Out of scope

- The immediate JR-37/AR-19 correction or any agent’s current work on it.
- Treating Berkeley Sedge and generic sedge as interchangeable for availability, substitution, fulfilment, search, or plant identity.
- Creating a generalized plant alias or pricing-equivalence mechanism.
- A shared price rule for other sedges, sizes, or suppliers.

## Assumptions

- “1 gallon” and “1 G” refer to the existing 1 G size convention.
- APS’s existing 1 G Sedge price is the approved price to place on the Berkeley Sedge, 1 gallon APS entry.

## Later distinct case

2026-09-25 19:06:17 CDT — Texas Sedge | Carex texensis1G now has a separate approved APS generic Sedge1G pricing reference, recorded in `approved-pricing-reference-reuse.md`. It does not expand this historical Berkeley Sedge case. Bhoumik’s rejection of synthetic duplicate price-only rows means this file’s earlier line-item wording must not be treated as permission to create such rows for Texas Sedge or other plants. This record remains staged; no independent completion, cancellation or new implementation is asserted.

## Open questions

- None for this scoped correction. If similar persistent cross-name price-sheet corrections continue after this entry, Chris and Bhoumik can review whether a broader governed workflow is justified.

## Handoff log

- 2026-08-25 — staged for Bhoumik as a pricing and order-workflow change; not sent to Nova.
- 2026-09-03 — Chris identified recurring APS plant-name matching; Daisy corrects APS inventory and Rosie corrects the current JR/AR separately.
- 2026-09-03 — Chris narrowed the requested durable outcome to a Berkeley Sedge, 1 gallon APS price-sheet entry at APS’s 1 G Sedge price. A generalized equivalence mechanism is explicitly deferred unless future repeats justify review.
