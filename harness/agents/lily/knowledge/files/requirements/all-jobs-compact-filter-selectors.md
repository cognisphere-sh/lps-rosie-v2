# Open compact mobile Job filters only when needed

- Status: routed · integration authorized; current filter compatibility and auth/safe-runner/live gates pending; not integrated or shipped
- Route: nova
- Raised: 2026-09-11 by Chris (via Nova, Telegram 588–589)
- Updated: 2026-10-22
- Latest related discovery: `all-jobs-primary-status-filter-layout` — Chris809 asks for primary status toggling plus rare-filter nesting; new design is proposed only, not a build amendment to this old queue. No September patch or deployment receipt is inferred.
- Related: `mobile-all-jobs-toolbar` (prior card/toolbar work; mobile Item Status omission remains)

## Problem

The mobile All Jobs Filters sheet makes Chris scroll past every Status, Customer and date-range option even when he is not changing them. His compact press-to-open visual request remains desired, but its earlier status/default assumptions have been superseded by committed operator work. This follow-on must change presentation only.

## Evidence

- Historical Chris message 588: “Can we optimize for screen space. Lets try making these drop downs with selection. Press to select. If multi like status select and deselect with highlights. At opening of jobs view preselect/ show only only open status. So closed won or lost should be hidden.”
- Historical photos 588–589 showed full-height Created/Updated radio lists and Status/Customer checkbox lists. Their old six-stage vocabulary is historical evidence, not current acceptance.
- 2026-09-18 — Parent confirms the visual request remains desired only while preserving the new committed semantics: five stages **Quote, Availability, Committed, Won, Lost**; fresh/reset **Availability + Committed**; Select all/Deselect all; an empty Status selection means **no statuses/no results**, not unrestricted results.
- Nova’s 10:08:21 preflight reports clean committed baseline `f9a2ddb` and that compact mobile selector presentation is still absent. Bhoumik’s Telegram 665 authorizes queued execution; the current owner is refreshing the source-only plan. Lily’s bounded current source inspection supports these filter semantics and the still-expanded mobile option lists; it is not a runtime/deployment test.

## What it should do

### Compact mobile presentation

Keep the existing Filters sheet, with four initially collapsed, press-to-open controls in this order: **Status, Customer, Created, Updated**. Each has its name, a truthful current-selection summary and a minimum 44px trigger. Closed controls occupy compact rows, not the height of their option lists.

Status is multi-select in exact current order **Quote, Availability, Committed, Won, Lost**. Each press toggles selection with a visible highlight, checkmark and corresponding accessible state; colour alone is insufficient. Keep the options open for successive choices. Preserve explicit **Select all** and **Deselect all**. Select all visibly selects all five; Deselect all selects none and returns no matching Jobs. A zero-selection summary must read **No statuses selected** (or equally clear), never All/unrestricted. The default summary can show **Availability + Committed**; other selections show their name/count. Do not call that pair “all open jobs,” since Quote is a separate selectable stage outside the starting pair.

Customer keeps its existing multi-select meaning and matching. Open a bounded list with local option search for the long customer list. Searching options changes only which choices are shown, not the selected customers or Job result scope; selections survive option search. The collapsed summary shows All customers, the selected customer or a count. Customer’s existing empty/all meaning is not changed by Status’s none meaning.

Created and Updated keep one choice each: All time, Today, Last 7 days, Last 14 days, Last 30 days. Their collapsed controls show the chosen range; choosing it closes that selector, not the whole Filters sheet. Preserve the rolling parent-request date meaning.

Only the selector being used expands. Apply selections immediately through the existing filter behavior; do not add a draft/Apply transaction, stacked modal or confirmation. Trigger re-press, opening another group, outside tap within the sheet or Escape may close a selector without losing its selections. Escape closes a nested selector first and returns focus to its trigger; a later Escape closes the sheet. Preserve explicit Close, sheet backdrop dismissal, focus containment and return focus. Long lists and the on-screen keyboard must not clip menus, create horizontal scrolling or strand Close/reset controls.

### Preserve the current committed filter contract

This is **mobile visual work only**, not another Jobs-default change. Preserve the current shared All Jobs first-entry/reset selection of **Availability + Committed** on mobile and desktop. Quote, Won and Lost remain deliberately selectable. No Job status or lifecycle is mutated.

Do not reset on refresh, refetch, resize or return navigation. Preserve current valid saved/in-view subsets, explicit all-five and explicit empty selection through refresh, tab restore and mode crossing. Use the current committed normalization/fallback behavior for older or missing state; do not bring back the historical six-stage preservation rules, four-open baseline or empty-means-all migration from the abandoned candidate.

Keep the distinction between **Deselect all statuses** and **Clear all filters/reset**: the former means no statuses/no results; the latter restores Availability + Committed and the current Search/customer/date/page reset behavior. Reset wording must not suggest unrestricted results or all open stages. Mobile reset continues to leave parked desktop Item Status untouched; desktop's existing Item Status behavior remains unchanged.

Status contributes zero deviations at exactly Availability + Committed and one at any other selection, including all five or none. Other groups retain their current count meaning. Summary, highlights/checkmarks, accessible state, badge and effective results must agree. Mobile Item Status remains absent from the sheet/accessibility tree/query/result constraint/badge, with its desktop state isolated as currently implemented.

## Acceptance criteria

- At 320px, 390px and 480px, mobile Filters initially shows four compact closed controls rather than long exposed lists. Triggers, choices and Select all/Deselect all controls are at least 44px targets.
- Status displays only Quote, Availability, Committed, Won, Lost in that order, with highlighted/checkmarked accessible multi-selection and no extra Apply step.
- Select all selects all five current stages; Deselect all shows No statuses selected, returns no matching Jobs and counts as one Status deviation. It must never remove the Status constraint or show unrestricted results.
- Fresh entry and explicit filter reset still select only Availability + Committed, with zero Status deviation. Merely opening/closing a selector does not alter filters or results.
- Valid current saved/in-view Quote-only, mixed, Won/Lost, all-five and empty selections survive refresh, return navigation and 899/900 mode crossing under the committed restoration contract. Missing/legacy-state handling matches the new committed baseline, not the historical candidate.
- Selected summary, checked/highlighted options, accessible state, active badge and effective query/results agree for baseline, partial, all-five and none.
- Customer search retains selections and matching; long names/lists remain usable and its existing All customers behavior is unchanged.
- Created/Updated retain one existing range or All time, truthful collapsed summaries, unchanged rolling-date meaning, and leave the sheet open after choosing a range.
- Touch/keyboard QA verifies nested Escape before sheet dismissal, Tab/Shift+Tab containment, selector/sheet Close and outside dismissal, restored focus and keyboard-visible scroll/reset access.
- Mobile Item Status remains omitted/ignored; mobile reset does not erase parked desktop state. Desktop selector layout and all committed desktop filter/default/reset behavior are unchanged.
- Current-candidate rendered QA at 320/390/480 and desktop includes each selector open/closed, long content, on-screen-keyboard conditions, empty/all/default results and mode crossing. State tests alone are not visual acceptance.
- Independent technical and visual review is tied to the actual refreshed candidate and baseline. Historical test results are not a current release gate pass; no shipped claim before verified release evidence.

## Out of scope

- Any change to status vocabulary/model, stored statuses, lifecycle, availability responses, money or permissions.
- Changing current initial/reset defaults, explicit none/all behavior, committed saved-state normalization, date/timezone meaning, request order, paging limits or customer matching.
- Desktop redesign, other-screen defaults, a new Apply workflow, supplier/customer sends, card/focused-Job redesign or Item Status policy.
- Applying the old nine-path candidate/patch, reviving its old defaults or unrestricted empty behavior, or creating a duplicate builder.

## Assumptions

- The existing Nova owner remains responsible for this queued visual slice. This is a corrected follow-up to that owner, not a new parallel implementation request.
- Nova’s September 24 23:09:27 report establishes clean committed source HEAD `3c4adca`, not filter-candidate compatibility or release readiness. The live build predates HEAD and exact deployed source is unknown; QA auth is absent and the host OOM-safe runner is unvalidated. Operator723/724 already requests those prerequisites. Nova alone owns current-candidate preflight, tests, reconstruction and independent technical/rendered release gates. This older filter slice is eligible only if compatible with current semantics after the current priorities; no old status/default patch or duplicate operator ask.
- Git commitment does not resolve record-name rollout or migration-target dependencies. Committed migrations/source are not proof of applied migrations, live compliance or deployment. The bounded 0115 notes-contract audit is owned separately; no parallel source audit or old note-policy integration belongs here.

## Handoff log

- 2026-09-11 13:02:27 CDT — Nova relayed the exact wording: the opening-default clause says Jobs generally, while both references are mobile. Read-only audit complete; routed this full narrow follow-on to Nova, including saved-state migration and nested-focus caveats. No Lily implementation or production writes; concurrent operator work must be preserved.
- 2026-09-11 13:06:17 CDT — Nova accepted and delegated to `compact-job-filter-selectors`: preserve legacy/all-six/unrestricted intent independently of fresh/reset defaults, nested Escape and mobile Item Status behavior. Owner uses an isolated candidate worktree and stops on overlapping operator edits; no live build/deploy before exact technical and visual gates.
- 2026-09-11 13:38:04 CDT — Nova reports isolated nine-path candidate frozen for independent review: 43/43 focused tests and typecheck pass. Full suite has six CSS/token failures also reproduced on clean `c954d13`; reviewer is distinguishing baseline failures from candidate defects. Release is not green: no integration, commit, deployment or browser/visual QA yet. Original operator files/index remain untouched; status stays routed.
- 2026-09-18 10:08:47 CDT — Parent superseded the preceding semantic assumptions with the clean committed five-stage/two-default/empty-none contract. Historical visual request remains desired; old candidate must not be applied. Full corrected visual-only brief successfully sent to Nova main for its existing owner, with new independent candidate gates; no duplicate implementation and not shipped.
- 2026-09-24 23:09:28 CDT — Existing-owner coordination relays Bhoumik Telegram721 at23:05:36, “I have committed. You can integrate.” Nova23:06:24/722 acknowledges protected integration and delegates fresh preflight; no candidate applied yet. Record authorization/preflight only. This older filter candidate requires current-semantic compatibility, behind mobile-list chat removal, focused AR drawer items1–2, supplier Past tabs and signed-out JR deep link. No new builder, audit or integration command by Lily; scope excludes full AR709, unresolved JR-status item3 and unrelated schema/DB/note-routing changes. Capture already exists once as `nova:main:2026-09-24T23:06:24-05:00:integration-authorization-telegram721`.
- 2026-09-24 23:12:10 CDT — Latest coordination relays Nova23:09:27: clean committed HEAD3c4adca includes0104+0115; signed-out JR fix already committed6c0e95c and current supplier Past implementation supersedes the old candidate. Nova’s existing owners review/reconstruct current priority slices against HEAD, never apply old patches. Filter compatibility still unverified; live source unknown, QA auth absent, OOM-safe runner unvalidated. Operator723/724 already asked; no Lily audit/tests/build or duplicate request. Shared evidence captured as `nova:main:2026-09-24T23:09:27-05:00:current-integration-base`.
