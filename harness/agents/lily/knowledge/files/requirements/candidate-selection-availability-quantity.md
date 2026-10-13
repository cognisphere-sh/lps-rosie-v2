# Selecting a candidate must not turn demand into supplier availability

- Status: staged — historical NULL-loss defect; Oct10 owner trace reports0125 NULL-handling change, actual completion/target verification not established here
- Route: bhoumik (database/workflow); Nova source investigation only, no implementation assigned by Lily
- Raised: 2026-09-30 from Rosie JR97 incident via Nova
- Updated: 2026-10-10 07:47:55 CDT

## Dated source reconciliation — 2026-10-10 07:47:55 CDT

Nova's reused JR111 source audit at dirty HEAD2af1653 reports0125 changed NULL availability handling; latest helper is0126, not this file's historical0123 baseline. No current NULL-loss defect or deployed fix is newly asserted here, and no builder-confirmed closure is supplied. Separate `job-fulfilment-coverage-classification.md` owns the newly identified candidate-ask-first coverage hazard; it does not reopen/reset unknown quantity or demand precedence in this earlier slice. Evidence `../nova/workspace/threads/main/tasks/jr111-stemodia-demand-audit/notes.md`. No duplicate audit/authorization ask/data repair.

## Problem — historical September30 defect

Selecting an unanswered priced candidate can fill the Job's availability quantity with the customer's demand even though the supplier quantity is unknown. Pending status does not make that manufactured number safe: demand and actual supply are different facts. This quantity-integrity defect is independent of original-request conformity or status-model decisions.

## Evidence

- Feedback `nova:main:2026-09-30T17:37:49-05:00:jr97-selection-demand-stock`: Rosie JR97 owner report says candidates had NULL availability/status and no AR; selected Job availability became3/10/7/5/1. These are demanded amounts, not confirmed stock. Line→candidate→reported line quantity:1097→1099→3,1108→1110→10,1109→1111→7,1110→1112→5,1111→1113→1.
- `nova:main:2026-09-30T17:42:11-05:00:jr97-quantity-trace`: Nova's bounded source audit at HEAD `af7f7454c48e854c68f7cb7f37d9dd754994e406` identifies latest0123 helper line213: PostgreSQL LEAST ignores NULL operands, so unknown candidate quantity and known demand yield demand. Status NULL already becomes Pending. Shared app/agent selection and selected-answer/offer reapplication use this helper; no JS fallback in the inspected selection path.
- Audit: `../nova/workspace/threads/main/tasks/audit-select-candidate-quantity-jr97/notes.md`; migration `../daisy/migrations/0123_substitute_rows_on_save.sql:208–223`, SHA256 `a07c7a9625650226e2ace039aeea96b3c1aef36f6994493bca7317b2fd04fee8` (Lily-relative paths). Owner report/source prediction, not independent live deployed-function verification or repair. No tests were run.
- Parent17:42:32 reports Nova already requested narrow function correction/regression authorization from Bhoumik. No further assignment/notification needed from Lily.

## What it should do

Selection alone must not manufacture supplier availability. If the candidate's supply quantity is unknown, the Job quantity remains unknown rather than becoming demand or zero. Genuinely known zero and positive quantities remain distinct; existing approved quantity capping/demand precedence applies to known values. Keep selected candidate facts, demand, price, status and actual fulfilment meaning intact.

## Acceptance criteria

- Selecting an unanswered priced or unpriced original or alternate with known Job demand leaves availability unknown and status Pending; selecting it does not imply stock confirmation.
- Candidate demand present/absent and unknown Job demand do not turn unknown supply into a number. Switching from a known-supply selection to unknown supply, repeating selection and reloading retain unknown supply.
- A candidate with an answered status but unknown quantity also retains unknown quantity through relevant authorized selected-line reapplication. No-AR alone is not the gate: separately supported standalone stock facts remain valid.
- Known zero stays zero; known positive quantities below/equal/above demand retain the existing cap behavior. Known supply with unknown demand is not discarded. Demand precedence/cap policy is not redesigned in this slice.
- Candidate rows/status, selected identity, copied price/size/customer note, internal requirements, and current original/alternate status mapping are unchanged except the incorrect copied unknown quantity. Existing membership/active/terminal/order guards remain intact. No AR/order/customer-send/stage side effects.
- Bhoumik authorizes the narrow correction and relevant regression verification; deployed function identity and owner-verified outcomes are established before a shipped claim. Source evidence alone is insufficient.

## Out of scope

- Original-request baseline/normalization or global status model; see `job-line-request-conformity.md` for dated reconciliation.
- The supplier-picked/typed substitute workflow's offer-quantity fallback in0123 apply_candidate_offer. That is a separate authorized answer/default policy and is not JR97's no-AR/unanswered cause.
- Blanket NULL/zero reset, data backfill/repair, RPC replay, status corrections, selection bans, customer publication or new schema columns.
- Lily implementation or new Nova build assignment. No duplicate Bhoumik question/queue entry.

## Open questions

- Bhoumik authorization for the already-proposed bounded correction/regressions; Nova's parent has already asked.
- Actual deployed-function identity and owner-authorized verification. No independent live confirmation yet; no repair of historical JR97 rows inferred.

## Handoff log

- 2026-09-30 17:38:11 CDT — Incident captured as watching pending Nova's existing trace; no duplicate investigation.
- 2026-09-30 17:42:32 CDT — Distinct quantity-integrity slice recorded after exact source finding; staged under Bhoumik's already-requested authorization. No new external send, code, DB, test or operational action. Current status contract explicitly preserved.
