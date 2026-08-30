# Make the Plant Search Cultivar selector a clear toggle

- Status: routed
- Route: nova
- Raised: 2026-08-30 by Chris (approved UI direction via Bhoumik/Lily handoff)
- Updated: 2026-08-30

## Problem

The Cultivar multi-select already holds the right choices, but its field/header and chevron do not make its open/closed interaction clear enough on touch. Chris needs the existing control to behave as a simple, dependable toggle without a redundant completion step.

## Evidence

- 2026-08-30 feedback log, **Cultivar selector toggle**: the approved direction is for the existing Cultivar field/header and chevron to be a 44px open/closed toggle, preserve selections, expose expanded state, return focus on close, and require no Done action.
- App review, Plant Search: Cultivar uses the shared multi-select and shares its selection state with the Cultivar column filter.

## What it should do

Keep the existing Plant Search Cultivar multi-select and its current selection/filter meaning. Make its existing field/header plus chevron a 44px control that toggles the option list open and closed. Selecting one or more cultivars keeps those choices and leaves the dropdown usable for further selections; closing it preserves them. The control exposes whether it is expanded and returns focus to itself when closed.

There is no Done button: changes apply through the existing selection behavior, and the same trigger closes the one dropdown.

## Acceptance criteria

- In Plant Search, the existing Cultivar field/header including its chevron is one clearly labelled 44px-minimum toggle for opening and closing the Cultivar multi-select.
- The trigger exposes its open/closed state through `aria-expanded` and has an accessible Cultivar name that remains meaningful when selections are present.
- Selecting Cultivars preserves all selected choices and retains the current Plant Search/column-filter behavior; selecting a choice does not discard prior choices or require reopening a new control.
- Activating the trigger again, dismissing the dropdown, or using Escape closes it; when it closes, keyboard focus returns to the Cultivar trigger.
- No Done, Apply, or other completion button is added to this single Cultivar dropdown.
- Existing Cultivar option search, clear-selection behavior, shared toolbar/column selection state, other Plant Search filters, result matching, and API/query behavior remain unchanged.

## Out of scope

- Changing cultivar data, match rules, Plant Search filters other than this interaction, table layout, or server/API behavior.
- Adding a modal filter sheet, a new filter workflow, or a Done/Apply confirmation step.

## Assumptions

- “Existing field/header” means the current Cultivar trigger and chevron, not a new filter surface; its toolbar and column presentation continue to share the same selected state.

## Open questions

- None.

## Handoff log

- 2026-08-30 — Drafted from Bhoumik’s released no-change hold and explicit approved UI direction; ready for Lily main to route to Nova.
- 2026-08-30 — Routed to Nova by Lily main; awaiting build confirmation.
