# Keep quick quote opportunities out of Request Management until sourcing starts

- Status: staged
- Route: bhoumik
- Raised: 2026-08-29 by Chris (via telegram)
- Updated: 2026-08-29

## Problem

At higher volume, a quick customer quote is not yet plant-sourcing work. Putting every early price request into Request Management inflates active operational work and mixes contractor bidding with jobs that need live availability, installation changes, supplier coordination, and fulfilment.

## Evidence

- 2026-08-29 feedback log, **Quick quotes are not Job Requests**: Chris says quick quote requests belong in a separate Quote view. He can return the quote there; only when the customer comes back to source plants or update the installation date do its details move into a new Request and begin Request Management.
- 2026-08-29 feedback log, **Budgeting quotes are allowed**: early pricing is a placeholder for contractor bidding and may change with install timing.

## What it should do

Keep a quick quote opportunity in a dedicated Quote view rather than creating a Job Request or beginning Request Management. Rosie may generate and return it without a supplier availability or price check. It must clearly communicate that it is indicative and subject to plant price/availability changing with installation timing; retain the customer’s requested plants and returned quote as its own dated opportunity history.

Only an explicit customer re-engagement to source plants or change/update the installation date converts the opportunity into a **new** Job Request. Conversion preserves a clear link to the source quote and carries the relevant customer, plant, quantity, quoted-price, quote-date, and install-date context into the new Request for review; it does not silently represent early indicative pricing as current supplier-confirmed price or availability.

The converted Job Request begins the Request Management lifecycle. Supplier availability asks, Rosie’s Job Request thread, Request Management counts, and the Confirmed/Closed process apply only after conversion.

## Acceptance criteria

- A quick quote can be prepared and returned without supplier confirmation, a Job Request, or an availability request, and clearly says it is indicative/subject to later verification.
- Quote opportunities and active Job Requests appear in distinct work views.
- Customer re-engagement to source plants or update installation timing creates a new Job Request linked to the original quote.
- The new Request carries the relevant quote context for review while preserving the original quote as historical evidence.
- An early quote does not become a current supplier-verified price or availability merely because it converts.
- Reporting can distinguish quote opportunities/quote value, converted quotes, and Job Requests/confirmed/closed work without double-counting a converted opportunity as two Job Requests.

## Out of scope

- Automatically contacting a supplier or customer because a quote exists.
- Treating a quick quote as an order or customer commitment.
- Deciding the supplier-price evidence rule for an indicative quote; that remains a lifecycle policy question.

## Assumptions

- A conversion is explicit and customer-driven, not a time-based automatic promotion.
- A newly converted Request has no supplier availability confirmation until Request Management obtains it.

## Open questions

- **Chris:** On conversion, should all original quoted plants, quantities, prices and customer/install details be carried into the new Request for review, or should Rosie choose only the plants still needed? Recommended: carry all as an editable starting point and retain the original quote unchanged.
- **Bhoumik:** Define the durable quote opportunity, conversion link, no-double-count reporting rule, and which quote details are carried versus retained only as source history.

## Handoff log

- 2026-08-29 — Staged for Bhoumik; this changes workflow/data boundaries, not merely a Quote screen.
- 2026-08-29 — Bhoumik confirmed: Rosie may generate a quick quote without an availability check; sourcing/availability begins only at explicit conversion.
