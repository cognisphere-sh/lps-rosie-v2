# Keep missing prices distinct from free plants and Order readiness

- Status: staged · focused business contract decision; no change authorized
- Route: bhoumik
- Raised: 2026-10-05 via Rosie/Nova contract-conflict handoff
- Updated: 2026-10-05 19:07:03 CDT

## Problem

Unknown prices are described inconsistently: Rosie’s general guidance says unknown prices stay empty, while candidate intake guidance uses numeric zero for not found, never empty. Current source supports either as an unpriced candidate, but treats actual zero supplier answers differently. LPS must not mistake missing prices for free plants or silently lose legitimate zero-price facts.

A related, distinct action boundary needs a decision: inspected Order creation source permits price-pending Orders, while Rosie’s procedure says never order unpriced. The choice is **whether and when a price-pending Order is allowed**, not a presumption that every candidate needs a price or a new Order gate is already approved.

## Evidence

- Feedback **Unknown-price contract needs owner trace**, **Unknown price source trace completed**. Nova’s existing completed read-only audit: `../nova/workspace/threads/main/tasks/candidate-price-null-audit/notes.md`; Lily’s attributed summary `workspace/threads/main/tasks/pricing-controls-audit/unknown-price-2026-10-05.md`.
- Candidate unknown prices are nullable in inspected source. Candidate empty and zero both show No price; selecting either leaves the Job price empty, and unselected candidates do not affect selected totals. The documented zero-sentinel convention is not a technical source prerequisite.
- JR102 owner directed only NEW unpriced Kidneywood/Leadtree1282–1285 to empty prices with no selection-total effect. That approved case remains unblocked; no wider candidate/price rewrite is approved.
- Availability-request zero with a supplier answer is a numeric zero-price fact, not the same as an unanswered zero sentinel. The answer API accepts a blank string to clear a price to empty but rejects explicit JSON null. Inventory, candidate, Job and quote conventions must not be flattened into one unsupported rule.
- Inspected direct/availability-based Order choices and creation paths do not require a price; they can retain an empty price and empty total after normal quantity/confirmation checks. Numeric zero instead fails the Order positive-price constraint. Quote generation has separate missing-price restrictions.
- These are **source findings**, dirty working tree0dc74ad8, not deployed/database or successful runtime outcomes. No tests/build/browser/API/DB probes were performed by Nova for this audit or duplicated by Lily.

## What it should do

Use a clear, consistent contract for unknown, actual zero and positive prices, separately identifying a missing-search-result marker where one is deliberately retained. Readers, write paths and totals must preserve those meanings rather than turn empty into free or represent a zero sentinel as a supplier’s offer.

Choose the permissible unpriced-work stages: exploratory candidates and selection, customer priced quotes, explicit Order creation and later fulfillment steps need not have identical prerequisites. If price-pending Orders are allowed, retain that unresolved condition honestly. If they are prohibited at a specific action, enforce only the approved boundary with a useful explanation. No new gate is assumed here.

## Acceptance criteria for the selected contract

- Unknown candidate prices remain visibly unpriced and do not invent a price or selected total; currently approved JR102 empty-price handling remains valid unless an explicit later decision changes its scope.
- A real supplier zero-price answer is distinguishable from unknown/not-found and is not bulk-cleared by sentinel normalization.
- Candidate selection, Job price persistence, quote completeness and Order readiness follow their separately agreed stage rules; exploratory unpriced candidates are not blocked merely because firm pricing is required later.
- At the chosen explicit Order/fulfillment boundary, missing price is either deliberately allowed as unresolved or rejected with a clear reason. Procedure and actual permitted behavior agree.
- Empty-price writes use the accepted API form; an invalid JSON-null payload is not silently substituted for a supported clearing operation.
- Line prices/totals and rollups do not falsely claim free or fully priced work from missing values. Any required presentation fix is scoped to the approved semantics.
- Existing candidate seeding, typed substitutes and documented zero conventions are aligned through their owners if changed, without blanket historical repricing or unrelated workflow changes.

## Out of scope

- Choosing a new sentinel or Order gate on Lily’s authority; requiring positive price for every discovery candidate or selection.
- Blanket zero-to-empty conversion, rewriting existing catalogue/Job/AR prices or approved/supplied terms, or inferring free plants from unknowns.
- New alias, approved pricing-reference, taxonomy or quote/order-management feature.
- A wider audit, live repair, tests, deployments, current JR102 operational changes or supplier/customer contact from this handoff.

## Open decision / ownership

- **Bhoumik:** Which candidate unknown-price convention should owners use consistently, and are price-pending Orders allowed—if so, when does price become mandatory? This is one focused contract decision, not a requested universal gate or preselected implementation.
- **Rosie:** align agent-owned instructions with the chosen contract; do not change existing source/API/price conventions globally from the new-JR102 case alone.
- No Nova build has been assigned. Parent confirms successful Bhoumik notification, Telegram365 (2026-10-05 19:09:21 CDT handoff); await his decision. No second human question or additional audit is required.

## Assumptions and limits

Source capability does not prove deployed behavior, justify creation of an unpriced Order, or decide the commercial rule. Unknown is not free; an actual zero AR answer does not automatically qualify as an Order price under the existing positive-price constraint. Existing current case approval is narrower than general convention reform.

## Handoff log

- 2026-10-05 19:03:44 CDT — Captured conflict and awaited Nova’s already-owned trace without duplication.
- 2026-10-05 19:07:03 CDT — Reused completed owner source report; staged this single focused unknown-price/Order-readiness decision for Bhoumik. No code, SOP, schema, data, tests or build routing by Lily; parent handoff ready for one notification.
- 2026-10-05 19:09:21 CDT — Parent confirms successful Telegram365 to Bhoumik. Decision pending; notification is not a new gate, repricing or builder authorization. JR102 unchanged; dirty-source capability remains distinct from observed unpriced Orders.
