# Keep supplier confirmation distinct from original-request conformity

- Status: staged — partial source coverage under newer Bhoumik Sep30 contract; remaining historical outcomes need owner disposition/verification, not blanket closure
- Route: bhoumik (database/status/workflow); no Nova implementation assignment by Lily
- Raised: 2026-09-29 by Chris via Rosie JR90
- Updated: 2026-09-30 17:42:32 CDT

## Current contract — supersedes September29 candidate-status interpretation

Nova's September30 source/owner report identifies Bhoumik's newer0123 contract: asked unavailable-with-substitute candidate retains Unavailable; offered substitute candidate becomes Available (Partial Qty if short), while an answered selected nonoriginal candidate produces Job Diff. A selected original with an offered substitute also produces Job Diff. Unknown status remains Pending; plain unavailable without an offer remains Unavailable. **Do not reapply September29's candidate-Diff-at-both-levels requirement against this newer contract.** Preserve stock facts, request conformity, selection, customer acceptance and Order/Job stages as distinct.

This is current source coverage plus attributed owner authority, not Lily certification of deployed functions/runtime. Nova's audit reports migration NOTE owner claims0123/0124 applied; no independent live identity/regressions. Current Rosie supplier-responses guidance matches the newer contract; no SOP correction by Lily.

## Problem and evidence

- Original concern: selecting a supplier-confirmed different plant/size/fulfilment quantity could hide original-request differences. Today's quantity integrity defect is separately recorded in `candidate-selection-availability-quantity.md`, not bundled here.
- Historical Chris JR90/web14(11:53:59),15(11:56:03),16(11:57:23) September29 required reusing submitted APS facts and showing Job differences. Web19 at12:03:34: “They should be marked as Diff Sz/Qnty/Sub as they are not the original request.” This led to Rosie7.5.0/case candidate-Diff corrections and Lily's both-levels requirement. Those are dated historical instructions/interpretations, superseded for current candidate mapping by Bhoumik's Sep30 contract; append-only raw feedback remains intact.
- September29 Rosie reports original Nolina lindheimeriana7G×3 unselected, offered15G nelsonii supported by submitted AR51 note; original line922 was marked difference without selection/request rewrite. Nolina was subsequently selected in-app before19. Other case alternates:45G vs30G Pride of Houston,3G vs5G prickly pear,5G vs3G crossvine. Her case repairs were owner-reported, not Lily verified or permanent-fix proof.
- Historical source baseline53db98b/catalogue≤0120: `workspace/threads/main/tasks/line-status-candidate-availability/source-check-2026-09-29.md`. Its direct-status mapping and candidate-display findings are **not current-source claims**.
- September30 source baseline `af7f7454c48e854c68f7cb7f37d9dd754994e406`: Nova report `../nova/workspace/threads/main/tasks/audit-select-candidate-quantity-jr97/notes.md`. Lily read only relevant0123 status/offer sections and Rosie supplier-responses/docs to reconcile this requirement, not a second quantity audit. Relevant paths: `../daisy/migrations/0123_substitute_rows_on_save.sql:1–47,167–223`; `../rosie/skills/agent/job-requests/artifacts/supplier-responses.md:1–54`; `../../../docs/supabase-schema.md:331–337`.

## Coverage and remaining limits

**Addressed in current source, runtime unverified:**
-0123 selected-line helper computes Pending for unknown status, Unavailable for plain unavailable without offer, Diff for answered nonoriginal / original with offer / legacy difference; original Available/Partial Qty/Can Order/Arriving Soon retain their domain mapping. Offered candidate Available while Job Diff is now intentional, not a defect.
- Shared selection helper and selected-line submission/offer-link reapplication use this status logic. It does not automatically choose an offer, create a customer acceptance or new Order merely from selection.
- Supplier offer application is now save-time (not the September29-only-submitted interpretation); separate Rosie alert/customer communication permissions remain. Do not restore old save/submit/status rules as an incidental quantity fix.

**Not established by this bounded evidence:**
- Original-versus-alternate identity classification relies on `is_original`/offer links, not semantic normalization of plant/size/demand. The historical concern about ambiguous/multiple original evidence, equivalent formatting and preserving original demand after size copy is not automatically closed by the flag-based rule. It is also not authority to commission a new immutable-baseline architecture or override the current classification.
- The earlier **unselected** Nolina Job-Diff outcome: current inspected functions reapply selected lines, while current Rosie guidance surfaces unselected answers in an alert for Chris to drag. Whether the prior unselected Job-status expectation remains a needed outcome or is superseded by the newer contract requires existing owner disposition; do not invent ANY-alternate-wins aggregation or ask Chris to repeat his case.
- Current no-AR explicit answer display, drag/drop/reload/reselection/rendered status consistency and historical case regressions have not been verified by this reconciliation. September29's Pending-mask finding is historical until current owner source/runtime evidence establishes remaining scope.

## Outcomes to retain under the approved current contract

- A confirmed actual alternate remains recognizable as such on its selected Job line without erasing its candidate stock confirmation/quantity. Exact confirmed original remains Available; Pending/Unavailable are not promoted to confirmed supply by selection.
- Plant/size/actual fulfilment quantity meaning, harmless format equivalence, unknowns and original evidence must remain honest; no blind surplus-equals-difference or fabricated baseline/stock.
- Approved status semantics persist across agent/app selection and relevant reapplication; no UI-only mask or manual repair loop. Existing membership/active/terminal/order guards remain.
- No automatic selection, original-request rewrite, customer approval/publication, sends, order creation or parent-stage changes.

## Out of scope

- Restoring the superseded September29 candidate-Diff rule; new global status/vocabulary or offer-default policy.
- The separate unknown-quantity LEAST defect or supplier-offer quantity defaults; quantity defect has its own narrow already-asked Bhoumik slice.
- Lily data/code/SOP/backfill/live DB/test action, or Nova implementation assignment. No duplicate queue/human question.

## Open items — owner disposition, not new implementation authority

- Existing Bhoumik/Rosie authority/coverage for unselected-case presentation, original identity/equivalent formatting and current explicit-answer display. Reuse existing decision/evidence; no new human interview or speculative redesign.
- Owner-verified deployed baseline/regressions before marking implemented behavior shipped. Do not infer all historical acceptance met from source migration presence.

## Handoff log

- 2026-09-29 12:03:37 CDT — Initial candidate-Available/Job-Diff interpretation drafted, not routed.
- 2026-09-29 12:05:20 CDT — Chris19 relayed; updated to candidate-Diff and Job-Diff before handoff. Rosie reported case/skill7.5.0 corrections, durable behavior still open.
- 2026-09-29 12:10:03 CDT — Parent Telegram360 successfully notified Bhoumik with that dated scope. Nova FYI evidence only, no code/UI/DB assignment; staged, not builder-accepted/fixed/deployed.
- 2026-09-30 17:42:32 CDT — Nova/current0123 evidence supersedes historical both-levels expectation. Reconciled to Bhoumik Sep30 offer-Available/selected-Job-Diff contract; source partial coverage recorded, unselected/original-evidence/display/runtime outcomes not blanket closed. No status reversion or new implementation route. Separate quantity-integrity request already asked by Nova is tracked independently.
