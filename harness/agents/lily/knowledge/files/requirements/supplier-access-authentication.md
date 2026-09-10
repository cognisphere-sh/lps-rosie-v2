# Let nurseries answer one request easily without exposing LPS operations

- Status: staged
- Route: bhoumik
- Raised: 2026-09-03 by Chris (via telegram)
- Updated: 2026-09-03

## Problem

A nursery needs to answer an individual availability request with almost no login friction, including when it is a prospective supplier that LPS has not onboarded. At the same time, an individual link must not become a way to browse the nursery portal, other requests, LPS Operations, customer information not deliberately shared, or sensitive company-wide data.

The current portal instead requires a company-scoped partner login before any request can be opened; that login sees the company’s portal workload. Current public-style access does not exist. This leaves prospective nurseries without a safe shared-request route and makes the access boundary too coarse for a one-off request.

## Evidence

- 2026-09-03 feedback log, **Supplier access should match the work**: Chris’s access model is frictionless web access for a single request, with optional install/authentication for power users; LPS Ops or Nursery Ops can share an individual live request; authenticated Nursery Ops can use aggregate sensitive information.
- 2026-08-28 feedback log, **Out-of-network availability path**: Chris needs a prospective wholesale nursery to receive a formatted request email with a live shared availability-and-request view.
- `out-of-network-public-availability-request` is already staged: it establishes the business need for an out-of-network request, but this requirement defines the reusable access/security contract it depends on.
- Current app audit: `/partner/:supplierId` is session-gated and company-scoped. A partner account can see that company’s requests and write response fields; availability-request creation currently rejects non-Partners. Existing request status does not itself provide a public-link expiry/revocation/audit contract.

## What it should do

Define one supplier-access model with two intentionally different levels:

1. **Single-request shared access.** LPS Ops or an authorized Nursery Ops user can share a live availability request through a hard-to-guess link. A recipient can open and update only that one request and its expressly shared information. The link is not a general portal login, does not reveal a request list, other suppliers, other jobs, or LPS Operations, and cannot be widened by changing an address or identifier.
2. **Authenticated Nursery Ops access.** A nursery that needs repeated work can install/authenticate on a trusted device and operate as Nursery Ops. Authentication is optional for a one-off response, but required before showing company-wide or aggregate/sensitive nursery information. An authorized Nursery Ops user can safely create/request a share for a particular live request so their team can update it quickly; sharing a request never grants the recipient the wider authenticated account’s access.

The model must make the following business/security rules durable:

- Each shared link is bound to exactly one intended supplier company and one availability request. It exposes the current request and its permitted answer actions only.
- A shared link becomes unusable when the request moves out of its live supplier-response state, is explicitly revoked, its configured lifetime ends, the supplier relationship is disabled, or an authorized person replaces it. The system must not rely on an old URL being forgotten.
- A revoked, expired, closed, malformed, or unauthorized link gives no information about whether a supplier, job, or request exists, and cannot write an answer.
- The information shown honors the existing deliberate customer-detail-sharing decision for that request. It must not expose LPS-only notes, private contacts, payment/order details, aggregate sales or inventory information, or data belonging to another nursery.
- Public-link responses retain the same supplier-response attribution, validation, freshness/change-review, and follow-up workflow as a portal response. LPS can distinguish an answer made through a shared link from one made by an authenticated Nursery Ops user or entered by LPS on the nursery’s behalf.
- Every grant, share, use, response, expiry, revocation, replacement and failed/blocked use is recorded sufficiently for LPS to answer who had access to which request, when, and what changed. Audit information is not itself available through public links.
- Existing company portal accounts remain valid only within their approved company scope. Any future aggregate view is available only to authenticated Nursery Ops with an explicit company authorization, never merely because a recipient possesses a request link.

This is the access contract for the staged out-of-network path and for future team sharing. It must be settled before UI work presents public links, install prompts, account controls, share controls, or aggregate nursery views.

## Acceptance criteria

- LPS can share one open availability request with a nursery without requiring that person to create or enter an account.
- A recipient following that link can view and answer only that request, and sees only customer/job information that LPS deliberately shared for it.
- Altering a link, using it after expiry/revocation/closure, or using it for a different request exposes neither data nor the existence of the target.
- An authorized Nursery Ops user can use an authenticated device for repeated company work and can create a bounded share for one live request without giving a teammate company-wide access.
- Aggregate or sensitive nursery information is unavailable until authenticated company authorization is established.
- LPS can revoke or replace a request share immediately and can see an auditable record of access grants, use, response changes and revocation/expiry.
- A supplier response made through either access mode reaches the same request/change-management workflow with clear actor/source attribution.
- Existing LPS Partner company accounts retain their current company-only scope unless Bhoumik explicitly approves a migration.

## Out of scope

- A visual redesign of the current Nursery Portal, a public-link page, account screens, or install prompts.
- General public supplier discovery, a public request list, or an unauthenticated company dashboard.
- Giving suppliers authority to create orders, see LPS Ops, or access payment/private fulfillment information.
- Changing the Request-versus-Order status model; this contract consumes the final live/terminal meaning that `availability-status-model-parity` establishes.
- Automatic supplier onboarding or deciding Grower-versus-Wholesale buying workflows.

## Assumptions

- “Single request” means one availability request to one supplier, not all requests for a Job or supplier company.
- A URL holder is treated as an invited collaborator for that single request, so forwarding is possible but contained; higher-risk aggregate data requires authentication.
- Current request closure is the initial expiry trigger, but Bhoumik must align the final trigger with the durable Request/Order status model and Chris’s requirement to allow legitimate late availability revisions.
- Existing company-scoped portal accounts are a useful starting point for authenticated Nursery Ops, but do not by themselves decide the future device, identity, recovery, or team-administration model.

## Open questions

- **Chris:** When a Nursery Ops power user shares a request with a teammate, is possession of the bounded link enough for that teammate to update it, or must the teammate first authenticate/register? The working assumption is bounded-link access to preserve speed.
- **Bhoumik:** Define the durable identity/device-recovery model for Nursery Ops, company membership/administration, trusted-device lifetime, and how a lost device/session is revoked.
- **Bhoumik:** Define the authoritative live-to-terminal request transition that expires links without blocking the approved late supplier-update period during fulfillment.
- **Bhoumik:** Define the required audit retention, actor labels, replay/rotation protection, rate limits and response/change-history relationship for shared-link activity.
- **Bhoumik:** Confirm whether a power user may issue shares directly or whether LPS approval is required for each share; the working reading permits an authorized Nursery Ops user to share one of their live requests.

## Handoff log

- 2026-09-03 — staged for Bhoumik as workflow, data and security contract work; no Nova UI route until the contract is approved.
