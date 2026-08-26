# Use one 1 G price for sedge varieties

- Status: staged
- Route: bhoumik
- Raised: 2026-08-25 by Chris (via rosie)
- Updated: 2026-08-25

## Problem

A 1 G sedge variety can be available from a supplier without a price on that exact variety's catalogue record. On JR-10, Berkeley Sedge was confirmed available at APS but lacked an exact APS price. Today, the price-prefill path only uses an exact plant identity at the requested size, leaving the price blank in this situation.

Chris has established that every 1 G sedge variety has the same 1 G sedge price. Pricing should therefore not be blocked by a missing cultivar-specific price, while availability and fulfilment still require the exact cultivar.

## Evidence

- 2026-08-25, **One-gallon sedge price** in `feedback.md`: Chris said, “Basically any sedge can be mapped to a 1g sedge price,” then clarified, “1g sedge variety has the same price.” The immediate case was Berkeley Sedge on JR-10.
- This affects a live order and the price used for an order, so it has earned a requirement rather than remaining a watched convention.

## What it should do

When LPS prices a 1 G sedge variety, use the established generic 1 G sedge price even if the exact variety has no price recorded.

Keep the requested cultivar unchanged for supplier availability checks, supplier requests, order creation, and fulfilment. The pricing convention must only supply the price; it must not treat varieties as interchangeable stock or change what is ordered.

## Acceptance criteria

- A 1 G Berkeley Sedge line with confirmed availability and no cultivar-specific price receives the established 1 G sedge price.
- An availability request for a 1 G sedge names the requested variety, not a generic sedge.
- The resulting supplier order and fulfilment record retain the requested sedge variety.
- The shared-price convention does not apply to non-sedges or to sedges in other sizes.
- A supplier's confirmed price can still replace or correct the prefilled price where the normal workflow allows it.

## Out of scope

- Treating sedge varieties as substitutes for availability or fulfilment.
- A shared price for sedges in sizes other than 1 G.
- Changing supplier-provided catalogue prices generally.

## Assumptions

- “1g” means the existing 1 G size convention.
- The established generic 1 G sedge price is the price LPS should prefill when the exact variety has no price; Bhoumik will determine the appropriate governed source and application point for that shared rate.

## Open questions

- Bhoumik: confirm where the governed generic 1 G sedge price should be maintained and at which pricing step it should be applied, while preserving the exact-cultivar availability and order workflow.

## Handoff log

- 2026-08-25 — staged for Bhoumik as a pricing and order-workflow change; not sent to Nova.
