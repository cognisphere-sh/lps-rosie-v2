# Keep fulfillment and private handling notes simple for now

- Status: staged · notes-first
- Route: bhoumik
- Raised: 2026-08-31 by Chris (via Nova handoff; Telegram messages 458/464/485/513/527/539)
- Updated: 2026-09-13 16:44:57 CDT

## Problem

Chris needs Job-specific fulfillment and handling facts to be available when the team works a Job: requested/estimated fulfillment timing, Delivery/Pickup, gate/instructions, payment handling, and tax handling. Earlier discussion proposed dedicated structured fields and header selectors, but Bhoumik identifies that as unnecessary complexity before there is a demonstrated need to filter/report on the facts, automate a header, or control their sharing by field.

## Evidence

- 2026-08-31 through 2026-09-01 — Chris requested a structured fulfillment date/Delivery-Pickup header and later exact payment/tax choices, while audits found no current durable field/API contract.
- 2026-09-11 — Bhoumik recommends retaining these as Job notes rather than adding schema, API, selectors, or display wiring now.
- 2026-09-11 13:59:48 CDT — Chris later asks for room in the focused mobile header: “We will need room for an estimated project install date. And Delivery or Prickup indicator” (Telegram603 via Nova; Pickup intended). Responsive layout capacity routes separately through `focused-job-header-layout`; it is not authorization to reverse the earlier notes-first decision. The September11 documented schema, request read shape, header caller and edit allowlist exposed no install-date/mode contract then; deployed database values/permissions were not independently checked. This historical observation must be re-audited against approved current contracts before a later implementation, not treated as current absence.

## What it should do

Use the existing internal Job notes area as the current, simple home for fulfillment and handling information. Write the facts clearly and explicitly, for example:

- fulfillment: requested/estimated date, Delivery or Pickup, and whether it remains to be confirmed;
- delivery: address/instructions and Gate code where relevant;
- payment: handling method or terms;
- tax: Exempt or Non Exempt where known.

Keep private handling information internal. Do not copy Gate codes, payment details/method, tax status, private contacts, or other internal notes into supplier/wholesale views, supplier-visible notes, customer quotes, or external notes unless Chris explicitly approves the specific disclosure.

Defer structured fulfillment date/mode, Gate, Payment Method, Tax Status schema/API, validation/audit, header display/editor/selector, and wholesale top-line synchronization. The focused/All Jobs UI stays truthful: it may show existing notes in its compact notes tray but must not manufacture a date, Delivery/Pickup indicator, selector, or controlled field display from notes, created/updated times, or inference.

Revisit a structured contract only when LPS demonstrates a concrete need for filtering, reporting, automated header display, controlled field-level sharing, or another workflow the notes-first approach cannot safely support.

## Acceptance criteria

- Chris can keep known fulfillment, delivery/gate, payment and tax handling facts in the existing internal Job notes area without a new Job schema/API or selector.
- Notes are explicit enough to distinguish a known fact from an estimate or item still requiring confirmation.
- Gate, payment, tax, private contact and other internal handling notes do not automatically appear in supplier/wholesale, customer, quote, external-note, or other recipient-facing surfaces.
- The focused/All Jobs UI does not invent or derive a fulfillment date, Delivery/Pickup indicator, Gate, Payment Method, or Tax Status from notes or timestamps.
- No structured display/editor/selector or wholesale top-line synchronization ships under this notes-first decision.
- A future proposal for structured fields identifies the concrete filtering, reporting, automated-header, controlled-sharing, or workflow need it solves before it is reconsidered.

## Out of scope

- New Job Request columns, migrations, APIs, validation, audit events, permissions, field selectors, or controlled visibility rules for these facts.
- Resolving relative dates automatically, parsing notes, or using created/updated timestamps as fulfillment facts.
- Showing private handling content to suppliers, wholesale recipients, or customers.

## Assumptions

- Existing internal Job notes already have the appropriate authorized access boundary for this simple approach.
- Notes-first is a current operational decision, not evidence that free text will satisfy future reporting, automation, or sharing needs.

## Open questions

- **Bhoumik:** Chris has named mobile header display as a use case and now asks for a calendar/month-day estimated install-date mockup. Notes-first remains the last recorded structural decision; mockup samples do not authorize a data workflow. Recheck current approved contracts before deciding if any additional authoritative saved date/mode support is warranted. No persistence/API/permission/editor work is authorized by this handoff.

## Handoff log

- 2026-08-31 to 2026-09-01 — earlier staged field-contract proposal covered a date/mode, Gate, Payment Method and Tax Status after audits found no current support.
- 2026-09-11 — reconciled to Bhoumik's notes-first approach: defer all structured schema/API/UI/selector/visibility work. Preserve internal-note privacy; reconsider only with demonstrated filtering/reporting/automated-header/controlled-sharing/workflow need.
- 2026-09-11 13:59:48 CDT — Linked Telegram603’s request for future date/mode room to `focused-job-header-layout` (Nova UI-only capacity). This existing requirement remains staged for Bhoumik; no duplicate structural requirement, reversal of notes-first, inferred header facts or Nova schema/API build. Parent thread to surface the split and current support limits.
- 2026-09-13 16:44:57 CDT — Telegram607/611 two-row mockup/inspiration request retains estimated install date as a visual sample, not source evidence, an edit path or structural approval. This requirement stays staged separately. Quote due/Follow up/Site visit dates in the inspiration are not requested workflows; current contracts must be rechecked before any later build.
