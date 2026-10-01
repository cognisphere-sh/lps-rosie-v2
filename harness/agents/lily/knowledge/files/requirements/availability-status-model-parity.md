# Give Job Requests, Requests and Orders honest plant-status models

- Status: staged — partial implementation; Request vocabulary/UI mapping still blocked
- Route: bhoumik
- Priority: 1 — Bhoumik weekly priority (2026-09-01)
- Raised: 2026-08-30 by Chris (via nova handoff)
- Updated: 2026-09-11

## Related focused requirement — 2026-09-29 12:05:20 CDT

`job-line-request-conformity.md` records original-request conformity separately from stock confirmation, with September30 17:42:32 reconciliation: newer Bhoumik0123 contract supersedes Sep29 candidate-Diff-both-levels; offered candidates Available/Partial Qty and selected alternate Job Diff. Source partial coverage is not shipped or blanket unselected/original/display closure. Separate `candidate-selection-availability-quantity.md` tracks JR97 unknown-quantity loss under B authorization already requested by Nova. This older file's September11 audit is historical, not current candidate/status/label baseline; neither case authorizes global vocabulary rework.

## Problem

Chris has defined authoritative plant-status vocabulary, but Chris reports that actual statuses are still not updated on plants or Requests/Jobs. The existing Portal records a supplier's answer with five older labels and an unanswered Set status; LPS Ops records four internal job-line states. The new Request and Order sets deliberately differ where the business action differs. A cosmetic color, label or status patch would cause a supplier answer, an LPS sourcing state and an order-buying action to appear interchangeable rather than fixing the model.

## Evidence

- 2026-09-01 feedback log, **Authoritative sales and plant statuses**: Chris supplied the authoritative Sales, Plant Status Request and Plant Status Orders sets.
- 2026-09-09 feedback log, **Statuses still not updated**: Chris says actual plant and Request/Job statuses still have not been updated, confirming priority 1 remains a blocking structural item rather than a completed visual refinement.
- Current app audit: Portal answers use **Available**, **Can order**, **Diff Size/Qty/Sub**, **Arriving soon**, **Unavailable**, with **Set status** unanswered; LPS Ops job lines use Pending, Available, Substituted and Unavailable.
- 2026-08-30 feedback log, **Portal availability statuses**: the prior Portal set was explicitly called correct. Chris’s later authoritative sets supersede that vocabulary where they conflict.

## What it should do

Use three separate, explicitly named status domains:

- **Plant Status Request** (a supplier response to an availability request), in this exact order and spelling: **Available**, **Unavailable**, **Diff Sz/Qnty/Sub**, **Can Order**, **Arriving Soon**, **Pending**.
- **Plant Status Orders** (the purchasing/fulfilment reading of a plant on an Order), in this exact order and spelling: **Available**, **Unavailable**, **Different Sz/Qnty/Sub**, **Need to Order**, **Arriving Soon**, **Pending**.
- The Sales status of the parent Job Request is defined separately in `lps-ops-job-request-statuses`; it must not be presented as a plant status.

Define which actor/action may set each value, what the effective current value is, and how a Request response is carried into an Order without silently changing its meaning. Preserve historical answers and internal job-line records, map legacy values safely, and make any unresolved legacy value visible rather than guessing. Only after this contract is approved may Nova map the exact labels, options, filters, summaries, colors and actions to each surface. Do not ship a cosmetic color/status patch as a substitute for the durable model and migration.

## Implementation audit — 2026-09-11

**Implemented and verified:**

- Sales stored values, UI labels and active/terminal treatment use **Active, Quote, Availability, Confirmed, Won, Lost**. Current schema/docs retain legacy archived records and describe workflow transitions; the app’s status test suite passes.
- Job plant statuses use the authoritative Order wording and order: **Available, Unavailable, Different Sz/Qnty/Sub, Need to Order, Arriving Soon, Pending**. The schema retains distinct job stored values, and Pending persists as a saved job-line state.
- Availability-request answers retain a separate stored domain (`diff_size_qty_sub`, `can_order`, NULL for Pending); NULL Pending preserves quantity, price and notes and does not count as answered. Current migrations/tests preserve legacy stored job values and legacy filter-label readability.

**Not implemented / blocking shipment:**

- Availability-request/Portal surfaces display the **Order** wording **Different Sz/Qnty/Sub** and **Need to Order**, not Chris’s authoritative Request wording **Diff Sz/Qnty/Sub** and **Can Order**. The current tests and app documentation explicitly assert that both pickers use the Order labels.
- Consequently, the visible Request and Order semantic split is not delivered. Existing separate stored values are insufficient while the Request UI, filters, summaries, print/detail surfaces and accessible labels flatten them into the Order vocabulary.

The requirement is therefore **partial, not shipped**. Bhoumik’s structural work provides much of the model/migration foundation; the remaining contract/UI mapping must make the Request wording exact without changing or misrepresenting its saved values.

## Acceptance criteria

- A user can tell whether a visible plant status is a Request supplier response or an Order purchasing/fulfilment state.
- Request surfaces show only the six authoritative Plant Status Request labels in their stated order; Order surfaces show only the six authoritative Plant Status Orders labels in their stated order.
- **Diff Sz/Qnty/Sub** and **Can Order** never appear as Order labels; **Different Sz/Qnty/Sub** and **Need to Order** never appear as Request labels.
- Existing Portal answers, Job Request line states, quantities, prices, notes and history remain readable after migration, with an explicit safe mapping or preserved legacy presentation.
- Pending has an explicit saved/unsaved and actor meaning; it is not merely a visual replacement for the Portal’s former **Set status** without a migration decision.
- Filters, bulk actions, summaries and status controls save only the value and action their label promises.
- Nova receives an approved UI mapping contract before any screen is made to look status-parallel.
- No plant, Request or Job surface is marked complete by a color-only, label-only or presentation-only status patch; its displayed value must be backed by the approved domain, transition and migration contract.

## Out of scope

- The dark styling of the Portal selector, except that it must consume the approved Request vocabulary.
- Changing customer/job-request Sales lifecycle stages.
- Automatic supplier onboarding or order placement.

## Assumptions

- The difference between Request and Order labels is intentional business meaning, not inconsistent copy.
- Chris’s 2026-09-01 sets supersede the earlier Portal canonical set, including its capitalization, abbreviations and unanswered-state treatment.

## Open questions

- **Bhoumik:** Define the durable Request and Order status values, permitted transitions/actors, effective-value relationship and migration of Portal **Set status**, **Can order**, **Diff Size/Qty/Sub**, **Arriving soon** and current LPS Ops Pending/Available/Substituted/Unavailable records.
- **Bhoumik:** Confirm whether Pending is a supplier-visible Request response, an internal unworked state, or has different permitted actors in Request and Order contexts.
- **Bhoumik:** Define how Request **Can Order** carries into an Order without being mislabeled as Order **Need to Order**, and how each substitution label preserves the underlying size/quantity/substitute detail.

## Handoff log

- 2026-08-30 — staged for Bhoumik: status/workflow and stored-value decision required before LPS Ops parity changes.
- 2026-09-01 — Bhoumik named this weekly priority 1: align Job Request and availability-request status meaning only through an honest model decision.
- 2026-09-01 — Chris supplied authoritative separate Request and Order plant-status sets. Requirement revised; structural model/migration remains staged for Bhoumik, and Nova UI mapping waits for that contract.
- 2026-09-09 — Chris reports actual statuses on plants and Requests/Jobs are still not updated. Re-surfaced as priority-1 blocker: no cosmetic color/status patch is acceptable before Bhoumik’s structural model/migration contract.
- 2026-09-11 — Bhoumik reported priority item 1 “Done.” Audit of current app/docs/schema and passing app test suite finds partial coverage: Sales and Job/Order plant vocabulary/migration are implemented, and request answers retain distinct stored values/Pending behavior; however Request surfaces visibly use Order labels (**Different Sz/Qnty/Sub**, **Need to Order**) instead of Chris’s exact Request labels (**Diff Sz/Qnty/Sub**, **Can Order**). Remains staged/partial and blocks a truthful shipped status.
- 2026-09-11 — Re-audited after Bhoumik said “check now.” The current app source remains at the status refactor commit (`32f7f8f`; newer `394717a` does not change app status code). `AR_RESPONSE_META`, schema documentation and current tests still assert/order **Different Sz/Qnty/Sub** and **Need to Order** for availability requests; repository search finds no visible **Diff Sz/Qnty/Sub** or **Can Order** mapping. No change to the blocking gap.
- 2026-09-11 — Re-audited again after Bhoumik said “check now.” There are uncommitted app/status edits. Request/Portal now shows **Diff Sz/Qnty/Sub** (corrected) but still shows **Need to Order** rather than **Can Order**. Job/Order source was also changed to **Diff Sz/Qnty/Sub**, which is wrong for its required **Different Sz/Qnty/Sub** label; it retains **Need to Order**. Thus both surfaces still share mixed wording rather than the exact distinct Request/Order sets. Targeted status/selector tests pass, but they assert the same incorrect mixed labels. The changes are uncommitted, so deployment is not verified.
