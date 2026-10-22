# Keep routine Job statuses visible and rare filters out of the way

- Status: drafted · private preview delivered; awaiting Chris review, no app build authorization
- Route: nova (design discussion only; no implementation handoff)
- Raised: 2026-10-22 by Chris (Nova relay, Telegram809/photo809)
- Updated: 2026-10-22
- Related: `all-jobs-compact-filter-selectors` (older mobile-only queue; not proof of delivery)

## Problem

On All Jobs, routine Sales-status switching shares a toolbar with rarely used Item status, Created and Updated controls. Chris asks for a better way to switch statuses and explicitly wants the three rare filters nested behind a filter icon. He has not selected a final layout or authorized code/global filter changes.

## Evidence

- Nova10:57:36 relays Chris809 at10:57:11; initial Lily input is a summary, not a verbatim quote. Screenshot read in place at `../nova/plugins/telegram/inbox/photo_809.jpg`: desktop All Jobs, Search jobs, Expand all, Committed selected, Item status · 7, Customer, Created, Updated, Clear all, New job request and notification action. It is a list toolbar, not the editable status on each Job card.
- Nova10:59 confirms no explicit desktop-only instruction. Status chips, a secondary popover/active badge and a mobile horizontal row were Nova’s suggestions, not Chris’s approved layout.
- Bounded October22 current source review establishes independent multi-selection, not exclusive tabs; current choices Quote, Availability, Committed, Won, Lost. See current contract below. No live/browser verification was performed.

## Approved need versus proposed design

**Explicit need:** improve routine status-filter access and nest rarely used Item status, Created and Updated behind a filter icon. Preserve current filtering and the existing mobile Item Status omission.

**Recommended minimal design, pending Chris review:**

- Search remains visible. Routine Sales statuses become a labelled group of compact independent toggle chips: **Quote · Availability · Committed · Won · Lost**. Checked/pressed styling plus a non-colour selection cue makes multiple selections obvious. These are not exclusive page tabs.
- On desktop, place the status group next to Search; retain Customer visibly available since Chris did not identify it as rare. A labelled/icon-only Filters trigger opens Item status, Created, Updated. Keep Expand/Collapse and New job/notification actions as actions, not filters.
- On mobile/constrained widths, retain visible Search and show all five primary status choices in a compact wrapping row beneath it if needed. Do not bury routine statuses or rely on an offscreen horizontal row that hides choices. This responsive arrangement is a proposal, not a chosen Chris layout.
- Secondary Filters receives an active-group badge only for effective nested deviations: desktop Item status differs from all seven and/or a Created/Updated range is set. All seven Item statuses selected means no Item-status deviation; no Item statuses selected is an active restrictive group. Each date contributes one. Primary Sales statuses and visible Customer do not inflate a secondary-only badge.
- Mobile Filters continues to omit Item Status and ignore parked desktop Item Status; it may expose Created/Updated and, if required by space, the unchanged Customer selector. Customer placement on compact layouts remains a design detail to review rather than a new matching rule.
- Keep existing Select all/Deselect all and global Clear/reset reachable. No second Apply flow or new filter state model. Do not add per-status result counts or new presets without a separate need.

## Current contract to preserve (source review, 2026-10-22)

- Sales Status is multi-select: Quote, Availability, Committed, Won, Lost. Initial/reset selection is Availability + Committed, not all open Jobs. Any combination including Quote/Won/Lost remains available.
- Select all selects all five; Deselect all means none and sends `status=none`, returning no Jobs. Never treat empty as unrestricted. This toggles list selection only, not a record status.
- Desktop Item Status is also multi-select with seven current options. All selected omits the item constraint, empty sends `itemStatus=none`; mobile omits the control and effective constraint, parking desktop selections for return. Do not introduce Item Status on mobile as a side effect of nesting.
- Customer retains multi-selection and existing empty=All customers meaning; Created/Updated remain single rolling parent-request windows: All time, Today, Last7/14/30 days.
- Search remains the same debounced filter: plant-line name, customer name/company/email or numeric/JR reference matches. Do not promise new Job-name full-text search from the short Search jobs placeholder.
- Query, filter selections and page restore through tab-scoped session state `lps.requests.visit.v1`, using the current normalizer. Preserve intentional all/none/subsets, reset, saved-page validation and existing page-one change behavior. The UI currently encodes criteria in API requests; this proposal adds no browser URL/deep-link persistence scheme.
- Global Clear resets Search/customer/dates and Sales to Availability + Committed; desktop also resets Item Status to all seven, mobile leaves parked desktop Item Status alone. Keep current paging limits/order and API/storage semantics.
- Current docs are partly stale: the opening paragraph agrees with the source baseline, but the mobile-toolbar paragraph still says five initial stages and cleared status includes Archived. Source explicitly uses Availability+Committed and empty=none. Do not revive those doc claims as design requirements.

## Proposed acceptance outcomes (not yet build-approved)

- Chris sees Search and all five primary Sales choices without opening secondary Filters; he can independently include/exclude multiple stages with clear visible and assistive-technology state.
- Rare desktop Item status/Created/Updated controls are absent from the primary strip, available behind Filters with truthful selected summaries and an effective-secondary-filter badge. Customer and essential actions remain reachable without becoming new filters.
- Current default, select/deselect-all, explicit empty result, global reset, saved selections/page, mobile parking and API behavior remain identical before/after layout change. Opening or closing Filters never clears selections.
- At 320/390/480 and desktop/constrained layouts, full status labels remain discoverable, Search is usable, long customer labels do not displace actions, and no primary choice disappears into unannounced clipping. Multiple rows are preferable to shrinking touch targets.
- All toggles/triggers are at least44px with native checkbox or `aria-pressed` semantics in a labelled group; do not use tab/tablist roles for independent filters. Keyboard order, Enter/Space, focus indication, Escape/dismissal and return focus are clear.
- A bounded secondary popover/sheet fits the viewport with usable scrolling and explicit mobile dismissal; the existing sheet/focus pattern is reused where appropriate, not stacked modals/Apply.
- Before any later shipment, independent current technical and rendered visual review must cover primary multi-selection and nested active states at 320/390/480 plus desktop. This task supplies no build/test/browser/release evidence.

## Out of scope

- Build authorization, applying any September candidate/patch, price UI, record/status/workflow/schema/DB changes, new defaults, query/search semantics, URL/storage/page behavior, or supplier/customer communication.
- Treating a desktop screenshot as an instruction to change desktop only, or silently reintroducing mobile Item Status.

## Assumptions and review boundary

- This is a new primary-versus-secondary toolbar design discovery. It overlaps the older mobile compact-selector goal but differs from its old all-controls-inside-sheet layout. Keep that old queue referenced, not silently combined or declared shipped.
- Parent Telegram380 delivered the layout proposal and asked “Shall we use that layout?” Chris814 subsequently requested a preview before commit. Nova already assigned ONE static PRIVATE desktop/mobile design mock owner; await its artifact URL/images and technical/visual representation notes. No duplicate preview builder or source audit. Preview authorization does not approve the layout, badge formula or UI implementation; no app source/runtime business data, app commit or deployment before Chris review. Existing multi-select/query semantics remain unchanged. This scope is All Jobs only, not Supplier Portal Chat812/contrast or price UI.

## Handoff log

- 2026-10-22 10:59 CDT — Current source and screenshot review completed; internal proposal shared with parent and Nova main for discussion only. Explicit rare-filter nesting need recorded; exact visual layout and build remain unapproved. No implementation, tests, browser or DB work.
- 2026-10-22 11:01:51 CDT — Parent confirms actual Telegram380 receipt: visible Search, primary multi-select status buttons, mobile wrapping, desktop Customer and secondary rare Filters/badge proposed to Chris with “Shall we use that layout?” Awaiting layout decision. Exact badge formula remains a proposal detail; no UI build route, approval or real-test claim.
- 2026-10-22 11:53:08 CDT — Parent relays Nova11:52:57: Chris814 at11:52:13 replies to811 asking for a preview before commit; relay spacing is not literal-original verified. Nova815 acknowledges private desktop/mobile DESIGN preview and has already delegated one static private-artifact mock. Private preview only is authorized; no application source/runtime data changes, app commit/deploy or layout/UI implementation approval. Nova coordinates artifact delivery; await URL/images and technical/visual representation notes.
- 2026-10-22 11:57:16 CDT — Parent relays Nova11:57:06: private static preview published at https://lps.cognisphere.sh/a/nova/private/artifacts/all-jobs-toolbar-design and shared with Chris via Nova816 replying to814. Nova reports captures at1440/320/390/480 and browser closed. Actual artifact path/source verification report remains pending. Delivery/captures are not independent QA, full-app acceptance, layout approval or app implementation authority. Await Chris review before any app build; no live data, app commit or deployment, no Lily browsing/audit/new mock or duplicate question.
