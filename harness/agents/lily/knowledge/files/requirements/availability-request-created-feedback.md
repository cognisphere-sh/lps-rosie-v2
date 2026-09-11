# Say created, not sent, when an availability request is ready

- Status: routed
- Route: nova
- Raised: 2026-09-11 by Lily's public-access audit; UI routing authorized by main
- Updated: 2026-09-11

## Problem

All Jobs reports “Availability request sent” after creating an availability request. For a non-Partner, that creates the record and public link but does not email the supplier. Chris could mistake prepared work for delivered outreach.

## Evidence

- Feedback log, **Created is not sent** (2026-09-11 05:01:02 CDT).
- Current `AvailabilityRequestDialog` in `app/app/requests/page.tsx` reports sent for single, multiple and mixed-result creation operations.
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

## Handoff log

- 2026-09-11 05:01:02 CDT — authorized for immediate Nova UI-only routing; full requirement delivered successfully to Nova main. Requested shipped/verification report to Lily main. No supplier/customer message or new workflow requirement.
