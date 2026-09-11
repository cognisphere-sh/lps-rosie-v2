# Make mobile request work dependable in the field

- Status: staged · partial read-only live verification; corrections unapproved
- Route: bhoumik
- Raised: 2026-09-10 by Chris (via Telegram)
- Updated: 2026-09-11 06:24:49 CDT

## Problem

Chris tried to update a request from his phone while walking the yard and says it “was not great.” Easy, effective mobile request work is critical: a phone journey must let him locate the right live request, understand it, make a safe change, and know that the change landed without losing his place. The app has separately scoped mobile list, focused Job, intake, chat-routing and availability-request improvements. The existing journey must be evaluated together before concluding that another data/workflow model is necessary; Lily’s prior source/docs review did not test all current paths.

## Evidence

- 2026-09-10 — Chris directly reported the field-use failure and importance of mobile request work.
- 2026-08-30 to 2026-09-01 — repeated All Jobs and focused-Job feedback established that phone space, identity, direct drill-in, safe actions and readable status cannot be treated as cosmetic details.
- `mobile-all-jobs-toolbar`, `mobile-focused-job-header`, `job-inbox-workspace`, `mobile-availability-request-view`, and `focused-job-chat-routing` define bounded UI slices; `visual-ui-qa-gate` already requires viewport review. These documents and the code/history review describe intended or implemented behavior, not an end-to-end field test result.
- 2026-09-11 06:10:18 CDT — Parent recorded Lily’s item-10 recommendation to Bhoumik at 06:08:46: evaluate existing-path readability, navigation, responsiveness and save/send/error feedback first. Durable Queued/Working/Done is an optional unapproved Lily proposal, not Chris’s requested solution or a prerequisite.

## Current findings — partial, not release PASS

2026-09-11 06:24:49 CDT — Nova supplied authenticated live evidence at 320×800, 390×844 and 480×900 (16 captures, 06:20–06:21 CDT). Lily read the report/manifest and visually assessed seven representative captures; navigation/measurements remain attributed to Nova. Evidence: `../nova/workspace/threads/main/files/live-mobile-review-20260911/review.md`, `manifest.tsv`; Lily assessment: `workspace/threads/main/tasks/mobile-field-request-workflow/live-evidence-assessment-2026-09-11.md`.

- **Works in sampled states:** All Jobs → JR-41 → linked AR-22 → Close → JR-41; bottom Jobs returns to `/requests`. AR stacked lines, wrapping identity/notes, sampled 44px inputs/Close and final subtotal above the footer are readable. Focused title wraps; no document-width overflow. Filter panel at 320 opens/closes without changing values.
- **P2 list identity:** Different Jobs at 320 show chiefly `Unassigned custo…`, hiding actual Job names. Smallest suggested correction: preserve more meaningful Job-name space without inventing customer values or broadly redesigning cards.
- **P2 sliding row context:** Focused table is 1014px within 279/349/439px visible width; sliding to price/notes loses plant identity. Preserve the existing horizontal slider preference; keep the plant-to-value association available and full truncated content readable without entering a saving editor. Horizontal scrolling itself is not the defect and stacked replacement is not requested.
- **P2 AR touch target:** AR-22 measures about 45×16px. Enlarge the existing target to at least 44px high without changing its route or duplicating controls.
- **P3 overlap:** Floating create overlaps a Rosie Chat control at 480 and some focused table content. Keep create reachable while providing a clear usable area for scrolling content/actions.

These are suggested UI corrections, not approved changes or a Nova handoff. No new workflow/data requirement is evidenced. SAVE/SEND and their success/error outcomes, chat/notifications/counts, unsent edits, device/browser Back and restoration of prior list scroll/filter context remain untested. Returning to the list route alone does not prove context preservation. Only JR-41/AR-22 were opened; no physical-phone/software-keyboard/safe-area, dark-mode or desktop certification. Nova denied all business writes and chat/notification/read-state calls. Disk build `mQbUTuNKRrrmDVkIrUVwi` is known; exact live source SHA remains unknown.

## What it should do

Bhoumik authorized a read-only current UX check on 2026-09-11 at 06:10:39 CDT (relayed 06:11:30): “Made UI better for request, check now.” Check the existing field-use journey for an existing or newly started request on a phone, including existing direct edits, chat, Save/Submit, failure feedback and return paths. Assess complete handoffs rather than create a competing screen or duplicate already-routed work:

1. **Find and open:** From Jobs or All Jobs, Chris can search/filter and identify the intended request from truthful customer/job identity, JR reference and current sales state, then open that exact request.
2. **Orient:** The focused request makes the same request identity and current state clear before he acts. Its immediately available totals/plant work, secondary details, canonical Job chat and linked availability-request path must not make him guess which request he is changing.
3. **Update safely:** Existing direct edits remain direct edits; Job chat targets the current request’s canonical conversation, and an availability-request update opens its dedicated detail with clear supplier, line answers and applicable Save/Submit action. Existing feedback must let Chris tell a saved result from an unsaved/actionable failure without weakening permissions, validation or confirmations.
4. **Acknowledge and return:** Distinguish message sent/received from actual request update completed. Transport receipt or an agent-working indicator is not evidence that a record changed. After an edit, save, submit, chat instruction, cancellation or close, Chris should understand the evidenced result or what remains unresolved, then return without silently changing request or losing established context.

Current authorization covers reading, navigation/opening/return and safe unsent edit states in the actual accessible UI; no production save/send/delete/create or notification/chat read-state mutation. Record deployed-build/source-provenance and authenticated-access limits; do not equate checked-in UI with live behavior. Report findings to Lily main before any implementation routing. Only demonstrated data/workflow gaps may warrant later design for Bhoumik. A new backend queue, response-state model or persistent badge is not a prerequisite; the optional companion proposals remain deferred until evidence establishes need and approval is given.

## Acceptance criteria

- On a real phone-sized browser at 320px, 390px and 480px, Chris can find a known active request in Jobs or All Jobs and open the exact JR he selected; no other request is silently selected.
- Before updating, the focused view makes that request’s truthful identity/JR and current sales state discernible, and provides reachable routes to its existing Job work, details and linked availability-request work without clipping, ambiguous controls or page-level horizontal scrolling.
- A focused-Job chat instruction visibly targets that exact canonical `jr-<id>` conversation before send; it cannot reuse a prior Job as its destination. Sent/received feedback is not labelled or treated as an actual request update completed; completion is claimed only when the corresponding result is evidenced.
- For a linked availability request, Chris can identify its supplier and request state, inspect/edit its available line answers, and reach the applicable Save/Submit control without accidental adjacent control activation. A successful save/submit identifies the completed request/result; a failure or incomplete action stays actionable and does not look durable.
- Existing request/status/price/availability permissions, validation, confirmations and honest missing-data behavior remain in force on mobile; the journey does not create a bypass or invent a value.
- Device/browser Back, close, cancel and successful-update return paths do not silently substitute another request. Returning to a list preserves its established active search/filter/selection context where the app already supports it.
- Each Nova UI release that changes one of these journey steps passes the existing independent visual UI QA gate at 320px, 390px, 480px and desktop isolation, including the affected open/closed, save/submit and return states. The QA record names the journey step exercised and any deliberately unavailable dependent workflow.
- An authorized QA report separates tested paths/results from source-only observations and untested states, records concrete defects and timing observations, and checks whether existing save/send/error/retry/return behavior meets the business need before proposing new data/workflow design. These are intended checks, not current pass claims.

## Out of scope

- A new mobile-only request model, duplicate detail page, new thread, or replacement for Jobs, All Jobs, focused intake, the focused Job, or the availability-request detail.
- Changing job/plant status vocabulary, availability-change semantics, price verification, permissions, database fields or destructive-action authorization.
- Reopening or reprioritizing the separately routed UI requirements without a concrete field observation identifying their defect.
- Adding a durable Queued/Working/Done model, backend queue, persistent response surface or agent procedure as a prerequisite to mobile usability; none is authorized here.

## Assumptions

- Chris asked for readable, navigable and responsive request work, not a new status model. Quick response does not imply an invented completion-time promise or durable queue.
- Existing save/send/error feedback may satisfy the need; prior source/docs/history review alone cannot establish either adequacy or failure across all paths.
- Existing UI requirements and the visual gate remain in force. Bhoumik’s later check-now message authorizes only the bounded read-only UX check, not save/send testing, building or implementation routing.

## Open questions

- Await parent/Bhoumik authorization before routing the four concrete UI corrections; no implementation authorized by the read-only review.
- SAVE/SEND/error/actual completion, unsent edits, browser Back and prior list-context restoration require separately permitted checks in a safe environment; no coverage claim from the current read-only sample.
- No demonstrated need for new data/workflow design; optional response tracking/display remain deferred.

## Handoff log

- 2026-09-10 — staged for Bhoumik after Chris’s field-use feedback. No Nova handoff: no independent, concrete UI defect was supplied; existing routed mobile UI slices remain the immediate screen-level work.
- 2026-09-11 06:10:18 CDT — Reconciled item-10 explanation to Bhoumik: existing-path QA first, with sent/received versus completed explicitly separated. Removed new acknowledgement/event-contract design as a prerequisite. No new tests, build, routing or workflow authorized by that clarification; optional state proposals remain deferred.
- 2026-09-11 06:11:30 CDT — Parent relayed Bhoumik’s later Telegram303 check-now authorization (06:10:39). Began bounded read-only current UI review; production mutations and implementation routing remain prohibited.
- 2026-09-11 06:15:04 CDT — Isolated live 390×844 attempt reached `/login?next=%2Frequests`, not authenticated request UI; result BLOCKED, not PASS. No 320/480 or request interactions verified; no production/auth writes or chat/notification openings. Disk build `mQbUTuNKRrrmDVkIrUVwi` and dirty checkout HEAD `95ca8af22581febec272852b0cb7897c51e96039` do not establish deployed source SHA. Report and blocker capture: `workspace/threads/main-§-[TASK]-§-mobile-field-request-workflow/tasks/live-mobile-check/files/live-review.md` and `live-login-blocker-390.png`. Parent asked Nova for evidence through its existing approved reviewer access; Lily’s initial attempt remains blocked.
- 2026-09-11 06:24:49 CDT — Assessed Nova’s authenticated 16-capture read-only review and seven representative screenshots directly. Overall finding is partial read-only verification, not release PASS; four bounded UI recommendations recorded, preserving horizontal sliders. Parent has told Bhoumik, but no implementation authorized/routed; SAVE/SEND and other excluded states remain untested.
