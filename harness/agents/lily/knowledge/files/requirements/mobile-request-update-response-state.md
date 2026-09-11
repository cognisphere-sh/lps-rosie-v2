# Optional mobile request-response display

- Status: drafted · optional/unapproved; deferred pending existing-path findings
- Route: nova
- Raised: 2026-09-10 by Lily as a possible solution to Chris’s mobile feedback
- Updated: 2026-09-11 06:24:49 CDT

## Problem

Chris needs to read and move through a request easily on his phone, receive quick and truthful feedback, and keep his working context. Lily’s proposed persistent response display is only one possible solution. It is not Chris’s settled request and does not make a new backend state model a prerequisite to improving the existing screens.

## Evidence

- Chris’s 2026-09-10 field-use and old-Rosie comparison supports readability/navigation/responsiveness goals, not a particular badge or status vocabulary.
- Legacy `72c30f1` showed event badges; prior source/docs review found current chat working/send-error feedback and AR write notices. Neither establishes actual current field performance; no full end-to-end test was completed in that review.
- 2026-09-11 06:10:18 CDT — Parent clarified existing-path QA first, no new state model as a prerequisite. At 06:11:30, parent relayed Bhoumik’s explicit read-only “check now” request, not implementation approval.

## What it should do

Hold this optional new display while `mobile-field-request-workflow` evaluates existing reading, navigation, save/send/error feedback and return context. If a concrete UI problem is evidenced, prefer a bounded correction to that existing surface using its current facts. Do not require `mobile-request-update-response-workflow` to be built first; it too is an optional deferred proposal.

Any eventual display must distinguish message sent/received from an actual request update completed. Working/receipt alone is not a successful data update. Preserve the request identity and actual result/error without inventing completion or unsupported response states. A persistent new surface needs separate justification and approval after the findings; no implementation handoff has been made.

## Acceptance criteria

- Any future UI correction cites the observed screen/state defect and uses existing supported facts where sufficient, rather than assuming a new backend queue or badge is necessary.
- Sent/received feedback cannot be mistaken for completed request work; an actual saved result or unresolved/error condition remains truthful.
- The correction preserves readable identity, navigation/context and existing actions, with touch-safe controls and the existing independent visual QA gate at applicable phone widths and desktop isolation.
- Untested send/save/error outcomes remain labelled untested; source-only observations do not count as a passed live journey.

## Out of scope

- Building/routing this optional display now or creating data/workflow state from UI copy or chat interpretation.
- Recreating old Rosie, changing existing status models, permissions, pricing, chat ownership or AR behavior.

## Assumptions

- The existing UI may already supply adequate response feedback. Its current-path check, not the old badge, determines whether a correction is needed.
- No persistent placement, state vocabulary or new backend dependency has been approved.

## Open questions

- The partial Nova review found list-title/row-context/touch-area/overlap issues, not a need for a new response display. SAVE/SEND/error remain untested; no new display rationale is established.

## Handoff log

- 2026-09-10 — Drafted a Nova display companion to Lily’s durable-workflow proposal; no implementation handoff sent.
- 2026-09-11 06:10:18 CDT — Reframed as optional/unapproved, with existing-path QA recommended before new design. Removed the suggestion that a backend model is a prerequisite to mobile usability.
- 2026-09-11 06:11:30 CDT — Read-only current UX check authorized by Bhoumik; no new display implementation/routing authorized.
- 2026-09-11 06:24:49 CDT — Assessed Nova’s partial authenticated read-only review; concrete small UI recommendations live in `mobile-field-request-workflow`, preserving the existing horizontal slider. No persistent response display was justified; this proposal remains optional/unapproved/deferred.
