# Supplier shared AR detail presentation

`AvailabilityRequestView` is the shared body/footer for
`/public/availability/:token` and `/partner/:id/requests/:arId`.

Only that view passes `centerStatus` to `ARLineTable`. The prop defaults to
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

The pinned footer has two independently centered rows: the full-width button
(up to 384px) and its wrapping explanatory sentence. The explanation is also
visible on phones. Safe-area padding and the independently scrolling body
remain intact. The button reuses `/desert-night-chat.webp`, scaled to a 240px
repeat and tinted purple inside its bounds; it does not read chat settings or
private reference images. The decorative span is noninteractive and
`aria-hidden`. White text has a solid `#3b225e` backing, independent of the
motif; the button retains its focus outline, disabled semantics and 48px
minimum height. No animation is added.

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
