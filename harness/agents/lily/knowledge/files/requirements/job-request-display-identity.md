# Show one exact Request identity from the stored company, job, and contact

- Status: routed
- Route: nova
- Raised: 2026-09-02 by Chris (via Rosie handoff)
- Updated: 2026-09-02

## Problem

Chris needs a Request’s identity to be immediately understandable without manually combining its separate facts. On JR-34 he specified the exact preferred display: `Land Water Light | Ox Eye Phase II | Dior Goodwin` — contractor/company, job/site, contact. JR-36’s requested identity follows the same three-part pattern: `Outdoor Renovations | 803 Redbud | Kyle Stoutenger`.

The three values already exist separately. Treating a combined display string as the stored job name makes later correction and display inconsistent, and caused unnecessary friction.

## Evidence

- 2026-09-02 feedback log, **Contractor in job identity**: JR-34 confirms the exact preferred display `Land Water Light | Ox Eye Phase II | Dior Goodwin` from the three stored values.
- 2026-09-02 feedback log, **Exact editable request identity**: Chris requested JR-36’s exact three-part display `Outdoor Renovations | 803 Redbud | Kyle Stoutenger`.
- Current model: the customer holds company and contact/name; the Job Request holds job/site name. No new data field is needed to display those already stored facts.

## What it should do

For a Landscape Professional Request/Order identity, display the exact ordered nonblank components:

`Company | Job/Site | Contact`

Use the actual stored values only. For JR-34 that is `Land Water Light | Ox Eye Phase II | Dior Goodwin`; for JR-36 it is `Outdoor Renovations | 803 Redbud | Kyle Stoutenger`. Omit a genuinely absent component and its adjacent separator; never invent, parse, duplicate, or write a combined title back into the stored job/site name.

The existing inline control edits the stored **Job name** component only. It must not be labelled or behave as an editor for the complete composed identity, company, or contact. A successful component edit refreshes the composed display.

This is display/UI behavior, not a customer/job data-model change. The still-staged customer-type requirement separately decides the Homeowner/Retail experience; until that policy is durable, this requirement governs the contractor/Landscape Professional identity only.

## Acceptance criteria

- A Landscape Professional identity uses the exact visible order `Company | Job/Site | Contact` from stored values.
- JR-34 renders as `Land Water Light | Ox Eye Phase II | Dior Goodwin`; JR-36 renders as `Outdoor Renovations | 803 Redbud | Kyle Stoutenger`.
- Missing components and separators are omitted honestly; the UI does not infer a site, contact, company, or composite fallback.
- The display never writes a combined identity into the stored job/site value or parses an existing name into components.
- The inline Job-name edit changes only the actual stored Job/Site component; company and contact remain separately edited through their own existing paths.
- The same identity format is used consistently wherever the contractor/Landscape Request identity is presented within the approved scope.

## Out of scope

- New database fields, migrations, data backfill, or parsing historical names.
- Changing the Homeowner/Retail type, pricing, date, fulfillment, supplier, order, or lifecycle workflows.
- Editing company or contact through the Job-name control.

## Assumptions

- JR-34 and JR-36 are both display-format evidence, not instructions to save a combined string as the job/site name.
- The three required values are already separately stored for those Requests.

## Open questions

- **Chris:** Confirm whether the same `Company | Job/Site | Contact` presentation applies on every contractor/Landscape surface, or name any deliberate exception.
- **Bhoumik:** No data decision is needed for this display rule. Decide only how the eventual Homeowner/Retail type should select its distinct display once that staged workflow is approved.

## Handoff log

- 2026-09-02 — Drafted for Nova as UI-only display composition after Chris clarified JR-34 uses three already stored values.
- 2026-09-02 — Routed to Nova by Lily main. The approved scope is display composition only; no data migration or combined Job-name write.
