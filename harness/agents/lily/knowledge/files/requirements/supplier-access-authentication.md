# Let nurseries answer one request easily without exposing LPS operations

- Status: shipped
- Route: bhoumik
- Raised: 2026-09-03 by Chris (via telegram)
- Updated: 2026-09-11
- Completion scope: single-request public access and the existing authenticated company-portal boundary; optional device/audit extensions are separate.

## Problem

A nursery needs to answer an individual availability request with almost no login friction, including a prospective supplier without a portal account. A forwarded request must not become a way to browse the nursery's wider workload, other companies, LPS Operations or unshared customer information.

## Evidence

- 2026-09-03 feedback, **Supplier access should match the work**: Chris wants frictionless single-request web links for prospective nurseries and nursery teammates, with authenticated Nursery Ops for aggregate sensitive work. App installation is optional for power users.
- 2026-08-28 feedback, **Out-of-network availability path**: formatted supplier email linking to a live shared request.
- 2026-09-11 Bhoumik, Telegram 276: work-list item 5 Public/out-of-network availability access is done.
- 2026-09-11 re-audit of current source `1135a0f`: the previous Partner-only rejection and blanket Job-stage closure are gone. Parent clarified that dedicated trusted-device administration and exhaustive access auditing were Lily proposals, not prerequisites for the core feature.

## What it should do

- Let LPS issue a hard-to-guess link to exactly one supplier availability request, including for an active prospective/non-Partner supplier without creating a portal account.
- Let an authenticated nursery user share its own request with a teammate; the teammate may view/respond without login, but gets no aggregate company or LPS access.
- Retain account/company authorization for the wider Nursery Ops portal. Installing the app does not itself grant access.
- Show only that request, its supplier-facing notes and deliberately shared customer/contact/shipping details. Permit only that request's supplier response actions.
- Allow explicit publication, copying, revocation and replacement. Closed/inactive requests and inactive suppliers cannot use the link.
- Preserve supplier updates during working Job stages including Confirmed. Won/Lost, legacy Archived or Job deactivation closes requests/revokes links. Job reopening may restore prior response stages and issue fresh links; old URLs must not revive through that reopening.
- Associate saved responses and submissions with the correct supplier, request and Job and notify the existing coordination workflow.

## Acceptance / delivered coverage

- Active non-Partner request creation automatically supplies a public URL; no Partner login required. Supplier must exist as an active directory record, not as a portal user.
- Public page resolves one request and supports the shared response/print/Submit flow without request-list, chat, catalogue or portal navigation.
- Existing authenticated nursery users can publish/revoke their own company's request; sharing does not expand the recipient's permissions.
- Current portal authentication/company checks protect aggregate data. Signed-out live aggregate/API checks return unauthorized.
- Make private clears the URL's authority; publishing again produces a new URL. Inactive/closed requests and inactive suppliers are denied.
- Current lifecycle permits Active/Quote/Availability/Confirmed work; terminal/deactivated Jobs close linked requests. Reopening formerly public work rotates URLs.
- Save and Submit reach the existing supplier workflow as distinct updates/submissions with resolved request/supplier/Job context. Neither action is automatic customer approval.

## Verification and limits

2026-09-11: 21 targeted existing app tests and six additional mock-only checks of the current query module passed; TypeScript passed. Live, fresh signed-out GETs confirmed generic invalid-link 404 and aggregate API 401 responses. SQL lifecycle assertions were read, not executed. No production request was created, shared, revoked or answered; no valid-token or live authenticated cross-company test was performed. No cross-request/aggregate disclosure was demonstrated in this scoped review.

Full evidence: `workspace/threads/main/tasks/supplier-access-authentication/audit-2026-09-11.md`.

## Separate follow-ons, not core blockers

- Dedicated device enrollment/remote session revocation, individual teammate roles, timed link expiry and exhaustive grant/use/change auditing were recommendations added by Lily. They are not newly mandatory acceptance criteria. Any expansion needs its own business decision.
- Public possession proves authority over that one request, not an individual's identity; broader response provenance/review remains with the separately tracked availability-change requirements.
- Supplier deactivation blocks public use but does not itself guarantee permanent removal of a still-stored request URL. Reactivating the supplier may re-enable it unless the request/link was closed/revoked. Permanent revoke-on-supplier-disable is a policy choice still available; no inactive-use bypass was demonstrated.
- Existing All Jobs creation feedback can say “sent” before a non-Partner email is actually sent. Correct that delivery claim separately; Share/create is not email delivery.

## Out of scope

- Public supplier discovery, aggregate anonymous access, supplier order initiation, or payment/private LPS data access.
- New trusted-device/identity-management infrastructure.
- Exhaustive access auditing, advanced role administration, or automatic customer publication of supplier changes.

## Handoff log

- 2026-09-03 — staged access/security proposal; included optional safeguards beyond Chris's concrete access request.
- 2026-09-10 — partial: active-Partner public links shipped, but non-Partner rejection and any-Job-stage closure still present. Audit also over-bundled device/audit proposals into completion; that interpretation is corrected below.
- 2026-09-11 — Bhoumik reports completion (Telegram 276). Current-source/test/read-only live audit confirms the core access boundary and removes the former Partner/lifecycle blockers. Marked shipped for that scope; optional safeguards remain separate recommendations, not release prerequisites.
