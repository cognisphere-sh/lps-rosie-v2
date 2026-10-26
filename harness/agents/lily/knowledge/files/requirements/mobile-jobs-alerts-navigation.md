# Put Jobs first and Alerts beside a smaller mobile Search

- Status: drafted — clear UI intent; awaiting other-page Alerts fallback scope (parent Telegram385 delivered)
- Route: nova (not routed to build)
- Raised: 2026-10-25 by Chris via Nova (Telegram846, photo844, follow-up847)
- Updated: 2026-10-25 10:57:30 CDT

## Problem

Chris wants Jobs to be the primary mobile navigation destination and Alerts near the All Jobs Search rather than occupying its present first bottom position. The existing Search can give up some width, but moving a globally available control onto one list page must not make Alerts disappear from other mobile work.

## Evidence

- `telegram:-1004330045748:846`, 2026-10-25 10:54:07, exact Chris: “I would like to put Jobs first and think Alerts should go to the top by the search bar, which can be reduced in size.”
- Photo844 is the private All Jobs mobile reference, inspected in place without copying/publishing it. Wording846 supersedes arrow-only interpretation; it is not a totals move. Chris847 asks “thoughts?”
- Nova10:56:13 confirms recommendation848 actually delivered. Initial acknowledgment timed out/not delivered;847 was Chris, not Nova. Nova's consistent-header suggestion for other pages is NOT Chris's approval.
- Current bounded source has fixed bottom Alerts and Agents, with a horizontally scrolling page strip between them. Photo shows only its rightmost segment; existing hidden pages must remain reachable. All Jobs has Search + Filters; several other mobile surfaces have no Search/header.
- Source map: `workspace/threads/main/tasks/mobile-jobs-alerts-navigation/source-check-2026-10-25.md` (local snapshot only, not runtime proof).

## What it should do

On LPS Ops mobile, make **Jobs first/primary in bottom navigation**, retaining the existing All Jobs destination. On mobile All Jobs, put the existing **Alerts** bell and unread badge beside the narrower but usable Search. Retain the Filters action and do not introduce a second utility row, change totals, or turn this into the separate unapproved status/filter layout.

Preserve every other destination and its existing relative order. The smallest source-informed proposal is Jobs fixed first, Suppliers → Plant search → Photos → Customers → More retaining that relative sequence, and Agents remaining right. This is a presentation proposal, not a new chosen navigation model or desktop reorder.

Keep one effective Alerts control per visible mobile surface and preserve access throughout existing admin mobile work. **Other-page placement awaits Chris's answer to parent Telegram385.** Conservative proposed fallback: remove bottom Alerts only on All Jobs (where Search owns it), retaining bottom Alerts elsewhere. Do not remove it globally or redesign every header without that answer. Existing focused-intake exceptions stay unchanged.

Keep the exact current notification audience, unread-thread meaning, badge formatting/full accessible count, list/filter/Mark read behavior, click-through agent/thread, open/close behavior and existing read updates. Supplier Portal's separate supplier-facing notifications and all desktop behavior remain unchanged.

## Acceptance criteria

- At 320,390,480px and899px, Jobs is the first/primary bottom control and opens the existing All Jobs list; all remaining destinations are reachable in their exact existing relative order, with Agents retained at right. No unrelated nav reorder or disappearance from a scrolled strip.
- Mobile All Jobs has one usable Search + existing Filters + one Alerts bell/unread badge in the same compact top row. Search narrows without overlap, clipping, horizontal page scroll or a second utility band; totals, new-job action and cards retain their existing meaning/placement.
- Search entry, long text, existing clearing behavior, selection/caret and focus remain usable; opening/closing Alerts does not erase query, filters or list state. Touch keyboard/safe areas do not obscure Search, bell or its dismissible panel, and the existing keyboard-aware navigation behavior is retained.
- Every touched button has at least44×44px usable target, clear accessible name, visible keyboard focus and logical visual/tab order. Search remains legible in light/dark themes; unread badge does not collide with controls or clip at large full counts.
- Badge preserves unread-thread totals and current visible cap (`9+`) with full count accessible. Agent list filtering does not recalculate global badge; existing agent filter, Mark read/Mark all read, empty/list content, unread updates and exact thread click-through are unchanged. Merely moving or opening bell does not mark anything read.
- Alerts opens a reachable, independently scrollable viewport-safe panel anchored to its actual control; current Escape/outside-close/reopen/filter reset and click-through behavior remain intact. No duplicate interactive bells, hidden active controls, duplicate panels or stale off-screen anchors.
- Other admin mobile list/detail/Agents/chat/search-less surfaces retain their existing Alerts access according to the one approved fallback choice. No blanket new global header or supplier-facing exposure; focused-intake exceptions remain as before.
- Across repeated899↔900px transitions and unresolved hydration, only the correct interactive branch is available, no duplicate Alerts is introduced and query/filter/unread state is preserved. Focus is not stolen from unrelated controls/modals; desktop nav/header/search/notification controls remain unchanged at900px and wider.
- Independent technical and rendered responsive review covers320/390/480/899/900px, desktop, keyboard/touch/long search/full unread counts, other-page fallback and Supplier Portal isolation before any separately authorized release. These are required outcomes, not tests performed by Lily.

## Out of scope

- Global removal of bottom Alerts, every-header redesign or placement on search-less pages before fallback decision.
- Desktop or Supplier Portal nav/Alerts changes; reordering any other destination; new routes, default destination/login behavior or persisted nav preferences.
- Search/query/default/filter/saved-preference changes, status/filter preview381 (still unconfirmed), card/totals relocation or focused Job header changes.
- New notification types/count semantics/read persistence, API/DB/workflow/roles/agent-thread changes, sends or background behavior.
- CI implementation/audit/repair, pricing, Android band, print or other queued work.

## Assumptions

- Scope is internal LPS Ops mobile, below existing900px breakpoint, not Supplier Portal or desktop.
- Jobs first means immediately available as first/primary bottom action, not merely first inside a strip that can scroll it away. Keep the existing route; no new landing/default/saved order.
- Retaining other-page Alerts in its current bottom surface is the smallest safe fallback proposal; it is not treated as Chris's decision yet.

## Open questions

- Chris: on other mobile pages, retain Alerts in bottom navigation or move it to the top there too? Parent reports actual Telegram385 delivered2026-10-25 10:57:30 CDT; awaiting answer. No duplicate question and no extra “can we build?” approval request.

## Handoff log

- 2026-10-25 10:56:13 CDT — Exact846/847 plus attributed correction captured once. Bounded local source discovery only; Nova was told NO BUILD ROUTE. Nova848 recommendation is not a scope approval.
- 2026-10-25 10:57:30 CDT — Parent reports scope question385 delivered. Draft retained awaiting fallback; no builder assignment, implementation or release claim. Any later builder must use a fresh reviewed base that explicitly excludes or separately reviews unverified committed CI candidatea60; incident836 STOP/audit+interception-repair permission remains separately pending. This requirement does not authorize CI work or silent bundling.
