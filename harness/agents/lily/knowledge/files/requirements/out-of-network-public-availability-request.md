# Let an out-of-network supplier answer one live availability request

- Status: shipped
- Route: bhoumik
- Priority: 2 — Bhoumik weekly priority (2026-09-01); work-list item 5 (2026-09-11)
- Raised: 2026-08-28 by Chris (via telegram); prioritized 2026-09-01 by Bhoumik
- Updated: 2026-09-11 14:10:56 CDT
- Completion scope: public/out-of-network request access; formatted email uses Rosie's existing approved supplier-send workflow, not automatic app sending.

## Problem

A prospective wholesale supplier without an LPS Partner account could not receive the same focused, current availability request to answer. Static plant details required manual reconciliation and account creation imposed unnecessary friction.

## Evidence

- 2026-08-28 feedback, **Out-of-network availability path**: Chris asked for a formatted email request and a live shared availability-and-request view for prospective Texas wholesale nurseries.
- 2026-09-01 Bhoumik made public out-of-network requests and individual availability requests weekly priority 2.
- 2026-09-03 Chris confirmed frictionless one-request access for prospective nurseries and teammates, separate from authenticated aggregate Nursery Ops.
- 2026-09-11 Bhoumik reports work-list item 5 done (Telegram 276, 04:51:20 CDT).

- 2026-09-11 Chris/CR, Telegram313 reply279 at 14:09:59 CDT: growers’ limited offerings usually permit an email/text reply; multiline whole-list wholesale-nursery requests better suit the live collaborative view. Full quote in feedback log, **Grower replies are usually simpler; whole-list nursery asks suit a link**.

## Channel fit — clarified, not new implementation

This delivered capability is particularly useful when a wholesale nursery receives an entire plant list requiring per-line availability, notes and pricing. It is not a universal requirement to send every supplier a link or require portal use. Chris estimates the usual grower response experience is email/text (“90/10”); growers generally have narrower offerings/fewer inputs. A multi-item grower ask may optionally use the existing scoped link, but grower-specific enhancements are not needed now.

No SMS integration or automatic outreach is implied or authorized, and this is not a rigid Grower-versus-Wholesale channel classification. General public access remains shipped and reusable. Rosie/Daisy ownership, all send approvals, the supplier-identity setup hold and item 8 order-management deferral remain unchanged. The email/link behavior below describes the available shared-request path, not a newly compulsory step for simpler asks.

## What it should do

LPS can select one active prospective/non-Partner supplier, create a bounded availability request from selected Job lines, and share a live URL without requiring a supplier login. Rosie can send a formatted, approved HTML availability email containing the same ask and public URL from that supplier's coordination thread. The supplier answers only its own request; responses return to the same supplier/Job coordination workflow.

## Acceptance / delivered coverage

- **Non-Partner eligibility delivered:** the selector reads all active suppliers; creation no longer rejects a non-Partner and automatically creates its public URL. An active supplier directory record is required, but a Partner account is not.
- **Bounded live view delivered:** request-specific UUID opens a no-login page for the intended supplier request, not other requests, aggregate portal work or LPS Operations. Existing customer-detail sharing applies.
- **Response association delivered:** only that request's supplier answer fields and Submit action are accepted; save and submission wake the correct supplier coordination path with Job/request context.
- **Email path documented and enabled by procedure:** Rosie's current supplier-coordination skill explicitly drafts approved HTML plant/size/quantity details and URL, sends from the supplier thread, checks actual delivery and retains correlation. Creating/copying a URL alone is not a send.
- **Revocation/lifecycle delivered:** Make private revokes; publication rotates the URL; terminal/deactivated Jobs close/revoke linked requests while working stages including Confirmed keep them open. Job reopening restores recorded states and gives previously public work a fresh URL, not its revoked one. Inactive supplier/request access is denied.

## Verification and limits

Current source `1135a0f` audited on 2026-09-11. Twenty-one relevant existing tests, six mock-only current-query checks and TypeScript passed. Live signed-out GETs confirmed generic unknown-URL 404 and aggregate API 401. Migration 0088 lifecycle assertions were reviewed but not run. No production request or email was created/sent, and valid-token success/mailbox delivery was not tested live; Bhoumik's completion report supplies the deployment confirmation.

Evidence: `workspace/threads/main/tasks/supplier-access-authentication/audit-2026-09-11.md`.

## Separate follow-ons, not reasons to reject access completion

- All Jobs' existing creation toast can say “Availability request sent” for a non-Partner even though that API only creates the record/link. Distinguish link readiness from actual email delivery; Rosie's separate email workflow remains the delivery route.
- Comprehensive access auditing, device/team administration and timed expiry were Lily recommendations, not prerequisites for work-list item 5.
- Supplier-change comparison, historical provenance and Chris-reviewed customer exposure retain their separate availability-change requirements; this completion does not mark those shipped.

## Out of scope

- Automatic Partner onboarding or supplier-initiated orders.
- Defining Grower-versus-Wholesale buying responsibility.
- A new automatic email sender behind Share or create.
- Granting a public link general nursery or LPS access.

## Assumptions

- “Individual” is one supplier-specific request containing one or more selected plant lines.
- Prospective supplier means no Partner login is needed, not that the request can have no known supplier record.
- Public forwarding to a teammate is intentional single-request delegation; the holder is not individually authenticated.

## Handoff log

- 2026-08-28 — captured as watched operational-design question.
- 2026-09-01 — staged as Bhoumik's weekly priority 2.
- 2026-09-10 — partially shipped: active-Partner public-link slice only; non-Partner request and email path still absent in the audited version.
- 2026-09-11 — Bhoumik reports completed. Re-audit finds the non-Partner rejection removed, non-Partner public URL creation and HTML supplier-email procedure added, and lifecycle corrected to retain working-stage supplier updates. Marked core shipped with verification limits and separate delivery-copy follow-up recorded.
- 2026-09-11 14:10:56 CDT — Captured Chris/CR Telegram313 channel/complexity clarification; link remains useful for whole-list wholesale asks and optional for more complex grower asks. No rollback, new feature or implementation routing; core stays shipped.
