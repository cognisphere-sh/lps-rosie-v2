# Open supplier availability work in the main Ops workspace

- Status: routed — **OPERATOR HOLD** (Bhoumik709): no full AR main-workspace/tabs/chat-switch implementation until a new go-ahead. Desired direction retained; no implementation/release claimed.
- Route: nova — UI/UX only
- Raised: 2026-09-20 by Chris via Nova, Telegram680 at19:04:37 CDT
- Updated: 2026-09-22T09:16:33-05:00

## Problem

Chris finds the AR side panel suboptimal for collaborating with a supplier. He wants the full corresponding AR workspace in the primary content area, retaining the surrounding Job context and switching the right chat to the supplier context.

## Evidence and decisions

- Feedback **AR collaboration belongs in main workspace** preserves Chris680’s exact request. Directly inspected `workspace/threads/main/files/ops-ar-main-workspace-reference-680.jpg` shows AR-chip content replacing the primary table area, not the Job header or chat column.
- Chris682 answers all three Nova681 questions: **“switch to supplier chat”**; **“yes”** to the tab/chip direction; **“It should be AR workspace”** (full content). Relayed by Nova19:10:05/Lily main. Directly inspected follow-on `ops-ar-main-workspace-reference-683.jpg` crops the lower reference to the table; that crop does not override the full-workspace answer. Montage identities/rows are not assumed to match.
- Chris687 explicitly clarifies multiple supplier ARs mean **multiple AR tabs**, each loading its full AR and corresponding supplier chat (Nova19:20:29, confirmed688; exact wording in feedback **Multiple requests mean multiple AR tabs**). This supersedes the earlier single changing AR-tab interpretation. One tab per distinct authorized linked AR, including separate AR tabs for the same supplier; chat remains supplier-scoped.
- Bounded current source/docs check confirms existing Ops Supplier chat is **Chris/team talking to Rosie in the supplier’s stored conversation**, not a direct supplier composer. The supplier portal exposes a separately filtered audience; internal messages do not become supplier-visible on navigation. Detailed source evidence: `workspace/threads/main/tasks/ops-ar-main-workspace/contract-check-2026-09-20.md`. Source-only, not live verification.

## Execution hold — supersedes technical-readiness-only blocking

Bhoumik Telegram709 at2026-09-22T09:15:43-05:00: **“Do not implement AR full page view yet.”** Nova relayed at09:16:06 and acknowledged in710. This holds the whole full-AR main-workspace/tab/chat-switch implementation even if baseline, auth or resource gates clear. No work resumes without a new go-ahead.

The separate focused Ops Job **AR drawer table items1–2** authorized under706 remain allowed. They are not approval to implement the full view, tabs or chat switching. Do not bundle this held scope into them. The later AR-reference meeting question remains discussion-only, with no workflow authorization.

## What it should do — retained desired design, not current execution permission

### Main area and navigation

1. Selecting an existing AR chip in the focused Ops Job opens that **whole corresponding AR** in the main work area, not an additional drawer. Retain the Job header and right chat area.
2. Show Request items, Orders and **one separate tab for each distinct authorized linked AR**. Each AR tab identifies both supplier and AR; existing chips select/reveal that corresponding tab. Do not reuse one changing AR tab, multiply tabs for duplicate item links, or add unrelated ARs from inferred supplier/montage identities. Switching tabs loads that AR’s content rather than stacking drawers. Keep active tab/chip unmistakable. Multiple tabs must remain usable on narrow screens: controlled tab-strip overflow, discoverable hidden tabs, active tab brought into view, clear keyboard focus/roving tab focus and 44px interaction targets. No unrequested tab-close, removal or deletion behavior.
3. Include full existing AR content: identity, dates and per-Job fulfillment schedules, state/supplier/Job/submission metadata and visibility cues, requested lines, responses, quantities/prices/totals, whole-request and line notes, and all currently permitted Share/status/reopen/Submit actions. Adapt presentation to the main area; drawer width controls need not be copied.
4. Preserve each view’s filters, selection, scroll and browser Back/history behavior, including a useful return path. Loading/error/empty/closed states remain clear and escapable. Switching must not lose edits or show/save stale data under another AR.

### Supplier-context chat and return

5. AR selection opens the existing **Rosie supplier conversation** for that AR’s actual supplier. Clearly label Rosie and the supplier context; the composer is internal to LPS/Rosie, not “send directly to supplier”. Preserve actual sender/audience attribution in the transcript, including any supplier-origin portal messages.
6. Separate AR tabs for the same supplier reuse the same stored conversation, transcript and unsent work; same-canonical-destination selection is a chat no-op, not a composer reset. Chris’s “AR chat thread” is the existing supplier-scoped Rosie conversation, not a separate AR-specific thread/chat store. Do not mint a thread or filter away other AR/Job context. A different supplier binds its own exact existing destination. Missing/unavailable or mismatched chat shows an honest unavailable state; never invent a thread or fall back silently to Main, the last supplier or customer. Activating a tab selects context only and dispatches no message.
7. Returning to Request items or Orders restores that view’s captured existing chat context and saved state/draft/attachments. If none was captured, use the current Job’s Rosie conversation. Orders has no newly invented conversation. Deliberately chosen existing customer/other conversations remain distinct, never merged into an AR supplier thread.
8. Preserve draft text and completed staged attachments in-session with their original conversation across these switches. **Current chat switching clears them**, so this is required narrow UI restoration, not an already-working guarantee. Preserve safe upload/recording teardown, exact-destination send guards and stale-result isolation; nothing pending may land in another audience. Do not silently discard unsent work or restore sent content as a new draft. No cross-device durable draft feature.

### Scope and behavior remain unchanged

9. A shared multi-Job AR stays whole: show its linked-Job context and per-Job schedules, with an explicit shared-scope cue where needed. The retained Job header is navigation context, not an implicit filter or action scope. Request-wide Share/Submit/status/close/reopen actions must not appear Job-only.
10. Preserve permissions, snapshot edit scope, closed/read-only behavior and actual action semantics. A line save is not Submit; only the existing explicit Submit/Re-submit path relays submission. Navigation never sends, shares, submits, grants access or changes workflow/data. Existing outbound approval gates remain.
11. Preserve true supplier-versus-admin provenance and existing override/context notes. Association with APS does not establish APS confirmation; do not invent missing author/freshness evidence. Internal notes do not become customer Shared notes or supplier-visible traffic merely by relocation.

## Acceptance criteria

- The tab list contains Request items, Orders and exactly one supplier/AR-identified tab per distinct authorized linked AR. Multiple suppliers and multiple ARs for one supplier produce separate AR tabs; duplicate item links do not duplicate tabs and unrelated ARs do not appear.
- Each chip selects/reveals its existing AR tab; activating it opens the full corresponding AR in the main area with retained Job header and unambiguous supplier/AR identity. No single changing AR tab or duplicate drawer substitutes for this.
- Request items / Orders / AR switching and Back restore the correct view, filters, selection, scroll and prior chat state; stale loads/saves cannot cross AR identities.
- Chat visibly shows Rosie in the active AR’s supplier context before send. Same-supplier AR-tab switches retain one canonical conversation and do not rebind/reset its draft; different suppliers remain separate. Missing/mismatched chat cannot send to an unrelated fallback. No AR-specific thread or direct supplier channel is created.
- Draft text and staged attachments survive AR/Job-tab round trips only in their original conversation. Test same-supplier, different-supplier, customer-context return and absent-prior-context fallback; upload/recording/send/reset races cannot leak, clear another destination or duplicate sent drafts.
- Full metadata, lines, responses, notes and permitted actions remain accessible. Closed/read-only/reopen, validation/errors, save-versus-Submit and supplier/admin attribution match the existing contract.
- A multi-Job AR shows all authorized linked work/schedules and clear whole-AR action scope, without silently filtering to the opening Job.
- Opening/switching sends nothing and changes no record or publication audience. Existing supplier/customer send approvals stay intact.
- With many tabs/long supplier names/narrow layouts, all tabs remain discoverable and reachable, the active tab is visible, roving keyboard focus/activation is coherent and touch targets remain 44px. No new tab-close/delete semantics or page-wide overflow. Loading/error/empty states and existing mobile access do not regress. Fresh independent technical and rendered review is required before release.

## Out of scope

New external chat channels, supplier impersonation, conversation consolidation, workflow/storage/permission changes, synchronization/conflict-policy redesign, supplier-note routing, changed commercial/status/action semantics, app-wide AR-entry replacement, or the separate header/mobile-navigation redesign. Other AR entry points retain their existing behavior unless separately agreed. No supplier/customer outreach by this task.

Do not bundle/restart the existing table/note/filter releases. Nova must perform fresh operator-baseline/auth/resource checks and follow independent release gates; this handoff does not override their holds or authorize a harness restart.

## Assumptions and open questions

- All three original product questions are answered; none is repeated. Chris689 explicitly accepts two ARs sharing one supplier thread. “Supplier chat” retains the existing Ops meaning—Rosie in supplier context—with honest labeling, not a new direct-to-supplier channel. If Chris later asks for direct messaging, separate that workflow/permission slice for Bhoumik.
- **Deferred, nonblocking next-meeting question (Chris689):** “When two ARs share one supplier conversation, how should I clearly communicate which AR I am referring to? What is my workflow?” Logged for Chris/Bhoumik at `workspace/threads/main/files/next-meeting-agenda.md`. Tab selection is not established as communicating the AR reference. Discussion only: do not solve/build now, infer automatic context insertion/messages/relay, create AR threads or block approved tabs. No meeting time was supplied; nothing scheduled.
- Initial scope is focused Ops Job chips/tabs, sourced only from existing authorized AR links and deduplicated by actual AR identity. Draft restoration is in-session UI state, not new persistent storage. Shared ARs remain unfiltered whole requests. Any later request for true AR-specific chat must be staged separately for Bhoumik; it is not implied by the visible AR tabs.
- **Explicit operator permission now blocks execution.** The September20 source-only preflight found UI-only feasibility but operator-edit overlaps, absent auth and a pending resource window; baseline was already requested686. Those historical technical gates do not authorize resumption if cleared. Await a new go-ahead for this full-view scope before any fresh implementation/preflight work; no repeat operator question or build/tests now.

## Related work

`ar-table-presentation.md` — 2026-09-22T09:14:06-05:00 Bhoumik706 authorizes fresh verification and isolated supported **table** execution by the same owner, NOT this whole main-workspace/tabs/chat project. Owner reports clean current a3c26aa with no main workspace yet; parent confirms safe1–2 reachable opt-in placement in **focused Ops Job → AR drawer**, reusable by a future main workspace, all other entries preserved. Item3 JR-origin explanation mapping remains unresolved; no AR/private-Sourcing substitution. No edits/completion/release reported. This requirement's broader scope and authorization/gates are not superseded by706.

`job-inbox-workspace.md` / `focused-job-chat-routing.md` supply context. `supplier-note-customer-routing.md` remains separately staged. `focused-jr-table-layout.md`, `sourcing-note-disclosure.md`, `shared-note-empty-cell.md` and `all-jobs-compact-filter-selectors.md` remain separate held releases.

## Handoff log

- 2026-09-20T19:06:13-05:00 — Full exploratory draft delivered to Nova main as DESIGN ONLY; no implementation then authorized.
- 2026-09-20T19:11:05-05:00 — Chris682 resolved all three questions; bounded current workspace/chat source/docs check completed. Full approved narrow requirement delivered successfully to Nova main, superseding this item’s design-only hold. Existing internal supplier-chat meaning and draft-clear gap explicitly documented; no new questionnaire/data/workflow slice. Fresh protected-base/auth/resource/review gates and unrelated release holds remain; no implementation/release claim.
- 2026-09-20T19:17:28-05:00 — Parent reports Telegram353 delivered the full main-AR/tabs/retained-Job-header/supplier-context-chat direction, explicitly explaining operator ↔ Rosie rather than a new direct-send channel, visible shared-AR scope and not-live status. Delivery complete; await Nova review/release, no further questions or outward sends. Existing bind-time draft loss remains a source finding distinct from required preservation.
- 2026-09-20T19:19:17-05:00 — Parent relays Nova19:18:56: UI-only feasible, IMPLEMENTATION HOLD due operator overlaps; committed current baseline already requested in686. Auth/resource gates also remain pending. Owner has a source-only plan for scoped focused entry, whole-AR content/action preservation, exact supplier chat and safe in-session draft restoration. No implementation, tests, API/workflow changes or old table/filter bundling. Technical baseline/proposal evidence retained in task contract check; Lily did not repeat preflight or contact operator.
- 2026-09-20T19:21:10-05:00 — Chris687/Nova688 supersede the single changing AR tab with multiple supplier/AR-identified tabs, one per distinct authorized linked AR. Canonical behavior/acceptance updated; correction delivered successfully to Nova’s current owner, no duplicate builder. Same-supplier tabs retain the same supplier-scoped chat/drafts; responsive accessible tab overflow required, no close/delete semantics. Existing baseline/auth/resource implementation HOLD remains.
- 2026-09-20T19:25:08-05:00 — Chris689 accepts the shared supplier-thread model and explicitly requests only a next-meeting agenda item on clearly referring to an AR in that conversation. Logged in `workspace/threads/main/files/next-meeting-agenda.md`; no duplicate feature requirement, new product/UI/workflow authorization or extra blocker. Parent/Nova internal notification only; parent owns external acknowledgement.
- 2026-09-22T09:16:33-05:00 — Parent relays Bhoumik709 exact “Do not implement AR full page view yet.” (09:15:43), via Nova09:16:06/Nova710 acknowledgement. Marked OPERATOR HOLD across requirement/index/task; desired design remains, no implementation until new go-ahead. Separate706 AR-drawer table items1–2 remain allowed and are not full-view implementation. Nova already acknowledged, so no duplicate owner route/builder/source changes. AR-reference agenda unchanged in discussion-only scope.
