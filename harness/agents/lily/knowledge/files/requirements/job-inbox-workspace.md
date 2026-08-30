# Put active Job Requests in an inbox workspace

- Status: routed
- Route: nova
- Raised: 2026-08-29 by Chris (via nova)
- Updated: 2026-08-29 (focused-shell clarification)

## Problem

Chris wants the work he is actively coordinating to read like an inbox, not a long set of expandable records. He needs to see which Job Request has new conversation or a meaningful update and open it without losing the list of other work. The existing `/requests` screen is still valuable for scanning and managing the full set, but it is not the best default operational view.

## Evidence

- 2026-08-29, **Job inbox workflow**: Chris liked the inbox-style Job Request workflow shown in Nova's visual reference set (`photo_274.jpg`, `photo_275.jpg`, `photo_277.jpg`, `photo_279.jpg`, `photo_281.jpg`, and `photo_284.jpg`; none is presently available in Lily's Telegram inbox). He asked for the left rail to be ordered/bubbled by new messages, with the selected Job Request open beside it.
- 2026-08-29, **New request starts in its thread**: Chris approved New job request creating/selecting the new JR/thread and opening blank Rosie chat immediately, with JR details filling in as intake progresses.
- The existing app already gives every created Job Request the canonical Rosie conversation `jr-<id>` and has a derived link to it. The global Conversations picker already lists those open job conversations, while `/requests` shows expandable management cards.

## What it should do

### Default Jobs workspace

- Make the default `/jobs` destination an inbox-style active-Job-Request landing in the ordinary app shell. It presents the active list without auto-selecting a first row on desktop; selecting a row enters the focused workspace below. This deliberate no-selection landing makes the focused workspace’s Back control useful rather than looping immediately back into a selected job.
- Each list row identifies the Job Request (JR reference, job/customer name where known), shows its current status, and gives a compact latest-activity preview. It must make new/unread web-chat activity visually distinct without relying on color alone.
- Order active rows by most recent relevant activity: a newer Job Request conversation message takes precedence; where no web conversation exists, use the Job Request's most recent record update. A newly created request without either remains visible, not omitted.
- Selecting a row opens that Job Request's existing detail/work area in the main pane. Do not create or infer a new conversation: the only Job Request conversation is Rosie's canonical `jr-<id>` thread.
- A record edit/status change appears as activity in the selected job and refreshes its row's status/preview/order. A conversation message refreshes its row immediately. The implementation may use the app's existing live/polling chat refresh behavior.
- Preserve a clear way to open Rosie's conversation for the selected job; the inbox list is not a replacement for the conversation itself.
- Keep **All jobs** as an alternate management view with the existing scan, filters, bulk actions, detailed line editing, availability-request links, history and deletion behavior. It must remain reachable from Jobs and retain its established filters when returning during the same visit.

### Starting a new Job Request

- Reuse the existing **New job request** control and Rosie-led intake transport; do not introduce a competing data-entry form or separate create-JR dialog.
- After New successfully reserves the canonical `jr-<id>` identity and opens its Rosie thread, enter a purpose-built **focused intake mode**. On desktop, Rosie chat fills the workspace; on mobile it fills the screen. The intake header identifies the new JR, offers a deliberate exit/back/cancel control, and is purpose-built for intake—not part of the app-wide compact-header requirement.
- The focused chat accepts the existing supported message transport unchanged: typed text, pasted/dropped text or data, files, and screenshots/other supported attachments. These arrive in the same canonical Rosie thread; do not make a second upload path or duplicate attachment store.
- Intake remains focused while Rosie gathers the request and writes partial details. The UI may show only durable details returned from the Job Request record; it must not invent customer, job, status, lines, dates, or extract attachment content itself. Persisted partial details may refresh visibly as Rosie saves them, while chat remains the primary surface.
- **Manual exit only:** focused intake does not auto-transition when a Job Request record or line item appears. It stays focused until Chris uses its explicit exit/back/cancel control; exit opens normal selected workspace in an honest pending/partial state and does not abandon the canonical thread. Whether an atomic/pending model should define a later automatic transition is staged for Bhoumik, not part of this UI build.
- Focused intake is entered only by the exact same-tab reservation marker created by New. A copied or reloaded markerless `intake=1` URL for an existing active Job Request opens normal selected detail, including when that request has zero lines. A markerless pre-record/no-row URL shows unavailable/intake-not-started. These states must never manufacture a reservation, start intake, or select another Job Request.
- If starting intake fails before an id/thread is available, leave the user on the current Jobs view, show an actionable error, and do not select a phantom row. If an id was reserved but opening/navigating fails, retry/recover that same identity rather than reserving another. A reserved id with no saved Job Request is an allowed abandoned gap and must never be presented as a finished request. Cancelling/exiting never deletes a persisted JR or its thread; it only leaves focused intake.

### Focused workspace shell (desktop)

- Entering a selected active Job Request on desktop is a **focused Jobs workspace**: the Job Request/thread list becomes the far-left rail and the normal app navigation rail is hidden. There must never be two simultaneous left rails.
- The focused rail has a clearly labelled, 44px-minimum **Back** control at its top. It returns Chris to the normal app shell and Jobs landing/list, with the normal app navigation available again; it does not mean browser-back out of the app or close/delete the Job Request.
- The main pane remains the selected Job Request’s non-management work/detail surface. Its Rosie action opens the selected request’s canonical `jr-<id>` conversation through the existing global AgentChat panel. Preserve that panel’s existing docked/collapsed/full behavior in focused mode; do not add an embedded second Rosie chat, another conversation picker, or a second right panel. Supplier/customer/global conversations remain available through their established entry points.
- Put **New job** and Notifications in the focused workspace’s top action area (not in a revived app-nav rail or an added second toolbar), retaining their labelled 44px targets. New continues into the existing full-workspace focused intake flow.
- The normal `/jobs` landing keeps the normal app shell. Selecting a valid row enters focused mode and changes the address to `/jobs?jr=<id>` without a full reload. A valid direct `/jobs?jr=<id>` link opens directly in focused mode; an invalid, closed, deleted, or unavailable id shows an honest unavailable state and never silently selects another row.
- Selecting another row while focused replaces the selected `jr` in the current history entry rather than creating a Back-stack entry for every row. When focus was entered from normal Jobs, browser Back returns to the normal Jobs landing. The focused workspace’s own Back does the same; for a direct deep link with no Jobs landing behind it, it navigates to normal `/jobs` rather than leaving Chris stranded or exiting the app.
- On leaving focused mode, restore the normal Jobs list’s scroll position and keyboard focus to the row that was selected (or to the New-job trigger when that initiated the flow). Within focused mode, the selected rail row is exposed as current, every row has an accessible name including its activity/unread state, and keyboard selection moves to the main work pane only on an intentional activation; Tab and Shift+Tab retain a predictable rail → work-pane order.

### Navigation and responsive behavior

- A selected Job Request is addressable by URL from the Jobs inbox. Opening a valid link restores that selection; changing selection updates the URL without a full page reload; an invalid, deleted, inactive, or not-currently-visible JR shows a plain not-found/closed state rather than silently opening another job.
- Existing `/requests` links must keep working and open the All jobs management view unless explicitly updated as part of this change. Existing agent-chat links to `jr-<id>` continue to open that same Rosie conversation.
- There is no separate standalone Conversations route today: Conversations is the global agent-panel picker. The inbox replaces neither the picker nor supplier/customer conversations; it is the Job Request-specific work view.
- On mobile, show the Jobs list first. Selecting one drills into its detail view; a clear Back control returns to the same list position and selection state. Do not attempt to squeeze a desktop split pane into a phone width.
- Continue honoring the app's existing signed-in admin access. This change grants no supplier/customer portal access and exposes no conversation outside the established web-chat permissions.

## Acceptance criteria

- Chris opens bare `/jobs` on desktop and sees the normal app shell with the active Jobs inbox landing, without an arbitrary first JR auto-opening. He selects an active Job Request and sees a focused workspace: that Job Request/thread list is the only left rail, the normal app menu rail is absent, and its detail/work area is beside it.
- In the focused workspace, Chris can use a labelled 44px Back control to return to the normal Jobs shell/navigation; the list returns at the selected row rather than losing his place.
- A valid `/jobs?jr=<id>` link opens that JR directly in the focused desktop workspace. An invalid/unavailable id is stated plainly and never opens a different JR. Browser Back from a focus session entered through Jobs returns to normal Jobs; changing rows while focused does not create a Back-stack trail through each row.
- Focused job work keeps the selected JR’s canonical Rosie conversation available through the established global AgentChat panel, with no embedded duplicate chat or extra right panel. New job and Notifications remain reachable in the focused top actions.
- Chris presses the existing New job request control and enters Rosie full-screen focused intake for one canonical `jr-<id>` thread; no second form, thread, upload path, or attachment store appears.
- Focused intake accepts ordinary chat text plus pasted/dropped text/data, files, and screenshots through the existing chat transport. Durable partial request details refresh only after Rosie saves them; the UI never invents details from a draft or attachment.
- On desktop, focused intake fills the workspace; on mobile it fills the screen. Its dedicated intake header has deliberate exit/back/cancel controls and is not constrained by the compact app-header work.
- A successful New action stores an exact same-tab reservation marker and updates the URL to the pending JR. Only that marker restores focused intake; markerless copied/reloaded `intake=1` on an existing active JR opens normal selected detail, while a markerless pre-record/no-row URL is honestly unavailable/intake-not-started rather than selecting another JR.
- Focused intake never auto-transitions because Rosie has persisted a record or an active line. Chris’s explicit exit/back/cancel is the only UI transition to normal selected inbox/detail; an ordinary active zero-line JR opened from the inbox is normal selected detail, never intake.
- If New cannot reserve/open the intake, Chris remains on the current inbox selection with a clear retryable error and no phantom rail row. A recoverable failure after an id is reserved must retry that same intake rather than quietly allocate a second JR reference.
- A new web message on `jr-<id>` moves that JR ahead of older activity and visibly marks it unread until viewed through the app's existing read behavior.
- A JR with no web transcript is still present and is ordered by its latest Job Request update rather than disappearing.
- Chris changes a JR status or edits it and its inbox row refreshes to show the new status and current activity order.
- Chris can switch to All jobs and still use the existing filters, line selection/bulk availability-request action, full request details, audit history, and deletion safeguards.
- Opening a copied Jobs-inbox link selects that JR; an unavailable JR does not redirect Chris to a different record.
- On a phone, Chris presses New and enters full-screen focused Rosie intake. Back/exit returns to the Jobs list or normal selected partial workspace without a cramped split view and without losing a saved partial JR/thread.
- On a phone, Chris opens an existing request from the Jobs list, uses Back, and returns to the list rather than a cramped split view. `/jobs?jr=<id>` is the mobile detail drill-in (not a desktop-style replacement rail); its 44px Back returns to `/jobs` and the normal bottom navigation remains the app navigation.
- Supplier and customer conversations remain available only in the existing global Conversations picker and their established entry points.

## Out of scope

- Replacing Rosie's thread procedure, adding a second thread per JR, or merging supplier/customer conversations into a JR thread.
- Changing the Job Request lifecycle/status vocabulary, creating Orders, or changing supplier/customer portal behavior.
- Applying the compact-header requirement to the focused intake header; its identity, exit and intake controls are purpose-specific.
- Per-person cross-channel unread tracking, notification rules, or treating Telegram traffic as web-chat messages; those require the staged activity semantics decision below.
- Rebuilding All jobs' record-management behavior.
- Changing Rosie's intake/thread workflow, notification semantics, or the app’s global agent-panel behavior outside the focused Jobs shell.
- An automatic intake-to-workspace transition or the atomic/pending Job Request model that would authorize one; Bhoumik owns that staged workflow decision.

## Assumptions

- “New messages” in this first UI slice means messages recorded in the existing web-chat transcript for Rosie's `jr-<id>` thread. The existing team-panel read cursor supplies the initial unread cue; it is not a per-user read receipt.
- “Active” follows the currently implemented open Job Request set. The forthcoming lifecycle decision may rename/redefine that set; Nova should keep this UI adaptable rather than hard-code a future sales-stage policy.
- `photo_274.jpg`, `photo_275.jpg`, `photo_277.jpg`, `photo_279.jpg`, `photo_281.jpg`, `photo_284.jpg`, `photo_312.jpg`, and `photo_314.jpg` are visual direction. The latter two were referenced in the Nova handoff but were not available in Lily's Telegram inbox at write time; the explicit behavior above is canonical.
- The current app reserves an id then opens Rosie, and Rosie creates the row during intake. The UI preserves that truthful pending state unless Bhoumik approves an atomic record-and-thread creation change. Until then, manual exit—not a record or active-line threshold—ends focused intake.

## Open questions

- None blocking the UI slice. Bhoumik owns the staged question of durable, cross-channel activity/unread semantics and any lifecycle boundary changes.

## Handoff log

- 2026-08-29 — routed to Nova as a UI/UX slice. The companion workflow/data semantics requirement is staged for Bhoumik.
- 2026-08-29 — clarified focused desktop shell for Nova: bare `/jobs` is the ordinary-shell no-selection inbox landing; the JR/thread rail replaces (never sits beside) normal app nav only for a selected JR; Back restores normal Jobs; direct selected-JR URLs are focused; mobile remains a detail drill-in. The existing global AgentChat remains the one Rosie panel, with no embedded duplicate.
- 2026-08-29 — Nova accepted the canonical focused desktop shell; implementation will follow the current Suppliers filter integration to avoid shared-worktree overlap. Nova is auditing the live Jobs shell/history/chat wiring; mobile stays the established normal-shell drill-in.
- 2026-08-29 — resolved audit boundary: preserve shipped manual-exit-only intake. No auto-transition on record/line creation pending Bhoumik’s atomic/pending-model decision. Same-tab reservation marker is required for intake; markerless existing-JR `intake=1` is normal selected detail, markerless no-row is unavailable, and ordinary active zero-line JRs are normal detail.
