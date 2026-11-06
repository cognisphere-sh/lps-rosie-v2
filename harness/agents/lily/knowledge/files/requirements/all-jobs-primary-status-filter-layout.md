# Put four routine Job-status buttons above Advanced filters

- Status: routed · SOURCE PLAN READY, execution BLOCKED; operator baseline/836 authority pending, not built/QA/released
- Route: nova (existing owner only)
- Raised: 2026-10-22 by Chris (Nova relay, Telegram809/photo809)
- Updated: 2026-11-05
- Superseding authority: Chris Telegram854; placement reference855; Nova delivered acknowledgement856
- Related: `all-jobs-compact-filter-selectors`, `mobile-all-jobs-toolbar` — older queue/history only; no old patch or delivery inference

## Problem

All Jobs requires opening a Status dropdown for frequent switching while secondary filters occupy the main toolbar. Chris has now explicitly chosen four primary buttons and one Advanced filters entry point. This supersedes the October five-primary/visible-Customer design proposal and its unresolved “lets try it” clarification; it does not change the Job lifecycle or list-filter semantics.

## Evidence

- Chris Telegram854, 2026-11-05 11:54:51 CST, via Nova11:56:28, exact: “Can I get Quote, Avail, Commited and Won filter buttons at the top and everything else tucked into advance fiters icon.” Preserve this evidence including typos; use the current canonical Committed identity in the interface and data.
- Direct private inspection of photo854: desktop `/requests`, Won selected in a five-option checkbox menu (Quote, Availability, Committed, Won, Lost), with Select all/Deselect all. It concerns list filtering, not per-record Sales-status mutation.
- Photo855 at11:55:17 is an annotated placement reference, not a second textual request: Search right-side space marked, Expand all and current Won dropdown circled, Item status/Customer/Created/Updated crossed. No instruction to delete Expand all, add Search-clear behavior or remove Lost is inferred. Nova delivered ACK856 replying to854.
- Bounded November5 current source/docs review supports the preserved contract below. No Lily code, test, browser, API, DB or runtime/deployment verification.

## What it should do

### Four primary independent status buttons

Keep Search visible and expose exactly these four quick filter buttons in order: **Quote · Avail · Committed · Won**. Avail means the existing Availability stage; Committed retains the existing stage identity, not a new spelling/value. Provide the full accessible name for abbreviated visible text.

These are independent multi-select toggles, not exclusive tabs or record-status actions. Toggling a quick button changes only that one membership in the existing five-stage selected set. Keep any selected Lost or other quick statuses intact. Use a labelled filter group, visible pressed/checked cue plus non-colour indication and accessible pressed/checked state.

### Advanced contains the other filters, not other app actions

One compact icon-only **Advanced filters** trigger opens **Lost**, **Item status**, **Customer**, **Created**, **Updated** on desktop. Lost remains an independent choice in the same five-stage Sales-status selection, not a new filter intersected with the four quick buttons and not a removed stage.

On mobile retain the current Item Status omission/ignore semantics: Advanced contains Lost, Customer, Created and Updated, without silently adding Item Status. Keep the parked desktop Item Status selection unchanged on return. Do not duplicate the four primary buttons as an old Status dropdown in Advanced.

“Everything else” means remaining FILTERS. Search, navigation, New job, notifications, paging, existing Clear/reset and logical utility actions remain available. Expand all/Collapse all is a desktop non-filter utility: preserve its availability/meaning, using the smallest honest fit, not automatic deletion or burial in Advanced because it is circled in855. Do not introduce a mobile expansion utility that is currently absent.

### Selected hidden criteria stay visible

A selected Lost must be apparent while Advanced is closed through its active indication and an accessible summary naming Lost; it cannot disappear, reset or become an invisible result restriction. Customer/date/desktop Item-status selections likewise have truthful summaries when opened and a closed active indication.

Safe implementation detail (not an additional Chris preference): count active nested groups. Selected Lost contributes one; non-default desktop Item Status contributes one (all current seven=zero, any subset including none=one); selected Customer contributes one; Created and Updated each contribute one when set. Exclude primary quick-status changes and Search from this secondary-only badge. On mobile ignore the parked Item Status completely. Any different badge treatment must still visibly identify selected Lost and effective hidden criteria without implying they were cleared. Opening/closing the surface must never change results.

Keep current Select all/Deselect all for the ENTIRE five-stage Sales selection reachable with explicit scope. Select all includes Lost even though only four stages have quick buttons. Deselect all removes all five; show No statuses selected rather than All/unrestricted. Keep the existing full-view Clear/reset meaning; do not invent a new default or silently clear Lost when a quick filter changes. Any controls located inside Advanced must distinguish whole-Sales selection/reset from merely the Lost choice.

## Current contract to preserve (bounded source review, 2026-11-05 CST)

- Current Sales IDs/labels remain `quoted`/Quote, `availability`/Availability, `committed`/Committed, `closed_won`/Won, `closed_lost`/Lost. Initial and global-reset selection remains **Availability + Committed**. Exposing four quick choices does not select all four or create a new baseline.
- Status all selects five; explicit empty sends `status=none` and returns no matching Jobs. Do not revive empty=all, older six-stage/four-open assumptions or the old preview patch.
- Desktop Item Status has seven current options; all seven omits its constraint, empty sends `itemStatus=none`. Mobile uses no effective Item-status constraint and parks the desktop state. Customer is multi-select with empty=All customers. Created/Updated are single rolling parent-request windows (All time, Today, Last7/14/30 days).
- Keep the existing debounced Search matching and query encoding, API behavior, server order/paging limits and page-one-on-effective-change behavior. No new browser URL state or search behavior.
- Query/filter/page restoration remains tab-scoped `lps.requests.visit.v1`, with its current normalizer, explicit item-selection handling and saved-page validation. Preserve restored Won-only, Lost-only, mixed, all and none selections, including during 899/900 mode crossing. The screenshot’s Won-only state must remain Won-only when rendered in the new layout.
- Existing global Clear resets Search/customer/dates and Sales to Availability+Committed; desktop resets Item Status to all seven, mobile does not erase parked desktop Item Status. No storage migration is implied.
- Current RequestsToolbar is owned by All Jobs, with the shared generic Toolbar used elsewhere. Isolate the visual change to this request: do not alter global shared-toolbar callers or unrelated status pickers.
- Docs opening baseline matches current source; other historical comments/mobile-doc text about all-stage defaults or empty including Archived are stale, not authoritative for this UI.

## Acceptance criteria

- Desktop and mobile/constrained All Jobs show Search and exactly four ordered primary quick statuses Quote/Avail/Committed/Won; Lost, Customer and dates are in Advanced, with Item Status there only on desktop.
- Clicking any primary button independently adds/removes that same canonical stage, preserving all other selected statuses including hidden Lost. No record is mutated and no exclusive tab role is used.
- Start with restored Lost-only: all four quick buttons are off, Advanced visibly/accessibly indicates Lost, and results retain Lost-only. With Lost+Won, toggling Won leaves Lost selected; reopening Advanced shows the same selection. Test mixed, all-five and none paths without hidden resets.
- Select all covers all five including Lost; Deselect all returns none/no Jobs, and global Clear restores Availability+Committed, not four quick stages or all stages. Button state, hidden Lost state, summaries/badges and effective results agree.
- All-seven Item Status is not presented as seven active nested filters; subset/none remains active on desktop. Customer/date filters retain their current matching, selection cardinality and date meaning. Mobile effective badge/results exclude parked Item Status across mode crossing and reset.
- At320/390/480 and desktop, primary labels and actions are usable without page overflow/clipping. Allow a compact wrapping quick-status row beneath visible Search instead of hiding buttons or shrinking targets. Advanced fits its viewport with bounded scrolling, long customer-label handling and usable close/reset access.
- Quick buttons, filter trigger and interactive choices have minimum44px targets, visible focus and adequate selected/unselected contrast; keyboard Enter/Space toggles independently. Advanced supports touch/keyboard opening, Escape/close/outside dismissal and return focus; reuse accessible sheet/popover patterns, not stacked modals or an Apply workflow.
- Search, paging, New job/notification/navigation, Clear and existing utility actions remain logically available with unchanged meaning. No new Search-clear action is inferred from855. Expand all remains a desktop utility, not a filter.
- Saved-session restore, current defaults/all/none/reset/query/storage/API behavior and 899/900 responsive switching remain unchanged apart from placement. Protect unrelated shared-toolbar surfaces.
- Before execution the existing owner supplies fresh protected B0/current-source/operator compatibility evidence and explicitly clears actual execution holds. Before release, independent exact-candidate technical and rendered QA covers320/390/480+desktop, focus/contrast, hidden Lost and saved states. No source/mock-only pass is a shipped claim.

## Authorization and delivery gates

Chris854 explicitly approves this narrow UI direction; no repeat layout-approval question is needed. Route the full corrected scope to Nova MAIN’s SAME owner (reuse its existing All Jobs preview/implementation task if appropriate), never start parallel builders or apply a historical patch.

This approval does NOT clear the CI836 two-failure incident, operator-baseline/runtime/safe-QA/release holds or authorize adopting unreviewed CI controls. Until Nova explicitly clears actual execution against fresh B0, work remains source-only planning/owner preflight, not an in-progress build or release. No logo/native Android/navigation385 fallback/AR-print/price UI/CI-control bundle, DB/schema/workflow or unrelated authority.

## Out of scope

- New/renamed stage IDs, status mutation, new defaults, exclusive one-status mode, query/API/search/storage/paging changes or new business workflow.
- Mobile Item Status reintroduction; hiding Search/nonfilter controls; removing Lost; treating the five-primary preview as approved; unrelated branding/navigation/printing/price/CI fixes.
- Lily implementation, testing, browser/API/DB work, SOP changes or external Telegram. Builder ownership and independent release gates stay with Nova.

## Handoff log

- 2026-11-05 12:05:20 CST — Parent relays Nova12:05:07 SOURCE PLAN ONLY complete: `../nova/workspace/threads/main/tasks/all-jobs-toolbar-preview/source-plan-2026-11-05.md`. Fresh HEAD80ea65a has extensive staged/unstaged operator auth/portal/PWA/orders/docs work; individually clean toolbar/query/test/doc paths do not establish a release baseline. Plan limits layout to RequestsToolbar plus focused tests/docs, preserving current selection/default/restore/query,44px responsive layout, Advanced Lost visibility and mobile parking; no generic Toolbar restyle. No edits/checks/browser/API/runtime performed. Nova857 already requests committed baseline and pending836 narrow read-only audit/tool-repair authority from Pi; owner HOLD until explicit scope. Dirty CI/auth/logo controls not adopted;850 stays sign-in only. Helper capture receipt is not fail-closed proof. No Lily audit, builder, new ask or execution/shipped claim.

- 2026-11-05 12:00:36 CST — Parent relays Nova12:00:18 acceptance of full854 scope; existing `all-jobs-toolbar-preview` owner assigned fresh source-only plan/preflight. No parallel or old-five-mock implementation. App edits/checks/browser/release execution are NOT cleared; CI836/operator-base/safe-QA holds remain,850 is sign-in only. Actual source disposition and required-clearance report pending; not code/build/QA/shipped.

- 2026-10-23 10:39:53 CDT — Captured Chris381 exact “lets try it” once by source ID; awaiting parent clarifier382 response. No app build route or second question.

- 2026-10-22 10:59 CDT — Current source and screenshot review completed; internal proposal shared with parent and Nova main for discussion only. Explicit rare-filter nesting need recorded; exact visual layout and build remain unapproved. No implementation, tests, browser or DB work.
- 2026-10-22 11:01:51 CDT — Parent confirms actual Telegram380 receipt: visible Search, primary multi-select status buttons, mobile wrapping, desktop Customer and secondary rare Filters/badge proposed to Chris with “Shall we use that layout?” Awaiting layout decision. Exact badge formula remains a proposal detail; no UI build route, approval or real-test claim.
- 2026-10-22 11:53:08 CDT — Parent relays Nova11:52:57: Chris814 at11:52:13 replies to811 asking for a preview before commit; relay spacing is not literal-original verified. Nova815 acknowledges private desktop/mobile DESIGN preview and has already delegated one static private-artifact mock. Private preview only is authorized; no application source/runtime data changes, app commit/deploy or layout/UI implementation approval. Nova coordinates artifact delivery; await URL/images and technical/visual representation notes.
- 2026-10-22 11:57:16 CDT — Parent relays Nova11:57:06: private static preview published at https://plantsupply.app/a/nova/private/artifacts/all-jobs-toolbar-design and shared with Chris via Nova816 replying to814. Nova reports captures at1440/320/390/480 and browser closed. Actual artifact path/source verification report remains pending. Delivery/captures are not independent QA, full-app acceptance, layout approval or app implementation authority. Await Chris review before any app build; no live data, app commit or deployment, no Lily browsing/audit/new mock or duplicate question.

- 2026-11-05 11:57:17 CST — Chris854 explicit four-primary UI supersedes the five-primary/visible-Customer proposal and pending381 ambiguity.855 is a placement reference; Nova ACK856 confirms same intent. Captured both once, privately read images and bounded current source/docs/shared callers. Corrected full requirement successfully delivered to Nova main for the same owner; requested actual blocked/execution-stage acknowledgement. CI836/operator/runtime/release/safe-QA gates remain, source-only/preflight, no implementation or shipped claim.
