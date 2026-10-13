# Supplier shared AR detail presentation

`AvailabilityRequestView` is the shared body/footer for
`/public/availability/:token` and `/partner/:id/requests/:arId`. Its header
card, note card and submit bar are exported (`ARRequestHeader`,
`ARRequestNote`, `ARSubmitBar`) and also drawn by the admin job page's AR tab
(see [all-jobs.md](all-jobs.md)), which adds in-place editing.

Only that view and the job page's AR tab pass `centerStatus` to `ARLineTable`. The prop defaults to
`false`: ordinary Ops drawers, focused portal-style drawers, supplier profiles
and leading-column By-item tables retain their prior presentation. It affects
only the desktop table: Status heading text and the row's picker wrapper are
centered in the existing grid track. A transparent 3px header left border
matches each row's accent border so their track centers coincide. The existing
column order, saved reorder/resize widths, content, horizontal overflow and
picker semantics are unchanged; only the immediate desktop Status trigger button
has a minimum 44px height, via `[&>button]:min-h-11`. Nested in-cell answer-dialog
buttons (No Sub, Cancel, Submit and Save answer) retain their existing sizing.
The trigger's labels/options and font size are unchanged. Below 900px,
the shared view still mounts the existing stacked phone cards and labelled
Status controls instead of the desktop table.

The pinned footer holds the centered full-width button (up to 384px) alone;
the explanatory sentence under it was removed on 2026-10-07, here and on the
job page's AR tab, which draws the same `ARSubmitBar`. Safe-area padding and the independently scrolling body
remain intact. Since 2026-10-07 the button is a plain `bg-primary` /
`text-primary-foreground` button in the app's theme colour (it previously
reused the purple-tinted `/desert-night-chat.webp` artwork); it retains its
focus outline, disabled semantics and 48px minimum height.

All current handlers and gates remain as before: Submit/Re-Submit depends on
stored `submittedAt`, saving disables the action and says Submitting, accepted
answers play the existing receipt, failed submission leaves the existing
error behavior, and closed requests have no submit bar. Notes, answer dialogs,
prices, disclosures, summaries and the printable sheet are unchanged. This is
not a database/API/publication/lifecycle change; the existing Draft and
permission gates remain owned by the routes and APIs.

## Verification boundary

`app/lib/availability-shared-detail-polish.test.tsx` adds offline DOM regression
coverage for the opt-in/default boundaries, persisted reorder/resize, keyboard
answering/focus, direct-trigger selector isolation across nested answer dialogs,
centered footer/decorative content, note submission/receipt,
loading/saving/closed/error gates and the three phone card breakpoints. These
assertions do not establish browser geometry, contrast, motif recognition,
long-table scrolling or independent reference similarity.

The isolated source candidate's automated tests, typecheck/build and rendered
QA are **unverified** while resource-safe execution authorization is held.
Before release, independent technical approval and the `visual-ui-release-qa`
exact-candidate gate must cover both routes at 320/390/480/1440px, keyboard and
answer dialog focus, long tables/text, horizontal scroll, reorder/resize and
all affected states. Private chat/customer references must not become public
fixtures or evidence. Source inspection alone is not a visual PASS or a release.
