# Keep install, fulfillment, gate and payment facts on each Job Request

- Status: staged
- Route: bhoumik
- Raised: 2026-08-31 by Chris (via Nova handoff; Telegram messages 458/464/485/513/527)
- Updated: 2026-08-31

## Problem

Chris wants the focused Job header to state the estimated project install date and whether fulfilment is Delivery or Pickup, and the focused detail tray to hold a dedicated Gate code and Payment method. None exists as durable Job Request data today: they cannot be shown truthfully, edited, or carried through request paths. An address or free-text note may hint at a delivery plan, but is not a reliable fulfillment decision; a Gate code must not leak into supplier/customer-facing content.

## Evidence

- 2026-08-31 — **Focused Job header date and fulfillment**: Chris specified the exact header order: Estimated project install date, then a Delivery/Pickup selector immediately to its right.
- 2026-08-31 — app/schema audit: `job_requests` has no project/install-date or fulfillment-mode field; its request read models and GET APIs omit both; the approved Job Request update path does not permit either. The focused header intentionally receives no project date, and current Jobs documentation prohibits treating created/updated dates, address data, or notes as an install date or fulfillment method.
- 2026-08-31 — Gate/payment audit: `job_requests`, its read models/APIs, and writable-field allowlist contain no Gate code or Payment method. Current Job overview explicitly says delivery schedule/payment method are not recorded. Supplier portal availability is a fixed scoped projection and customer quotes use separate external notes, so neither new internal value would leak automatically; neither may be copied into supplier-visible LPS notes or customer-facing content without explicit approval.
- 2026-08-31 — **Mobile All jobs date resolution**: Chris removed Last updated from the mobile summary; only this optional structured Install Date, tied to structured Delivery/Pickup, may later occupy that compact summary slot. It is blank until deliberately supplied and must never be created/updated time or note-derived.

## What it should do

Give every Job Request optional, durable facts: one consistently named requested/estimated **fulfillment date**; a constrained **fulfillment mode** with exactly Delivery or Pickup; a dedicated **Gate code**; **Payment Method** with exactly `Over the Phone`, `On File`, `At Pick Up`, `Terms`, `Check`; and **Tax Status** with exactly `Exempt`, `Non Exempt`. They are real Job Request facts, not derived labels.

Make the values available consistently to established authorized Job Request read paths and persist intentional create/edit changes through an approved Job Request update path with validation and audit history. Preserve an honest empty state: a Job Request may begin without an install date or fulfillment choice and remains unset, without a fabricated date, inferred delivery method, invented Gate code, payment default, or choice that claims Chris made it. Last updated, created timestamps, and notes are not substitutes for install date. Gate code and payment method are internal by default: do not copy either into supplier-visible availability notes/portal content or customer-facing quote/external-note content without a separately approved disclosure policy.

Define the operational contract before release: who may set/change each value, when the estimate should be reviewed as a job progresses, how an unset value is presented, and whether/when a value becomes locked or remains editable. When intake contains a relative delivery phrase (for example, “next Tuesday”), retain the source text, source provenance and received-at reference; define timezone/reference-date resolution, confirmation, normalized Install Date/Delivery-Pickup storage, and revision behavior. The UI must never resolve that phrase on its own. Existing Job Requests must remain readable and truthful until values are deliberately supplied.

## Acceptance criteria

- A Job Request can durably retain one optional requested/estimated fulfillment date; one optional fulfillment value, Delivery or Pickup; one optional dedicated Gate code; one optional Payment Method from exactly Over the Phone, On File, At Pick Up, Terms, Check; and one optional Tax Status from exactly Exempt, Non Exempt.
- The values survive refresh and are returned consistently through the existing Job Request read paths used by focused Jobs, Jobs/Requests management, and approved related views.
- An approved Job Request update path saves intentional changes to each value and preserves the existing trigger-backed audit/history behavior for such changes.
- A Job Request may be created with requested/estimated fulfillment date and fulfillment mode unset, then intentionally edited later; an unset value remains explicitly/unambiguously unset. The system does not substitute Last updated, created timestamps, addresses, sourcing notes, or another indirect value. Any future compact All jobs summary display remains blank in that state and presents the agreed structured fulfillment date only alongside structured Delivery/Pickup.
- Delivery/Pickup, Payment Method and Tax Status are constrained deliberate choices, not arbitrary text, and none is silently defaulted from an address or notes.
- Once the durable contract is approved, the critical Ops top line shows an editable requested/estimated fulfillment date and Delivery/Pickup selection; a blank/unset record remains blank. Wholesale request views receive only the persisted top-line date and Delivery/Pickup indicator per the approved visibility decision. Gate code, Payment Method, Tax Status, private contacts and other private detail are internal by default and do not appear in supplier portal/availability content, supplier-visible LPS notes, customer quotes, external notes, or another customer surface unless Chris explicitly approves a separate disclosure rule.
- Existing Job Requests and all existing job/request workflows, status actions, lines, chats, availability behavior, permissions, and routes remain intact.
- The documented lifecycle/ownership, permissions and validation rule states who can create/change an estimate or its associated fulfillment choice, when it is reviewed, and whether either becomes locked; it handles new and legacy unset requests safely.
- A relative delivery phrase from intake retains its source text, provenance and received-at reference, with an explicit timezone/reference-date resolution and confirmation rule before it becomes an Install Date or Delivery/Pickup fact; revisions remain attributable.

## Out of scope

- The focused-header/details-tray visual layout, responsive styling, or editable UI controls; those are Nova UI work only after this contract is available.
- Inferring delivery/pickup, Gate code, or payment method from an address, notes, customer type, supplier, or availability request.
- Creating delivery schedules, routing/dispatch, orders, supplier commitments, or a new status/lifecycle.

## Assumptions

- The structured date is one calendar-date estimate, not created/updated time and not an appointment/schedule; Bhoumik resolves its exact name/meaning with Chris before schema/UI.
- Delivery and Pickup are the complete initial fulfillment vocabulary Chris requested; Over the Phone, On File, At Pick Up, Terms, Check are the complete initial Payment Method vocabulary; Exempt and Non Exempt are the complete initial Tax Status vocabulary. Any additional choice requires an explicit business decision rather than free text.
- The fields are optional because Chris may not know either fact when a Job Request begins.

## Open questions

- Bhoumik: settle one consistent requested/estimated fulfillment-date name and relationship to Pickup/Delivery, reconciling Chris’s earlier estimated order/delivery/install wording before schema/UI.
- Bhoumik: reconcile LPS Job status with supplier-facing availability-request status before either appears in the wholesale-request top line.
- Bhoumik: who may edit each value, at what job stages, and whether any becomes locked once the Job is confirmed/ordered?
- Bhoumik: which authorized internal Job Request/order views must consume the new contract beyond focused Jobs, while retaining an honest unset state? Any supplier/customer disclosure remains out until explicitly approved.

## Handoff log

- 2026-08-31 — staged for Bhoumik after the install-date/fulfillment audit found no schema, read/API, or approved write-path support. Nova must not create a nonpersistent or inferred selector; once Bhoumik approves the durable contract, a separate Nova UI slice can place the header display/editor.
- 2026-08-31 — expanded after Gate/payment audit found neither field in schema/read/API/write support. Existing immutable trigger-backed Job Request history can audit approved new values. Gate code/payment method must be internal-by-default; do not auto-copy Gate code into supplier-visible LPS notes or either field into customer external notes/quotes.
- 2026-08-31 — amended after Chris's Telegram message 485: the staged nullable install-date plus Pickup/Delivery contract is explicitly blank-at-creation and editable later; it is the only future primary-header date. Last updated moves to expandable Request / Job details and is never a substitute.
- 2026-09-01 — JR-19 source-email evidence confirms intake can extract explicit Job/contact/address facts, but “Delivery next Tuesday” is not current durable date/mode data. Bhoumik's contract must retain source/provenance/received-at and define confirmation-based relative-date resolution; Nova must not infer it.
- 2026-09-01 — Chris's message 513 confirms relative phrases resolve during intake and are stored with traceability: email received Tue Aug 18 2026 + “Delivery next Tuesday” yields a confirmation-approved estimated date Tue Aug 25 2026. He calls it estimated order date, while earlier language says Install Date; semantic/name resolution is explicitly staged before schema/UI. No existing data was mutated.
- 2026-09-01 — Chris's message 527 defines the durable contract expansion: LPS and wholesale-request top line needs Job status · Customer/Contractor · Job identifier · requested/estimated fulfillment date · Delivery/Pickup; compact internal tray needs Contact, Payment Contact, Delivery, instructions/Gate, exact Payment Method and Tax Status enums. Bhoumik owns nullable schema/API/create-edit validation/audit/permissions and visibility. Wholesale receives only top-line fulfillment facts; payment/tax/gate/private contacts stay hidden absent explicit approval.
- 2026-09-01 — Chris's message 539 reconfirms the explicit dependency: after persistence/API exists, Ops has editable date and Delivery/Pickup selection in the critical top line; wholesale has only approved persisted indicator/date. Unset stays blank; created/updated timestamps and notes are never substitutes. This is later UI migration, not current fake UI.
- 2026-08-31 — cross-referenced `mobile-all-jobs-toolbar`: the compact mobile summary may show Install Date only after this durable contract exists, tied to Delivery/Pickup; until then it remains blank and Nova must not infer from dates or notes.
