# Let an out-of-network supplier answer one live availability request

- Status: staged
- Route: bhoumik
- Priority: 2 — Bhoumik weekly priority (2026-09-01)
- Raised: 2026-08-28 by Chris (via telegram); prioritized 2026-09-01 by Bhoumik
- Updated: 2026-09-01

## Problem

An out-of-network prospective wholesale supplier has no LPS Partner portal, so LPS cannot give them the same focused, current availability request to answer. The current request creation path admits LPS Partners only. Emailing static plant details leaves LPS and the supplier without one shared live record and makes follow-up or corrections harder to trust.

## Evidence

- 2026-08-28 feedback log, **Out-of-network availability path**: Chris asked for a formatted email request with a link to a dynamic shared availability-and-request view for prospective Texas wholesale nurseries.
- 2026-08-28 feedback log, **Supplier type changes the work**: Growers and wholesale suppliers may need different request-to-buy handling.
- 2026-09-01 Bhoumik weekly priorities: public availability requests for out-of-network suppliers, plus the ability to make an individual availability request, are priority 2.
- Current app audit: creating an availability request rejects a supplier that is not an LPS Partner, and the existing Portal access model is partner-only.

## What it should do

Allow LPS to create an availability request for one selected out-of-network supplier and send that supplier a formatted email with a secure, supplier-specific link to its live shared request view. The recipient can review and respond to only that request; LPS can see the same current response and follow up through the established coordination record.

The request must retain the same clear distinction between LPS-entered information and a supplier response, and fit the staged availability-response/change-management model rather than creating a second, untraceable answer path. Its public access must be limited, revocable and end when the request is no longer open.

## Acceptance criteria

- Chris can select one eligible out-of-network supplier and create an availability request for that supplier without first making them an LPS Partner.
- The supplier receives a formatted email with a working, supplier-specific link to the current availability request.
- Opening the link exposes only the intended supplier and request, not the LPS portal, other suppliers, jobs or requests.
- The supplier can provide an availability response that LPS can see in the related request and identify as supplier-provided.
- LPS and the supplier see current information for that request without relying on a static emailed plant list.
- Access can be withdrawn or expires when the request is closed; a withdrawn/expired link no longer permits viewing or updating.
- A subsequent supplier update follows the same freshness, attribution and review rules being defined in `availability-last-updated-semantics` and `availability-response-change-management`.

## Out of scope

- Automatically onboarding the supplier as an LPS Partner.
- A supplier initiating or placing an order.
- Deciding the broader Grower-versus-Wholesale buying workflow or agent ownership.
- Redesigning the existing LPS Partner Portal or its status-selector styling.
- A Nova UI build before Bhoumik defines the public-access and response contract.

## Assumptions

- “Individual availability request” means one request to one deliberately selected supplier, rather than a bulk send to several suppliers.
- The shared view is a bounded request link, not public discovery or a general unauthenticated supplier account.
- The existing human-tone email requirement governs wording of the initial ask; this requirement governs the access and response workflow.

## Open questions

- **Bhoumik:** Confirm whether “individual availability request” means one supplier-specific request (the working reading) or a request limited to one plant line. This determines the creation flow and its relationship to the present selected-line request action.
- **Bhoumik:** Define the safe recipient verification, link lifetime/revocation, response permissions and how a response is correlated with the supplier and Job Request.
- **Bhoumik/Chris:** Define which actual distinctions between Grower and Wholesale Supplier alter this path before separate buying workflows are introduced.

## Handoff log

- 2026-08-28 — captured as a watched operational-design question in `business/operations.md`; no build was defined.
- 2026-09-01 — promoted and staged when Bhoumik made the public out-of-network path and individual request capability weekly priority 2. No external handoff sent by task instruction.
