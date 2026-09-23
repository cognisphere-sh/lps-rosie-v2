# Job and item notes

Use the same three fields on `job_requests` and `job_request_items`. Put
job-wide information on the job and line-specific information on the item.
These definitions replace the older exception-only and sourcing-entry
eligibility rules.

| Field | Purpose |
|---|---|
| `note_from_customer` | Notes or additional information supplied by the customer: alternatives, color, special requests and other requirements. Preserve original demand/options when the quoted offering changes. |
| `note_for_customer` | Notes included in the quote and shared with the customer. They may come from Chris/LPS's sourcing work or an AR supplier response. Include only information meant for the customer. |
| `note_internal` | Internal notes for Chris/LPS to track sourcing progress: findings, pending actions, blockers, supplier comparisons and decisions. |

Keep notes concise and current. Do not duplicate structured fields or copy a
transcript into them; leave NULL when there is nothing useful to add. Useful
progress on an existing job can be recorded before an AR is sent. A general
price/supplier lookup still creates no job, AR or outreach. Report findings
in Chris's original chat as well as updating relevant job notes.

## Write or update

1. Follow [write discipline](writes.md): read current notes, recent changes,
   source evidence and Chris's latest decisions. Choose the field by origin
   and audience, and the row by scope.
2. Keep customer-supplied information in `note_from_customer`; Chris's internal
   decisions and supplier replies do not become customer-origin notes. Preserve
   customer conditions, original options and phases. Retain job-wide context
   once on the job rather than repeating it on every item.
3. Save only the customer-facing part of Chris/LPS findings or submitted AR
   `note_from_supplier` in `note_for_customer`. Put internal progress, costs,
   comparisons, follow-ups and decision context in `note_internal`. Split
   mixed notes by audience; never copy the whole supplier reply into a quote.
   If intended audience is unclear, keep that detail internal until clarified.
   Use [quote-generation: notes for customer](../../quote-generation/artifacts/shared-notes.md)
   for wording and rendering.
4. Update the affected facts in place, preserving unrelated customer-facing
   notes, current choices, pending decisions and constraints. Keep suppliers
   distinct internally. Retain necessary source/proxy/override evidence and
   label unconfirmed facts accurately; a catalogue price is not stock evidence.
   Put job-wide override authority once on the job, explicitly not
   supplier-confirmed, with any necessary row qualifier.
5. Guard note-only writes and verify the saved fields. Note updates do not
   change prices, quantities, offerings, availability, statuses, source selection
   or orders, and do not authorize sends. A real alternative still needs
   Chris's action-specific quote/AR approval before it is offered or requested,
   including in notes; quote approval is separate from AR approval.

## AR handoffs

When preparing an authorized AR, read both the job's and each item's
`note_from_customer`. Pass supplier-relevant job context into
`availability_requests.note_for_supplier` and line details into
`availability_request_items.note_for_supplier`. Preserve useful color, alternative,
handling and special-request details within the approved ask. Keep internal
sourcing context and irrelevant/private customer information out. Shared ARs
must preserve which job/allocation a requirement applies to; never apply one
customer's conditions to every linked job. Follow
[supplier-coordination: line notes](../../supplier-coordination/artifacts/line-notes.md).

For a safely matched, explicitly submitted AR response, use its header and
line `note_from_supplier` to populate the corresponding job/item `note_internal`
or `note_for_customer` by audience. Request-wide conditions go on the applicable
jobs; line-specific details go on the linked items. Apply only relevant scope,
and retain shared totals as shared totals. Unsubmitted edits stay on the
supplier thread. Follow [supplier responses](supplier-responses.md); recording
a customer-facing detail does not select a supplier, accept a substitution or
authorize customer delivery.

Examples (wording only): customer `Red flowers only; single trunk` can be
carried into the relevant AR line's `note_for_supplier`. A submitted supplier note
`Plants need staking. Ask Chris to confirm the pickup slot.` can yield
`Requires staking` in `note_for_customer` for the applicable offering and
`APS: confirm pickup slot` in `note_internal`.
