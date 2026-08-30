# Put Supplier filters in one place

- Status: routed
- Route: nova
- Raised: 2026-08-29 by Chris (via nova handoff)
- Updated: 2026-08-29

## Problem

The Suppliers screen makes the same filtering job appear in two places: its top toolbar and the table headers. This spends scarce vertical space and makes it unclear which control should be used, while City has just been removed from the toolbar but remains in a header widget. Chris wants one compact Suppliers toolbar, not duplicate toolbar and table-header filters.

## Evidence

- 2026-08-29 feedback log, **One Suppliers filter surface**: Chris asked for one compact toolbar and no duplicated toolbar plus table-header filters.
- App review: `/suppliers` currently has broad search plus Type, State, and LPS Partner toolbar controls, while every filterable table header can also host a filter widget. Its City toolbar control was removed in Nova’s uncommitted cleanup, leaving City only in the header.

## What it should do

Give `/suppliers` one filter surface: a compact toolbar above the results. The default desktop row is one line: broad Search, a clearly labelled Filters control, any active-filter summary/chips, the shown/total company count, pager when needed, and existing Notifications. It must not grow a second utility row or duplicate any filtering control in the table header.

Selecting **Filters** opens a focused filter surface rather than expanding the toolbar inline. On desktop, it is an anchored popover from the Filters control: the table stays visible, the control remains the clear anchor, and the default toolbar stays one line. On mobile, the same control opens a screen-edge filter drawer/sheet with a clear Close action, so fields are not constrained by a narrow popover and every control is comfortably touchable. Closing either surface keeps selected filters applied; it does not discard them.

The advanced surface contains exactly these Supplier-list filters:

- **Name contains** — a strict name-only contains match, distinct from broad Search.
- **City** — a searchable multi-select of matching cities.
- **Type** — a searchable multi-select of supplier types.
- **State** — a searchable multi-select of matching states.
- **LPS Partner** — the mutually exclusive choice of LPS Partners or Not partners.

The broad Search remains the existing broad, typo-tolerant search across its present supplier/contact/location fields; it is not relabelled or narrowed to name. The advanced Name contains control is the deliberate exact-field alternative.

Active selections are represented once in the compact toolbar after the Filters control, as readable chips/summary rather than duplicate fields. The summary must make active criteria discoverable, including more than one value for a filter, and the existing Clear all clears both broad Search and every advanced selection. The filter surface itself may offer a way to clear an individual criterion without creating a second active-control surface.

Table headers retain their column labels, current sorting behavior and column layout controls, but no header renders a filter text box, dropdown, or other filter widget. Existing company grouping, matching-farm expansion, cards, row actions, and pagination remain as they are.

This is presentation/consolidation only. It preserves the existing Supplier query and API filter meanings, including location-level filtering before company grouping, server-side totals/pages, current sort behavior, and the existing active-filter reset to page one. It does not alter supplier data, matching rules, routes, or agent threads.

## Acceptance criteria

- On a normal desktop Suppliers view, Search, Filters, active-filter summary/chips when present, shown/total Companies, pager when applicable, and Notifications fit in one toolbar line at the supported default desktop width; no second toolbar or generic header is introduced.
- The toolbar has one labelled, keyboard-accessible Filters control with a usable 44px target; opening it on desktop shows an anchored popover and does not force an inline toolbar expansion.
- On mobile, activating Filters opens a touch-usable drawer/sheet with an explicit 44px Close action; it is not a cramped desktop-style popover.
- The advanced surface offers Name contains, City, Type, State, and LPS Partner, and no Supplier-list filter is exposed as a table-header widget.
- Broad Search retains its current broad/typo-tolerant behavior; Name contains affects supplier name only and is visibly distinguished from it.
- City, Type and State retain searchable multi-select behavior; LPS Partner retains the mutually exclusive LPS Partners / Not partners choice.
- Applied filters are shown once in the toolbar as readable active state, including multi-value selections; closing the popover/drawer leaves them applied.
- Clear all clears broad Search and all advanced filters, restores the unfiltered Supplier list, and returns the result set to its first page.
- Applying, changing, or clearing a filter preserves existing query/API semantics: filtering occurs before company grouping, totals and pages describe the filtered company set, matching farm counts remain truthful, and pagination resets as it does today.
- Supplier table headers retain labels, sorting, resize/reorder behavior and column picker, but contain no filter text box, dropdown, or duplicate filter control.
- Company rows, nested farm rows, mobile supplier cards, agent-chat actions, hiding/restoring rows, and existing paging continue to work with filtered results.
- All new/changed controls are keyboard operable, announce useful accessible names/state, meet a 44px usable touch target where interactive, and remain readable in light and dark modes.

## Out of scope

- Changing what broad Search matches, supplier data, API contracts, filter matching rules, grouping, sorting, pagination size, or URLs.
- Adding new supplier attributes or qualification/workflow filtering.
- Changing Plant Search, Customers, or other screens’ filter layouts.
- Changing the City cleanup’s underlying data/query behavior; this consolidates its placement with the other Supplier filters.

## Assumptions

- An anchored desktop popover is preferable to an inline expansion because Chris’s primary complaint is duplicated and space-consuming control chrome; it preserves a compact one-line scan surface while the table remains in context.
- A mobile drawer/sheet is preferable to a popover because five filter groups plus searchable option lists need a dependable, touch-sized surface.
- Active chips/summaries can reuse the existing filter state; no persistence or URL-state change is needed for this UI-only work.

## Open questions

- None.

## Handoff log

- 2026-08-29 — Drafted after reviewing the Suppliers page, filter/query behavior, current toolbar/header controls, and Nova’s uncommitted City cleanup.
- 2026-08-29 — Routed to Nova by Lily main; approved UI/UX work is ready to build, including the City-cleanup alignment.
