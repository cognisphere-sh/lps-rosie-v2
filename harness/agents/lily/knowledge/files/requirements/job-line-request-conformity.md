# Keep supplier-confirmed alternates visibly Diff Sz/Qnty/Sub

- Status: staged — Bhoumik notified via parent Telegram360; current JR90 case owner-corrected; durable behavior open
- Route: bhoumik (database/status/workflow; not Nova implementation)
- Raised: 2026-09-29 by Chris via Rosie JR-90
- Updated: 2026-09-29 12:10:03 CDT

## Problem

Supplier stock confirmation does not establish that an offer matches the original requested plant, size and quantity. Chris's latest correction requires an alternate **candidate itself**, as well as the Job line, to show Diff Sz/Qnty/Sub rather than Available. Existing selection directly copies candidate status and does not compare to original demand; an unasked candidate's display can also hide an explicit answer behind Pending. Today's manual corrections unblock JR90 but do not prove durable prevention.

## Evidence — latest direction wins

- **Current authority:** `web:jr-90:19`, 2026-09-29 12:03:34 CDT, exact Chris wording relayed by Rosie12:05:20: “They should be marked as Diff Sz/Qnty/Sub as they are not the original request.” Rosie explicitly retracts the earlier interpretation that a confirmed alternate candidate stays Available while only its Job line is Diff. Exact original confirmed as asked remains Available.
- Rosie reports candidates709 (45G vs30G Pride of Houston),725 (15G Nolina nelsonii vs7G Nolina lindheimeriana),724 (5G vs3G crossvine) corrected to diff_size_qty_sub, retaining confirmed quantities; asked candidate713 (3G vs5G prickly pear) corrected via AR51 RPC/re-submit. Refreshed selected Job lines918/922/942/923 all alternative_proposed. Nolina had been selected in the app just before19; Rosie preserved that selection. Owner-reported case result, not independent Lily runtime verification or permanent-fix evidence.
- **Superseded interpretation, evidence retained:** `web:jr-90:14`11:53:59 said to reuse previously confirmed APS15G Nolina/45G yaupon information and mark candidates available;15 at11:56:03 said selected plant/size differences require Job Diff Size/Qty;16 at11:57:23 said “Similarly for Nolina and other row. Remember this.” At that point Nolina was unselected, and Rosie corrected original line922 to difference without selecting it or changing original7G. Message19 resolves the candidate-status interpretation; do not implement the earlier candidate-Available/Job-Diff split.
- Rosie11:59:20 identifies AR51 submitted11:42:43/re-submitted11:50:15 evidence: original Nolina candidate687 note `15g nelsonii`, original30G Pride of Houston candidate683 note `45g instock`. Stock evidence comes from submitted supplier facts and Chris's instruction, not merely price, note field/authorship or an unsent draft. Fragment wording alone does not independently establish every quantity; confirmed quantities are owner-reported.
- Rosie12:05:20 reports job-requests skill7.5.0 removed her earlier interpretation. Current guidance correction is owner-complete; Lily does not duplicate it.
- Bounded local source audit: HEAD `53db98bb1f8641b46bc70025efd4fdbba6f2caa2` with dirty app/docs; no original-request comparison in selection/submission paths. Actual paths/hashes/limits in `workspace/threads/main/tasks/line-status-candidate-availability/source-check-2026-09-29.md` (Lily-relative). No live DB/tests/deployment verification.

## What it should do

For a supplier-confirmed offer that differs from the ORIGINAL requested plant, size or fulfilment quantity, show **Diff Sz/Qnty/Sub on the candidate and the Job line**, while retaining supplier confirmation, quantities and evidence. A confirmed exact request remains Available. Stock confirmation and request conformity are distinct facts even though Chris wants the existing candidate status to reflect the difference; this does not require a new status model.

Use reliable original-request evidence, not values already copied from a selected offer. Meaningfully equivalent formatting must not create false differences. Preserve unknowns and contradictory facts. The earlier confirmed-unselected Nolina outcome remains in scope: difference can be surfaced without selecting or rewriting the original request. Its later app selection is a separate user action, not authority for automatic selection. No global ANY-alternate-wins rule is approved for mixed offers.

## Acceptance criteria

- Confirmed45G Pride of Houston versus original30G shows candidate Diff Sz/Qnty/Sub and Job Diff Sz/Qnty/Sub, retaining confirmed stock quantity. Corresponding3G/5G prickly-pear and5G/3G crossvine cases behave consistently.
- Confirmed Nolina nelsonii15G versus original Nolina lindheimeriana7G×3 is a plant-and-size difference at both levels. Selected and unselected scenarios are supported: recording confirmation/difference alone does not create/change selection or rewrite original plant/size/demand. Preserve the actual user-selected state in current JR90.
- Confirmed exact original request stays Available. Plant-only, size-only and actual fulfilment-quantity-only differences are covered, including confirmed shortfall. Equivalent supported formatting such as `15G`/`15 G` does not create a false alternate. Species/cultivar/form or purchasing-unit equivalence is not guessed from superficial text similarity.
- Missing quantity is not zero or complete coverage; ambiguous plant/size is not invented as exact or different. Excess supplier stock is distinguished from the quantity actually offered/selected to fulfil the request; no surplus-equals-difference rule.
- Correct candidate and saved Job statuses persist through drag/drop, agent selection, switching/reselection, reload and relevant submitted-answer reapplication. Authorized submitted-fact handling also supports the unselected case. No UI-only mask or repeated manual repair is an acceptable permanent result.
- A candidate with an explicit supported difference/availability answer does not display Pending solely because it lacks its own AR association. No-AR stock confirmation from a submitted response is preserved; an unconfirmed, price-only or draft candidate does not become confirmed by this display correction.
- Before completion, Bhoumik resolves and verifies bounded mixed cases: pending/unavailable/can-order/arriving-soon with mismatch, multiple exact and alternate offers, and absent/ambiguous original evidence. Preserve negative/unknown facts without inventing precedence. The clear confirmed-alternate cases must not wait on an unrelated global model redesign.
- Original-request evidence remains reliable across selection/reapplication. Existing membership, active/terminal, supplier-answer and order approval/allocation guards remain. This fix causes no automatic customer approval, external send, order creation or parent-stage transition.

## Out of scope

- The **superseded** design “alternate candidate Available, Job line Diff.” Stock remains confirmed, but candidate status follows Chris19's difference instruction.
- New global status vocabulary/model, automatic selection or sends, customer publication/note routing, order rules or Job-stage changes.
- Lily data/status edits, backfill, live DB/test audit, app/code changes or another agent's SOP edits.
- Standalone Nova implementation. Display consistency depends on this Bhoumik-owned status contract; a future approved presentation-only slice can be split by the owner.

## Assumptions and related work

- Diff Size/Qty and latest Diff Sz/Qnty/Sub refer to the existing difference meaning; current local helper uses the latter. Historical September label requests are not used as today's baseline.
- Existing `availability-status-model-parity` concerns broad vocabulary/domain mapping, not original-versus-offered comparison. This focused requirement crosslinks that history without reopening it. Supplier response/change-management and note/customer-routing scopes remain separate.
- JR90 is operationally unblocked per Rosie. Prevention remains open; no need to ask Chris again or repeat the case fix.

## Open questions — Bhoumik, using existing owner evidence

- What reliable original plant/size/demand evidence governs comparison after selection replaced displayed size or original-marked candidates were edited? Current flags can be multiple and are not immutable; do not fabricate historical demand. No storage architecture prescribed here.
- What bounded normalization and mixed-status/multiple-offer precedence preserves the confirmed selected/unselected outcomes without hiding negative/unknown facts? Current direct status copying does not settle this.
- What is the actual deployed/migration baseline, and does the implementation pass the relevant durable-path checks? Local source and owner reports are not release evidence.

## Handoff log

- 2026-09-29 12:03:37 CDT — Initial candidate-Available interpretation drafted but **not routed**. Exact web14–16 captured; bounded source check completed without data/code/SOP changes.
- 2026-09-29 12:05:20 CDT — Rosie relayed later explicit Chris19; requirement revised before handoff to candidate-Diff AND Job-Diff, initial design expressly superseded. Parent main warned not to send older interpretation. Staged for Bhoumik; no external notification/builder route by task. Owner reports case repair and skill7.5.0 complete, durable behavior open.
- 2026-09-29 12:10:03 CDT — Parent reports Telegram360 successfully notified Bhoumik: latest Chris19 alternate-Diff despite confirmed stock, exact confirmed original Available; four current lines corrected; durable candidate/Job/dragdrop/unselected consistency without losing original demand or automatic selection. Nova received requirement/evidence FYI only, explicitly no code/UI/DB assignment. Status remains staged, not builder-accepted, fixed or deployed. No additional human question.
