# Put desktop Notifications in their marked rail homes

- Status: routed — serialized behind the current desktop-shell deployment gate
- Route: nova
- Raised: 2026-09-10 by Chris (via Nova handoff; Telegram message 565 / photo 565)
- Updated: 2026-09-10

## Problem

On desktop, Notifications floats at the top-right of both the LPS Ops workspace and Supplier Portal. Chris marked the normal workspace rail's lower utility section—immediately above Settings and the rail utility/account area—as the Ops home. He separately marked the Supplier Portal rail at the supplier identity/avatar position as the portal home. The floating locations compete with page work and disconnect each notification surface from its own rail.

## Evidence

- 2026-09-10 feedback log, **Desktop Notifications move to rail** — Chris's marked message 565/photo 565 asks to move the LPS Ops desktop notification trigger from the floating top-right location to the marked lower-left rail position.
- 2026-09-10 feedback log, **Supplier Portal Notifications move to identity rail** — Chris's marked message 568/photo 568 extends the move to the desktop Supplier Portal at its supplier identity/avatar rail position.
- Current shell review: the LPS Ops control owns the shared all-agent unread list, badge/count, agent filters, Mark all read, click-through routing and open/close behavior. The portal's distinct control owns only supplier-facing request/chat alerts and their actions; it must never expose internal all-agent notifications. Each mobile app already presents its own fixed left **Alerts** bottom-bar action.

## What it should do

On desktop only, place the one **LPS Ops** Notifications trigger in the normal navigation rail's lower utility section, directly above Settings and the existing utility/account area. Place the one **Supplier Portal** Notifications trigger in its left rail's supplier identity/avatar region at Chris's marked position. Remove each former desktop floating/top-right trigger rather than leaving a second, hidden, or independently active notification control.

Each rail trigger remains an icon-led 44px minimum control with an accessible Notifications name. In an Ops collapsed rail it remains discoverable and usable as a compact control; in expanded rails it fits naturally at its respective marked location. Each unread badge/count remains truthful and visible without changing what its own surface counts.

Opening either rail trigger shows its existing notification panel anchored to that trigger rather than to a stale header position. The panel opens inward from the left rail (upward and toward the workspace where space permits) and clamps/repositions as needed to remain in the visible viewport. Its list remains independently scrollable at constrained heights; it must not be clipped by the rail or cover the trigger in a way that prevents normal close/reopen use.

Keep the existing **LPS Ops** unread notification behavior intact: agent filters, filtered Mark read / unfiltered Mark all read, unread previews, click-through to the correct agent/thread, keyboard operation, focus behavior, Escape/outside-close behavior, and unread/read updates. Keep the existing **Supplier Portal** notification behavior intact, including its supplier request/chat alert badge/count, panel content/actions and click-through to the relevant request or Local Plant Supply chat. The portal surface is strictly supplier-scoped and must never show internal all-agent notifications, filters, counts, or actions. Both mobile fixed bottom-left Alerts actions and their existing popover behavior remain unchanged.

This is a desktop presentation change only. It does not change chat transport, notifications, unread semantics, agent/thread routing, data, supplier-request workflow, or permissions.

## Acceptance criteria

- At desktop widths, LPS Ops Notifications appears once in the lower-left navigation rail directly above Settings and the existing utility/account area, while Supplier Portal Notifications appears once in its left rail at the marked supplier identity/avatar position; each former top-right/floating trigger is removed.
- Each desktop trigger has a minimum 44px usable target, a clear accessible Notifications name, keyboard operation and visible focus; the Ops trigger works in both expanded and collapsed rail states.
- Each unread badge/count remains visible and retains only its existing surface's meaning: all-agent unread for LPS Ops; supplier request/chat alerts for Supplier Portal.
- Opening either trigger renders exactly its own panel anchored to that rail trigger, opening inward/upward where space permits and otherwise staying wholly reachable within the visible viewport; no rail or viewport clipping makes its controls or list inaccessible.
- The LPS Ops panel preserves its existing unread list ordering/content, agent filters and counts, Mark all read / filtered Mark read behavior, independently scrollable content, and empty states.
- The Supplier Portal panel preserves its supplier request/chat alert content, count, independently scrollable content, empty state and existing actions/routing; it never exposes an internal agent notification, agent filter/count, or internal Mark-all action.
- Selecting an alert still opens the correct existing destination: the exact existing agent conversation/thread in LPS Ops, or the relevant Supplier Portal request / Local Plant Supply chat in the portal, with no duplicate routing action.
- Escape, outside click, focus handling and reopen/close behavior remain correct from both rail triggers, including after Ops rail collapse/expand and desktop resize.
- At widths below the existing desktop breakpoint, both apps' bottom-left **Alerts** actions and their behavior/placement are unchanged.
- No duplicate, invisible-but-active, or stale desktop notification trigger/panel remains after either move.
- The affected LPS Ops expanded/collapsed rail, Supplier Portal identity-rail, and both mobile Alerts regressions are independently visually reviewed at 320px, 390px, 480px and desktop under the existing UI release gate before deployment.

## Out of scope

- Changing unread definitions, notification data, agent chat transport, thread/request routing, read persistence, supplier permissions, or request/chat alert semantics.
- Combining the Supplier Portal notification surface with LPS Ops internal all-agent notifications.
- Changing either mobile bottom navigation or Alerts placement.
- Adding new notification types, settings, sounds, or workflow automation.
- Reworking unrelated rail destinations, Settings, Account, or the agent chat panel.

## Assumptions

- Chris's Ops marked spot means the lower desktop navigation rail position immediately above Settings and the utility/account area, not a new page-level sidebar. His portal marked spot means the supplier identity/avatar region of that portal's left rail.
- Each existing panel is retained as its own surface; only its desktop trigger and collision-safe anchor change. The Supplier Portal panel remains supplier-scoped rather than inheriting the LPS Ops panel.
- “Desktop” follows the app's existing 900px breakpoint. Each panel may use its existing compact width but must adapt position/height truthfully to the actual visible viewport.
- This combined change must remain queued behind the current exact visual-gated desktop-shell stack and deploy, as Nova confirmed, so concurrent rail/header work cannot create duplicate controls or regress the shared shell.

## Open questions

- None blocking the UI slice. Nova has confirmed it will remain queued until the current desktop-shell stack passes visual QA and deploys; it must not independently deploy against a stale shell revision.

## Handoff log

- 2026-09-10 — Formalized from Nova's handoff of Chris's Telegram message 565/photo 565 after current shell and notification behavior review.
- 2026-09-10 — Routed to Nova as a UI-only requirement, explicitly serialized behind the current desktop-shell deployment gate or a safe dependency-compatible release.
- 2026-09-10 — Nova accepted it and will keep it queued rather than fold it into the current exact stack. It waits for that stack to pass visual QA and deploy, preventing shared-shell duplication/regression. Nova reports reviewer credentials are absent as of 17:54 CDT.
- 2026-09-10 — Chris's message 568/photo 568 extended the queued UI slice to the desktop Supplier Portal: move its distinct supplier-scoped trigger from top-right to the left rail's marked supplier identity/avatar position. The portal panel must preserve only supplier request/chat alerts and must never expose internal all-agent notifications. Requirement amended; no new external handoff requested.
