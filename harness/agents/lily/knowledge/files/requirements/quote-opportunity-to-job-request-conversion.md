# Quick quote first, availability later, on the same Job Request

- Status: staged — current one-JR path supported by skills/source; no new implementation authorized
- Route: bhoumik
- Raised: 2026-08-29 by Chris (via telegram)
- Updated: 2026-09-11
- Scope correction: the earlier separate-opportunity/new-JR conversion assumption is superseded for item 7. Filename retained for existing references; it is not a conversion-build instruction.
- Disposition (2026-09-11 05:49:31 CDT): main has told Bhoumik the current item-7 workflow is supported, with no new Sales vocabulary or conversion needed. A separate Quote/dashboard view remains a deferred Chris wish, not a dependency. Source/skill support is verified; a live end-to-end round trip is not.

## Problem

An early indicative quote must not prematurely request supplier availability. Lily previously equated “no sourcing yet” with “no Job Request yet,” and recommended a separate quote record followed by new-JR creation. Bhoumik explicitly corrected that distinction: create the JR at the start, quote without an availability request, then request availability on that same JR when Chris instructs Rosie.

## Evidence

- 2026-08-29 — Chris described early budgeting quotes and a separate Quote-view opportunity at greater volume. This historical direction does not override current instructions or make a separate product mandatory.
- 2026-09-11 05:25:29 CDT — Lily recommended manual new-JR creation from a prior quote, explicitly unverified and not approved. That recommendation retained the separate-record assumption and is now superseded.
- 2026-09-11 05:38:08 CDT, Bhoumik, Telegram 289 — Create a JR from the beginning; a quick quote generates no AR; when the customer returns, Chris asks Rosie to send an AR on the **same JR**. He requested an instruction/status review, not implementation changes.
- 2026-09-11 — Current `job-requests` §1/§4/§6, `quote-generation` §1/§4 and `message-routing` §§1–2 explicitly create/reuse the JR for quick quotes and carry `quote_only: true` to suppress ARs and supplier contact. Simple price questions create neither JR nor AR.
- 2026-09-11 05:40:53 CDT — Rosie confirmed the same-job interpretation and current policy in a read-only reply. She supplied no separate approval artifact for stricter commitment gates or a persistent quote-only field.
- Read-only audit: `workspace/threads/main/tasks/status-lifecycle-clarification/audit-2026-09-11.md` contains source/API/migration citations, stage mapping and verification limits.

## What it should do

Use one JR and its `jr-<id>` thread from an explicit quick-quote request through later supplier sourcing. Reuse an existing relevant JR rather than duplicating it. Preserve customer, plant/size, quantity and quote context on that record.

During the quick-quote instruction, Rosie uses supported APS or explicitly named supplier inventory pricing, without creating/sending an AR or contacting suppliers. Missing prices or unclear plant identities must not be invented. Catalog prices are not confirmed availability or a reservation.

Generating a quote for Chris is distinct from sending it to the customer. Customer delivery follows existing Chris authorization and owner-thread rules, and is recorded only after actual delivery. Quote generation or sharing does not itself authorize supplier outreach.

When Chris later asks for supplier availability, use the **same JR**, re-read changed requirements/current lines and follow existing supplier coordination. An existing appropriate open AR is reused rather than duplicated. Partner portal publication and non-partner email follow their existing authorization and delivery rules; a prepared public link is not a sent email. Existing ordinary APS portal standing authorization is preserved, not broadened to the quote-only action.

Supplier answers remain factual availability/price evidence with AR state, sourcing updates and internal notifications. They do not automatically change Job/Order Sales status, establish customer commitment, select an offering, or send customer-facing changes.

The existing Sales vocabulary already fits: **Active, Quote, Availability, Confirmed, Won, Lost**. Quote covers completed pricing work as well as sharing; Availability starts on supplier-request delivery, not supplier completion. These are current observed rules, not a requested vocabulary change.

## Acceptance criteria — workflow to verify, not new-build authorization

- An explicit quick quote creates or reuses one JR/thread; completing pricing produces no AR or supplier contact and leaves plant availability unconfirmed.
- A general price lookup is not misclassified as a new JR.
- A quote prepared for Chris is not recorded as customer-delivered until it actually is; outward communication retains existing Chris authorization.
- A later explicit instruction to request availability uses the original JR and reviewed current plant/quantity scope, without a second-JR conversion.
- Repeated pricing or quote work does not regress Availability or Confirmed, and supplier input does not automatically change Sales status.
- Existing exact Sales labels remain; no Quote Delivered, Pricing, New/In Progress or extra conversion stage is required for this correction.

## Current implementation and verification limits

Current skills and checked-in migrations 0088/0089 support this path. The app AR API takes an existing Job Request ID and its line IDs; pricing hooks advance Sales stage but do not create ARs. `quote_only` is a handoff instruction, not an established app/database field in the inspected code.

Nine local status/filter unit tests passed. No live JR/AR, email, quote publication or production status was created/changed; end-to-end agent adherence and deployment state were not independently verified.

Current confirmation policy permits an explicit customer-confirmation event from Active, Quote or Availability, including without an AR. The older Lily claim that a supplier-verified package is a universally enforced prerequisite is **not** the current implementation. It must not be reintroduced silently. This does not turn customer acceptance into proof of supplier price/stock verification, order placement, or fulfilment.

The current supplier Orders page is a placeholder. Actual Order Details creation and a complete quote-event ledger are not established by this audit or prerequisites for correcting item 7.

## Out of scope

- Separate quote database, conversion engine, new Quotes view or dashboard as mandatory work.
- Code, schema, status, skill, deployment or data changes; implementation routing.
- Changing current authorization, confirmation, order-placement or closure policy.
- Dropping Chris’s broader historical Quote-view direction on his behalf.

## Open questions / smallest possible follow-up

- **Bhoumik:** No vocabulary change is indicated for this workflow. If he wants an explicit reminder in Rosie’s owned instructions, authorize only a clarification that a later Chris AR instruction ends the quote-only action on the same JR, with reviewed current lines and existing supplier gates. Not applied or routed.
- **Bhoumik, separately if desired:** Resolve any intended stricter supplier-verification prerequisite before Confirmed against current policy. This is a commercial/workflow decision, not a rename, and does not block the same-JR correction.
- Live workflow verification remains unperformed; source support is not a claim of a tested customer round trip.

## Handoff log

- 2026-08-29 — Staged broader separate-Quote-view/new-Request conversion direction.
- 2026-09-11 05:25:29 CDT — Lily suggested manual new-JR creation rather than a new quote product; no approval or capability validation.
- 2026-09-11 05:38:08 CDT — Bhoumik corrected item 7 to one JR from the start and asked for a current instruction/status audit.
- 2026-09-11 05:45:38 CDT — Audit corrected this requirement to the existing one-JR/no-AR quick-quote path; prior separate-record/manual-new-JR assumption is superseded, not a mandatory build. No implementation or runtime changes.
- 2026-09-11 05:49:31 CDT — Main reported item 7 supported to Bhoumik. Reconciled the linked Sales-lifecycle requirement and business picture; no stricter confirmation gate asserted, and future dashboard remains deferred. Raw feedback and unrelated status labels unchanged.
