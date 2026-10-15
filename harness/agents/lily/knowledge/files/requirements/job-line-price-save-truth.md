# Show the settled saved Job-line price truthfully

- Status: routed · QA/release authority clear797+379; BLOCKED current operator suite/source overlap awaiting compatible committed baseline, not integrated/shipped
- Route: nova (UI only)
- Raised: 2026-10-14 18:21:28 CDT
- Updated: 2026-10-14 21:59:35 CDT

## Problem and evidence

Chris’s JR121 complaint says an entered0 is not registering for quoting (compressed teammate relay, not verified verbatim). Nova’s completed source audit identifies a separate UI defect: Job-line unit-price editing can keep showing optimistic$0 after a save/refetch returns the same authoritative unknown value as before. The quote reader still sees unknown, so the apparent settled price and quote eligibility disagree.

Source evidence, not incident browser/runtime proof: `../nova/workspace/threads/main/tasks/jr121-quote-gating/notes.md`, HEADdd7193b, no deployed parity established. `EditableText:132` clears pending only when value changes; `:150–163` stores optimistic text and invokes save/refetch; `:225` renders pending over value. Typed0 succeeds in writing candidate0, but current Job view reads it asNULL, unchanged from priorNULL, so pending can remain. Lily read the owner report, did not duplicate code/DB/UI audit/tests or change anything.

This does **not** mean writes failed or that UI can decide intentional0 versus unknown. That distinct representation/read/helper contract is `unknown-price-and-order-readiness`, Bhoumik-owned/staged. A truthful display correction can work against the existing contract without resolving it.

## Intended outcome — corrective slice ready

After a completed Job-line unit-price save and authoritative refresh, display the authoritative value even if it is identical to the pre-edit value. Do not leave an optimistic value looking settled/saved when it is absent from the refreshed Job. Pending, unsaved/error draft and settled value must not be confused.

## Acceptance criteria

- For priorNULL→typed0→successful save→refetchedNULL, the settled unit-price cell reflects unknown, not a lingering apparent saved$0. This correction must not relabel unknown as free or make the quote guard accept it.
- A genuine nonmissing refreshed value appears accurately, including unchanged values. An optimistic local string is not independently proof of authoritative saved price.
- During pending save/refresh, existing edits remain usable. On save or refresh failure, preserve the user’s input for retry as an explicit draft/error rather than falsely claiming it is saved, silently discarding it, coercing it, or inventing a new persisted value. An unresolved refresh must not masquerade as confirmed saved state.
- Only the intended current row/edit is reconciled; a late save/refetch must not overwrite a newer edit or another row’s price/selection. Preserve existing save/cancel/error mechanics and permission behavior.
- Preserve all existing persisted pricing, candidate identity/selection, alternative species/qty, calculation and quote missing-price guards. Approved requested Shrub Live Oak1349qty23 must not turn into alternate2135SouthernLiveOak495; no automatic price fallback.
- Scope the behavioral correction to Job-line unit-price editing. Shared EditableText consumers must retain their existing behavior if common code is touched; no blanket rewrite of optimistic state/editability or new app-wide validation framework. Nova can choose the smallest local implementation and verify the affected consumer scope without Lily selecting architecture.
- Do not alter existing field visibility/access, private supplier/internal details, all-line scope, clipboard templates/payloads, quote output or send/status behavior. A display fix alone is not an intentional-zero quote fix.

## Inferred enhancement — proposal only, not included in corrective authorization

The current warning says every line needs quantity and unit price but identifies neither missing line nor field. A compact blocker hint naming the already-visible requested line and missing quantity/price would reduce guessing. This is useful inferred behavior, not explicitly requested: parent should obtain/locate approval before adding it, or leave the existing warning unchanged in the corrective slice. Do not expose hidden supplier/internal fields, add quote prerequisites, silently skip blockers or implement this enhancement simply because it appears here.

## Out of scope

- Changing sentinel/NULL/intentional0 policy, persistence/API/read conversion, quote completeness, or Rosie helper price acceptance. No money/status/workflow/DB change.
- Enabling a free quote through display, changing selection/quantity/species, coercing missing to0, or rewriting historical0.
- New PDF, quote generation/send/preview/download, customer delivery, stage transition, quote button gating, or app-wide inline editor redesign.
- Claiming incident browser reproduction, deployed fix, successful quote or tests run.

## Ownership / readiness

**Parent authorized and task successfully delivered Nova main the narrow truthful settled-display correction** under Chris’s standing UI ownership rule. It corrects a source-supported misleading save state directly relevant to his explicit complaint and does not need Bhoumik’s price-model decision first. Routed is not implemented, QA-passed or shipped. Intentional-zero outcome is now approved by379 but still requires the separate B-owned implementation/agent-helper contract; no model/migration/DB implementation assignment to Nova. Warning specificity remains an inferred proposal requiring approval, excluded from this build scope.

Nova’s handoff requires focused technical regression coverage and independently checked rendered mobile/tablet/desktop behavior using authorized existing access/resources/operator baseline. Save success/same-value and changed-value refresh, save/refresh failures, newer drafts/row identity and shared-consumer preservation must be checked. Scoped379 now permits the prepared correction’s bounded preflight/checks/QA/release path, but does not bypass safety, resource, auth, independent-quality or exact-baseline gates; blocked checks remain explicitly blocked/source-only, not shipment proof. No private internal/supplier evidence exposed; no new parallel builder or surprise broad audit/run.

## Current coordination blocker — QA authority is clear

2026-10-14 21:59:35 CDT — Nova21:59:23 confirms Pi direct797 “RunstandardQA” plus scoped379 clears QA authority; **no old796 hold or further approval stage is pending**. New blocker is incompatible current execution/source baseline: an operator full suite is already running (not Nova’s run), with uncommitted pricing/order/query work and overlapping `job-request.tsx` beside the six UI-owned paths. Builder stopped **before tests, commit, preview or deployment**; no killing operator work, stashing, overwriting, adopting changes or rerunning the suite. Nova799 already asks operator completion and a committed baseline; no duplicate request or Lily source/test audit.

Existing preview helper’s worktree+install conflicts with PRIMARY-only rules; builder is only checking a manual primary preview/capture route read-only, not creating a new pipeline. Existing sole builder and independent responsive review can resume safely when baseline is compatible and auth/resources/exact-quality gates satisfied. Source-ready remains unverified; operator suite execution is not this UI’s QA proof. Intentional-zero model/helper implementation remains B-owned and separate.

## Last owner source state and validation limit

2026-10-14 18:35:09 CDT — Nova18:34:57 reports a local `JobLinePrice` correction scoped to the PRICE consumer only, plus focused mocked coverage and docs. Shared EditableText, zero-price policy, RPC/view, quote warning and quote guards remain unchanged. Authoritative reads settle identicalNULL; save/read errors preserve recoverable draft, read retry does not repeat the write, and newer edits/row selections are guarded. These are builder source assertions, **not passed acceptance/runtime QA**.

Six owned paths remain **unstaged/uncommitted**, unrelated operator dirt preserved; no integrated/deployed baseline established. No typecheck, tests, preview, browser/API/DB/runtime checks were run. Independent rendered responsive QA is **UNKNOWN**, not passed. Nova’s earlier Telegram796 hold question is now clarified by379 replying378: bounded checks/browser/QA/release of this prepared correction may proceed, safety/resource/auth/independent-quality/exact-baseline gates intact. Parent successfully delivered that scoped authorization to Nova main; no duplicate question/route needed. Lily has not audited/tested/built the source. Owner report: `../nova/workspace/threads/main/tasks/jr121-quote-gating/notes.md`.

Source-ready does not mean saved-zero quoting works: intentional-zero outcome now approved379 but implementation/agent-helper contract remains separately B-owned; no model or quote warning enhancement is included here.

## Scoped authorization — execution not yet verified

2026-10-14 21:57:28 CDT — Pi379 at21:57:08 says exactly **“Both”**, replying parent378: intentional0 end-to-end versus unknown/historicalsentinels, and bounded validation/release of the prepared price-display UI correction including tests/browser/deploy. Resolves375Approved and377Please elaborate via clarification376/378. Parent successfully handed Nova main permission for safe preflight/tests/browser/QA/release under this narrow scope, **not** DB/model/money implementation, global0 conversion or unrelated pipeline. All safety/resource/auth/independent-quality/exact-baseline gates remain. Warning-detail enhancement excluded. No new question/route required; Nova owns runtime execution/evidence. Approval is not a test pass, integration, deployment or shipment claim; UI alone still does not enable intentional0 quotes.

## Handoff log

- 2026-10-14 18:21:28 CDT — Split corrective UI state reconciliation from B-owned intentional-zero quote contract using Nova’s full existing audit; bounded scope and proposal-only warning enhancement.
- 2026-10-14 18:23:57 CDT — Parent explicitly authorized this UI-only route. Internal CLI delivery to Nova main succeeded with full owner-source baseline, acceptance/preservation scope, technical/rendered QA and auth/resource/operator gates. No new parallel builder, semantics/helper/DB work or warning enhancement authorized. Await actual technical/rendered QA/deployment report; no Lily code/tests/live probes.
- 2026-10-14 18:35:09 CDT — Recorded Nova source-ready-only report; six owned paths unstaged/uncommitted, technical/runtime/rendered checks unrun or unknown. Awaited796 clarification without duplicate ask/action.
- 2026-10-14 21:57:28 CDT — Scoped379 Both replying378 approves bounded check/browser/QA/release path. Parent Nova-main handoff succeeded, gates intact; await actual execution/independent QA/deployment evidence. No new route, Lily tests/code/SOP or shipment claim.
- 2026-10-14 21:59:35 CDT — Recorded QA authority clear797+379 but new operator-suite/uncommitted-overlap blocker. Nova799 completion/committed-baseline request already sent; builder stopped before tests/commit/preview/deploy. No duplicate action or old-hold/new-approval interpretation.
