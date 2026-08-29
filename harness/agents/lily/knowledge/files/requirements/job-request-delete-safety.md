# Make deleting a job request safe on mobile

- Status: shipped
- Route: nova
- Raised: 2026-08-26 by Chris (via nova handoff)
- Updated: 2026-08-26

## Problem
On the mobile Job Requests list, the permanent-delete trash control for a collapsed job-request card sits in the card’s upper-right beside the Rosie/avatar control. Chris accidentally tapped it and says it is easy to fat-finger. Deleting a job request is especially costly because it permanently removes the request and related work.

## Evidence
- 2026-08-26 — **Job-request delete is easy to tap** in the feedback log: Chris said the trash control in `photo_220.jpg` was easy to fat-finger, he accidentally tapped it, and asked whether deletion should require a long hold.
- Nova’s 2026-08-26 screenshot audit identified the exact surface as the collapsed mobile JR-19 “Oak Grove Rd. planting” card, with the trash control beside the assignee/avatar.

## What it should do
On a collapsed mobile Job Requests card, move permanent request deletion out of the immediately tappable card header and into a clearly labelled secondary actions menu. Choosing Delete from that menu must open a deliberate, accessible confirmation that identifies the job request and makes the permanence and affected work clear before deletion happens. Long press may be considered as an additional touch affordance, but must not be the only way to reach deletion.

## Acceptance criteria
- On a mobile-sized Job Requests list, the collapsed-card header no longer places an immediately executable trash control beside the Rosie/avatar control.
- A user can still find request actions through a clear, tap-sized actions control and can choose Delete from it.
- Choosing Delete does not delete anything until the user completes a clear confirmation that identifies the request and says deletion is permanent.
- The confirmation preserves the existing warning about related work that will be removed, including lines, availability requests and their answers, and change history.
- A user who cancels or dismisses the confirmation leaves the request unchanged.
- The actions control, Delete option and confirmation can each be reached and operated with keyboard and screen reader, with unambiguous accessible labels.
- On touch screens, the actions control and nearby Rosie/avatar control have distinct tap targets and do not overlap.

## Out of scope
- Changing the clipped demand-summary strip also visible in the screenshot.
- Changing the permanent-delete policy, server deletion behavior, or line-item delete controls.
- Requiring long press as the only deletion method.

## Assumptions
- This safety work is limited to the whole-request delete control on collapsed mobile Job Requests cards; desktop behavior and expanded-card layout may remain unchanged unless Nova finds a shared control needs the same safe presentation.
- The existing deletion confirmation is the right point to retain the detailed impact warning, but its presentation may be improved as part of this UI/UX change.

## Open questions
- None.

## Handoff log
- 2026-08-26 — Routed to Nova with the requested mobile-safe actions-menu and confirmation behavior.
- 2026-08-26 — Shipped live by Nova in `c90a8d3`. Collapsed mobile cards now use a separate 44px Actions → Delete request path and accessible confirmation; live JR-19 QA passed without deleting data. Nova confirmed expanded mobile/desktop request delete, line-item delete, DemandSummary and server behavior are unchanged.
