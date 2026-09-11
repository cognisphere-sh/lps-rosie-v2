# Optional durable response tracking for mobile updates

- Status: staged · optional/unapproved; deferred pending existing-path findings
- Route: bhoumik
- Raised: 2026-09-10 by Lily as a possible solution to Chris’s mobile feedback
- Updated: 2026-09-11 06:24:49 CDT

## Problem

Chris needs readable, navigable, quick mobile request work with context preserved. Lily proposed durable response tracking after reviewing an older Rosie event badge, but Chris did not request a new status model or backend queue. The absence of a common durable response object in the reviewed source does not establish that one is needed to solve his problem.

## Evidence

- 2026-09-10 — Chris said updating a request while walking the yard “was not great,” asked for easy reading/navigation and quick response, and recalled better elements in old Rosie on Vercel.
- Historical source `72c30f1` has a Queued / Working / Done / Failed / Cancelled event badge. This was not verified as the exact Vercel deployment Chris meant; it is a possible design reference, not proof of his preferred solution or faster operation.
- Prior source/docs review found current chat transport/working feedback, AR write notices and no common durable per-request instruction/outcome surface. It did not test every current path or demonstrate that existing feedback fails.
- 2026-09-11 06:10:18 CDT — Parent clarified Lily’s item-10 recommendation: QA existing journey/save/send/error feedback first; new data/workflow design is optional, unapproved and not a prerequisite.
- 2026-09-11 06:11:30 CDT — Parent relayed Bhoumik’s “Made UI better for request, check now” (Telegram303, 06:10:39), authorizing read-only current UX checking only, not this design.

## What it should do

Defer this proposal while the existing journey is checked under `mobile-field-request-workflow`. First establish whether current navigation, visible pending/success/error feedback and safe return paths meet the business need. Message sent/received and agent working must not be mistaken for an actual request update completed; existing UI and actual update evidence may already make that distinction adequately.

Only if specific findings demonstrate a gap that cannot be addressed with existing behavior should Lily propose the smallest data/workflow change to Bhoumik. Durable received/working/completed/failed tracking remains one possible solution, not an agreed vocabulary or implementation. A future proposal must explain the demonstrated failure and why current feedback/history cannot cover it before defining any additional state.

## Acceptance criteria

- Existing-path findings distinguish observed outcomes, source-only observations and untested states; a missing architectural feature alone is not a defect.
- Message receipt/send acknowledgement is explicitly separate from the corresponding actual update result; only evidenced outcomes support a completion claim.
- If later proposed, new workflow scope is tied to a reproduced need, considers a smaller existing-path solution and requires Bhoumik’s approval before implementation or a dependent UI handoff.
- Existing mobile improvements and their QA can proceed without this optional state model. No queue, state names, service-time target, retention scheme or new agent procedure is mandated here.

## Out of scope

- Implementing a backend queue, new status/event model, persistence, notification rule or Rosie procedure now.
- Treating legacy event Done as proof of a business update, or restoring legacy persistence/navigation.
- Changing existing pricing, availability, access, Sales stages or approval rules.

## Assumptions

- Quick response is a business usability goal, not evidence that a new durable workflow is required.
- Earlier text overstated Lily’s proposed architecture as a confirmed gap. The useful source observations remain, but the inference is withdrawn pending current-path evidence.

## Open questions

- Nova’s read-only sample identified list title truncation, lost plant context while horizontally sliding, a short AR target and create-button overlap—not evidence for new durable state. Save/send/error outcomes were not exercised; they remain untested.
- If a workflow need is later demonstrated, what is the smallest approved change? No design decision is requested before that evidence.

## Handoff log

- 2026-09-10 — Lily staged a durable response-contract proposal and a dependent Nova display after a legacy-source comparison.
- 2026-09-11 06:10:18 CDT — Corrected to optional/unapproved, deferred until existing-path findings demonstrate need; not a mobile usability prerequisite.
- 2026-09-11 06:11:30 CDT — Bhoumik authorized a read-only current UX check. No workflow implementation or routing authorization; companion display remains optional and unapproved.
- 2026-09-11 06:24:49 CDT — Nova’s authenticated review partially verified reading/navigation on JR-41/AR-22; remaining evidenced defects are UI-only, with SAVE/SEND/error still untested. No demonstrated new workflow need; this proposal stays optional/unapproved/deferred.
