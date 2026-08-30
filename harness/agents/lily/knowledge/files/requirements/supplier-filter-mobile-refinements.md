# Keep essential Supplier filters visible and mobile paging quiet

- Status: routed
- Route: nova
- Raised: 2026-08-30 by Chris (approved UI direction via Bhoumik/Lily handoff)
- Updated: 2026-08-30

## Problem

The new one-surface Supplier filtering direction is right, but putting every criterion behind one trigger makes the two most frequent scan filters—Supplier type and State—too hidden. On phones, the top page indicator also spends attention before Chris has reached the results. The filter sheet needs a deliberate mobile finish rather than a generic popover.

## Evidence

- 2026-08-29 feedback log, **One Suppliers filter surface**: Chris wants one compact Supplier toolbar rather than duplicated filter chrome.
- 2026-08-30 feedback log, **Supplier filter refinements**: the approved refinement keeps Supplier type and State visible on both desktop and mobile; Name, City, and LPS Partner stay nested; mobile uses a clear bottom sheet; and mobile paging moves to a quiet progressive result action.
- App review, `SupplierFilters`: all five criteria are currently inside the trigger’s mobile sheet. The shared toolbar currently displays **Page n of N** with previous/next controls wherever pagination is supplied.

## What it should do

Refine the Supplier list’s single filter surface without changing its existing matching, grouping, sorting, server paging, or data behavior.

- Keep **Supplier type** and **State** as visible, touch-usable controls in the Supplier toolbar on desktop and mobile.
- Make the advanced-filter trigger icon-only to save room while retaining an accessible name, tooltip, 44px target, and an active-filter count. It opens the remaining advanced criteria: **Name contains**, **City**, and **LPS Partner**. Do not duplicate Type or State inside that advanced surface.
- On mobile, advanced filters open as a modal bottom sheet: a visible handle and title; an explicit 44px X/Close action; swipe-down and backdrop dismissal as secondary exits; and sticky bottom actions for **Clear all** and **Show results**. Type and State remain visible outside the sheet.
- On mobile, remove the top **Page n of N** presentation and its page controls. Show loaded results normally, then offer a quiet bottom **Load 50 more** action when another bounded server page exists. Each activation loads the next 50 and appends/progressively reveals them; it is not an unbounded client fetch. Desktop pagination remains unchanged.

Existing broad Search, active-filter indication, selected values, Clear all semantics, and the desktop advanced-filter presentation continue to work. Clearing filters returns to the first result set as today.

## Acceptance criteria

- On desktop and mobile Suppliers, **Supplier type** and **State** are visible in the normal toolbar, each has a usable 44px interaction target, and their existing multi-select/filter behavior remains intact.
- The advanced trigger is icon-only visually, has a useful accessible name and tooltip, is at least 44px, and communicates the number of active nested criteria without relying only on color.
- Name contains, City, and LPS Partner are available from the advanced surface; Type and State are not duplicated there or in table headers.
- On mobile, the advanced trigger opens a modal bottom sheet with a visible handle/title, a 44px explicit X/Close action, backdrop and swipe-down secondary dismissal, and keyboard-accessible dialog behavior.
- The mobile sheet keeps **Clear all** and **Show results** visibly available in a sticky bottom action area while its fields scroll; Clear all resets broad Search and all Supplier criteria and restores the first result set.
- Closing the sheet by Close, backdrop, swipe, or Show results leaves any selected filters applied; no separate Done action is needed beyond **Show results** for this multi-criterion sheet.
- On mobile, the top toolbar does not display **Page n of N**, Previous, or Next paging controls. When more results exist, a quiet bottom **Load 50 more** action loads the next bounded page and preserves results already revealed.
- Mobile loading remains bounded by the existing server/page API; changing or clearing a filter resets the progressive result view to the first page and never mixes results from different filters.
- Desktop continues to show and use its existing pagination controls and server-side totals/pages.
- Broad Search, company grouping, matching-farm counts, sorting, desktop popover behavior, existing Supplier actions, and current query/API filter meanings are unchanged.

## Out of scope

- Changing Supplier fields, filter match meanings, broad Search coverage, supplier grouping, API contracts, page size, URLs, or qualification/workflow logic.
- Changing filter layouts on Plant Search, Customers, or other screens.
- Reintroducing table-header filters.

## Assumptions

- The active count on the icon-only trigger counts only the nested advanced criteria; visible Type and State show their own selected state.
- **Load 50 more** uses the existing page size and remains an explicit user action rather than automatic infinite scrolling.

## Open questions

- None.

## Handoff log

- 2026-08-30 — Drafted as a UI-only refinement to `supplier-filter-consolidation` after Bhoumik released the no-change hold; ready for Lily main to route to Nova.
- 2026-08-30 — Routed to Nova by Lily main; awaiting build confirmation.
