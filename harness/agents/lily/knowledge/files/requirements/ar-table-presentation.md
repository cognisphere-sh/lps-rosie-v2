# Reorder the AR table and keep status context together

- Status: routed — EXECUTION AUTHORIZED; same-owner fresh verification/isolated supported implementation in progress. Reachable safe1–2 scope: focused Ops Job → AR drawer, opt-in. Item3 mapping unresolved. Owner reports clean current source and no edits yet; not completed/released.
- Route: nova — scoped UI/UX only; no new data/workflow authorization
- Raised: 2026-09-20 by Chris via Nova, Telegram691 and correction693
- Updated: 2026-09-22T09:16:33-05:00

## Problem

Chris wants the AR table easier to scan: requested and available quantities together, less space consumed by Plant, and relevant captured detail beside Status. He explicitly clarifies that item3 refers to details captured through the **JR line-status modal**, useful to him and the customer—not an inferred AR answer-note source.

## Evidence

- Chris691 at19:32:28: “Lets Reorder the AR view. See task1-3 annotated on the image. Do you understand our intent”. Original photo retained at `workspace/threads/main/files/ar-table-presentation-reference-691.jpg`.
- Independently inspected diagram: task1 moves Avail qty between Need and Size; task3 puts related notes immediately after Status. Task2 tiny wording/any fraction cannot be transcribed confidently. Its Plant-region arrow plus Nova692's narrower-Plant interpretation support a modest width reduction as an explicit assumption, not a quoted measurement. Full-name access is a preservation criterion.
- Chris693 at19:37:06: “We were refencing the status modal pop and content input view that happens when selecting a Status in a JR. Is that clear where that pop originates. I want those details that were captured shown in the notes after the status. They go together to provide me and the customer additioanl info”. This supersedes the initial AR-modal inference before any route/build.
- Historical September20 bounded source found an AR answer modal sharing its existing Notes value, but did not establish the clarified JR-modal capture path. That inspected JR picker saved status only, with customer-visible Shared notes separate from private Sourcing; AR associations could include multiple JR lines. This dated evidence must not become a standing claim about current/live functionality or justify patching stale source. Evidence: `workspace/threads/main/tasks/ar-table-presentation/source-check-2026-09-20.md`.
- Bhoumik706 at2026-09-22T09:12:09-05:00 says exactly **“implement this”**, replying to Nova705's three-item table scope with item3 mapping unresolved. Nova09:12:58 assigns the SAME owner fresh baseline/mapping verification plus isolated supported implementation. This authorizes execution, not completion, release or automatic baseline clearance.
- Nova09:13:28 reports fresh clean source `a3c26aa`, no main AR workspace yet, current drawer/profile/portal callers, no edits yet and QA auth absent. Parent09:14:06 confirms the smallest reachable placement adjustment: **safe1–2 opt-in focused Ops Job → AR drawer now**, reusable by a future main workspace. This supersedes new-main-workspace-only placement; no full tabs/chat implementation is authorized.

## What it should do — reachable safe items1–2

1. In the **AR drawer opened from the focused Ops Job**, opt in to Avail qty immediately between Need and Size. Keep requested and available quantities visibly distinct and preserve their values/meaning. Make the same presentation reusable by a future main AR workspace without building that workspace now.
2. Make Plant modestly narrower/rebalance its share of available space so the response columns are easier to scan. Preserve the complete saved plant identity and associated requested-detail/LPS note access; no botanical/name reconstruction or information loss. Full names must be usable on touch and keyboard, not hover-only.
3. Keep the other existing columns/content/actions in place for now, including AR notes and Ops line totals/subtotal. Items1–2 do not silently implement a guessed version of item3.
4. Apply through Nova's existing owner as isolated, reachable table work—not dormant code depending on the old main-workspace project and not a silent implementation of that project. Preserve every other drawer entry, supplier/public portals, supplier profile, Orders and Job tables. Retain mobile accessibility rather than forcing a wide desktop table onto phones.

## Item3 — execution authorized only where the fresh existing contract supports it

Chris wants the actual **JR status-modal captured details** in Notes immediately after Status, because they qualify the status for him and the customer. No column label was specified; “Status details” is not his chosen label.

Nova's current owner must first establish the actual existing modal, saved content, baseline/runtime and authorized association. Do not replace it with AR Nursery notes, assume it means customer Shared notes, or infer it from private Sourcing. A combined/multi-Job AR line can correspond to several JR rows with different notes/statuses; do not take a first/legacy link, merge unrelated text, imply JR and AR statuses are identical, or cross-copy/overwrite either side. Customer-useful intent does not itself authorize supplier/customer publication.

Any runtime verification uses an existing authorized read-only path; selecting a live status may autosave and is **not** authorized simply to reproduce a modal. Do not ask Chris to restate the origin. Bhoumik706 authorizes the smallest truthful UI-only implementation where fresh evidence establishes the existing contract. If item3 remains unmapped, isolate safe1–2 progress and report the precise remaining gap rather than substitute data or claim all three complete. A genuinely new data/workflow contract stays separately staged for Bhoumik; no speculative migration or broad proposal now.

## Acceptance criteria — safe items1–2

- Opening an authorized AR through the focused Ops Job's existing AR drawer shows Need → Avail qty → Size → Plant, with matching headers/cells and unchanged remaining response/price/total/note content. This is a reachable opt-in path, not code waiting for an unbuilt main workspace.
- Plant uses less excessive width at the reference desktop size; complete saved names, requested details and LPS notes remain accessible on desktop, keyboard and touch. No guessed percentage or changed saved names.
- Long names/notes, empty values, differing requested/available quantities and narrow screens remain usable without clipped essential controls or page-wide overflow; table/footer totals remain correctly aligned.
- Existing AR answers, all notes and their audiences/provenance, prices, quantities, totals, editing/focus/drafts/save/cancel/errors, stale-result protections and closed/hidden/read-only permissions remain unchanged. No duplicate editors or view-switch loss.
- Navigation/layout changes save/send/submit nothing. Existing explicit Submit/Re-submit and approval gates remain. Admin-entered overrides never become supplier confirmation by relabeling.
- All other drawer entries and supplier/public/profile presentations remain unchanged. No full AR workspace/tabs/chat behavior is added. Fresh independent exact-artifact technical and visual review and existing release gates are required; no broad heavy tests before a safe runner is established.
- If item3 is supported by the freshly verified existing contract, the actual JR-origin explanation appears in Notes immediately after Status with truthful linked-row/status context and audience. Otherwise delivery explicitly says **items1–2 only; item3 unresolved**. No AR-note substitution, guessed Shared mapping, private-note exposure or claim that all three/the full main workspace are complete.

## Assumptions and dependencies

- Narrower Plant is a modest fit-led default, not an exact fraction: tiny annotation2 wording remains uncertain. No extra questionnaire is needed.
- No new notes-column label is settled; final terminology must reflect the verified source and audience. Existing Notes stays unchanged during safe items1–2.
- `ops-ar-main-workspace` is under explicit **OPERATOR HOLD** from Bhoumik709 at2026-09-22T09:15:43-05:00; Nova710 confirms. Full-page/main-workspace/tabs/chat-switch work must not be implemented. The separately authorized706 focused Ops AR-drawer1–2 slice continues; it does not lift that hold or make item3 mapped. Exact709 feedback/whole-project state is owned by the linked requirement/task. No restart/bundling of older table, note, filter or header work and no harness restart.
- September20 baseline/auth/source findings are historical, not automatic September22 blockers or clearance. Owner now reports clean `a3c26aa`, isolated ready/no edits yet; item3 remains unresolved and QA auth absent. Await same-owner fresh findings and applicable safe-runner/exact-review/release evidence. Do not duplicate its read/build task or operator ask.

## Out of scope

New note storage or status capture, cross-record synchronization, source selection/conflict policy, rewriting notes, new provenance data, customer publication/relay, supplier contact, status/money/workflow/API/schema/skill changes, global portal restyling, and unrelated releases.

## Handoff log

- 2026-09-22T09:16:33-05:00 — Parent relays explicit Bhoumik709 full-page hold/Nova710 acknowledgment; current narrow focused-Job AR-drawer1–2 execution scope unchanged. Full-page/tabs/main-workspace/chat-switch remain OPERATOR HOLD; item3 unresolved. Crosslink boundary reinforced, no duplicate feedback/build/route.
- 2026-09-22T09:14:06-05:00 — Bhoumik706 “implement this” authorizes fresh verification and isolated supported-table execution by SAME Nova owner. Nova09:13:28 reports clean a3c26aa/no main AR workspace yet/no edits; parent confirms reachable **focused Ops Job → AR drawer opt-in1–2** scope, other entries preserved. Updated current behavior/acceptance; item3 unresolved, QA auth absent. No stale-source patch, full old tabs/chat authorization, duplicate builder/audit/operator ask or completion/release claim.
- 2026-09-20T19:44:51-05:00 — Parent relays Nova19:44:25 current-owner independent confirmation: item3 SOURCE/RUNTIME MAPPING HOLD upheld; AR allocation payload lacks JR statuses/details. Safe items1–2 planning accepted only as opt-in new main-workspace presentation, no blanket existing-drawer/portal change. Baseline/auth/resource holds unchanged, no build or live check. Owner evidence: `../nova/workspace/threads/main/tasks/ops-ar-main-workspace/jr-status-mapping-2026-09-20.md`.
- 2026-09-20T19:40:18-05:00 — Chris693 correction incorporated before any stale handoff. Parent agrees items1–2 only to current Nova owner; item3 source/runtime dependency, no broad data proposal or repeated origin question. Source-only task; no code/data/live tests/Telegram. Full requirement and exact source findings successfully delivered to Nova main/current owner, subject “AR691/693: safe layout1–2; JR-origin notes mapping HOLD”; no parallel builder.
