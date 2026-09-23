# Make the mobile All jobs scan card compact and direct

- Status: routed
- Route: nova
- Raised: 2026-08-30 by Chris (via Telegram messages 431–432 and 435 / Nova handoff)
- Updated: 2026-09-22T15:36:37-05:00
- Current narrow override: `mobile-job-card-chat-controls` — Chris718/Nova719 now remove all inline chats from current **mobile All Jobs list cards only**, keeping person/profile/notes, supplier identity/all AR access and Job actions. The older Rosie-must-remain criteria below are superseded for that list; focused and desktop chats remain unchanged. Do not reinstate historical exact-two-row/omitted-notes/date or old-status assumptions over current operator contracts. The linked requirement is current authority for this new slice, not a wholesale card rebuild.
- Follow-on: `all-jobs-compact-filter-selectors` — compact mobile selectors and shared current five-stage/open-work baseline; separate filter scope.

## Problem

Mobile All Jobs is a scan-and-open view, but its inline expansion chevron consumes scarce top-line width for a secondary workflow. The shipped card remains too tall and ambiguous: cryptic status codes, an unclear Rosie action and duplicate/missing-identity handling make the list harder to scan. Chris has now explicitly questioned the arrow and approved using the reclaimed space for the identity line instead.

## Evidence

- 2026-09-01 — Chris rejected the initial mobile card and its two-row replacement as visually poor.
- 2026-09-01 — Message 533/photo 532 identified excessive height, unclear Pending/chat, cryptic `Src`/`QD`, early truncation and duplicate-JR blank-job fallback.
- 2026-09-01 — Message 537/photo 532 supersedes the prior correction: remove the mobile inline-expansion arrow; Job identity already opens focused Job, where details and safe Delete must remain available.
- 2026-09-08 — **Mobile All Jobs Item Status** (message 558 / photo 557): Chris wants Item Status removed entirely from the mobile Filters sheet; mobile results must include all item statuses, with no hidden selection, badge state or restored desktop state constraining them.

## What it should do

On mobile, Filters omits **Item Status** entirely. A mobile query always includes all item statuses: it cannot carry a hidden Item Status selection, a badge/deviation caused by one, or a restored desktop Item Status selection. Keep desktop Item Status unchanged. Treat this as separate responsive state: when moving from desktop to mobile, do not send the desktop item-status criterion; when returning to desktop, restore its prior desktop selection truthfully rather than pretending it affected mobile results. Session restore must apply the same separation.

On mobile, make every All Jobs card a direct, tight two-row scan entry with **no inline expansion and no chevron**. Tapping Job identity opens the existing focused Job destination. Do not replace the chevron with another collapsed-card action.

- **Row 1, exact order:** `JR reference · full plain-language sales status · Customer/Company · Job name`.
- **Row 2, exact order:** clearly labelled Pending count/indicator at left · visible **Rosie Chat** action at right.

Show the actual full current status labels, not opaque codes: **Active, Quote, Availability, Confirmed, Won, Lost**. This is a presentation change only: it does not alter the status model, stored value or lifecycle.

Use the reclaimed chevron width and tight spacing for the customer/company and job identity. The card is exactly two content rows, with maximum 10–12px outer vertical padding and a 6px row gap; it has no dead reserved height. At a blank Job name, do not repeat the separately displayed JR reference as a fallback. Show truthful customer/company identity alone or a neutral non-identifier missing-job treatment.

Nothing becomes inaccessible when inline expansion is removed. Secondary customer/contact/note detail, full plant-status detail and the existing compact **Delete job** utility move to or remain in the focused Job view reached from that card. Delete retains its existing confirmation, permanent-delete outcome, permissions and safety. The focused Job view must keep a clear route back to All Jobs/device history behavior.

Rosie Chat remains a visible, named, accessible 44px action to the request’s existing canonical Rosie Job thread. Pending remains clearly labelled; do not use a full-width Pending bar or a floating/unlabelled avatar.

Install Date and Delivery/Pickup remain absent until Bhoumik’s staged durable contract supplies truthfully persisted values. Do not show blanks, placeholders, inferred values, created/updated dates or a PO.

## Acceptance criteria

- At 320px, 390px and 480px, each collapsed mobile All Jobs card is exactly two content rows, has no inline expansion/chevron, no wrapping, clipping, overlap, horizontal page scrolling or dead reserved space.
- Card outer vertical padding is no more than 10–12px; Row 1/Row 2 gap is 6px.
- Row 1 is exactly ordered JR reference · full understandable sales-status label · Customer/Company · Job name. It shows only the current full labels Active, Quote, Availability, Confirmed, Won, Lost, never cryptic abbreviated status codes.
- Customer/company and job identity receive the reclaimed chevron width and all remaining flexible Row 1 space after JR/status. A blank Job name does not repeat the JR reference.
- Row 2 shows labelled Pending at left and a visible named Rosie Chat action at right. Rosie Chat is not an unlabeled/floating avatar and retains a 44px touch target, accessible name and canonical Job-thread route.
- Tapping Job identity opens the existing focused Job view.
- From focused Job, a user can still reach customer/contact/note detail, full plant-status detail and Delete job. Delete retains confirmation, permanent-delete result, permissions and safety.
- Focused Job retains its existing usable return route/history behavior to All Jobs.
- Collapsed All Jobs cards contain no full-width Pending bar, customer/contact/note detail, full status counts, Last updated, created date, inferred date, PO, Install Date, Pickup or Delivery.
- Install Date and Delivery/Pickup remain omitted until the persisted durable contract exists.
- Mobile Filters omits Item Status; mobile results contain all item statuses, with no hidden/restored item-status selection or badge/deviation constraining them.
- Switching desktop → mobile removes Item Status from the mobile query; switching back restores the prior desktop selection, and session restore preserves that same truthful mode separation.
- Desktop Item Status behavior, ordering/API behavior, status semantics, Rosie routing and Delete safety are unchanged.
- Rendered visual QA covers mobile at 320px, 390px and 480px plus desktop isolation.

## Out of scope

- New status values or lifecycle/workflow changes.
- Data-contract work for dates, fulfillment, PO or missing identity data.
- Changing the focused Job’s data/action meaning, Delete authorization or confirmation rules.
- Desktop redesign, filtering/order/API changes other than the mobile-only Item Status omission, or merging Job and Rosie conversations.

## Assumptions

- This is UI-only: focused Job already provides the appropriate destination for details and safe Delete; no new data/workflow contract is implied.
- “Full status” means the current full human-readable label, not a new status taxonomy.

## Open questions

None for the UI-now slice.

## Handoff log

- 2026-08-30 — Routed to Nova with mobile toolbar, expanded-card Delete placement and preserved ordering semantics.
- 2026-08-31 — Shipped initial mobile hierarchy and pending/date refinements in `3e1e485`.
- 2026-09-01 — Chris rejected the first collapsed-card presentation; Nova shipped its two-row replacement in `6ee562a` with 213/213 tests, typecheck/build and healthy restart.
- 2026-09-01 — Live review reopened the card for tight spacing, clearer labels, identity width and no duplicate-JR fallback.
- 2026-09-01 — Chris superseded that correction: remove mobile inline expansion/chevron entirely, reclaim its width for Row 1, and preserve all detail/Delete access through focused Job. Re-routed to Nova before implementation.
- 2026-09-08 — Amended and routed to Nova: remove Item Status from mobile Filters and normalize mobile queries to all item statuses, isolated from desktop selection/session state; desktop remains unchanged. Nova accepted; the active focused/mobile-v3 owner will implement the separate desktop state/mobile-ignore behavior, then technical and visual QA at 320/390/480px and desktop.
