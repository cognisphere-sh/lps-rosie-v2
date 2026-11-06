# Reimagine Status on the AR print sheet

- Status: drafted · PRIVATE PREVIEW DELIVERED to Chris830; awaiting layout choice, app implementation unapproved
- Route: nova (existing design owner, not a new build assignment)
- Raised: 2026-10-23 by Chris via Nova
- Updated: 2026-10-23 11:24:36 CDT

## Problem

The pictured Availability Request paper sheet repeats a tall six-choice Status list on every line. Chris asks for a better layout. The design goal is easier paper scanning and marking without sacrificing readable labels, writing space or existing answer meaning; less height is useful only if the form remains usable.

## Evidence

- 2026-10-23 11:16:11 CDT — Parent relays Nova11:15:53, attributing Chris Telegram828 at11:14:19. Request is compressed intent, not verified verbatim. Feedback handle `nova:main:2026-10-23T11:15:53:ar-print-status-layout-828`.
- Private `photo_828.jpg` inspected in place only: printed Availability Request with repeated vertical six-choice Status lists. No private names/rows/image copied or published.
- 2026-10-23 11:24:36 CDT — Parent relays Nova11:24:15: existing `ar-print-status-preview` delivered Chris830 (reply828) a safe synthetic A print PNG and [private comparison](https://plantsupply.app/a/nova/private/artifacts/ar-print-status-concepts). A recommended: full-label 2-column × 3-row grid, easier marking. B: six tick columns with full legend EACH page, denser. No layout adopted or app approval.
- Owner reports actual Chromium Letter-PDF rasterization and synthetic local320/390/480/1440 wrapper/label-overflow PASS; B21-row repeat-legend/footer verified. Not physical handwriting, live app print QA or Lily independent verification; browser closed/Daisy coordination reported. No app commit/build/deploy.
- Owner source mapping caveat: `(arAnswerOption ?? empty-string) == option`, with Pending represented by empty string, can mark Pending for NULL/empty. Earlier unanswered≠Pending paper intent was proposed, NOT verified current behavior. Mock unmarked paper examples are not a saved-mapping proposal. Existing arriving_soon→Can Order and unavailable named-substitution→Diff mappings are not new design. Source/photo evidence is not live proof. Feedback `nova:main:2026-10-23T11:24:15:ar-print-status-concepts-delivered-830`.

## What it should do

Compare a compact two-column per-line status arrangement with Nova's slimmer shared-header alternative on paper, retaining an unambiguous association between each line and its answer. Prefer readable full labels and adequate hand-marking space over density alone. Compare blank and filled examples with synthetic content only. This draft records review criteria, not a selected design or permission to build the app change.

## Acceptance criteria for design review

- All six existing printed labels remain present and distinguishable: **Available**, **Unavailable**, **Diff Sz/Sub**, **Can Order/Arriving Soon**, **Partial Qty**, **Pending**. No new status, shortened-away meaning or invented combination.
- One answer belongs to one item. Square paper marks must not imply a new multi-select status model. Preserve the existing saved-answer mapping; do NOT infer unanswered≠Pending as an approved correction. Owner reports current NULL/empty can mark Pending. Unmarked mock paper examples demonstrate layout, not proposed saved-data behavior; any future semantic correction must be separately scoped/authorized before app implementation, not bundled here.
- Blank paper forms remain easy to mark by hand; filled forms clearly distinguish an existing answer from unmarked choices without relying on color. Text and mark outlines remain legible in ordinary black-and-white printing, including the longest label.
- The comparison retains usable quantity, price and notes space, long-content legibility, and clear row boundaries; no clipped labels, overlapping marks or row/answer ambiguity. A shared legend must remain understandable on every printed page and not require guessing codes.
- Multi-page examples retain current print-page identification and item/status association across page breaks. No new or lost request/Job identity disclosure. Screen-readable preview text has a sensible reading order; no claim of tested app/export accessibility from a static mock.
- Existing audiences and price/notes inclusion remain unchanged. Preserve current blank versus populated behavior and paper-form purposes; no internal notes or commercial information added to another audience.
- The private mock is reviewed before parent seeks any app implementation decision. Preview delivery is not Chris's design acceptance, app authorization, shipment, or live print QA.

## Out of scope

- Live status picker, All Jobs toolbar/filters, AR Submit styling, Android app top band and supplier chat contrast.
- App implementation until separate approval; duplicate mock/source audit, browser/tests/DB work by Lily.
- New statuses, multi-select answers, data/availability semantics, fields, send/routing policy, broad print/export workflow or template redesign.
- Private customer/Job data copied into mockups or published examples.

## Assumptions

- This is a printed-form presentation request, not a request to change the availability model or live screen controls.
- Compact two-column and shared-header layouts are alternatives to evaluate, not Chris-approved solutions; density alone does not decide the winner.

## Open questions

- Await Chris's layout review/choice. Parent owns any needed follow-up; no new external question while review is pending. App build approval is not established.
- No current mapping-change assignment or automatic Bhoumik question: any demonstrated future semantic need must be separate from this presentation slice.

## Handoff log

- 2026-10-23 11:16:11 CDT — Captured attributed request and drafted bounded design criteria. Nova already owns `ar-print-status-preview`; no new builder/build route or approval assumption.
- 2026-10-23 11:24:36 CDT — Parent reports draft path already forwarded to Nova11:18 (not builder route). Nova11:24:15 reports private comparison delivered830, bounded owner PDF/local QA and current source mapping caveat above. Corrected earlier proposed unanswered≠Pending criterion; no semantic fix bundled. Remains drafted/awaiting Chris choice, not app-approved/routed/shipped. No duplicate audit/mock/browser/builder/Telegram/question.
