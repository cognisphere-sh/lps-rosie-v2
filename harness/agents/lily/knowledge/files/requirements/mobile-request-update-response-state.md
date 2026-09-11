# Show the current response state for a mobile request update

- Status: drafted · blocked by mobile-request-update-response-workflow
- Route: nova
- Raised: 2026-09-10 by Chris (via Telegram)
- Updated: 2026-09-10

## Problem

Chris working in the yard needs a quick, readable answer to “did this request update land, what is happening, and what do I do next?” Current mobile chat can show a transient agent-working indicator and individual availability-request controls report their own result, but it has no common request-level response surface. The earlier Rosie workspace visibly used Queued / Working / Done / Failed states; retain the clarity of that pattern, not its legacy screen or unsafe persistence model.

## Evidence

- 2026-09-10 — Chris explicitly asks for easy reading/navigation, quick response and movement through the request on a phone; he cites better old Rosie UI/UX elements.
- Legacy implementation review (`72c30f1`): a visible event-state badge named Queued, Working, Done, Failed and Cancelled.
- Current app review: focused mobile Job makes canonical chat and AR actions reachable, but no durable request-level response state is available to display.

## What it should do

Once `mobile-request-update-response-workflow` supplies approved durable request response facts, show a compact, readable response state in the focused mobile Job at the action/result context. It identifies the exact request update, uses written state and outcome/next-action text rather than color alone, and links or routes Chris to the existing relevant chat or availability-request detail when action is needed.

It must make an unresolved or failed state more actionable than a completed state without crowding the primary request identity, status, totals or plant table. It uses the existing independent visual QA gate.

## Acceptance criteria

- On 320px, 390px and 480px, an included request update shows its approved written received, working, completed or failed/blocked state in the focused Job without clipping, horizontal scrolling or ambiguous color-only meaning.
- The surface identifies the current Job context and provides the approved outcome or next action; a failed/blocked state can route Chris to the existing relevant chat or AR detail.
- A completed state is shown only when the workflow contract reports an actual completed outcome; an unresolved supplier verification, approval or failed write remains visibly unresolved.
- The response display does not replace or duplicate the existing canonical chat identity, AR Save/Submit result, status controls or Job details tray.
- Independent visual QA passes the affected states at 320px, 390px, 480px and desktop isolation, retaining the required evidence.

## Out of scope

- Creating response state, changing its workflow/event retention, or interpreting chat text as a record update; those are Bhoumik’s blocked dependency.
- Rebuilding the old Rosie/Vercel workspace, adding a second mobile request page, or restoring legacy item-status filtering or optimistic persistence.
- Changing job/plant status models, permissions, price controls, chat routing or AR behavior.

## Assumptions

- The state belongs near the focused request action/result context, not on the compact All Jobs scan card.
- Nova chooses the specific presentation after Bhoumik supplies the durable facts; this requirement specifies behavior, not a component.

## Open questions

- None for the display after the blocked workflow contract is approved.

## Handoff log

- 2026-09-10 — drafted as the Nova UI companion to the staged workflow requirement. Do not route/build before Bhoumik confirms the durable response contract.
