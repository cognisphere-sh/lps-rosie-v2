# Make mobile request work dependable in the field

- Status: staged
- Route: bhoumik
- Raised: 2026-09-10 by Chris (via Telegram)
- Updated: 2026-09-10

## Problem

Chris tried to update a request from his phone while walking the yard and says it “was not great.” Easy, effective mobile request work is critical: a phone journey must let him locate the right live request, understand it, make a safe change, and know that the change landed without losing his place. The app has separately scoped mobile list, focused Job, intake, chat-routing and availability-request improvements, but no single operational acceptance journey verifies their handoffs together.

## Evidence

- 2026-09-10 — Chris directly reported the field-use failure and importance of mobile request work.
- 2026-08-30 to 2026-09-01 — repeated All Jobs and focused-Job feedback established that phone space, identity, direct drill-in, safe actions and readable status cannot be treated as cosmetic details.
- `mobile-all-jobs-toolbar`, `mobile-focused-job-header`, `job-inbox-workspace`, `mobile-availability-request-view`, and `focused-job-chat-routing` already define bounded UI slices; `visual-ui-qa-gate` already requires viewport review, but does not define this end-to-end business journey.

## What it should do

Define and own one field-use acceptance journey for an existing or newly started request on a phone. It must verify the complete handoff, rather than create a competing mobile screen or duplicate the UI requirements already routed to Nova:

1. **Find and open:** From Jobs or All Jobs, Chris can search/filter and identify the intended request from truthful customer/job identity, JR reference and current sales state, then open that exact request.
2. **Orient:** The focused request makes the same request identity and current state clear before he acts. Its immediately available totals/plant work, secondary details, canonical Job chat and linked availability-request path must not make him guess which request he is changing.
3. **Update safely:** A request-level message/action goes to the current request’s canonical Job conversation; an availability-request update opens its dedicated phone detail, where its supplier, request state, line answers and the applicable Save/Submit action are clear. A write either gives an unambiguous acknowledgement of the exact request and result, or remains visibly unsaved/actionable with the reason. No mobile shortcut may infer unavailable data, bypass existing price/status/availability controls, or make destructive action easier.
4. **Acknowledge and return:** After a save, submit, chat instruction, cancellation or close, Chris can tell what happened and return through normal device/browser navigation to the same working list/request context without silently opening a different request or losing the thread that owns the work.

Bhoumik must decide the cross-cutting operational ownership and success/failure acknowledgement contract, including which existing workflow events count as a completed mobile update and how an incomplete/failed update remains recoverable. Nova continues to implement only independently supported UI slices; their release review must exercise this journey where they affect it.

## Acceptance criteria

- On a real phone-sized browser at 320px, 390px and 480px, Chris can find a known active request in Jobs or All Jobs and open the exact JR he selected; no other request is silently selected.
- Before updating, the focused view makes that request’s truthful identity/JR and current sales state discernible, and provides reachable routes to its existing Job work, details and linked availability-request work without clipping, ambiguous controls or page-level horizontal scrolling.
- A focused-Job chat instruction visibly targets that exact canonical `jr-<id>` conversation before send; it cannot reuse a prior Job as its destination.
- For a linked availability request, Chris can identify its supplier and request state, inspect/edit its available line answers, and reach the applicable Save/Submit control without accidental adjacent control activation. A successful save/submit identifies the completed request/result; a failure or incomplete action stays actionable and does not look durable.
- Existing request/status/price/availability permissions, validation, confirmations and honest missing-data behavior remain in force on mobile; the journey does not create a bypass or invent a value.
- Device/browser Back, close, cancel and successful-update return paths do not silently substitute another request. Returning to a list preserves its established active search/filter/selection context where the app already supports it.
- Each Nova UI release that changes one of these journey steps passes the existing independent visual UI QA gate at 320px, 390px, 480px and desktop isolation, including the affected open/closed, save/submit and return states. The QA record names the journey step exercised and any deliberately unavailable dependent workflow.
- Bhoumik records the accountable operational acknowledgement/recovery rule for mobile request updates and the evidence that the journey is usable in the field; any resulting Rosie procedure change is separately approved and owned by Rosie.

## Out of scope

- A new mobile-only request model, duplicate detail page, new thread, or replacement for Jobs, All Jobs, focused intake, the focused Job, or the availability-request detail.
- Changing job/plant status vocabulary, availability-change semantics, price verification, permissions, database fields or destructive-action authorization.
- Reopening or reprioritizing the separately routed UI requirements without a concrete field observation identifying their defect.

## Assumptions

- Chris’s report is a direct enough operational signal to stage the cross-cutting workflow/acceptance contract, but does not identify a discrete visual defect that can responsibly be sent to Nova today.
- Existing routed UI work remains the delivery path for its individual screens; this requirement supplies the business-level journey and recovery definition that spans them.

## Open questions

- Which routine mobile updates require a durable workflow event versus the current UI acknowledgement alone?
- What field-use completion/failure measure will Bhoumik use to determine that critical mobile work is dependable?

## Handoff log

- 2026-09-10 — staged for Bhoumik after Chris’s field-use feedback. No Nova handoff: no independent, concrete UI defect was supplied; existing routed mobile UI slices remain the immediate screen-level work.
