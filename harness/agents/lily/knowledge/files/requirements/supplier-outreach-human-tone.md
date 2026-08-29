# Ask suppliers about availability like a person

- Status: shipped
- Route: rosie
- Raised: 2026-08-28 by Chris (via Rosie, JR-21)
- Updated: 2026-08-28

## Problem

Suppliers do not know what an “LPS job” is. A formal availability request such as “Please confirm your availability” sounds like a demand or automated form rather than a normal request for help, making ordinary supplier outreach less natural.

## Evidence

- 2026-08-28 — Chris, through the JR-21 test: “No one knows what an LPS job is”; outreach should sound “like a regular human, not a LLM output.” He specifically rejected “Please confirm your availability” as a demand, not an ask.
- Chris supplied the intended model: “Morning, Have a project here in Austin looking for 200 x 7g Giant Green Thuja. Ya’ll have those available? If you have a photo handy I would love to take a look. Thanks in advance”.

## What it should do

When Rosie drafts a non-Partner supplier availability email for Chris’s approval, make it a brief, informal, concrete ask in ordinary human language. Give enough project context to orient the supplier (for example, a project in Austin) rather than referring to an internal “LPS job.” State the plant, size and quantity, ask whether they have it, and include only useful optional asks such as a photo when relevant.

Avoid form-like or demanding phrasing, including “Please confirm your availability.” Continue to use the supplier’s recorded communication preference when one exists, and keep per-draft Chris approval intact.

## Acceptance criteria

- A drafted non-Partner availability email is two to three light, plain-language lines and asks rather than commands.
- It never calls the request an “LPS job” or asks the supplier to “confirm availability.”
- It identifies the specific plant, size and quantity and gives a brief project/location context when available and appropriate to share.
- Chris still reviews and approves each exact draft before Rosie sends it; previously approved text is sent verbatim.
- Supplier-specific preferences continue to override the general tone convention.

## Out of scope

- Changing LPS Partner portal availability requests.
- Changing supplier data, job-request workflow, approval gates, or the email sending mechanism.
- Rewriting previously approved or sent outreach.

## Assumptions

- “Project here in Austin” is a model of useful context, not mandatory boilerplate; the draft uses the actual known location/context and does not invent one.
- A photo request is optional and used when it would help Chris assess the material.

## Open questions

None.

## Handoff log

- 2026-08-28 — Routed to Rosie to update her owned outreach-drafting guidance in the relevant skill(s). Chris’s approval of this change is present in the JR-21 feedback.
- 2026-08-28 — Shipped: Rosie updated `supplier-coordination` to v1.9.0. §4 now requires brief, light, plain-language non-Partner availability asks; prohibits “LPS job” and “Please confirm your availability”; and retains supplier preferences plus exact per-draft Chris approval. Rosie intentionally did not duplicate wording in `job-requests`, which delegates it to `supplier-coordination` §4.
