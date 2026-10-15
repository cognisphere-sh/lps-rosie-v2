# Keep missing prices distinct from free plants and Order readiness

- Status: staged · intentional-zero business outcome APPROVED379; B-owned implementation contract pending; separate Order/convention policy unapproved
- Route: bhoumik
- Raised: 2026-10-05 via Rosie/Nova contract-conflict handoff
- Updated: 2026-10-14 21:57:28 CDT

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

## October 14 intentional-zero quote slice — approved outcome, B-owned implementation

2026-10-14 18:19:21 CDT — Nova relays Chris JR121 web complaint that his entered zero is not registering for quoting; the compressed handoff is **not verified verbatim**. Rosie reports explicit approval for **requested Shrub Live Oak, line1349, quantity23, quote price$0**, not alternate2135 Southern Live Oak at$495. Rosie reports `update_job_line` accepted0 and selected candidate2115 stores0. These are owner reports, not live verification by Lily.

The business outcome is distinct from missing price: this approved intentional zero must register for that quote without replacing the requested plant, silently selecting the priced alternative, or converting other missing prices to0. Quote-price approval does not confirm stock, authorize Order/customer delivery, or mark a line complete. JR12116 demands, unknown customer/fulfillment details, quoted stage and pending status are also owner-reported, not established completeness or execution evidence.

Nova18:19:40 confirms the current source path: the write preserves numeric0, but the Job read view maps0 to unknown price/total; quote generation then rejects incompleteness. The quote helper accepts a real numeric0 if it reaches that helper. Candidate display also labels0 as No price. This is a representation/read-contract conflict, **not a failed write or merely a quote-button condition**. No existing saved-Job path preserving legitimate zero through this read was found in the bounded trace. Evidence: `workspace/threads/main/tasks/pricing-controls-audit/intentional-zero-2026-10-14.md`; owner audit `../nova/workspace/threads/main/tasks/jr121-quote-gating/notes.md` when ready.

**Focused outcome for Bhoumik:** an explicitly approved intentional zero must remain zero through the selected requested line’s read, calculation and priced-quote output, while genuinely missing prices remain missing and quote completeness is retained. Existing historical zero sentinels must not become free prices unless qualified under an approved distinction. Bhoumik owns the convention/representation and any coordinated migration/read/write/UI/guidance change; no flag, new model, direct removal of conversion, patch or architecture is chosen here.

Nova’s full audit is complete at HEADdd7193b (source/deployment parity unknown): current UI only copies Text/HTML Quote or Availability to clipboard, not a PDF/send/create/status action. All active lines need finite nonmissing quantity/price; customer fallback, EDD, fulfillment, stage and pending status are not blockers. Unselected2135 is not fallback. Rosie quote-job also rejects saved NULL and render-quote additionally rejects numeric0, so the full intentional-zero outcome includes affected agent quote-helper contracts, not merely the Job read view. **Do not promise JR121 is unblocked from a view-only fix, remove completeness guards or invent customer/delivery prerequisites.** No duplicate audit/query/test or implementation. The separate price-pending Order policy remains staged and unresolved by line-scoped quote approval.

A separate source UI defect can misleadingly retain typed$0 after a successful save/refetch still readsNULL: shared EditableText clears pending only when its value prop changes. `job-line-price-save-truth` contains the bounded corrective display slice for Nova/parent routing; it does not make numeric0 valid, change persisted/read prices, or resolve this B-owned contract. More detailed missing-line warnings are a separate inferred proposal, not automatically build-authorized.

## What it should do

Use a clear, consistent contract for unknown, actual zero and positive prices, separately identifying a missing-search-result marker where one is deliberately retained. Readers, write paths and totals must preserve those meanings rather than turn empty into free or represent a zero sentinel as a supplier’s offer.

Choose the permissible unpriced-work stages: exploratory candidates and selection, customer priced quotes, explicit Order creation and later fulfillment steps need not have identical prerequisites. If price-pending Orders are allowed, retain that unresolved condition honestly. If they are prohibited at a specific action, enforce only the approved boundary with a useful explanation. No new gate is assumed here.

## Acceptance criteria for the selected contract

- For the approved JR121 requested Shrub Live Oak1349/qty23 quote, intentional unit price$0 survives selected-line read/calculation as numeric0 and appears as$0/$0 line total in priced quote output, subject to existing other-line completeness/approval gates. Affected app clipboard and Rosie priced-quote helpers honor the same approved distinction; fixing only the read view is not end-to-end completion. No alternate2135/$495 substitution is introduced.
- Genuinely missing prices still block an incomplete priced quote; no missing→0 coercion or quote-completeness bypass makes the intentional-zero case appear fixed.
- Historical0 not-found sentinels remain unknown unless qualified by the approved distinction; no blanket conversion of old zero values to free prices or unrelated prices/history rewrite.
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

- **Bhoumik, intentional-zero quote slice:** Telegram379 approves the scoped business outcome explained in378: intentional0 survives end-to-end quoting distinctly from unknown and historical not-found0, which is not free. Choose the safe implementation contract, including affected agent helpers; no representation/flag/migration is preselected and no DB/model/money implementation has been assigned to Nova. The approval does not settle the separate Order policy or all unknown-price conventions.
- **Bhoumik, separate standing Order/convention slice:** which unknown-price convention should owners use consistently, and are price-pending Orders allowed—if so, when does price become mandatory? No universal candidate gate or Order gate is inferred.
- **Rosie:** align agent-owned instructions with the chosen contract; do not change existing source/API/price conventions globally from the new-JR102 case alone.
- No Nova semantics build has been assigned. Standing Order/convention slice notified via parent365 remains separate/pending. Intentional-zero outcome notified374 is now approved by379; implementation/agent-helper contract remains B-owned. Parent already successfully handed Nova main bounded preflight/tests/browser/QA/release authorization for the separate prepared UI correction, subject to safety/resource/auth/independent quality/exact-baseline gates. This is not model/migration/global0conversion or other-pipeline approval; UI alone does not enable$0. No duplicate question/task route/code/test by Lily.

## Assumptions and limits

Source capability does not prove deployed behavior, justify creation of an unpriced Order, or decide the commercial rule. Unknown is not free; an actual zero AR answer does not automatically qualify as an Order price under the existing positive-price constraint. Existing current case approval is narrower than general convention reform.

## Scoped approval clarified

2026-10-14 21:57:28 CDT — Telegram379 at21:57:08 says exactly **“Both”**, replying parent378: (1) intentional0 end-to-end versus unknown/historical not-found0; (2) bounded verification/release of prepared UI price-display correction including tests/browser/deploy. This resolves375 “Approved.” and377 “Please elaborate” via the same clarification376/378. **Intentional-zero business outcome approved; implementation contract stays B-owned.** UI may proceed through approved safe preflight/technical+independent responsive QA/release gates, not bypass safety/resources/auth/exact-baseline checks. Parent Nova-main handoff succeeded; no new task route or question needed. Warning-detail enhancement remains proposal-only. Tests/deployment/shipment are not yet claimed; Nova owns execution/evidence. Raw feedback: telegram:main:375,377,379.

## Handoff log

- 2026-10-05 19:03:44 CDT — Captured conflict and awaited Nova’s already-owned trace without duplication.
- 2026-10-05 19:07:03 CDT — Reused completed owner source report; staged this single focused unknown-price/Order-readiness decision for Bhoumik. No code, SOP, schema, data, tests or build routing by Lily; parent handoff ready for one notification.
- 2026-10-05 19:09:21 CDT — Parent confirms successful Telegram365 to Bhoumik. Decision pending; notification is not a new gate, repricing or builder authorization. JR102 unchanged; dirty-source capability remains distinct from observed unpriced Orders.
- 2026-10-14 18:19:21 CDT — Captured line-scoped JR121 intentional$0 quote outcome; watched Nova’s already-owned current trace without duplication.
- 2026-10-14 18:19:51 CDT — Added focused intentional-zero quote outcome after Nova’s current source finding; no representation choice or implementation authorization.
- 2026-10-14 18:21:28 CDT — Full owner audit complete; affected Rosie renderer also rejects numeric0. Expanded end-to-end acceptance, no new quote/send/PDF feature or completeness bypass. Split bounded false-saved UI display correction into job-line-price-save-truth; warning-detail enhancement proposal only. No live/runtime/unblocked claim.
- 2026-10-14 18:23:57 CDT — Parent confirms actual Telegram374 notifying Bhoumik intentional-zero/agent-helper decision, still unapproved. Authorized UI-only correction delivered successfully to Nova main with existing price guards/semantics intact; no zero-policy implementation route.
- 2026-10-14 21:56:04 CDT — Captured exact unscoped Approved from375 without assuming scope;377 requested elaboration, parent378 explained.
- 2026-10-14 21:57:28 CDT — Captured379 exact Both replying378. Intentional-zero outcome approved, B-owned implementation pending; prepared UI authorized for bounded checks/QA/release via successful parent Nova-main handoff. Separate Order policy and other backlog not approved; no implementation or shipment claim.
