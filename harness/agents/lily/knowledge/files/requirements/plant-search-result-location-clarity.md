# Show where each Plant Search match is located

- Status: routed
- Route: nova
- Raised: 2026-09-04 by Chris (via Daisy handoff)
- Updated: 2026-09-04

## Problem

Chris needs to judge an exact plant-and-size match before deciding whether its location or delivery fit works. Current Plant Search groups matches by supplier company and shows a supplier state, but the specific matching farm/location is not consistently visible; a branch name appears only in some multi-location cases. That makes a Georgia exact match easy to lose behind an early Florida filter or misread as a company-headquarters location.

## Evidence

- 2026-09-04 feedback log, **Cherry laurel geography filter**: Lake Tree Growers’ exact 15 G, 6–7 foot Cherry Laurel in Georgia should have been surfaced and location-labelled instead of omitted after an early Florida filter.
- App audit, `/plants`: matching inventory is grouped under a company; supplier state is shown at group level while the matching row’s branch/farm evidence is conditional. The current result API already orders unfiltered search results by relevance, so this is a result-reading UI need, not a ranking/query rewrite.

## What it should do

In Plant Search results, make the location of the specific matching inventory clear wherever Chris reads a result, alongside the supplier/company identity. Use the most specific location evidence the existing result provides; distinguish a stock/farm location from a supplier/company location when that distinction exists. If only supplier location is known, label it honestly rather than implying it is where the stock sits.

Keep Plant Search’s existing broad matching, relevance ordering, filters, grouping, and delivery-neutral behavior. State remains an optional refinement, not an automatic restriction imposed by the result display.

## Acceptance criteria

- On desktop and mobile, every displayed matching inventory row has a clear, concise location cue tied to that match or an honest supplier-location cue when no stock-location evidence exists.
- A result from a different state than the requested/preferred area remains visibly understandable as, for example, a Georgia match rather than disappearing behind supplier grouping.
- Where a company and the matching stock have distinct known locations, the result distinguishes them without implying headquarters is the farm.
- The location cue remains readable in collapsed and expanded result states and does not create clipping, overlap, or horizontal scrolling at supported desktop and phone widths.
- Existing search relevance, size/plant matching, state filter behavior, grouping, totals, pagination, delivery claims, and API/data semantics do not change.

## Out of scope

- Changing search ranking or automatically applying geographic filters.
- Adding delivery territory, freight, distance, routing, or live availability claims.
- Creating new supplier/farm location data or changing inventory/supplier records.

## Assumptions

- This is a UI/UX clarity slice using location facts already present in the current result read model. If a required location distinction is not available, Nova should keep the display honest and flag the durable data gap rather than inventing it.

## Open questions

- None.

## Handoff log

- 2026-09-04 — Routed to Nova as UI-only result-location clarity; no search-ranking or data-model change requested.
- 2026-09-04 — Full behavior and acceptance criteria sent to Nova’s main thread.
- 2026-09-04 — Nova accepted; it will combine this with the frozen Plant toolbar candidate, then run technical review and the mandatory real-browser visual gate. Matching/ranking/filter semantics remain untouched.
