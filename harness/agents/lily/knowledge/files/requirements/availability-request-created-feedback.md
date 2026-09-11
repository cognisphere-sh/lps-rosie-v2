# Say created, not sent, when an availability request is ready

- Status: routed · committed/verified; deployment unverified — release hold
- Route: nova
- Raised: 2026-09-11 by Lily's public-access audit; UI routing authorized by main
- Updated: 2026-09-11

## Problem

All Jobs reports “Availability request sent” after creating an availability request. For a non-Partner, that creates the record and public link but does not email the supplier. Chris could mistake prepared work for delivered outreach.

## Evidence

- Feedback log, **Created is not sent** (2026-09-11 05:01:02 CDT).
- At audit/routing, `AvailabilityRequestDialog` in `app/app/requests/page.tsx` reported sent for single, multiple and mixed-result creation operations. Nova reports correction committed below; deployment is not yet confirmed.
- `POST /api/availability-requests` returns the created identity and optional public path; actual non-Partner email is Rosie's separate approved-send workflow.
- Core public/out-of-network access is already shipped. This is a nonblocking copy correction, not a new delivery workflow.

## What it should do

Report the creation outcome that this action actually establishes, without claiming supplier/email delivery. Use the same truthful wording for Partner and non-Partner creation; no new supplier-type branching is needed.

- Single complete success: **Availability request created**.
- Multiple complete success: **N availability requests created**.
- Mixed or all-failed results: **X of N created · F failed**, preserving the existing actual counts.

“Link ready” may only be used if an actual successful response establishes a link. The minimal correction is “created” everywhere in these creation-result messages, with no new link-detection behavior.

## Acceptance criteria

- Creating one non-Partner request reports created, never sent or emailed, without dispatching email.
- Creating one Partner request reports created; its existing portal delivery remains unchanged.
- Multiple-success, mixed-success and all-failed operations report accurate creation/failure counts and no unearned delivery claim.
- Existing error handling, refresh, close behavior, request payloads and selections remain unchanged.
- No new network calls, sends, public exposure, permissions or lifecycle/status changes are introduced.

## Out of scope

- Email dispatch, delivery tracking, supplier coordination changes or any database/API change.
- Altering sharing, revocation, expiration, customer disclosure or supplier/company scope.
- Broad dialog/title/action redesign or changing separately verified genuine-send confirmations.
- Reopening core item 5 or bundling device/audit proposals into this correction.

## Delivery state

Nova reports commit `b97c98e` complete: 284/284 technical tests, typecheck/build, and independent visual PASS across 108 captures. **Deployment unverified; release on hold.** Nova's 05:38:17 update says the live app was rebuilt around 05:26 and restarted around 05:27 as build `ezhtGlipCRWQTLqmK3te0`, but its exact source provenance is unknown. Uncommitted UI/features may already be live; there is no newer committed app delta from `b97c98e`, which does not prove build equivalence. Bhoumik has been asked whether those potentially operator-deployed features must be retained before any replacement. Verification is Nova-reported, not a new Lily audit. Await provenance/retention resolution and explicit deployment verification before marking shipped. Core public-access item 5 remains shipped and unaffected.

## Handoff log

- 2026-09-11 05:01:02 CDT — authorized for immediate Nova UI-only routing; full requirement delivered successfully to Nova main. Requested shipped/verification report to Lily main. No supplier/customer message or new workflow requirement.
- 2026-09-11 05:36:46 CDT — parent relayed Nova's committed/verified report for `b97c98e`; kept routed, not shipped, pending provenance preflight and isolated deployment. No external communication or app change by Lily.
- 2026-09-11 05:39:42 CDT — parent relayed Nova's 05:38:17 live-build discovery. Replaced definite “not deployed” with “deployment unverified — release hold”: source provenance unknown and Bhoumik's retention decision pending. No deployment/source changes by Lily.
