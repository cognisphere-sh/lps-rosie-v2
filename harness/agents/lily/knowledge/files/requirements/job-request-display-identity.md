# Show one exact Request identity from the stored company, job, and contact

- Status: routed
- Route: nova
- Raised: 2026-09-02 by Chris (via Rosie handoff)
- Updated: 2026-09-25 12:11:54 CDT

## Current policy-provenance caveat

2026-09-25 12:11:54 — **AWAITING DECISION:** parent reports Telegram359 successfully asked Bhoumik/Chris one forward decision: use current Company | short site/request description for new Jobs, including request description without a site, versus older site-only/blank storage plus separate company display. Existing Jobs stay unchanged. This is not new approval, rollback or implementation authority; no further question and no current owner/app change until answer.

2026-09-25 12:05:28 — Historical approval below is preserved, not a verified current storage contract. Rosie reports JR82 created with a full Company | request-description name under current intake §4. Changelog5.26.0 attributes stored `Customer/Company Name | Slug` to Chris but lacks a date/message citation; Rosie's September25 12:09:06 bounded lookup did not locate that exact general approval. It found case-specific Chris composites on JR34/JR36 September2 and main webchat38 September21 (`Urban Landscape Group | 404 Inwood`); these do not specify a general stored-name policy or plant-description fallback. Implementation commit4f22287 September23 is not approval. This leaves policy genuinely unresolved rather than proving SOP drift. Current `app/lib/job-identity.ts` and `docs/app/README.md` already preserve recognized full names without adding separate company/contact, unlike this older atomic-only assumption. Source presence does not establish human approval or live behavior; August31 recall alone does not establish drift. Pending provenance, this requirement does not authorize restoring atomic storage, parsing/backfilling names, renaming JR82 or changing the frontend. AR/Order record names and company-only customer intake remain separate. Bounded evidence: `workspace/threads/main/tasks/job-name-policy-reconciliation/notes.md`.

## Focused mobile presentation exception

Chris’s Telegram607/615 governs the private **mockup-only** exception in `focused-job-header-layout`: Company once in the top JR/Company/Status/Total group; Job below only when meaningfully distinct, with estimated install date/Rosie. Supporting customer row is real person + customer Chat only, not company again. Telegram615 rejected equal-value repeated-role display; the prior preview is not UX-approved. This local suppression does not alter independent stored values, global helpers, or the real Job-only editor: an equal-valued stored Job remains present/editable and must not become a fake Add Job name state. No All Jobs, rails, search, desktop, parsing, merging or implementation approval.

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
- Saved job-scoped AR/Order reference names. 2026-09-22T12:50:45-05:00: their existing operator rollout is separately unproven live; it does not rename the atomic Job, change this composition/editor scope or establish a blocker for this requirement. Evidence only: `workspace/threads/main/tasks/record-name-rollout/rollout-dependency.md` on Lily; no naming build/approval inferred.

## Assumptions

- JR-34 and JR-36 are both display-format evidence, not instructions to save a combined string as the job/site name.
- The three required values are already separately stored for those Requests.

## Open questions

- **Chris:** Confirm whether the same `Company | Job/Site | Contact` presentation applies on every contractor/Landscape surface, or name any deliberate exception.
- **Bhoumik:** No data decision is needed for this display rule. Decide only how the eventual Homeowner/Retail type should select its distinct display once that staged workflow is approved.

## Handoff log

- 2026-09-02 — Drafted for Nova as UI-only display composition after Chris clarified JR-34 uses three already stored values.
- 2026-09-02 — Routed to Nova by Lily main. The approved scope is display composition only; no data migration or combined Job-name write.
