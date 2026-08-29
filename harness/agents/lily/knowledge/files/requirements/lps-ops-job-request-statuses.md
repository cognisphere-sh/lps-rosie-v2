# Use Chris’s LPS Ops job-request lifecycle and history

- Status: staged — lifecycle/history; Closed Lost reason capture deferred
- Route: bhoumik
- Priority: Lifecycle/history is current staged work; Closed Lost reason capture is low-priority follow-on
- Raised: 2026-08-27 by Chris (via nova handoff, then Chris clarification)
- Updated: 2026-08-27

## Problem

The LPS Ops view needs one clear lifecycle for a customer job request and a durable place to review completed work. Chris does not see value in Archived: a duplicate or bad request should be deleted, while every legitimate request ends as either Closed Won or Closed Lost. The current lifecycle has Sourcing, Quoted, Closed Won, Closed Lost, and Archived; it has no Confirmed stage, and it does not define a historical reporting view.

This lifecycle drives the request vocabulary, active-work counts, Rosie's JR chat directory and JR-thread closure. Historical closed work must remain available for business reporting rather than being treated as clutter in the active work list.

## Evidence

- 2026-08-27 — Chris first defined the LPS Ops Job Request status order/colors from `photo_234.jpg`: Active (green), Quote Delivered (blue), Confirmed (purple), Closed Won (teal/dark green), Closed Lost (red), Archived (gray). The screenshot showed Rosie's Recent Chats/JR picker with Urban Oasis marked Active. (via Nova handoff)
- 2026-08-27 — Chris clarified that Archived has little purpose and “just takes up data”; duplicates/bad requests should be deleted, and all other requests either become an order or do not: Closed Won or Closed Lost. He expects Closed Won/Lost in a Job Request Historical view for reporting/querying, including requests and dollars created in January and Closed Won last month. (via Lily)
- 2026-08-27 — Chris specified that selecting Closed Lost must require a Reason dropdown and save the selected reason with the request. Exact choices: Price, Different Vendor, Unable to Fulfill Request, No Response, NA. Screenshot `photo_27.jpg` illustrates a Closed Lost reason alongside a close date. (via Lily)
- Current LPS job requests use Sourcing, Quoted, Closed Won, Closed Lost, Archived. Current open-request counts and Rosie's JR chat picker treat only Sourcing and Quoted as open; Closed Won, Closed Lost, and Archived close the JR conversation. (`docs/supabase-schema.md`, app/docs review, 2026-08-27.)

## What it should do

- Establish this lifecycle for **LPS Ops Job Requests**: Active (green), Quote Delivered (blue), Confirmed (purple), Closed Won (teal/dark green), Closed Lost (red). Retire Archived as a future job-request outcome.
- Treat Closed Won and Closed Lost as the two completed outcomes. They leave active operational work but remain retained and findable in a Job Request Historical view.
- Make the historical view support the business questions Chris named: requests and their dollar value created during a selected period, and requests Closed Won during a selected period. Its time basis and totals must be clear enough that Chris can trust the result.
- Keep erroneous/duplicate requests distinct from historical closure: deletion remains a deliberate exception, with safeguards appropriate to a permanent removal and its dependent work/history.
- Apply the agreed lifecycle consistently wherever LPS Ops judges, filters, counts, or lists job requests, including active-request summaries and Rosie's JR conversation picker. Completed requests should not crowd active work; they should remain available through history/reporting.
- Preserve lifecycle history through the transition from the current status set. Keep line-item availability answers and supplier availability-request progress independent of job-request lifecycle.

## Acceptance criteria

- Chris can open an LPS Ops job request and see only Active, Quote Delivered, Confirmed, Closed Won, and Closed Lost, in that order and with the stated colors; Archived is not a new selectable outcome.
- Active-work views and Rosie's JR conversation picker follow the agreed definition of open work; Closed Won and Closed Lost leave those active-work views and their JR conversation has the agreed closed behavior.
- Chris can use a Job Request Historical view to find Closed Won and Closed Lost requests without restoring them to the active list.
- Chris can answer, for a chosen period, how many requests and how many request dollars were created, and how many requests/dollars were Closed Won, with the basis of each measure shown clearly.
- An existing legitimate request is preserved and mapped to a valid lifecycle status; pre-existing Archived records receive an approved treatment rather than disappearing.
- A duplicate or bad request can be deliberately removed only through the agreed deletion safeguards; a normal completed request is retained for history and reporting.
- Job-request line statuses and supplier availability-request statuses retain their existing independent meanings.

## Deferred follow-on — not an immediate build item

- When the status/history flow is next expanded, require and save one Closed Lost reason from this exact list: Price, Different Vendor, Unable to Fulfill Request, No Response, NA.
- Show and make that saved reason available for historical review/querying at that time.

## Out of scope

- Changing individual plant-line availability states.
- Changing supplier portal availability-request stages.
- Changing customer or supplier identity/contact metadata.
- Building a general chat-status system unless Bhoumik confirms the scope is broader than LPS Ops Job Requests.

## Assumptions

- This supersedes the initial screenshot’s Archived status: Chris has now ruled it out as a normal future outcome.
- The future Closed Lost reason is a structured business outcome, not a free-text note or a line-item/supplier-status value.
- “Active” replaces the current initial Sourcing stage and “Quote Delivered” replaces Quoted, subject to Bhoumik’s approved migration plan.
- Closed Won and Closed Lost are retained historical business records, not deletion candidates merely because they are no longer active.

## Open questions

- **Chris:** What specifically moves a request from Confirmed to Closed Won: the customer’s commitment, or only creation/placement of the actual order? This decides the meaning of Confirmed and the Closed Won reporting date.
- **Bhoumik:** Propose the safe migration and retention treatment for existing Sourcing, Quoted, and Archived requests, including how historical reporting distinguishes created, closed, and any future order date, and how existing Closed Lost records without a known reason are handled.
- **Bhoumik:** Confirm the exact scope of the new lifecycle/history behavior across LPS Ops job requests, Rosie's JR picker and customer summaries versus legacy chat metadata. It must not silently alter supplier availability requests or plant-line statuses.

## Handoff log

- 2026-08-27 — Staged for Bhoumik. Initial status definition captured; not sent to Nova because lifecycle, migration, thread closure, retention, and reporting behavior are workflow/data concerns.
- 2026-08-27 — Updated after Chris clarified that Archived should be retired, completed requests belong in historical reporting, and only duplicate/bad requests should be deleted.
- 2026-08-27 — Captured Closed Lost reason choices from screenshot `photo_27.jpg`; Chris marked this low-priority follow-on, not an immediate build item. Lifecycle/history remains staged for Bhoumik.
