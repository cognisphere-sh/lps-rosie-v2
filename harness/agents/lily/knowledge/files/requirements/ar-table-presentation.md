# Reorder the AR table and keep status context together

- Status: routed — items1–2 delivered to current Nova owner; item3 SOURCE/RUNTIME MAPPING HOLD. Existing main-workspace implementation HOLD unchanged; nothing implemented/released.
- Route: nova — scoped UI/UX only; no new data/workflow authorization
- Raised: 2026-09-20 by Chris via Nova, Telegram691 and correction693
- Updated: 2026-09-20T19:44:51-05:00

## Problem

Chris wants the AR table easier to scan: requested and available quantities together, less space consumed by Plant, and relevant captured detail beside Status. He explicitly clarifies that item3 refers to details captured through the **JR line-status modal**, useful to him and the customer—not an inferred AR answer-note source.

## Evidence

- Chris691 at19:32:28: “Lets Reorder the AR view. See task1-3 annotated on the image. Do you understand our intent”. Original photo retained at `workspace/threads/main/files/ar-table-presentation-reference-691.jpg`.
- Independently inspected diagram: task1 moves Avail qty between Need and Size; task3 puts related notes immediately after Status. Task2 tiny wording/any fraction cannot be transcribed confidently. Its Plant-region arrow plus Nova692's narrower-Plant interpretation support a modest width reduction as an explicit assumption, not a quoted measurement. Full-name access is a preservation criterion.
- Chris693 at19:37:06: “We were refencing the status modal pop and content input view that happens when selecting a Status in a JR. Is that clear where that pop originates. I want those details that were captured shown in the notes after the status. They go together to provide me and the customer additioanl info”. This supersedes the initial AR-modal inference before any route/build.
- Bounded current source shows an AR answer modal and its existing Notes share one value, but does **not** establish the clarified JR-modal capture path. The inspected JR picker saves status only; customer-visible Shared notes are separate from private Sourcing. AR associations can include multiple JR lines. This is a source/runtime mapping discrepancy, not a claim that Chris is wrong or the feature is absent live. Technical evidence: `workspace/threads/main/tasks/ar-table-presentation/source-check-2026-09-20.md`.

## What it should do — safe items1–2

1. In the focused Ops **new full main AR workspace** defined by `ops-ar-main-workspace`, place Avail qty immediately between Need and Size. Keep requested and available quantities visibly distinct and preserve their values/meaning.
2. Make Plant modestly narrower/rebalance its share of available space so the response columns are easier to scan. Preserve the complete saved plant identity and associated requested-detail/LPS note access; no botanical/name reconstruction or information loss. Full names must be usable on touch and keyboard, not hover-only.
3. Keep the other existing columns/content/actions in place for now, including AR notes and Ops line totals/subtotal. Items1–2 do not silently implement a guessed version of item3.
4. Apply through Nova's existing owner, serialized with the held full-main-workspace plan. Shared presentation must not leak changes into supplier/public portals, supplier profile, unrelated AR drawers, Orders or Job tables. Retain mobile accessibility rather than forcing a wide desktop table onto phones.

## Item3 — clarified intent, NOT implementation-ready

Chris wants the actual **JR status-modal captured details** in Notes immediately after Status, because they qualify the status for him and the customer. No column label was specified; “Status details” is not his chosen label.

Nova's current owner must first establish the actual existing modal, saved content, baseline/runtime and authorized association. Do not replace it with AR Nursery notes, assume it means customer Shared notes, or infer it from private Sourcing. A combined/multi-Job AR line can correspond to several JR rows with different notes/statuses; do not take a first/legacy link, merge unrelated text, imply JR and AR statuses are identical, or cross-copy/overwrite either side. Customer-useful intent does not itself authorize supplier/customer publication.

Any runtime verification uses an existing authorized read-only path; selecting a live status may autosave and is **not** authorized simply to reproduce a modal. Do not ask Chris to restate the origin. Once the real existing contract is established, return the smallest truthful UI-only presentation for approval/routing; if a genuinely new data/workflow contract is required, stage that separately for Bhoumik. No speculative migration or broad proposal now.

## Acceptance criteria — safe items1–2

- Opening an authorized AR in the focused main workspace shows Need → Avail qty → Size → Plant, with matching headers/cells and unchanged remaining response/price/total/note content.
- Plant uses less excessive width at the reference desktop size; complete saved names, requested details and LPS notes remain accessible on desktop, keyboard and touch. No guessed percentage or changed saved names.
- Long names/notes, empty values, differing requested/available quantities and narrow screens remain usable without clipped essential controls or page-wide overflow; table/footer totals remain correctly aligned.
- Existing AR answers, all notes and their audiences/provenance, prices, quantities, totals, editing/focus/drafts/save/cancel/errors, stale-result protections and closed/hidden/read-only permissions remain unchanged. No duplicate editors or view-switch loss.
- Navigation/layout changes save/send/submit nothing. Existing explicit Submit/Re-submit and approval gates remain. Admin-entered overrides never become supplier confirmation by relabeling.
- Supplier/public/profile/other-entry presentations do not change accidentally through a shared component. Fresh independent technical/rendered review and existing release gates are required.
- No item3 implementation claims until the owner resolves the JR-origin mapping and whole-AR linked-row/audience dependency; no AR-note substitution, guessed Shared mapping or private-note exposure.

## Assumptions and dependencies

- Narrower Plant is a modest fit-led default, not an exact fraction: tiny annotation2 wording remains uncertain. No extra questionnaire is needed.
- No new notes-column label is settled; final terminology must reflect the verified source and audience. Existing Notes stays unchanged during safe items1–2.
- `ops-ar-main-workspace` remains the baseline: MULTIPLE AR tabs/full whole-AR content, supplier-scoped Rosie chat, shared-scope and state preservation. Operator-baseline overlap, auth and resource-window HOLD persist. This does not restart/bundle earlier table, note, filter or header releases or authorize a harness restart.
- Item3 is blocked on Nova current-owner source/runtime mapping and exact association/audience evidence, not on Chris repeating his clarified request. Nova's independent bounded check2026-09-20T19:44:25-05:00 confirms the inspected JR picker is identical across HEAD/index/worktree and status-only; no actual JR-modal captured-field contract established. QA auth is absent, so no runtime/status-click reproduction occurred. Intended runtime/source-baseline or authorized read-only evidence is still needed; no further audit/question/data proposal authorized.

## Out of scope

New note storage or status capture, cross-record synchronization, source selection/conflict policy, rewriting notes, new provenance data, customer publication/relay, supplier contact, status/money/workflow/API/schema/skill changes, global portal restyling, and unrelated releases.

## Handoff log

- 2026-09-20T19:44:51-05:00 — Parent relays Nova19:44:25 current-owner independent confirmation: item3 SOURCE/RUNTIME MAPPING HOLD upheld; AR allocation payload lacks JR statuses/details. Safe items1–2 planning accepted only as opt-in new main-workspace presentation, no blanket existing-drawer/portal change. Baseline/auth/resource holds unchanged, no build or live check. Owner evidence: `../nova/workspace/threads/main/tasks/ops-ar-main-workspace/jr-status-mapping-2026-09-20.md`.
- 2026-09-20T19:40:18-05:00 — Chris693 correction incorporated before any stale handoff. Parent agrees items1–2 only to current Nova owner; item3 source/runtime dependency, no broad data proposal or repeated origin question. Source-only task; no code/data/live tests/Telegram. Full requirement and exact source findings successfully delivered to Nova main/current owner, subject “AR691/693: safe layout1–2; JR-origin notes mapping HOLD”; no parallel builder.
