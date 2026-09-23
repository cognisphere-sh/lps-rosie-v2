# Remove chats from mobile Job list cards, not the Job's useful context

- Status: routed · current owner ISOLATED IMPLEMENTATION on HEAD + preserved operator-byte REVIEW overlay only; UNVALIDATED runner HOLD, QA/integration/release blocked
- Route: nova
- Raised: 2026-09-22 by Chris (Telegram718 via Nova)
- Updated: 2026-09-22T15:44:06-05:00
- Related: `mobile-all-jobs-toolbar` (earlier card scope), `all-jobs-compact-filter-selectors` (separate filters), `mobile-conversation-navigation` (held future idea, not this change).

## Problem

Chris's current phone All Jobs list spends scarce card space on several chat entry points. Contact/notes and supplier/AR context are squeezed beside them, making scanning and opening work awkward. Chris explicitly asks to remove chats from this mobile view; this is not a claim that the conversations themselves are redundant or broken.

## Evidence

- Chris718 at2026-09-22T15:35:04-05:00: “lets remove the chats from this mobile view. it clearly doesn’t work”. Photo718 shows All Jobs search/filter, JR-59/JR-55/JR-62 cards, supplier AR links and global bottom navigation.
- Nova719 acknowledgement, relayed15:35:42: inline chat buttons/avatars removed from **mobile Job list cards only**, reclaiming room while keeping Job details and AR links.
- Feedback **Remove chats from mobile list cards**; retained visual reference `workspace/threads/main/files/mobile-job-card-chat-reference-718.jpg`.
- Bounded current source/image mapping: `workspace/threads/main/tasks/mobile-job-card-chat-controls/source-check-2026-09-22.md`. Shared list/focused header reuse makes focused-mobile isolation essential. Working tree is not clean and no served-app identity was verified.
- Earlier focused-header chat-removal/consolidation was withdrawn after Chris recognized different threads. That remains withdrawn for that surface; it does not cancel this new list-only request.

## What it should do

On **mobile All Jobs list cards only**, remove all inline conversation entry points: the Rosie avatar for the Job, the customer chat bubble beside the real contact, and supplier chat bubbles beside supplier/AR links. Remove their interactive and layout presence rather than hiding pictures while leaving clickable/focusable blank controls.

Keep the useful card content and established actions: real customer/person identity and its current profile link, current customer-note preview, supplier identity/grouping and every linked AR entry, Job identity/open-details route, status, recorded scheduling/fulfillment information, item count/subtotal, and existing available edit/detail actions. A label that also opens chat must lose only that chat behavior, never the identity; inspection currently finds separate identity links and chat buttons, so no identity deletion is needed.

Give the remaining summary, customer/notes and supplier/AR content the freed width. Allow sensible responsive wrapping instead of retaining avatar-sized holes, empty separators or a narrow AR column forced alongside a fixed customer block. This is not a mandate for a rigid two-row card, a fixed height, expanded plant details or new navigation. Keep notes' existing audience/content and established full-detail access.

Leave desktop list cards, focused Jobs on both mobile and desktop, Customers, supplier/portal chat surfaces and global Alerts/Customers/Jobs/More/Agents navigation unchanged. All separate existing conversations, messages, permissions, context and routing remain intact. Removing list buttons must not delete/merge chats, create threads, send a message or change read state.

## Acceptance criteria

- At **320, 390 and 480 CSS pixels**, mobile All Jobs cards show no inline Rosie Job avatar, customer chat bubble or supplier chat button. There are no invisible/disabled leftovers in keyboard order or the accessibility tree and no blank clickable chat regions.
- The contact name/company fallback and current customer-profile destination remain; note previews retain their correct original text/audience and existing detail access. Test a linked person, company fallback/unassigned customer, absent notes and long notes. No missing data is invented.
- Each supplier remains identifiable and **every** linked AR remains a distinct reachable control opening the same authorized request as before. Test no suppliers, one supplier, multiple suppliers and multiple ARs for one supplier, including long labels. A chat-only supplier still retains its identity if it has no AR entry; do not add a replacement chat action.
- Job identity still opens the same full Job. Available edit/detail actions, status, recorded date/fulfillment displays, totals and safe deletion through the existing detail/action path retain meaning and behavior. Current Jobs search/filter/list-state, filtered totals and floating create action remain unchanged.
- Freed space actually belongs to the remaining content: no reserved avatar gaps/empty chat separators or needless empty strip; supplier/AR controls are not squeezed or clipped into an unusable column. No horizontal page overflow, overlapping content or blocked bottom/create controls. Long content can wrap or use its established deliberate preview treatment; full facts/actions remain accessible through existing destinations.
- Remaining affected controls have clear accessible names, visible keyboard focus and usable minimum-44px mobile touch targets without expanding unrelated screens. Touch, keyboard and assistive-technology checks distinguish identity/profile actions, AR navigation and Job details; none invokes a removed chat interaction or thread-resolution request.
- Check initial mobile load/hydration and **899↔900px** crossing in both directions, including repeated resize and desktop expansion state. Only mobile-list chat controls disappear; desktop chat controls return with original destinations. Focus must not remain on a removed or hidden element, jump into unrelated work, or create a ghost/duplicate control.
- At the same mobile widths, **focused Job** controls/chats remain exactly available as before; desktop collapsed and expanded list cards retain their existing chat destinations and actions. Customers/portal chat and bottom global **Alerts, Customers, Jobs, More, Agents** remain available and unchanged. No conversation content, routing, permission, read-state or sending changes.
- Nova's current owner records a fresh preserved baseline and isolates this scope from dirty operator work. Independent technical and **rendered visual** review of the exact final candidate covers all above sizes/states plus desktop, compares against photo718, and retains evidence. Passing tests/source review alone is not visual acceptance or deployment proof. Report deployed identity/runtime verification separately, or clearly report blocked/not released.

## Out of scope

- Focused-header redesign or revival of withdrawn chat consolidation; any global chat removal, multi-thread navigation project, new picker or new conversation.
- Removing person/customer/notes rows, supplier identity, AR access, current scheduling/fulfillment or detail actions merely to make cards shorter.
- Database/schema/migration, record-name rollout, new stored summaries/preferences, status or workflow changes; no supplier/customer contact or live data repair.
- Full AR main workspace/tabs/chat-switch remains **OPERATOR HOLD709** until new go-ahead. No bundling with held AR table candidates, supplier Past work or record-name rollout; their existing owner/baseline/release gates remain intact.
- Restoring old two-row/Pending/Rosie/omitted-date card designs from historical requirements or stale docs. This request is against current cards; all unrelated operator contracts are preserved.

## Assumptions

- “This mobile view” means All Jobs list cards shown in photo718, confirmed by Nova719, not all mobile conversations.
- Existing global Agents navigation and focused/customer/supplier surfaces are sufficient retained chat entry paths for this narrow UI change; no replacement feature or extra user question is needed.
- Wrapping remaining mobile content to use freed space is part of the approved UI correction, not permission for a wholesale card redesign.

## Open questions

- Current owner reports fresh HEAD7c756c8 plus an enumerated tracked app/docs operator-byte overlay as an **isolated implementation/review baseline only**, with an independent manifest. Three nonoverlapping record-name hunks in shared Job source must remain byte-preserved; this is not a clean shared base, production approval or operator commit. Same owner is implementing the list-context/mobile supplier-links delta. Manifest/candidate evidence remains for independent review; Lily has not verified it.
- **UNVALIDATED runner HOLD: no test execution.** QA remains blocked until the existing runner gate is cleared; no test reroute is authorized here. Future integration requires a compatible operator commit/rebase and fresh review of the exact candidate. No dirty deploy, held-bundle release or name-rollout clearance. No unresolved user-facing mapping or further Chris question.

## Handoff log

- 2026-09-22T15:36:37-05:00 — Chris718/Nova719 scope captured and all three chat-control types mapped in current source. Identity/profile link, note text and supplier/AR navigation are separate and must remain. Full requirement plus precise source mapping delivered successfully to Nova main for current-owner implementation. Fresh owner preservation/gates required; no Lily code, live queries, tests or release.
- 2026-09-22T15:44:06-05:00 — Nova15:43:27 owner-reported fresh7c756c8: list header/focused/Requests/All Jobs docs clean, shared Job source has only three nonoverlapping record-name hunks. Nova permits exact HEAD + enumerated tracked operator-byte overlay with independent manifest for **isolated review**, not production/operator approval. Same owner implementing; UNVALIDATED runner HOLD bars all test execution, QA/integration/release blocked pending the existing runner gate and compatible operator commit/rebase + renewed exact review. Parent Telegram356 already announced scope/not live. No extra user message, new test route or fresh Lily source/runtime audit.
