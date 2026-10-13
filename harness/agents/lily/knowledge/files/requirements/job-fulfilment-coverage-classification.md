# Judge Job coverage against current fulfilment demand, not only the supplier ask

- Status: staged — Bhoumik notified Telegram372 (parent verified receipt); semantics/authorization unresolved
- Route: bhoumik (database/status/workflow); no Nova implementation assignment
- Raised: 2026-10-10 from Nova's source audit of Rosie JR111 report
- Updated: 2026-10-10 07:51:18 CDT

## Problem

A supplier can completely answer a smaller historical ask without covering the customer's current Job demand. Current source can label a selected original Job line Available when its confirmed quantity covers only that smaller ask. Supplier ask coverage and current Job fulfilment coverage must not be silently treated as the same fact.

This is a concrete source-paper classifier hazard, **not proof that JR111's Stemodia quantities are corrupt or that current stock is inadequate**. The incident's18/36/36 history remains unresolved; it may be legitimate ask/selection/offer history.

## Evidence

- Feedback `nova:main:2026-10-10T07:47:36-05:00:job-coverage-ask-first`: Nova source audit at HEAD `2af1653bdb7aee79874ca66c705e63d10ab3ef43`, dirty working tree, identifies latest0126 selected-line helper comparing confirmed quantity to candidate demand first, then Job demand only as fallback. Paper case: selected original ask18, available18, current Job demand36 yields Job quantity18/statusAvailable, not Partial Qty relative to36. No test/runtime execution.
- Reused source report `../nova/workspace/threads/main/tasks/jr111-stemodia-demand-audit/notes.md` (Lily-relative), not a duplicate investigation. Relevant app-home paths: `harness/agents/daisy/migrations/0126_job_line_candidate_sync.sql`, helper lines25–53; current0127 attach/answer/submission and0129 reverse sync. Owner SHA256 for0126: `90302c69a02e2fbb13d3404623e2f4491716e68a1dc4ab1106a77d8b7911a730`. Deployed app/functions/rows not independently verified.
- Separate feedback `nova:main:2026-10-10T07:47:36-05:00:jr111-stemodia-history`: Rosie reports AR77 asked Stemodia candidate1576 demand18, Job1274 and offered1587 demand36, with no owner quantity change reported. Current source preserves non-NULL ask on attach, supplier answer/publish does not rewrite demanded quantity, selected-only reverse sync leaves unselected asks historical. An existing offered36 can carry its own36; a new typed offer under asked18 initially copies18. No automatic halving found. This does not establish which path produced these rows, their historical approved asks or supplier's literal response.
- Candidate `is_original` can be promoted/demoted under0129 and is not immutable intake provenance. `updated_at` is not field history, and no durable candidate changelog appeared in the owner audit. Do not infer writer, cause or correction amount.

## What it should do — proposed outcome for Bhoumik's decision

Judge Job coverage against the applicable **current fulfilment demand** under Bhoumik's approved semantics, while retaining the historical/supplier-specific ask and its answer faithfully. A complete answer to an ask of18 must not by itself assert that a current customer requirement of36 is fully covered. The candidate may truthfully cover its own ask; the Job's coverage reading must reflect what the Job still needs.

Preserve the newer selection/status contract, including original-versus-alternate meaning and supplier confirmation. No proposal to restore September29 candidate-Diff-at-both-levels behavior or to turn every alternate into Partial Qty. Bhoumik must settle how coverage and existing difference/negative/unknown statuses combine before implementation; this slice does not define precedence globally.

## Acceptance criteria

- With applicable current Job fulfilment demand36 and a selected original supplier ask18/confirmed supply18, the Job does not imply complete coverage solely because the supplier answered all18. Bhoumik specifies and verifies the appropriate existing partial-coverage outcome; no new global model is required by this request.
- The historical asked18, confirmed18, current customer36 and their distinct meanings remain intact. No silent ask/demand rewrite to make a comparison pass, and no mutation of candidate stock facts merely to relabel Job coverage.
- Full current-demand coverage is not falsely partial. Genuine known zero, positive supply and unknown supply/demand remain distinct; no inferred zero/stock confirmation or new default from selection.
- A current Job demand change or switching/reselecting a historical candidate cannot leave a falsely complete coverage reading. The relevant approved selection/submission/reapplication paths and reload reflect the owner-approved meaning, not a UI-only mask.
- Preserve the current original/alternate/offer status contract and explicit customer/Order/send gates. Candidate confirmation or Job coverage classification causes no automatic selection, request rewrite, publication, order or parent-stage transition.
- Completion needs Bhoumik's approved semantics/authorization and owner verification of the actual target baseline and appropriate regressions. A source counterexample is not live deployment/case repair proof.

## Out of scope

- Diagnosing or repairing JR11118/36/36, resetting quantities, rebind/re-submit, resuming the Oct3 paused pipeline, live DB/tests/probes or a new candidate history schema.
- Earlier NULL-supply→demand defect (`candidate-selection-availability-quantity`), supplier-offer quantity fallback/default policy, AR submission-reset/enrichment policy, immutable original-baseline redesign or universal status precedence.
- Nova UI/build assignment, Lily code/data/SOP edits, blame attribution or new human interview. Parent will notify Bhoumik once after this focused handoff.

## Open decisions and evidence limits

- **Bhoumik:** define the Job's applicable current fulfilment demand/coverage basis where a supplier-specific or historical ask differs, and how it combines with existing statuses. Supplier-ask scope must remain preserved, not silently synchronized away.
- Historical ask approval, authorship and mutable original classification cannot be guessed. If needed for this decision, reuse existing request/supplier text and owner chronology/payload evidence; gathering new evidence or a global provenance model is not authorized here.
- Current live function/app identity and actual case chronology are not established. No claim of present JR111 shortfall, defective supplier answer or quantity corruption.

## Handoff log

- 2026-10-10 07:47:55 CDT — Separate classifier slice staged for Bhoumik following Nova's reused bounded source report. Incident-history evidence captured as watching, concrete source hazard captured separately. No external notification/build/data/audit action by task; parent notification pending. Existing newer status contract and prior pipeline hold preserved.
- 2026-10-10 07:51:18 CDT — Parent confirms actual CLI receipt for Telegram372 delivered Bhoumik the separate current-demand coverage decision/source-paper risk versus unresolved Stemodia history, preserving historical ask and no quantity repair/status-change authority. Remains staged: notification is not implementation approval, case diagnosis or shipment; no further human question.0125 unknown-quantity source-change qualification acknowledged, not live closure.
