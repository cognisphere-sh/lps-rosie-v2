# Keep a focused Job chat on the current request

- Status: shipped
- Route: nova
- Raised: 2026-08-31 by Chris (via Rosie handoff)
- Updated: 2026-08-31

## Problem

Chris entered “Update pricing!!!” while viewing JR-31, but it was delivered to JR-30. The current chat panel can retain a previously selected conversation; the page location is supplied to Rosie only as supplementary context after that thread has already been chosen. That makes Chris chase or wait for a correction when he is trying to act on the Job Request in front of him.

## Evidence

- 2026-08-31, **Pricing update arrived on wrong job**: from the JR-31 page, Chris’s pricing-update message arrived on JR-30. He then said, “Can’t take 40 minutes.”
- App/webchat audit: the composer sends its retained selected thread directly. Its current page is informational context, not routing. A focused Job has a canonical existing Rosie thread, `jr-<id>`.

## What it should do

When Chris opens Rosie chat from a focused Job Request, bind that chat action to that Job Request’s existing canonical Rosie conversation and make its Job identity clear before he sends. A message initiated for the focused Job must go directly to that Job’s conversation; page context may accompany the message but must not be the mechanism that tries to repair a wrong destination afterward.

Keep intentional global chat navigation available. If Chris deliberately opens a different Job, supplier, customer, or main conversation, the interface must make that destination clear rather than silently treating it as the focused Job.

## Acceptance criteria

- From focused JR-31, Chris opens the Job chat and sees that it is JR-31 before sending.
- A message sent through that focused-Job chat is delivered to JR-31’s existing Rosie conversation even if the panel previously displayed JR-30.
- The sent message retains useful page context, but correct delivery does not depend on Rosie interpreting that context or manually forwarding it.
- Chris can still deliberately open JR-30 or a supplier/customer/main chat, with the chosen destination clearly identified.
- No new Job, supplier, or customer thread is created; no conversations are merged; global chat and portal behavior remain unchanged.

## Out of scope

- Changing pricing rules, source-price policy, or the data model for price updates.
- A personal cross-channel unread/priority model.
- Replacing Rosie's canonical Job Request thread or changing supplier/customer thread ownership.

## Assumptions

- The immediate correction is a client interaction/routing safeguard around an already-existing canonical thread, so it is UI/UX work for Nova.
- A focused Job’s explicit Job-chat action is distinct from deliberately browsing the global chat picker.

## Open questions

- None blocking the UI correction.

## Handoff log

- 2026-08-31 — routed to Nova as the direct UI/UX slice; delivery confirmed. Nova accepted urgent implementation: focused JR actions will bind the panel to canonical `jr-<id>` before composing/sending and show the destination, with no context-based repair, thread minting, or global/portal changes. The related urgency/process decision is separately staged in `urgent-pricing-update-workflow`.
- 2026-08-31 — Nova’s initial four-path implementation passed 173 tests but is not deployable after adversarial review. It is remediating same-route/ABA revision cleanup, attachment/voice destination ownership, visible-before-enabled transition, same-revision poll ordering, and race-test coverage. A second review found deeper app races and judged plugin hardening incomplete/over-scoped; all task-added plugin changes will be removed. The fix remains app-only, covering mobile-agent ABA intent, poll/send dedupe, reset/send serialization, a transcript-ready gate, and per-generation upload/voice cancellation. Final re-review found three more blockers: hung-reset deadlock, reset lock loss on same-canonical rebind, and recording setup/start teardown. Nova added canonical reset locks, bounded abort/timeout recovery, and total recording-setup cleanup.
- 2026-08-31 — shipped by Nova in `3e1e485`. Focused Job chat now binds canonically before an enabled composer/send, visibly identifies the destination, and protects stale transcript/send/reset/upload/voice operations with canonical ordering. App-only restart is healthy (build `2o2ygVTcrmZzPtp2yNoH_`); 213/213 tests, typecheck and build pass. No plugin or harness changes.
