# Collapse the focused Jobs rail when Chris needs the work width

- Status: routed
- Route: nova
- Raised: 2026-08-30 by Chris (via nova handoff, Telegram message 407 / `photo_407`)
- Updated: 2026-08-30 (Chris refinement, Telegram message 414)

## Problem

In the selected desktop Jobs workspace, the 292px Active jobs rail is valuable for changing jobs, but it permanently takes room from the selected job’s details and Rosie work. Chris needs to be able to get that space back without leaving the focused Jobs workspace or losing the job he is working on.

## Evidence

- 2026-08-30, **Focused Jobs rail collapse**: Chris’s annotated reference asks for the left Active jobs rail to collapse fully, leaving a visible edge control to bring it back. The requirement applies to the focused Jobs desktop workspace only.
- `job-inbox-workspace` already establishes the focused desktop rail, its 292px width, selected-JR behavior, Back to All jobs control, and mobile drill-in behavior. This is a narrow usability refinement of that shipped/routed UI slice, not a new workflow.

## What it should do

- In a selected **desktop** focused Jobs workspace, let Chris collapse the 292px Active jobs rail completely so the selected job’s work/detail pane receives the released width.
- When collapsed, retain a clearly visible 44px minimum control on the left workspace edge that expands the rail. It must not cover, clip, or make the selected-job content unreachable.
- When expanded, provide a clearly visible 44px minimum collapse control in the rail. Move **Back to All jobs** into the Active jobs header as an icon-only, 44px minimum left-arrow control with a screen-reader accessible name (`aria-label`) but **no visible tooltip**. It remains independent of collapse; collapsing the rail is not leaving Jobs.
- Preserve the same active-job list, its ordering/unread cues, scroll position, current selected JR, URL/history behavior, selected detail state, open details/history drawers, and global Rosie chat state while toggling. A toggle is presentation only: it does not re-fetch, reselect, navigate, or reset intake.
- Persist this desktop rail preference per device using the app’s existing local browser-preference convention, separate from the normal app-navigation rail preference. Default to **expanded** for the focused Jobs rail so the inbox/workspace first remains discoverable; after Chris chooses collapse or expand, restore that choice on later focused desktop Jobs visits.
- Keep the existing focused desktop rail at 292px when expanded. Mobile behavior is unchanged: Jobs remains its existing list/detail drill-in and does not gain a collapsed desktop rail or new mobile control.
- Controls expose an accessible name, `aria-expanded`, and `aria-controls` pointing to the controlled rail; they are keyboard-operable with visible focus. Collapse/expand must preserve logical focus rather than leaving it on hidden rail content.

## Acceptance criteria

- On desktop with a selected `/jobs?jr=<id>`, Chris can collapse the 292px Active jobs rail and the selected job pane visibly receives the rail width.
- With the rail collapsed, Chris sees and can keyboard-operate a non-overlapping 44px edge control that expands it; job content remains readable and reachable.
- With the rail expanded, Chris sees and can keyboard-operate distinct 44px collapse and icon-only left-arrow Back controls in the Active jobs header. The Back control has a screen-reader accessible name but no visible tooltip, and still returns to All jobs using the existing route/history behavior.
- Toggling does not change the selected JR, URL/history entry, active-list ordering/scroll, selected detail/drawer state, or the docked/collapsed/full Rosie chat state.
- Chris’s last desktop choice is restored on a later focused Jobs visit; a first-time user sees the rail expanded. The ordinary app nav rail preference remains unaffected.
- Screen-reader and keyboard checks find correctly named controls with `aria-expanded` and `aria-controls`; focus never remains in content that has just been hidden.
- At widths below the existing 900px desktop breakpoint, the existing mobile Jobs list/detail behavior is unchanged.

## Out of scope

- Changing Jobs routes, active-job data, inbox ordering/unread rules, JR workflow/statuses, or Rosie/chat transport.
- Changing the normal app navigation rail, its saved preference, or mobile navigation.
- Altering the width/content of the expanded Active jobs rail, other than replacing the separate Back row with its header Back control and adding its collapse control.

## Assumptions

- The focused Jobs rail preference is local UI chrome and may use a browser-local, per-device setting, as the normal desktop nav rail already does; it is not an account-level or database preference.
- Expanded is the appropriate default because it preserves the established inbox-first focused workspace for someone who has not expressed a preference.

## Open questions

- None blocking this UI slice.

## Handoff log

- 2026-08-30 — routed to Nova as a desktop UI/UX refinement. It is intentionally separate from the existing normal navigation-rail preference and does not touch data or workflow.
- 2026-08-30 — Chris refined the rail header from `photo_409`: remove the separate Back to All jobs text row. Put its independent, icon-only 44px left-arrow control in the Active jobs header with accessible name/tooltip; preserve its existing route/history behavior.
- 2026-08-30 — Chris superseded the tooltip detail in Telegram message 414: the icon-only Back control retains its 44px target and screen-reader accessible name/`aria-label`, but has **no visible tooltip**. Collapse/expand controls are unchanged.
