# Quick quote first, availability later, on the same Job Request

- Status: staged — one-JR quick-quote path supported in current instructions/source; dashboard deferred; no build authorized
- Route: bhoumik
- Raised: 2026-08-29 by Chris (via telegram)
- Updated: 2026-09-16T14:47:43-05:00
- Scope correction: the earlier separate-opportunity/new-JR conversion assumption is superseded for item 7. Filename retained for existing references; it is not a conversion-build instruction.

## Problem

An early indicative quote must not prematurely request supplier availability. Lily previously equated “no sourcing yet” with “no Job Request yet,” and recommended a separate quote record followed by new-JR creation. Bhoumik corrected that distinction: create the JR at the start, quote without an AR, then request availability on that same JR when Chris instructs Rosie. A possible later direct-to-order case must not be mistaken for an already-supported no-AR order path.

## Evidence

- 2026-08-29 — Chris described early budgeting quotes and a separate Quote-view opportunity at greater volume. This historical direction does not make a separate product mandatory.
- 2026-09-11 05:25:29 CDT — Lily recommended manual new-JR creation from a prior quote, unverified and not approved. That recommendation is superseded.
- 2026-09-11 05:38:08 CDT, Bhoumik, Telegram289 — Start with one JR; a quick quote generates no AR; when the customer returns, Chris asks Rosie to send an AR on the **same JR**. He requested an instruction/status review, not implementation.
- 2026-09-11 05:40:53 CDT — Rosie confirmed that interpretation. September 11’s audit and nine local status/filter test passes are historical evidence, not current order-capability or deployment verification.
- 2026-09-16 — Current `quote-generation` and `job-requests` still specify one-JR no-AR quick quoting, stopping after the quote; ordinary-job AR sending now explicitly waits for Chris’s approval.
- 2026-09-16 14:41:27 CDT — Chris’s JR-59 example says to quote everything, reports APS can get everything with lead time, and illustrates possibly skipping Availability for an order. Exact quote and provenance: feedback **JR-59 may skip availability**.
- Current bounded audit, including Rosie and Nova’s read-only confirmations: `workspace/threads/main/tasks/status-lifecycle-clarification/audit-2026-09-16.md`. Earlier audit: `audit-2026-09-11.md` in that directory.

## What it should do

Use one JR and its thread from an explicit quick-quote request through later supplier sourcing. Reuse an existing relevant JR rather than duplicating it. Preserve customer, plant/size, quantity and quote context.

During a quick quote, use supported pricing without creating/sending an AR or contacting suppliers. APS is the current default scope in the inspected instructions; any exception requires Chris’s authorization. Missing prices or unclear identities are not invented. Catalogue pricing is not confirmed availability, a reservation or a supplier commitment.

Generating a quote for Chris is distinct from sending it to the customer. Actual delivery retains existing approval/owner-thread rules and is recorded only after it occurs. Neither generation nor delivery itself authorizes supplier outreach. Quote-only work stops after quoting rather than initiating an availability-send approval ask.

When Chris later explicitly authorizes availability, use the **same JR**, review current requirements/lines and follow the owned supplier-coordination procedure. An appropriate existing open AR can be reused rather than duplicated. Current ordinary-job instructions require explicit AR-send approval; the historical September 11 APS portal standing-permission statement is superseded, not preserved as current authorization.

Supplier answers remain factual sourcing evidence. An availability response by itself neither establishes customer commitment nor authorizes customer-facing changes.

Current Job stages are **Quote, Availability, Committed, Won, Lost**. Quote starts at intake and alone does not establish completed pricing or customer delivery. Availability follows approved supplier-request delivery. No additional quote-conversion stage or new vocabulary is requested.

## JR-59 example — not acceptance or order authorization

Rosie identifies the example as Ground and Garden, a 26-line phased request created from the preceding message128. Chris’s statement about APS capability with lead time is his reported expectation, not an independently verified stock/price promise. Unknown prices stay unresolved; phase/timing context may remain notes-first.

The example reinforces quote-first flexibility but does not make an AR mandatory merely for a quick quote. It also does not prove that an actual accepted order can currently be created without one. The inspected order-creation path requires answered AR source lines and their job allocations, even if the JR skips the displayed Availability stage. **Skipping a stage is not skipping those source records.** The no-AR accepted-order behavioral gap is staged in `order-dispatch-and-supplier-response`, not implemented or newly routed here.

## Acceptance criteria — verify behavior, not new-build authorization

- An explicit quick quote creates/reuses one JR/thread but creates no AR or supplier contact and does not imply confirmed plant availability.
- A general price lookup is not misclassified as a new JR.
- A draft for Chris is not recorded as customer-delivered until actual authorized delivery.
- A later approved availability instruction uses the original JR and reviewed current scope, without second-JR conversion.
- Repeated quote work does not regress Availability/Committed or reopen a terminal job.
- Quote-only/direct-order examples do not manufacture customer acceptance, supplier commitments, prices or orders.
- The current five Job stages are preserved; no Quote Delivered, Pricing or conversion stage is required for this correction.

## Current implementation and verification limits

Current instructions/source support the same-JR quick quote and later approved AR. This is distinct from a complete no-AR order workflow: current source includes Orders, but the guarded creation contract requires availability sources. A status-only customer-confirmation event creates no order. The old six-stage/Orders-placeholder findings must not be restated as current behavior.

Supplier confirmation is an Order event, not a JR Confirmed stage. App Order labels currently read New/Processing/Order Ready/Closed Won/Closed Lost; older skill/docs wording differs. The audit records that drift without authorizing a change.

No live JR/AR/order, production query, send or deployment check was performed. Source support, including staged changes, is not tested end-to-end operation or approval/rollout proof. No new universal verification gate is proposed; the order-input constraint is reported as observed behavior.

## Out of scope / open follow-through

- Separate quote database, conversion engine, Quotes view or dashboard as mandatory work. Chris’s broader view wish remains deferred, not dropped.
- Code, schema, status, skill, deployment, data changes or implementation routing.
- Reconsidering the accepted-order no-AR gap or order-dispatch scope without Bhoumik’s decision; tracked in the existing order requirement rather than duplicated here.
- Live workflow verification remains unperformed. No extra clarification/verification procedure is imposed on Rosie’s JR-59 pricing.

## Handoff log

- 2026-08-29 — Staged broader separate-Quote-view/new-Request conversion direction.
- 2026-09-11 05:25:29 CDT — Lily suggested manual new-JR creation; no approval or capability validation.
- 2026-09-11 05:38:08 CDT — Bhoumik corrected item 7 to one JR from the start and requested current instruction/status audit.
- 2026-09-11 05:45:38 CDT — Audit corrected this requirement to the existing one-JR/no-AR quick quote. No implementation/runtime changes.
- 2026-09-11 05:49:31 CDT — Main reported item 7 supported. Linked lifecycle/business records reconciled; future dashboard deferred, with no stricter confirmation policy asserted.
- 2026-09-16T14:47:43-05:00 — Added JR-59 exact-provenance illustration; refreshed lifecycle/authorization/order assumptions against current source and owner reports. No-AR order creation is unsupported by the inspected contract, unlike no-AR quick quoting. Existing order requirement holds the Bhoumik decision; no new build or operational action.
