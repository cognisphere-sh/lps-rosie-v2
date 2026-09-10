# Find the exact plant and size before narrowing by geography

- Status: drafted
- Route: daisy
- Raised: 2026-09-04 by Chris (via Daisy handoff)
- Updated: 2026-09-04

## Problem

A request for “6 foot cherry laurel in FL” was filtered to Florida before the product was evaluated. Daisy answered that none were available, omitting Lake Tree Growers in Georgia with an exact 15 G, 6–7 foot Cherry Laurel at $73. Chris needs sourcing searches to surface the best exact plant-and-size match rather than silently turn a geographic preference into a no-results conclusion.

## Evidence

- 2026-09-04 feedback log, **Cherry laurel geography filter**: Chris asked why the exact Georgia match was not returned first after Daisy filtered to Florida and said none.
- Daisy `plant-and-supplier-search` skill review: it says to set filters from what was asked and discusses geographic evidence, but does not state that non-exclusive geography is a qualifier rather than an early exclusion.

## What it should do

For a plant/size request that includes geography, first retrieve and present exact identity/size matches across the catalogue and show each matching supplier/farm location explicitly.

Treat geography as a separate qualifier: distinguish matches in the requested area from those outside it, but do not exclude the latter before evaluating the product and size. Within equally good product/size matches, a requested-area match may be called out or placed first. Never infer delivery or stock location from supplier headquarters.

Only apply a geographic restriction that can remove otherwise matching inventory when Chris explicitly says geography is mandatory, such as “Florida-only,” “local only,” or an equivalent delivery boundary. If the wording is genuinely unclear, give the exact matches with their locations and ask one concise follow-up rather than reporting none.

## Acceptance criteria

- For a non-exclusive geographic plant request, Daisy searches the full relevant inventory before concluding whether the requested plant and size are available.
- An exact product-and-size match outside the preferred geography is included and clearly labelled with its supplier/farm location.
- A weaker product or size match does not displace an exact match solely because it is nearer or in the preferred state.
- A “none” answer makes clear whether it means no exact plant/size match anywhere or no match in the preferred area; it never collapses those two answers.
- Supplier/farm location evidence is named accurately, and delivery eligibility is not assumed from it.
- Explicit Florida-only/local-only/delivery-boundary requests may use geography as a filter; ambiguous wording receives one concise clarification or a location-labelled full-match answer.

## Out of scope

- Changing inventory, supplier, farm, location, delivery, or pricing data.
- Claiming delivery coverage, estimating freight, or contacting suppliers.
- Changing the Plant Search app’s data/query contract.

## Assumptions

- Chris’s use of “in FL” in this incident expressed a preference for Florida supply, not an exclusive Florida-only restriction; his stated rule governs future handling.
- This is a Daisy-owned skill/process recommendation. Daisy must not alter its skill without Chris’s or Bhoumik’s approval.

## Open questions

- Chris’s or Bhoumik’s explicit approval is required before Daisy changes procedural memory.

## Handoff log

- 2026-09-04 — Drafted from Chris’s direct correction.
- 2026-09-04 — Recommendation sent to Daisy for owner review only; no skill edit is authorized pending Chris’s or Bhoumik’s approval.
- 2026-09-04 — Daisy confirmed the recommended wording accurately reflects the intended behavior and likewise requires explicit Chris/Bhoumik approval before a skill edit.
