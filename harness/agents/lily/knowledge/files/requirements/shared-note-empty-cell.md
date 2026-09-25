# Keep empty Shared note cells quiet but easy to edit

- Status: routed — composition PAUSED; AR-only merge awaits operator release, no Shared UI deployment authority or release proof
- Route: nova
- Raised: 2026-09-17 by Chris (Telegram648/photo648, via Nova)
- Updated: 2026-09-25T01:29:40-05:00
- Related: `sourcing-note-disclosure` — separate internal-note behavior, not applied here

## Current merged-note contract caveat

- 2026-09-24 23:15:33 CDT — HEAD `3c4adca`/0115 now combines customer sourcing requirements and outcomes in editable customer-audience notes; quiet-empty polish must preserve populated merged content and not restore removed customer-origin fields/under-Plant editors. Current `NoteCell` already sets an empty placeholder, but source presence is not deployed/accessibility/rendered acceptance. Private internal sourcing stays separate. Existing approved scope and release gates unchanged. Source-only audit: `workspace/threads/main/tasks/note-audience-contract-audit/source-check-2026-09-24.md`; no application/runtime claim or policy change.

## Problem

Repeated “Add a shared note…” text clutters the Job table even when there is nothing to tell the customer. Chris wants an empty cell to look subtly editable without repeating those words on every row. Existing actual Shared notes must remain visible.

## Evidence

- Feedback **Quiet empty Shared note cells**: Chris648, verbatim via Nova12:38:19: “remove Add a shared note, just contract the cell to show you can click in an add note”.
- Directly inspected photo648 shows the empty placeholder repeated alongside a populated “5 gallon” note. Reference retained at `workspace/threads/main/files/shared-note-empty-cell-reference-648.jpg` on Lily.
- Existing operator-table audit for `sourcing-note-disclosure` already confirms a separate inline Shared note editor, reused in focused Jobs, expanded All Jobs and the operator's customer-detail request cards. Current uncommitted editor/table work must be preserved. No new broad audit or data query is needed for this slice.

## What it should do

1. Remove the repeated visible “Add a shared note…” placeholder from empty Shared note cells. Use a subtle, discoverable empty-cell affordance showing that it can be activated; blank must not look disabled or inaccessible.
2. Keep a meaningful accessible name such as “Add shared note for [plant]”, visible focus and deliberate mouse/touch/keyboard access. The active empty-cell target is at least44px; the visible decoration can stay quiet. Do not depend on hover alone.
3. Activation uses the existing inline note editor and existing save/cancel/error/refresh behavior, not the sourcing detail popup/history flow. Preserve customer visibility and existing write permissions. Opening without editing does not create or clear a note.
4. Populated Shared notes remain visible exactly as authored with their current editor behavior. Null/empty/whitespace-only content may present as empty without trimming or changing the stored value merely to render it. No note-content rewrite, audience change, move or automatic copy.
5. Apply the narrow empty-cell presentation consistently in the existing reused operator Request items table. Preserve selection, table order/resize/scroll, row context and neighboring editors. No blanket Orders/portal/public/customer-output change.

## Acceptance criteria

- Empty rows no longer repeat “Add a shared note…” onscreen, but a mouse, keyboard and touch user can discover and activate each empty cell. Accessible Add shared note identity and clear focus remain; target is at least44px.
- A populated example such as “5 gallon” remains visible and unchanged. Empty/null/whitespace cases render quietly without background data writes or false populated state.
- Existing inline add/edit/save/cancel/blur/Tab/error paths work and stay on the intended row. No sourcing icon, full-history interaction, hidden populated text, accidental selection/deletion or changed customer-sharing permission is introduced.
- Focused Jobs, expanded All Jobs and operator customer-detail request cards preserve current operator edits and saved layout choices. No width policy or global placeholder/editor redesign is inferred from this request.
- Review at320/390/480px and desktop includes empty, focused, editing/error and populated neighboring rows. Independent technical and rendered visual QA may share the isolated candidate/review session with sourcing disclosure but reports this slice separately. No clipped targets, new page overflow or loss of readability; fix/recheck failures before release.

## Out of scope

- Shared note icon-only conversion, hiding populated notes, sourcing/history behavior, column-width redesign, original customer evidence changes or global note-editor changes.
- Data/schema/API/workflow/permission changes, note cleanup/migration, customer/supplier contact or changed public output.
- Any delay or scope expansion of the separately approved sourcing-history UI; Nova may serialize the same-file changes without making this polish a new dependency.

## Current integration gate

- 2026-09-24T23:07:41-05:00 — Bhoumik Nova Telegram721 at23:05:36: “I have committed. You can integrate.” Nova722/23:06:24 acknowledges protected integration and independent checks/release report; fresh HEAD/index/current-versus-frozen-candidate/auth/resource preflight is delegated, NO candidate applied yet. This authorizes scoped integration, not a QA waiver or proof of clean compatibility, migrations/name-rollout target resolved, integration identity, release or live behavior. Prior `f9a2ddb` safety was a dated report, not today's guarantee. Subsequent Nova23:09:27 reports clean committed `3c4adca` contains0104+0115; no migration-application/candidate-compatibility claim follows. Live build predates HEAD/exact source unknown, QA auth absent and OOM-safe runner unvalidated; operator723/724 already asked.
- Current priority is Bhoumik743/Nova744 DEPLOY AR R3 ONLY after740: available quantity/Plant/existing AR-line note after Status (items1–3 in approved internal focused-Job drawer), not full-page AR709. All other candidate composition, including this empty-Shared slice/mobile-list/Past/older notes-table-filter work, is PAUSED, not withdrawn.743 does not authorize their deployment or old status/default patch restoration. Preserve operator work/safe-runner/auth gates; Nova owns execution. No broader botanical/schema/DB/supplier-note-routing authority or change to populated Shared note audience/authorship.

- 2026-09-24T23:11:53-05:00 — Bounded0115 note-contract review belongs to separate `note-audience-contract-audit`; no parallel audit or old notes-policy integration here. Current deep-link fix6c0e95c and alternate supplier Past source are existing source facts, not deployed/compliant release proof. Current owners reconstruct approved mobile chats/drawer1–2 against exact HEAD and review actual Past, not apply old patches. This slice remains only quiet empty-cell presentation subject to current contract compatibility; no data authority or old audience assumptions inferred.

- 2026-09-24T23:26:45-05:00 — Nova23:24:06/operator727 retract the unconditional0104 DB gate after ledger correction. Nova separately audits current optional-reader0106/changed-backfill0108; no stale apply/blanket0104 prerequisite here. Notes0115 risk already raised726 remains with its owner. Mobile-list `ed9186c0` and drawer1–2 R2 `70ab266d` are only reported staticSAFE candidate IDs; Past `be11efac` review pending. RequestLinks/header/docs overlap requires deliberate composition/fresh review. No tests/auth/live-build verification or integration/deploy despite721, and no implied technical pass for this separate Shared UI slice.

- 2026-09-25T00:03:56-05:00 — Nova reports R3 candidate `189709a` independently staticSAFE, not a presumed git commit/release. Tests/build/browser/auth are UNMET; operator already asked secure QA login/bounded-runner approval. No dirty `server.sh` deploy/safety waiver. Existing AR `note_for_supplier` placement under740 does not create/copy/edit note data, change Submit/audience/customer exposure or imply JR association. No integration/release claim for this paused Shared UI slice.

- 2026-09-25T01:29:40-05:00 — AR drawer1–3-only main merge now owner-reported at `fecd81be6821af7f39b7d3197cbb0dc889de74e6`, parents07445867/e79b0cb; latter independently STATIC reviewed,11 exact candidate blobs, other operator/Lily repairs preserved. Bhoumik749 takes release after merge, Nova751 already provided SHA/gates. No exact tests/type/build/browser/deployment, hostOOM/runner still unvalidated. Daisy read-only target-catalog result confirms AR fields/0115-compatible answerRPC only, not end-to-end/all migrations. AR MERGED NOT LIVE; this Shared slice and other composition remain PAUSED. No mobile/Past/full709/customer-publication in THIS merge scope, not a statement that older HEAD changes do not exist.

## Separate workflow boundary

- 2026-09-17T12:49:16-05:00 — Chris657's proposed supplier-status/plant-note versus private-pricing routing is separately staged for Bhoumik by task `supplier-note-customer-routing`. It does not authorize automatic content copying/classification, change this empty-cell UI scope, or waive its current integration gates. No data/skill/seed change is bundled here.

## Assumptions

- “contract the cell” may mean compact it or contrast it. The accompanying intent and Nova acknowledgment support a subtle clickable empty-cell cue, not a prescribed width reduction. Preserve current sizing/layout unless the quiet affordance itself needs ordinary fit adjustment; do not ask Chris another wording question.
- In the sourcing requirement, “Shared unchanged” means sourcing work leaves Shared content, populated rendering, audience and editing intact. This independently approved empty-placeholder polish is the only separate exception.

## Handoff log

- 2026-09-17T12:39:22-05:00 — Captured exact648 and inspected reference; reused the bounded existing source audit. Successfully delivered full requirement to Nova main, subject **Separate UI: quiet empty Shared note cell, populated notes unchanged**. Linked to but not a prerequisite for sourcing disclosure; no sourcing/history behavior applied to Shared. No Lily app/data/skill edits or Telegram.
- 2026-09-17T12:42:45-05:00 — Nova12:41:07 accepts this separate slice with the same serial owner, but current operator baseline is BLOCKED before implementation; Nova651 already requested preservation/commit, no duplicate ask. Parent Telegram346 communicated both scopes and not-live status to Chris. No tests, edits or deployment claimed.
- 2026-09-18T10:06:32-05:00 — Parent relays Nova10:06:16: Bhoumik665 at10:05:42 says “Execute your queued changes.” Nova resumes fresh protected-base preflight for sourcing disclosure, this separate empty-Shared slice and QNTY/requested-number centering under one serial owner, then the reviewed technical queue. Scoped execution approval does not prove baseline conflict resolution, implementation or release. Operator index/source, permissions/audience and independent technical/rendered gates remain protected; no harness self-restart, new builder or broad workflow/schema/notes-policy approval. Await builder evidence; no duplicate external reply.
- 2026-09-18T10:08:47-05:00 — Parent relays Nova10:08:21: current clean committed `f9a2ddb` passes fresh baseline preflight and isolated work has started for the three approved slices. Status now IN PROGRESS, not blocked; no completion/release claim. Operator protections, fresh independent technical/rendered gates and this slice's distinct audience/behavior remain. No Lily repo re-audit or new builder. Separate compact-mobile-filter refresh is outside this scope.
- 2026-09-24T23:07:41-05:00 — Recorded shared721 integration permission as authorization/preflight only, with no applied candidate or release proof. Single deduplicated feedback receipt is **Committed work may be integrated**, ID `nova:main:2026-09-24T23:06:24-05:00:integration-authorization-telegram721`; no second capture for this requirement. Existing Lily owners informed internally to maintain their own scopes, no repeated audit/builder/operator ask or external message. Await actual Nova preflight/release evidence.
- 2026-09-24T23:11:53-05:00 — Current3c4adca/base/source-versus-live/auth/runner facts propagated to existing owners, without duplicate shared feedback/audit/build/ask. Fresh0115 compatibility is separately owned; latest shared capture ID `nova:main:2026-09-24T23:09:27-05:00:current-integration-base`. No candidate integration or live release proved.
- 2026-09-24T23:26:45-05:00 — Recorded latest conditional integration gates and only relayed to affected existing mobile-list/AR/Past owners. No duplicated feedback/audit/test/build/operator ask, no assumed candidate commit or release identity.
- 2026-09-25T00:03:56-05:00 — Updated composition to PAUSED under743 AR-R3-only deployment priority, requirement retained. Shared743 helper receipt captured once under `nova:main:2026-09-25T00:03:38-05:00:ar-r3-deploy-telegram743`; no separate duplicate for Shared. Existing AR/mobile/Past owners informed; no extra builder/ask/tests or inferred release.
- 2026-09-25T01:29:40-05:00 — Shared merge event captured once (ID `nova:main:2026-09-25T01:28:51-05:00:ar-r3-main-merge`) and existing AR owner told MERGED-NOT-LIVE/operator-owned release. Own Shared requirement still PAUSED/retained, no deployment authorization. No duplicate feedback/audit/tests/operator ask or Telegram; await actual release/resumption.
