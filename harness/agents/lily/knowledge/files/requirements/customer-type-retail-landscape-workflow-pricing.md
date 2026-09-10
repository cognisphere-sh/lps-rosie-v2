# Work homeowners as retail customers and landscape professionals as contractors

- Status: staged
- Route: bhoumik
- Raised: 2026-08-30 by Chris (via telegram image)
- Updated: 2026-08-31

## Problem

LPS currently treats a customer as a person with an optional company, and all Job Requests follow one contractor-oriented intake, quote, sourcing, and pricing path. Chris needs to distinguish a homeowner from a landscape professional at the start so a homeowner can receive a retail customer experience and a landscape professional the traditional contractor experience. Entering “Retail” as a company is not a durable or truthful way to make that distinction, and it cannot drive pricing safely.

## Evidence

- 2026-08-30 feedback log, **Homeowner or landscape professional**: Chris requested the Homeowner / Landscape Professional choice and explicitly said it must support distinct retail versus traditional-contractor work, including pricing.
- 2026-08-30 feedback log, **Customer-type request/order naming**: Landscape Professional Requests/Orders are Company Name then Job Name; Retail Requests/Orders are `Retail | Customer Name`; both show `EPD: M/D/YY`. Landscape job name can be a residence name, street number/name, or PO, and can be added after intake.
- 2026-08-31 feedback log, **Company then job name**: Chris confirmed the displayed Landscape Professional form and separator through JR-32: `Oviedo Land and Garden — Job #1`. This supersedes the earlier pipe separator; it does not establish a new general fallback from short request text.
- 2026-09-02 feedback log, **Exact editable request identity** and **Contractor in job identity**: Chris specified JR-36 as `Outdoor Renovations | 803 Redbud | Kyle Stoutenger` and JR-34 as `Land Water Light | Ox Eye Phase II | Dior Goodwin`. Follow-up confirms both are a display format from separately stored company, job/site, and contact values—not a request to store a composite job name.
- Current schema/app review: a customer is a person with optional company, and a Job Request may link to that customer; neither has a durable customer-type, workflow, price-policy, estimated-project-date, or type-specific naming concept. New intake reserves a Job Request and Rosie creates the customer/job context in its conversation.
- 2026-08-29 feedback log, **Quick quotes are not Job Requests** and **Budgeting quotes are allowed**: the existing quote policy is built around contractor bidding and explicitly indicative catalog pricing; it does not establish a homeowner retail-price policy.

## What it should do

Define and retain a truthful Homeowner versus Landscape Professional classification as part of the customer/job intake model, separate from a person’s name and company. The classification must be available to Rosie and the app when they create, review, quote, source, fulfill, and report on the work.

Define the two customer experiences in business terms. For each type, specify the pricing basis and the applicable workflow differences, if any: quote/price presentation, indicative-versus-verified price rules, taxes, payment/credit terms, delivery or pickup, communication/approval, and whether a job can proceed through the existing contractor process unchanged. The system must use the approved type-specific policy consistently and show Chris which policy is governing a quote or job; it must never silently infer the type from a company name.

Define and retain the working Request/Order identity and estimated project date. A Landscape Professional displayed title uses the exact ordered stored values `Company Name | Job/Site | Contact`, as confirmed on JR-34 and JR-36. A Retail normal displayed title is `Retail | Customer Name`. Both display the estimated project date in abbreviated form, `EPD: M/D/YY`. The Landscape display is composition only: company, job/site, and contact remain separately stored and corrected; it is never saved or parsed as one job-name string. A blank Landscape Professional job name must remain an honest incomplete state that can be filled later without breaking the job, its history, or its links. Do not infer a general short-description fallback from this rule without Chris’s decision. See `job-request-display-identity` for the UI display contract.

Decide the scope of the classification: whether it is a durable customer relationship, a job-specific choice, or both; how an existing customer is corrected; and what happens when the same person/company legitimately has different kinds of work. Preserve the historical type and pricing basis actually used for a quote/job so later reporting and review do not rewrite past commercial decisions.

This is a workflow/data and commercial-control change. Its durable model and policy are staged for Bhoumik. A separate Nova UI requirement supplies the visible intake choice and title/date rendering once this contract is settled.

## Acceptance criteria

- A Homeowner / Landscape Professional classification is retained separately from customer name and company and is available throughout the related intake and job workflow.
- Chris can identify the type before a price/quote is produced; the system never treats a company name, missing company, address, or old price as proof of type.
- Each type has an explicit approved pricing basis and applicable workflow rules; a quote/job makes clear which basis is in effect.
- Landscape Professional Requests/Orders display the normal exact `Company Name | Job/Site | Contact` identity and an estimated project date from separately stored values; Job Name can begin blank and be filled later as a residence name, street number/name, or PO without fabricating data or losing continuity.
- The display never writes a composite identity into, or parses one out of, company/contact/job-site facts.
- Retail Requests/Orders retain the `Retail | Customer Name` identity and an estimated project date; both types present the date as `EPD: M/D/YY`.
- A Homeowner can be worked through the defined retail experience and a Landscape Professional through the defined contractor experience without manual relabeling or hidden price workarounds.
- A price or quote produced under one type is not silently reused under the other type.
- The historical type and pricing basis used for a quote/job remain reviewable after a customer record is changed.
- Existing customers and Job Requests remain usable until Chris/Bhoumik decide how, or whether, they are classified; no blanket inference or migration mislabels them.

## Out of scope

- Choosing actual retail price levels, contractor discounts, tax rates, payment terms, or delivery fees before Chris approves them.
- Building an e-commerce checkout, retail storefront, or general customer portal.
- Changing supplier categories or the supplier availability/order workflow.

## Assumptions

- “Retail customer” means a homeowner-facing LPS commercial/workflow experience, not a fake company called Retail.
- Landscape Professional is the initial contractor-oriented category; other future customer classes are not implied by this request.
- Existing quick quote opportunities remain governed by their separately staged indicative-quote requirement unless Chris explicitly extends a type-specific policy to them.

## Open questions

- **Chris (one needed answer):** What is the minimum operational difference you want between the two types—especially the retail pricing basis/markup and any different quote, payment, delivery, tax, or communication step? A short list is sufficient; Bhoumik can turn it into a safe policy.
- **Bhoumik:** Should type be held on the customer, on each job/quote, or both? Recommend retaining the customer’s normal relationship type while snapshotting the type, title/date basis, and pricing basis used on every commercial record, with an explicit per-job override only if Chris confirms it is needed.
- **Bhoumik:** Define the safe transition and reporting treatment for existing unclassified customers/jobs and for a customer whose type, company, job name, or estimated project date is corrected later.

## Handoff log

- 2026-08-30 — Staged for Bhoumik: durable customer/job classification, type-specific Request/Order naming and estimated project date, commercial pricing policy, workflow behavior, history, and migration/transition decisions are required before the UI can be functional.
- 2026-08-31 — Clarified displayed Landscape Professional format from JR-32: company first, then an em dash and job name (`Oviedo Land and Garden — Job #1`); no generic short-description fallback inferred.
- 2026-08-31 — Rosie updated her owned `job-requests` procedure to v3.5.0: preserve a NULL job name until a real residence name, street number/name, PO, named project/site is known; prohibit generic inferred summaries and combined company/job titles; treat `Company — Job name` as presentation logic. Durable type/date/pricing/data work remains staged for Bhoumik.
- 2026-09-02 — JR-34/JR-36 follow-up resolves the apparent conflict: both are exact three-component display requests using values already stored separately. `job-request-display-identity` is a Nova UI composition requirement; no durable identity override/data change is implied.
