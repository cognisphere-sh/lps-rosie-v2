# Open compact Job filters only when needed

- Status: routed
- Route: nova
- Raised: 2026-09-11 by Chris (via Nova, Telegram 588–589)
- Updated: 2026-09-11
- Related: `mobile-all-jobs-toolbar` (prior card/toolbar work; mobile Item Status omission remains)

## Problem

The mobile All Jobs Filters sheet makes Chris scroll past every Status, Customer and date-range option even when he is not changing them. Closed work also occupies a fresh Jobs view that he expects to show open work first.

## Evidence

- Chris, message 588: “Can we optimize for screen space. Lets try making these drop downs with selection. Press to select. If multi like status select and deselect with highlights. At opening of jobs view preselect/ show only only open status. So closed won or lost should be hidden.”
- Photos 588–589 show full-height Created/Updated radio lists and Status/Customer checkbox lists; the current six displayed Sales labels are Active, Quote, Availability, Confirmed, Won, Lost.
- Source/docs review confirms one shared All Jobs filter state across mobile/desktop, tab-scoped restoration, immediate filtering, and a mobile sheet with all options expanded. Mobile Item Status already has separate ignored/parked desktop state.

## What it should do

### Compact mobile selectors

Keep the existing Filters sheet, with four initially collapsed, press-to-open controls in this order: **Status, Customer, Created, Updated**. Each has its name, a truthful current-selection summary and a minimum 44px trigger. Closed controls occupy compact rows, not the height of their option lists.

Status is multi-select, in exact current order **Active, Quote, Availability, Confirmed, Won, Lost**. Each press toggles the selected state with a visible highlight plus checkmark and corresponding accessible state; colour alone is insufficient. The options remain open for successive choices. At the default selection its summary may read **Status · Open (4)**; changed subsets show the selected name or selected count, never simply “Open.”

Customer retains the existing multi-select meaning and matching. Open a bounded selection list, with local option search for the existing long customer list. Search narrows the choices shown, not the selected customers or Job results on its own; selected customers survive option search. Closed summary shows All customers, the selected customer or a count. Do not change customer identity or matching as part of this layout.

Created and Updated each retain one choice: All time, Today, Last 7 days, Last 14 days, Last 30 days. Their closed controls show the selected range; choosing a range closes that selector, not the whole Filters sheet. The existing rolling parent-request date meaning is unchanged.

Only the selector being used expands. Selection updates filters immediately as today; do not add a draft/Apply transaction, stacked modal or new confirmation. Pressing a trigger again, selecting another group, tapping outside that selector, or Escape can close it without losing selections. Nested Escape closes the selector first and restores its trigger focus; a later Escape closes the sheet. Keep explicit Close, sheet backdrop dismissal, focus containment and return focus. Long lists must scroll within available sheet/viewport space without hidden choices, clipped menus or sideways scrolling; search and the on-screen keyboard must not strand Close/reset controls.

### Open-work starting view for All Jobs

On a **fresh All Jobs entry with no usable saved selection**, preselect **Active, Quote, Availability, Confirmed** and exclude Won/Lost. This starting/default reset rule applies to the shared All Jobs list on mobile and desktop; compact selector styling is mobile-only. It is a presentation/query choice, not a lifecycle rule or a change to any Job record, focused rail or other app surface.

Fresh means no usable filter-state restoration, not every render, refetch, resize, navigation return or browser refresh. Preserve deliberate status subsets, Won/Lost inclusion and explicit unrestricted selections when refreshing or restoring this tab. Existing valid saved all-six selections have no reliable intent marker; preserve them rather than guess they were the old default. Retain the established intent of recognized legacy saved selections while displaying only current labels. Invalid/missing state falls back safely to the open-work baseline; it must not accidentally become an unrestricted query.

Use the current Clear all filters / Clear all action to **reset the view to that open-work baseline**: empty Search, All customers, All time for both dates, first result page and no filter deviations. Make that reset meaning explicit with concise helper text such as “Resets to open jobs.” It is an intentional reset, not something done on a refresh. Mobile reset must leave the parked desktop Item Status choice alone; desktop reset retains its normal item-filter clearing behavior.

Preserve the existing explicit **All statuses** unfiltered choice and empty-selection meaning, including legacy history handling; it must visibly read All statuses/unrestricted, never “None selected” while returning every status. All statuses is not the fresh-entry default or the reset state. An explicit selection of Won/Lost or All statuses stays in effect until the user changes/resets it.

The Status group counts as zero deviations at the exact four-open-stage baseline and one when it differs, including unrestricted or all-six selections. Other groups retain their existing count meaning. Selected summaries, option states, badge/deviation indication and effective results must agree, including restoration and mobile/desktop crossing. Mobile Item Status remains absent from the sheet, accessibility tree, query, results constraint and badge; its desktop state stays isolated.

## Acceptance criteria

- At 320px, 390px and 480px the initial mobile Filters sheet has four compact closed controls, not long exposed checkbox/radio lists; each trigger and selectable option has a minimum 44px target.
- Status shows only Active, Quote, Availability, Confirmed, Won, Lost in that order. Multi-selection has highlight, checkmark and truthful accessible state; successive changes remain possible without reopening the selector.
- Customer option search preserves selections, matching and result scope; long names and lists remain usable.
- Created/Updated each allow exactly one existing range or All time; their closed summaries match the query and choosing one leaves the sheet open.
- Opening/closing selectors never applies an extra reset or loses focus/selection. Keyboard/touch QA verifies nested Escape, Tab/Shift+Tab containment, sheet Close/backdrop and restored trigger focus.
- Fresh first-entry mobile and desktop queries include exactly the four open stages. No Won/Lost appears unless intentionally selected/restored; this writes no Job status.
- Deliberate Won-only, mixed, all-six and unrestricted selections survive refresh, revisit and mode crossing. Valid preexisting saved all-six state is retained. Missing/malformed state receives the open baseline rather than unrestricted results.
- Recognized older saved-selection migration retains its prior inclusion intent; changing the default does not silently strip deliberately selected Won/Lost.
- Clear/reset returns open stages, clear Search/customer/dates and page one; the Status deviation count returns to zero. Reset text distinguishes open-work reset from unrestricted All statuses.
- Every applied non-default Status subset/unrestricted state counts as one Status deviation, not a count of chosen statuses; summaries/checks/badges/results agree after each action.
- Mobile Item Status remains omitted/ignored, and mobile reset does not erase parked desktop Item Status. Desktop layout and ordinary selector interactions remain unchanged apart from the expressly shared initial/reset baseline.
- Rendered before/after QA at 320/390/480 plus desktop covers long labels/customer lists, each selector open, keyboard-visible scrolling, close/reset access and 899/900 mode crossing. Unit/state tests alone are not visual acceptance.

## Out of scope

- Status vocabulary/model, stored statuses, lifecycle, availability responses, permissions or money changes.
- Changing date/timezone/window meaning, request order, server paging limits, customer matching or unfiltered/legacy-history API behavior.
- Global defaults for other screens, forced reset of existing sessions, desktop layout redesign, a new Apply workflow or supplier/customer sends.
- Reopening card/focused-Job design or the separate mobile Item Status decision.

## Assumptions

- Chris’s general “At opening of jobs view” instruction covers the shared All Jobs list at both widths; his screenshot-driven selector compaction is mobile-only. It does not authorize changing other Jobs-related surfaces.
- Preserving ambiguous saved all-six intent is safer than forcibly converting existing sessions. Reset offers an explicit way to adopt the new open default.

## Handoff log

- 2026-09-11 13:02:27 CDT — Nova relayed the exact wording: the opening-default clause says Jobs generally, while both references are mobile. Read-only audit complete; routed this full narrow follow-on to Nova, including saved-state migration and nested-focus caveats. No Lily implementation or production writes; concurrent operator work must be preserved.
- 2026-09-11 13:06:17 CDT — Nova accepted and delegated to `compact-job-filter-selectors`: preserve legacy/all-six/unrestricted intent independently of fresh/reset defaults, nested Escape and mobile Item Status behavior. Owner uses an isolated candidate worktree and stops on overlapping operator edits; no live build/deploy before exact technical and visual gates.
- 2026-09-11 13:38:04 CDT — Nova reports isolated nine-path candidate frozen for independent review: 43/43 focused tests and typecheck pass. Full suite has six CSS/token failures also reproduced on clean `c954d13`; reviewer is distinguishing baseline failures from candidate defects. Release is not green: no integration, commit, deployment or browser/visual QA yet. Original operator files/index remain untouched; status stays routed.
