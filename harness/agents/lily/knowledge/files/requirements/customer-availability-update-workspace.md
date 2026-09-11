# Show LPS-published availability in customer job details

- Status: drafted
- Route: nova
- Raised: 2026-08-28 by Chris (via telegram)
- Updated: 2026-09-11

## Problem

A future customer Job Request Details workspace needs only the availability information LPS has chosen to share. Raw supplier responses and sourcing notes are internal factual input, not customer-facing status.

## What it should do

When Chris or Rosie chooses to communicate availability to a customer, the future customer workspace may show that LPS-published information and its customer-facing update time. It must not automatically ingest supplier revisions or reveal sourcing notes, internal commentary, supplier identity/context, or a workflow approval state.

## Acceptance criteria

- A raw/new supplier response is not automatically visible in the customer workspace.
- The workspace can show availability information that LPS deliberately publishes for the customer.
- Internal sourcing notes and Job/Order operational status remain private.

## Out of scope

- A supplier-change approval queue, automatic projection, provenance/review UI, or customer notification automation.

## Assumptions

- Chris/Rosie decide manually what customer communication is appropriate, as Bhoumik’s sourcing-notes model directs.

## Open questions

- The dynamic customer Job Request Details workspace itself remains dependent on `customer-job-request-details-workspace`.

## Handoff log

- 2026-09-11 — removed the prior automatic supplier-change review/projection assumption to align with Bhoumik’s authoritative manual-communication direction.
