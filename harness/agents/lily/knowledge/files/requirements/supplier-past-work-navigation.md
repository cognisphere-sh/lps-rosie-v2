# One supplier destination: Past order/Requests

- Status: routed · OWNER-REPORTED HOLD: current-base overlap / existing operator record-name rollout dependency; approved UI scope unchanged
- Route: nova
- Raised: 2026-09-22 by Bhoumik (via Nova Telegram handoff to Lily)
- Updated: 2026-09-22T12:51:42-05:00

## Problem

The supplier portal has separate Closed Orders and Closed Requests destinations beside active work. Bhoumik wants past work together, lower in the sidebar, so suppliers have one place to look without crowding active navigation.

## Evidence

- Bhoumik712 at2026-09-22T10:48:23-05:00: “On supplier portal, in bring complete order and completed availability request at the bottom of the sidebar. Merge them to a single window with two tabs. One single button in sidebar: Closed Order/Requests.”
- Immediate713 at10:48:37 corrects the name to exactly **“Past order/Requests”**. That correction supersedes the initial label. Nova714/715 acknowledges one bottom sidebar entry and one Orders/Availability Requests view, presentation-only. Relayed via Nova10:49:18/Lily main10:50:35; not independently reinspected in Telegram.
- Bounded local source/doc check at HEAD `7c756c8bab23b2f2f52d7bdf43ff24a7bbce3e47`, app/docs clean before and after inspection. Current source has four navigation entries, including separate Closed Orders and Closed Requests. This is not live deployment verification. Detailed evidence: `workspace/threads/main/tasks/supplier-past-work-navigation/source-check-2026-09-22.md` on Lily.

## What it should do

1. Replace the two past-work navigation entries with **one** entry labelled exactly **Past order/Requests**. Put it in the lower desktop sidebar, separate from active work and above the existing Settings/Log out utility controls. Keep active Availability Requests and Orders intact, along with rail expand/collapse and utility access.
2. Open a single view within the existing authenticated supplier portal shell, with tabs **Orders** and **Availability Requests**. “Window” means the shared tabbed container, not a compulsory popup, extra browser window, second login or new authentication route. Do not nest duplicate shells, alerts or chats.
3. Reuse each existing past list, its cards/grouping, count meaning, order, loading/error/empty states and permitted detail actions. No new combined total, filters or paging model. A selected empty tab stays selected rather than silently switching to the populated type.
4. Preserve exact current membership:
   - **Orders:** the existing closed classification: own Closed Won/Lost, or all linked Jobs closed/archived/inactive with at least one resolved association and none open/unresolved. Retain actual order status; a derived-closed order is not relabelled Won. Order Ready alone stays outside. Missing associations do not imply closure; inactive/deleted orders remain excluded.
   - **Availability Requests:** only actual Closed requests returned by the existing supplier list. Completed means answered/submitted and remains an active-list bucket, not Closed. Hidden/inactive/deleted requests remain excluded. Current list/count covers Closed entries within the latest 500 returned eligible requests; this change must not widen that limit or imply an all-time count.
5. Make Orders the first tab and the default for a fresh click on the unified sidebar entry. Existing Closed Orders and Closed Requests URLs/bookmarks must enter the same view on their corresponding tab. Prefer retaining those existing locations as tab entry points. Tab selection follows the location, survives refresh, and restores predictably with native Back/Forward. Existing record-detail URLs still work; their past-list return links lead to the corresponding tab and unified navigation highlight. Active-record return behavior remains unchanged.
6. Retain current state boundaries: Orders grouping initially By order and mount-local; active bucket selections remain mount-local with current defaults. No new durable filter/tab preferences or cross-supplier state. Preserve existing refresh behavior and any mounted-view state rather than promising new persistence after remount. Mobile chat Back/close history, desktop session preferences and alerts/chat behavior remain intact.
7. On mobile, expose the same single past-work destination within existing responsive navigation; keep **Alerts LEFT / Chat RIGHT**, active destinations and More/Settings/logout reachable. The exact full label remains its accessible name; responsive wrapping must not rename it. Both tabs must be usable by touch and keyboard, with visible selection/focus and appropriate accessible tab navigation.

## Acceptance criteria

- Supplier sees exactly one past-work destination per visible navigation surface, with exact **Past order/Requests** wording; neither old separate past entry remains. Desktop placement is genuinely in the lower sidebar, not merely the last upper link.
- One shell contains Orders and Availability Requests tabs; fresh entry defaults Orders. Each legacy past-list location, tab switch, refresh, Back/Forward and record-return path restores the correct tab/highlight without duplicate history traps or a new login/window.
- Controlled before/after fixtures show identical membership, count meaning, order and details for both past lists: own Won/Lost, all-linked-closed, mixed-open/shared, missing-link and Ready-only orders; Closed versus Completed/New/Processing/Hidden/inactive requests. Derived closure keeps real status labels. Existing fetch/paging limits remain unchanged.
- Existing Orders group views and refresh/retry behavior, AR list states, detail print/sharing where currently allowed, and closed read-only restrictions are unchanged. Active filters/defaults/counts/actions and detail navigation are unaffected.
- Authenticated supplier/company isolation is preserved on both tabs and direct links. No cross-supplier stale rows, unauthorized internal customer/Job identity, private admin note or chat traffic appears. Tab navigation does not send messages, mark chat read by itself, or change operational records.
- Independent technical review plus genuinely rendered QA at **320/390/480px and desktop** pass on the exact reviewed candidate: expanded/collapsed rail, both tabs, populated/empty/error/long-label cases, touch/keyboard focus, 44px new-control targets, no clipped label/tab, unintended document overflow, duplicate shell or blocked scroll. Both portal themes remain legible; mobile Alerts-left/Chat-right and chat Back behavior survive. Record build identity/screenshots/results and distinguish controlled rendering from signed-in runtime evidence; auth/resource blockers are not a pass.
- Nova confirms implementation/release and updates affected portal documentation before Lily calls it shipped. Protect operator changes; recheck the current baseline, use an isolated candidate and safe runner, and do not silently combine unrelated candidates.

## Current dependency / hold

- 2026-09-22T12:50:45-05:00 — Nova12:49:45, relayed by Lily main, reports the supplier Past candidate remains on **current-base overlap HOLD** tied to the existing operator record-name rollout. Owner reports the intended fields are absent from the live catalogue, the migration is untracked with no application receipt, and dependent readers/docs are unstaged. Readers require those fields before their display fallback, so app release cannot safely precede the reviewed migration; its backfill is not neutral/idempotent. This is reported evidence, not an independent Lily live audit.
- Operator717 is already informed; Nova has not applied or edited the rollout. Detailed dependency evidence belongs to `workspace/threads/main/tasks/record-name-rollout/rollout-dependency.md` on Lily (sibling-confirmed path2026-09-22T12:51:42-05:00). No new record-name feature, independent naming build, duplicate live audit/user ask or database work is authorized here.
- The sidebar/tabs design and original route stay unchanged. The earlier7c756c8 clean-source check is dated baseline evidence, not current clearance. Await operator/owner resolution and a safe current baseline before resuming; exact-candidate technical/rendered and release gates still apply afterward. Do not bundle735ce1e or revive709's held Ops workspace.

## Out of scope

- Changing what is Completed, Closed, Ready, Won/Lost, hidden, archived or deleted; new status transitions, close/reopen/delete/archive buttons or workflow changes.
- Database, API, authorization, money, data migration or live-record changes; widening lists, new history retention, counts or pagination; internal note exposure.
- The separate AR-table candidate `735ce1e` and its auth/resource gates. No shared release assumption.
- Full **Ops** AR main-workspace/multiple-tabs/supplier-chat-switch implementation: Bhoumik709 OPERATOR HOLD still applies. These are two supplier **past-list type tabs**, not that project.

## Assumptions

- The approved presentation-only acknowledgement means merge the existing past views. Bhoumik's “complete/completed” wording does not authorize moving answered Completed ARs or merely Ready Orders. No repeated user question is needed under that boundary.
- Orders-first/default, corresponding old locations as tab entry points, and lower-sidebar utility-area placement are the minimal UI choices. Existing remount preference resets remain legitimate; no remembered-last-tab policy is introduced.
- Source evidence is current only to the inspected checkout. Nova's separate current implementation owner must refresh the baseline and report any genuine runtime/data-contract gap rather than expanding scope.

## Handoff log

- 2026-09-22T10:50:35-05:00 — Logged both exact messages/correction, completed bounded source/doc check, formalized approved UI and gates. Full requirement successfully delivered to Nova main via agent messaging, requesting a separate current implementation owner and fresh baseline/protected operator changes. No code, test, data or live-UI action by Lily; owner acknowledgement/implementation/release pending at initial handoff.
- 2026-09-22T12:50:45-05:00 — Recorded Nova12:49:45 owner-reported existing record-name rollout/current-base overlap HOLD via parent; operator717 already informed, no Nova apply/edit. Linked sibling rollout task without new build/audit/DB action or repeated ask. Approved exact-label/sidebar/tabs scope retained; not shipped.
