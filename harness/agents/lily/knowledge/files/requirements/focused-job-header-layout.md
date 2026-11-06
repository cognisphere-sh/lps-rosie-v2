# Mock up a two-row focused mobile Job header

- Status: drafted · private R3 mockup delivered; awaiting Chris feedback; app implementation held
- Route: nova
- Raised: 2026-09-11 by Chris (via Nova; Telegram photo600/message601; revised photo607/message607)
- Updated: 2026-09-25 12:09:06 CDT

## Current identity-contract caveat

2026-09-25 12:05:28 — Private R3 and Chris's historical visual directions below are unchanged; implementation remains held. Current Rosie intake/app identity source now support stored full Company | Slug names, so the older atomic Job/editor assumption needs provenance reconciliation before any eventual implementation. Rosie's September25 12:09:06 bounded lookup found later case-specific named-site composites but no exact general storage/fallback approval; current source alone is not approval, and no parsing, data correction or frontend workaround is authorized. See `job-request-display-identity` and `workspace/threads/main/tasks/job-name-policy-reconciliation/notes.md`.

## Problem

Chris still finds the focused mobile Job header unsatisfactory and rejected the first private mockup for displaying Ground and Garden three times: “Do I really need to explain why that is terrible?” Repeating the same name wastes scarce phone space without helping him identify the Job. The two-group hierarchy remains, but equal-value repeated-role display is superseded: show the company once and a separate Job name only when it adds distinct information. Mockups remain required before implementation.

## Evidence

- 2026-09-13 17:09:01 CDT — Chris Telegram615: “Ok is has Ground and Gared 3x. Do I really need to explain why that is terrible?” Nova accepted the mistake and is revising the existing private mockup. New direction: company once, distinct Job only, supporting real person + customer Chat only. This overrides earlier mockup instructions to repeat equal Company/Job values, not stored fields or global identity behavior.

- 2026-09-13 — Chris’s exact Telegram607 text: “What is the layout.. can you do mock ups on the UI? JR, Company, status, total Below job name, install date ( 🗓️ icon month day), Rosie. Current view still not great.” Nova handoff16:43:17, photo/message at16:42:38, Lily relay16:43:54 CDT.
- Current visual reference: `workspace/threads/main/files/focused-job-header-reference-607.jpg` on Lily (original Nova `plugins/telegram/inbox/photo_607.jpg`). It shows JR-51 with a tall stacked JR/name/composed-identity/status header, Rosie avatar, and separate customer/contact Chat below. It is visual evidence, not proof of current database values or deployment provenance.
- 2026-09-13 16:44:57 CDT — Additional photo609 shows full current JR-51 (Subtotal $1,526.00 and contact Rene Maldonado); photo610/Telegram611 caption is exactly “Inspiration”. The design uses right-aligned totals, compact status/calendar metadata and Rosie cues. Its sample totals/contacts and Quote due, Follow up and Site visit dates are not record facts or requested workflows. Retained at `workspace/threads/main/files/focused-job-header-reference-609.jpg` and `focused-job-header-inspiration-610.jpg`.
- September11 Telegram601/photo600 originally requested `JR-<id>: Customer – Job · Status`; Telegram603 then requested room for estimated install date and Delivery/Pickup. That one-group presentation is now superseded. Earlier reference remains at `workspace/threads/main/files/focused-job-header-reference-600.jpg`.
- Telegram595 withdrew Chat/avatar removal: “Nevermind they are different threads”. Real customer/contact access and distinct chat destinations remain safeguards.
- September11 source/schema/API review found no supported install-date/mode contract, but that finding is historical, not a claim about September13 support. No new broad audit is required for private mockups; re-audit approved current contracts and deployed availability before any eventual implementation.

## What it should do

**Private R3 mockup delivered only; feedback pending.** Following Chris619 “Can you try again”, Nova delivered the company-once/distinct-Job/person+customer-Chat retry at19:30:19 (Telegram621390 image/622 private link). Nova reports actual-fit long-name fallback, independent25 measurements/44px/no-overflow PASS, and point-in-time private exact-SHA verification. Narrow/long cases still wrap; do not claim universal height savings. This is not Chris’s UX acceptance or app/API/data/date-contract implementation. No fresh Lily audit, duplicate send or new routing; prior rejected artifact remains unchanged.

Current private preview: https://plantsupply.app/a/nova/private/artifacts/job-header-company-once-r3-20260913-fdb7f677 . Reported SHA: `fdb7f677b0a576339d4cc6c769d15437b197625446f10946dfbf0ac229a997a0`. Verification/privacy are reported point-in-time evidence, not an ongoing guarantee. Company-once constraints, distinct stored fields, separate chat contexts and mockup-only limitations below remain.

The supplied inventory was JR, company, Job, status, total, estimated install date, prior Delivery/Pickup, Rosie, contact person and customer Chat. It is a list of candidate/existing elements, not approval to show everything or add a field/workflow. The corrected layout constraints below now govern the resumed private mockup; the inventory is not a current app-build instruction.

**Rejected/superseded preview, retained as evidence only:** https://plantsupply.app/a/nova/private/artifacts/job-header-two-row-preview-20260913-61c9b7a . Nova reports independent exact-SHA PASS for `61c9b7a6de3fc233d0fb497a65b8c1ba4dd26968a37d737bf66082c28233de63`, covering 320/390/480 sample, absent-date, long, equal-value and missing-Job variants. These are **two logical groups**, not guaranteed two literal lines: 390/480 are shorter while embedded 320 is taller; that tradeoff was disclosed. Customer contact/Chat was separate, but repeated company display still failed Chris’s UX review. That static exact-SHA PASS is historical test evidence, **not visual acceptance** and not approval of this design. Lily has not performed another review/test, and this report establishes no live API/data/app/date support or implementation approval.

Evidence: `../nova/workspace/threads/main/tasks/review-two-row-header-mockups/review.md` and `../nova/workspace/threads/main/tasks/two-row-job-header-mockups/evidence/manifest.json` (from Lily).

Show two visual rows/groups in this exact order:

1. **JR / Company / current Status / Total**
2. **atomic Job name only when meaningfully distinct from Company / install date with calendar icon and month-day display / Rosie**

These are information roles, not mandatory literal labels or slash characters. Preserve the app’s familiar chrome, typography, status treatment and context so Chris can judge the arrangement rather than an unrelated wireframe. Use the inspiration’s right-aligned total and compact metadata/Rosie cues within Chris’s explicit two-row order, not its multi-card page or navigation. The calendar remains estimated **install** date, never Quote due, Follow up or Site visit. Keep the two-row hierarchy clear at narrow widths; allow readable wrapping within each group when needed rather than clipping identity, shrinking touch targets or forcing horizontal page scroll. A genuinely distinct Job name remains fully readable.

Use the exact canonical JR reference and show **Company once across the focused header and its supporting customer row**. Show the Job name below only when meaningfully distinct from Company; suppress a redundant equal-value Job display rather than spending another line on the same text. Do not discard a genuine distinct Job/site merely because it shares some company words. This is local presentation only: actual Company and Job values stay independent and unchanged, with no parsing, stored correction, merging or global identity-helper change.

For the Ground and Garden equal-value example, show Ground and Garden once in the top group, not again as the lower Job or in the supporting row. A suppressed duplicate is **not a missing Job**: retain the existing Job-only Edit access with its real saved value; never substitute an Add Job name state. Add applies only when the stored Job is genuinely absent. If Company is absent, retain any real distinct Job and truthful current customer access; never infer company from notes or turn a person into a company.

Include clearly **sample** total/date examples and an honest **absent-date** variant in the private mockups. A sample date must not look like a verified JR-51 install commitment; calendar icon plus month/day is a formatting proposal, not evidence of a saved date. Do not represent absence as today, Created/Updated, an inferred date, or a functioning date editor. Sample total is illustrative, not a quote, recalculation, repricing or authorization to save money. In any eventual implementation, Total must retain the existing authoritative total meaning and source; no new taxes, freight, margins or pricing calculations are implied.

Outside the compact groups, the supporting customer row contains only the **real PERSON name plus customer Chat**, under its existing availability conditions. Do not repeat company there. Omit a genuinely absent person honestly rather than substituting company or inventing a contact; keep the separate customer Chat path under its existing conditions. Rosie remains the existing Job/supplier chooser with canonical Job and distinct stored supplier destinations; customer Chat keeps its own stored customer destination. No control or thread is merged, guessed, created or silently removed. Global identity, atomic Job-name editing and status meaning remain unchanged.

Represent usable spacing for the existing 44px minimum status, Job edit and Rosie touch targets. Eventual implementation must preserve the current status choices/transitions, atomic Job-only save/cancel/trim/blank-as-cancel/error/refresh behavior, keyboard operation, visible focus and accessible names/full identity. Static pictures do not prove those behaviors work.

The prior estimated date/Delivery-Pickup structural scope remains in `job-request-install-date-fulfillment`, staged for Bhoumik under his notes-first decision. The latest lower-row date example does not authorize storage, API, permission, editor, notes-parsing or workflow changes. Delivery/Pickup is not an extra required control in these latest two rows. Any unsupported date/mode capability must stay separate from visual selection.

## Acceptance criteria

### Current deliverable: private mockups, not implementation

- Chris can compare revised faithful mobile UI mockups at 320px, 390px and 480px: top JR → Company → current Status → Total; lower meaningfully distinct atomic Job, when present → calendar/month-day install date → Rosie. The two logical groups may wrap; they must not repeat information just to fill rows.
- Mockups clearly distinguish illustrative sample total/date from verified record facts and include an honest absent-date state. No fake date editor or implied saved install commitment.
- The equal-value JR-51 case shows Ground and Garden **once visually** across the header and supporting row. The latter shows real person Rene Maldonado + customer Chat only; no company repetition. The stored Job remains intact and editable with its real value, not falsely missing or labelled Add Job name.
- A genuinely distinct Job/site stays readable below even when some words overlap Company. Long, absent-company, absent-person and truly missing-Job examples stay honest, without header overflow, invented contacts or loss of a genuine distinct Job name. Add Job name appears only for a truly missing stored value.
- Status, Job edit and Rosie have plausible 44px target space; current semantic distinctions and familiar app chrome remain clear. Customer and Job/supplier chat destinations are not combined.
- The corrected private R3 is available for Chris’s feedback, with390 lead image and responsive behavior. Record the reported measurement/touch/no-overflow PASS without treating it as UX acceptance; long/narrow wrapping remains a disclosed tradeoff. Prior rejected preview stays unchanged. Neither artifact’s test PASS approves app implementation. No duplicate Lily delegation, production UI change, data write, live action, public release or continuation of the superseded implementation is authorized.

### Before any later implementation

- Chris’s visual selection/feedback is incorporated and a separate implementation go-ahead recorded; mockup completion is not shipment.
- Re-audit current approved identity/status/total/date read/write/access contracts and deployment evidence. Do not use September11’s absence findings as current proof. Show only authoritative saved date/mode values supported by approved contracts; absent/unsupported values stay honest, and missing structural work stays Bhoumik-staged.
- Preserve atomic Job editing, current status semantics and choices, existing total meaning, separate customer/contact access and all exact chat routes/threads. No changes to global identity, desktop, All Jobs cards/filters/search/rails, pricing, fulfillment workflow or unrelated detail/table content.
- Any eventual build receives technical and independent rendered visual QA at 320/390/480 plus narrow/wide desktop regression, including keyboard/focus, long/missing/equal identity and action states. Preserve operator changes and serialize overlaps; isolated test fixtures only, no production edits/sends for QA.

## Out of scope

- Implementation, integration, deployment or live edits under this mockup request.
- Data-model/API/permission changes, pricing recalculation, notes parsing, inferred customer linkage, stored-identity deduplication, global identity-helper changes or combined-field storage.
- New date/mode controls or workflow, status transitions, or supplier/customer messaging. Inspiration-only quote-due/follow-up/site-visit dates, contacts, totals and navigation are not authorized data or scope.
- Removing/merging either chat control, changing exact thread destinations, broad identity cleanup, filter work, search, desktop redesign or a new conversation navigator.

## Assumptions

- “Below” defines the second row/group; readable wrapping within each grouping is preferable to clipping at 320px.
- The literal calendar/month-day request specifies the visual cue, not a durable date contract or a fully settled date-format policy.
- `job-request-display-identity` remains authoritative for global stored-component composition and `focused-job-name-inline-edit` for atomic editing. Telegram615’s local duplicate-display suppression supersedes earlier equal-value repeated-role presentation only within this focused-header mockup. It changes neither global stored-component composition nor atomic editing.

## Open questions

- **Chris:** visual feedback/selection on delivered private R3, including narrow/long-name wrapping. App implementation and data/date contracts remain separately unapproved.
- Prior rejected artifact remains unchanged; no new mockup task/review/build is requested by this delivery report.
- **Bhoumik, only if later needed:** any unsupported durable date/fulfillment contract remains in the existing staged requirement, not a mockup blocker or implicit approval.

## Handoff log

- 2026-09-11 13:58:45 CDT — Drafted one-group mobile identity/status layout after direct screenshot/source review; no live or rendered QA verification by Lily.
- 2026-09-11 13:59:48 CDT — Added Telegram603 date/Delivery-Pickup capacity; source/schema/read/edit check found no approved contract then. Notes-first and structural staging preserved; deployed availability unverified.
- 2026-09-11 13:59:48 CDT — Earlier full implementation requirement successfully delivered to Nova main with independent mobile/desktop QA and operator-conflict safeguards.
- 2026-09-11 14:03:34 CDT — Nova accepted/delegated isolated implementation separate from filters; no shared/live changes reported at that time. This historical acceptance does not authorize continuing that design after the September13 supersession.
- 2026-09-13 16:43:54 CDT — Telegram607 supersedes one-group layout with two rows and requests mockups first. Nova already owns private 320/390/480 mockups; record now awaiting visual feedback, not implementation. Sample total/date and honest absence required; existing Bhoumik-staged scope unchanged. No new broad audit or duplicate delegation.
- 2026-09-13 16:44:57 CDT — Captured/directly inspected full current photo609 and inspiration photo610/caption611. Right-aligned total/compact metadata/Rosie cues inform existing mockups only; explicit two-row order and estimated install-date meaning govern. No inspiration sample fact, deadline workflow, All Jobs or navigation redesign is authorized. Internal supersession/hold confirmation successfully delivered to Nova main; no implementation route or duplicate task.
- 2026-09-13 17:06:20 CDT — Recorded Nova’s 17:06:02 private mockup delivery to Chris (Telegram613/614), exact-SHA independent PASS and width/variant coverage as reported. Two logical groups and taller embedded320 tradeoff disclosed; customer contact/Chat separate. Awaiting visual feedback; prior implementation remains held. No new Lily review, tests, build, routing or duplicate external send.
- 2026-09-13 17:09:01 CDT — Telegram615 rejects the delivered mockup for Ground and Garden appearing three times. Nova accepted the mistake and is revising privately. Latest display: company once, Job only if meaningfully distinct, supporting real person + customer Chat only. Equal stored Job remains present/editable; no fake Add state, parsing, storage/global-helper change or chat merge. Static test PASS is not UX acceptance; no new implementation or duplicate review delegation.
- 2026-09-13 17:12:34 CDT — Nova confirms617 asked only for the element list, supplied in618. Existing owner now HOLD pending Chris prioritization; no revision HTML edits or republish happened. Company-once correction stays recorded, prior preview stays rejected, and no redesign or implementation is routed.
- 2026-09-13 18:55:17 CDT — Nova reports Chris619 “Can you try again” resumes private revision2 with same owner, company-once/distinct-Job/person+customer-Chat correction and lead390/responsive variants. Prior rejected artifact unchanged until new review. No app implementation/data/date contract approval, duplicate delegation or new Lily build/review.
- 2026-09-13 19:30:33 CDT — Recorded Nova’s19:30:19 R3 delivery via621/622, current link/SHA and reported independent25 measurements/44px/no-overflow PASS plus point-in-time privacy verification. Actual-fit long-name fallback still wraps for narrow/long cases, without universal height savings. Chris feedback pending, not UX accepted; no app/API/data/date-contract implementation or fresh Lily audit/routing/send.
