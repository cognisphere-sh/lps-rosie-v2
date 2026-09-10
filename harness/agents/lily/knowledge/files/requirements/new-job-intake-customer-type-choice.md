# Let Chris identify a homeowner or landscape professional when a new job starts

- Status: drafted — ready to route after Bhoumik confirms the durable workflow boundary
- Route: nova
- Raised: 2026-08-30 by Chris (via telegram image)
- Updated: 2026-08-31

## Problem

At new job intake, the customer record has only a person and an optional company. Chris nearly entered “Retail” as the company simply to distinguish the kind of customer. That would corrupt the customer’s real company information and gives the rest of the app no way to present the right working experience.

## Evidence

- 2026-08-30 feedback log, **Homeowner or landscape professional**: Chris requested a choice of Homeowner or Landscape Professional at new request/job creation so they can be worked as retail customers versus traditional contractors, including pricing.
- 2026-08-30 feedback log, **Customer-type request/order naming**: Landscape Professional Requests/Orders use Company Name then Job Name; Retail uses `Retail | Customer Name`; both show estimated project date as `EPD: M/D/YY`. A Landscape Professional job name may be a residence name, street number/name, or PO, and can be blank until details emerge.
- 2026-08-31 feedback log, **Company then job name**: Chris confirmed company-first Landscape presentation through JR-32.
- 2026-09-02 feedback log, **Exact editable request identity** and **Contractor in job identity**: Chris clarified the exact Landscape display composition from existing values: `Company | Job/Site | Contact` (JR-34: `Land Water Light | Ox Eye Phase II | Dior Goodwin`; JR-36: `Outdoor Renovations | 803 Redbud | Kyle Stoutenger`). This supersedes the prior separator reading.
- Current intake begins by reserving a Job Request and opening Rosie’s focused intake; the Customer screen currently shows name, optional company, contact details and address, but no customer type.

## What it should do

When Chris starts a new job/request, show a simple, clearly named choice between **Homeowner** and **Landscape Professional** before or as Rosie begins intake. Explain only enough to prevent the error: the choice identifies how LPS will work the customer; it is not the company name.

The selected type should stay visible in the active intake and the resulting customer/job workspace, using the approved wording. The UI must make clear when the type has not yet been selected rather than quietly assuming that a customer with a company is a landscape professional.

Render customer-facing working titles consistently: **Landscape Professional** Requests/Orders as `Company Name | Job/Site | Contact`, composed from existing separate stored values; **Homeowner/Retail** Requests/Orders as `Retail | Customer Name`. Show the estimated project date in the concise form `EPD: M/D/YY` wherever that working title is shown. For a Landscape Professional, allow Job Name to be blank at intake and visibly incomplete until Chris/Rosie later supplies a residence name, street number/name, or PO; do not manufacture a job name, parse a composite display title, or assume a general short-description fallback.

This UI slice must use the durable type, date, and naming behavior supplied by the staged workflow/data decision; it must not invent a local-only customer type, calculate a price itself, or save a fabricated title when information is absent.

## Acceptance criteria

- Chris can select **Homeowner** or **Landscape Professional** when beginning a new job/request, without entering either word as the customer’s company.
- The intake makes the selection’s purpose understandable: it determines the LPS working experience, not the customer’s business name.
- The selected type is visible while the intake is in progress and once the resulting customer/job is viewed.
- Landscape Professional Request/Order titles display as `Company Name | Job/Site | Contact` from separate stored values; Homeowner/Retail titles display as `Retail | Customer Name`; each displays `EPD: M/D/YY` when an estimated project date is present.
- A Landscape Professional Job Name may be blank at first and can be filled later as a residence name, street number/name, or PO; the UI neither blocks intake nor invents the missing value.
- A missing selection is visibly unresolved; the UI does not infer type from company, address, or prior pricing.
- The UI faithfully displays the persisted workflow/data decision and does not apply independent pricing or workflow rules.

## Out of scope

- Defining retail versus contractor pricing, payment, tax, delivery, quote language, or supplier behavior.
- Deciding whether a customer may have different types on different jobs.
- Reclassifying existing customer records.

## Assumptions

- The two labels are Chris’s intended starting vocabulary; they may be refined only by Chris/Bhoumik’s workflow decision.
- The choice belongs in the focused new-job intake, not as a substitute company field on the Customers list.

## Open questions

- **Bhoumik:** Confirm where the durable classification lives and whether it applies to the customer relationship, a particular job, or both; Nova should wire the choice to that result.
- **Chris:** What are the minimum practical differences in pricing and service for a Homeowner versus a Landscape Professional? Recommended single answer: identify the pricing basis/markup and any different quote, ordering, payment, delivery, or communication step.

## Handoff log

- 2026-08-30 — Drafted as an independent UI/UX slice for Nova, contingent on the staged durable workflow/data contract.
- 2026-08-31 — Rosie’s `job-requests` v3.5.0 now supplies the approved intake rule: no invented generic summary or combined company/job value; company/job formatting is presentation logic once a real job name exists.
- 2026-09-02 — JR-34/JR-36 clarify the exact Landscape presentation as `Company | Job/Site | Contact` from separately stored values. The composition is Nova UI work; the Homeowner/Retail type/date contract remains contingent on Bhoumik.
