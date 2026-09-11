# Define when a mobile request update has been received, worked or failed

- Status: staged
- Route: bhoumik
- Raised: 2026-09-10 by Chris (via Telegram)
- Updated: 2026-09-10

## Problem

In the yard, Chris needs a quick response and must be able to move through a request without guessing whether his instruction or update is merely sent, is being worked, is complete, or needs his attention. Current chat truthfully shows transport/agent-working activity and individual availability-request writes can report their own outcome, but there is no durable, request-level outcome that connects a mobile Job instruction to its resulting request update or explains a failure/incomplete handoff.

The older Rosie workspace did visibly distinguish transient event states such as Queued, Working, Done and Failed. It was a workspace-file implementation and is not a workflow to restore, but it is evidence for the specific field need: a visible response state. Its optimistic local writes and broad customer/order layout are not valid models for the current audited request contract.

## Evidence

- 2026-09-10 — Chris says request UI must be easy to read/navigate, support quick response and let him move through the request; he says the earlier Rosie-on-Vercel experience had better UI/UX elements.
- 2026-09-10 — Chris’s prior field report: updating a request while walking the yard “was not great.”
- Git history review: the June legacy Rosie workspace (`72c30f1`) rendered a Queued / Working / Done / Failed event badge. The current app chat exposes a transport send error and an agent-working indicator, but app/docs identify no durable per-request instruction/outcome state.

## What it should do

Define a durable, attributable response contract for a request-level mobile instruction or update. It must distinguish, for the exact Job Request, at least: received, actively being worked, completed with its outcome, and failed/blocked with the next action. It must say which update/event is being represented and preserve ordinary availability-request Save/Submit outcomes as their own exact writes rather than pretending a chat acknowledgement changed lines.

A response state must remain truthful through navigation, refresh, retry and return to the request. It must not promise completion when supplier verification, approval, missing facts or a failed write prevent it. Bhoumik determines which request actions enter this contract, their actor/timestamps, terminal/retry meanings, retention and how they relate to existing Job history and Rosie’s canonical `jr-<id>` thread. Rosie owns any resulting procedure only after approval.

## Acceptance criteria

- For an included request-level instruction, Chris can later identify the exact JR, its latest response state and the associated outcome/next action after navigating away and returning on a phone.
- The contract distinguishes received, working, completed and failed/blocked; completed names the actual result, while failed/blocked names the needed next action where one exists.
- An availability-request line Save or Submit is represented only by its actual write result; a chat message does not falsely claim that availability data was changed.
- A supplier verification, approval or missing fact remains visible as unresolved rather than becoming a false completed state.
- Retry/correction and an agent response remain attributable to the same request and do not silently attach to a different JR.
- The contract does not alter price verification, status/availability permissions, customer/supplier disclosure, or existing audit-history facts without explicit approval.

## Out of scope

- Recreating the legacy Vercel workspace, its workspace-file persistence, optimistic local writes, global event badge, customer-order navigation, or item-status filtering.
- The visual mobile indicator/surface, which is separately drafted for Nova after this contract exists.
- Changing chat transport, canonical Job threads, request lifecycle or availability status vocabulary.

## Assumptions

- “Quick response” requires a truthful received/working/outcome distinction, not an artificial completion-time promise.
- A per-request outcome needs a Bhoumik-approved workflow contract before Nova can honestly render it.

## Open questions

- Which actions beyond Rosie instructions and AR writes enter the request-level response contract?
- What time/actor/outcome evidence must remain in existing history versus the current response surface?

## Handoff log

- 2026-09-10 — staged for Bhoumik from Chris’s field-use and legacy-UX comparison. The companion Nova display is intentionally blocked until the contract exists.
