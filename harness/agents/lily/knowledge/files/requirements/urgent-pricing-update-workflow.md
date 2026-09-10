# Make urgent pricing updates reach the right Job without delay

- Status: staged
- Route: bhoumik
- Raised: 2026-08-31 by Chris (via Rosie handoff)
- Updated: 2026-08-31

## Problem

Chris needs to correct or refresh pricing while he is working a Job Request. A pricing instruction sent from JR-31 landed on JR-30, creating a manual correction and delay; Chris said, “Can’t take 40 minutes.” Correct screen routing reduces that friction, but it does not itself define how an urgent pricing instruction is recognized, acknowledged, prioritized, safely applied, or recovered if it lands in the wrong work queue.

## Evidence

- 2026-08-31, **Pricing update arrived on wrong job**: Chris wrote “Update pricing!!!” from JR-31; it arrived on JR-30, followed by “Can’t take 40 minutes.”
- The operating model assigns one canonical Rosie `jr-<id>` thread to each Job Request and makes that thread the source for Job decisions and pricing coordination.

## What it should do

Define an operational urgent-pricing-update path for the canonical Job Request conversation. An explicit pricing-update request must receive an immediate acknowledgement that names the Job Request and says whether Rosie has enough information to act. It must then either complete the safe update and report what changed, or state the one missing/ambiguous fact that prevents it.

The path must preserve commercial controls: it must not silently alter a price when the affected item, requested price, source, or required verification is unclear. It must also define how an incorrectly routed instruction is detected and returned to the right Job without asking Chris to reconstruct the request.

Bhoumik should decide the durable priority, acknowledgement, recovery, and observability contract. Rosie owns the resulting Job-request procedure/skill change once Chris or Bhoumik approves it.

## Acceptance criteria

- Chris can issue a pricing-update instruction in a Job’s canonical Rosie chat and promptly receives an acknowledgement naming that Job.
- When the instruction is sufficiently specific and permitted, Rosie reports the completed update against the same Job; when it is not, Rosie asks only for the fact needed to proceed.
- A price is never changed merely because a message is urgent; existing price-source, availability, customer-quote, and Chris-approval controls remain in force.
- A message discovered in the wrong Job queue is identified and returned to the intended canonical Job with clear traceability, rather than waiting for Chris to repeat it.
- The chosen operating target distinguishes immediate receipt/acknowledgement from completion time when supplier verification or missing details are genuinely required.
- The process records enough timing/outcome information for LPS to see whether urgent updates are meeting the agreed service expectation.

## Out of scope

- The focused-Job chat destination safeguard, which is the routed Nova UI requirement `focused-job-chat-routing`.
- Inventing a universal automatic price-update rule or bypassing source/availability verification.
- Changing customer or supplier communications, quote approval, or Job lifecycle policy.

## Assumptions

- “Immediate” means Chris receives immediate confirmation that the right Job owns the request, not a false promise that every price can be verified and changed instantly.
- The canonical `jr-<id>` thread remains the single source of Job-level pricing work.

## Open questions

- What acknowledgement and completion target is realistic for a routine stored-price correction versus a supplier-verified price change?
- Which pricing updates may Rosie apply from an explicit Chris instruction, and which require a source/availability check or a revised customer quote?
- Should an erroneous thread delivery be automatically relayed after verified page/job context, or held for a one-tap Chris confirmation to avoid moving a deliberately cross-job message?

## Handoff log

- 2026-08-31 — staged for Bhoumik: this is a workflow/priority/recovery contract, not a screen-only change. Rosie should own any resulting procedure update after approval.
