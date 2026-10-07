# Center AR Status controls and give Submit purple botanical flair

- Status: routed — R2 source-ready/SOURCE SAFE reported by independent Nova reviewer; technical execution/build/authenticated reference QA BLOCKED/resource HOLD, NOT integrated/deployed/shipped
- Route: nova — existing main owner, no parallel builder
- Raised: 2026-10-02 by Chris via Nova, Telegram766/767
- Updated: 2026-10-02 11:22:50 CDT

## Problem

The pictured supplier availability detail has row Status controls left-aligned within their track and a bottom-left Submit availability button. Chris wants a balanced, deliberate presentation: centered Status and Submit, with recognizable botanical line-art flair from his purple chat background rather than a generic plain action.

## Evidence

- Chris Telegram766 at2026-10-02 10:46:44 CDT: “Can we center the drop down for Status on the column? Also move the button to center. and add some flair to the button like the chat back ground. Can you use that same element or create a new one similar?” Feedback handle `telegram:-1004330045748:766`.
- Chris Telegram767 at10:47 CDT exact caption “button flair”. Feedback handle `telegram:-1004330045748:767`; photo shows black/purple dense botanical/cactus/agave/desert doodle LINE ART, plus a purple chat bubble. Nova acknowledged this specific motif, not generic gradient/glow.
- Private photos `../nova/plugins/telegram/inbox/photo_766.jpg` and `photo_767.jpg` independently inspected in place. They contain private customer/chat data: no copies, public evidence or public preview. No current record/token or operational assertion is inferred from pictured data.

## What it should do

1. Center each desktop row Status dropdown in its Status column, under a correspondingly centered Status heading. Keep the existing selected value, options, answer dialogs and keyboard interaction. Centering is local to this supplier availability-detail presentation, not all status controls in the app.
2. Center the Submit/Re-Submit button itself within the bottom action area's available width—not merely center a combined button-plus-explanation group. Retain the explanation/context and pinned accessible action area. Keep responsive access to the existing request notes and all answers.
3. Apply restrained purple botanical/cactus line-art flair inside the button, recognizable against767. Prefer the existing matching chat wallpaper asset suitably scaled/clipped/tinted if appropriate; otherwise a similar restrained motif is allowed. Keep clear text/contrast and honest interactive/disabled/loading states. No whole-panel wallpaper, generic glow-only substitute or dependence on private screenshot content/saved chat settings.

## Acceptance criteria

- At desktop on the pictured public supplier AR detail and its authenticated shared-detail counterpart, the Status heading and every row control share the column center. Persisted reorder/resize widths and existing column order/content stay intact; alignment remains correct after horizontal scroll, resizing/reordering and with long tables/names/notes/status labels.
- The Submit/Re-Submit button is centered relative to the action area even with the explanatory sentence present; explanation remains readable/reachable, not silently removed to create symmetry. Preserve all existing note/form/summary/price/contact disclosure and print content.
- In an independent rendered side-by-side comparison with767, the button shows recognizable purple botanical/cactus line art contained within its own bounds. A plain violet fill or generic gradient/glow alone does not satisfy the reference. Label remains visually primary, pattern not mistaken for status/loading or extra actions.
- At320/390/480px and desktop, no new page-wide overflow, clipped label or essential action, overlap with safe areas or last line, or inaccessible footer/explanation. Retain current stacked phone cards below900px rather than forcing a desktop table onto phones; their Status control stays clearly associated with the existing Status label. Large/small content and scrolled long tables keep Submit reachable.
- Keyboard traversal, dropdown operation, dialog focus restoration, Submit activation and visible focus outline/ring remain intact. Keep accessible labels/disabled semantics and at least44px touch targets. Check text contrast against the worst motif portion (normal text at least4.5:1; applicable UI/focus contrast at least3:1). Decorative artwork is noninteractive and adds no screen-reader noise. No animation needed; if any is introduced, reduced-motion behavior must pass.
- Preserve exact current Submit, Re-Submit, Submitting/loading, disabled/busy, closed/read-only, error/success/received, permission and approval behavior. Styling/alignment saves or sends nothing; activation invokes only the unchanged existing action. No lifecycle/status mapping, Pending/Available quantity semantics, Draft enablement, shared note audience or save/send/Submit gate change.
- Scope is the public and authenticated supplier shared AR detail only. Ops drawers (including focused portal-style drawer), supplier profile/By-item, Job/Order tables, chat appearance/settings and other AR caller controls remain unchanged by this slice. Shared helper reuse must not broaden the change accidentally.
- Existing Nova owner follows its own `visual-ui-release-qa` procedure: independent technical review and independent rendered QA of the exact isolated candidate/reference at320/390/480/desktop, keyboard, scrolled long tables and preserved states/caller boundaries. Record exact candidate/source/release identity and actual checks; blocked auth/runtime/build checks stay explicitly unverified, not claimed passed from source/static review. No release/completion claim without builder confirmation and existing gates.

## Out of scope

Database/API/migration/lifecycle/status/money/workflow changes; Draft AR64 recovery or replacement; new send/contact/publication/approval; botanical/name/note-policy reconstruction; changing current column order/width defaults or resolving earlier nonfocused-order uncertainty; full Ops main workspace709 hold/tabs/chat-switch; other held candidates or bundled releases; SOP/prompt changes; public private-data evidence.

## Assumptions and dependencies

- Photo766 header uniquely matches the public supplier detail; no URL was visible, so exact live token/record remains unknown. Because its content/footer is shared with authenticated supplier detail, the same cosmetic treatment applies to both, not admin/other callers. No human clarification is needed for this safe local UI slice.
- Existing approved `ar-table-presentation` column-order/notes scope and unresolved nonfocused policy remain unchanged. This is a separate polish requirement, not supersession or expansion of earlier scope.
- Current main checkpoint `efb3a8f1d22f223608579cb710fb2d7e71a34ef7` includes current operator/0127 lifecycle work. Bounded post-pause revalidation confirms the six affected source/route/theme hashes unchanged and affected tracked paths clean. Preserve/revalidate actual current operator baseline before build; no old candidate overwrite/reset or bundling. Checkpoint alone proves no tests/build/migration/runtime/deployment or independent QA.

## Source/reference appendix — identification, not implementation prescription

- Actual public route: `app/app/public/availability/[token]/page.tsx` → `app/components/workspace/public-availability.tsx` (matching Local Plant Supply, line/pending count and Print header) → shared `availability-request-view.tsx`.
- Authenticated shared route: `app/app/partner/[id]/requests/[arId]/page.tsx` → same `AvailabilityRequestView` body/footer.
- Current Status layout: `app/components/workspace/availability.tsx`, `ARColumnHeader`85–132, `LineRow`1137–1260, `ARLineTable`1282–1532; shared beyond these routes. Existing answer interaction is `LineStatusPicker`1054+; do not change it for this layout request. `AvailabilityRequestView`71–80 selects portal/mobile cards;103–126 contains button and explanation.
- Existing matching reference: `app/public/desert-night-chat.webp`, independently viewed; `app/lib/chat-appearance.ts` contains Desert Night wallpaper and violet tint/accent. Existing lighter `desert-plants-chat.svg` is not the dense767 motif. Reuse preference is an outcome, not required helper/architecture.
- Bounded docs: `docs/app/availability-header-metadata.md`, `docs/app/README.md`235–267/partner-route section. Some README layout tracks/order reflect older source; do not use that as authority to reset current layout/operator work.
- Baseline hashes/source limitations: `workspace/threads/main/tasks/ar-status-submit-polish/source-check-2026-10-02.md` on Lily. Images/source checked only; no Lily app edits, tests/build/browser/DB/live queries or runtime verification.

## Handoff log

- 2026-10-02 11:22:50 CDT — Nova main reports R2 `dd16e1fac1d7c584b0fc4878e04de0b8003b785c` independently SOURCE SAFE for shared-supplier-detail-only Status/footer centering, preserved explanation and contained Desert Night motif; R1 selector spill fixed without dialog style change. Seven regression tests prepared UNRUN. Technical execution/build/authenticated four-width/reference QA remain BLOCKED/resource HOLD; existing776 operator ask covers tiny bounded-runner validation then focused-test approval, unanswered. Nothing integrated/deployed. Owner evidence `../nova/workspace/threads/main/tasks/review-ar-status-submit-polish/files/source-review-r2.md` and builder source-candidate-r2 manifest supplied, NOT Lily re-audited. Source-ready awaiting gates only; no duplicate ask/test/build/Telegram/new owner. Raw report captured once as `nova:main:2026-10-02T11:22:50-05:00:ar-polish-r2-source-safe`.

- 2026-10-02 10:57:09 CDT — Nova main confirms requirement received and assigned exactly one existing implementation task `implement-ar-status-submit-polish` for isolated current-main UI candidate/matching docs/tests. Owner confirms public+authenticated shared detail only,0127 preserved, no parallel builder/main overwrite/DB/lifecycle change; independent source/exact-reference visual gates and explicit runtime/resource approvals remain. Await candidate/release report; receipt/assignment is not shipment.

- 2026-10-02 10:54:11 CDT — Nova checkpoint/pause release received; current exact affected-source hashes revalidated, no tracked changes on those affected paths. Full approved requirement successfully delivered via agent-msg to Nova main/existing owner (CLI delivered/ok), subject “Approved UI: supplier AR centered Status/Submit + purple botanical line art”. Routing only, not implementation/QA/release. No parallel builder or operational work. Nova already answered Chris; no Lily Telegram or invented reply receipt.
