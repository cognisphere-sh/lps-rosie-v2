# Job and item notes

Use the same three fields on `job_requests` and `job_request_items`. Put
job-wide information on the job and line-specific information on the item.
These definitions replace the older exception-only and sourcing-entry
eligibility rules.

| Field | Purpose |
|---|---|
| `note_from_customer` | Notes or additional information supplied by the customer: alternatives, color, special requests and other requirements. Preserve original demand/options when the quoted offering changes. |
| `note_for_customer` | Notes included in the quote and shared with the customer. They may come from Chris/LPS's sourcing work or an AR supplier response. Include only information meant for the customer. |
| `note_internal` | Brief current supplier/price/received-response facts, implemented line changes and material unresolved sourcing or quantity choices. Do not turn open choices into selected offerings or customer-origin statements. No approval/provenance narration or pending-response boilerplate. |

Keep notes concise and current, not an action log. Do not duplicate structured
fields, copy a transcript or list steps taken; replace superseded facts in
place and leave NULL when there is nothing useful to add. On an existing job,
record only the current supplier/price/response state, current actual line
modification/substitution and still-material unresolved sourcing/quantity
choices; workflow records and chat carry
action history. A general price/supplier lookup still
creates no job, AR or outreach. Report findings in Chris's original chat as
well as updating relevant job notes when useful.

## Write or update

1. Follow [write discipline](writes.md): read current notes, recent changes,
   source evidence and Chris's latest decisions. Choose the field by origin
   and audience, and the row by scope.
2. Keep customer-supplied information in `note_from_customer`; Chris's internal
   decisions and supplier replies do not become customer-origin notes. Preserve
   customer conditions, original options and phases. Retain job-wide context
   once on the job rather than repeating it on every item.
3. Save only the customer-useful outcome in `note_for_customer`: an actually
   unavailable original plant and approved recommended alternative (if any),
   a short factual description of an actual size/quantity/variant difference,
   or ETA/other meaningful supplier details when the plant can be ordered.
   Prefer the verified offered-versus-requested fact over an unsolicited
   customer-choice question; ask the customer separately only when authorized.
   A concise confirmation of a previously ambiguous customer unit/quantity
   (for example, individual 4-inch plants rather than trays) may be useful
   even when available as requested. Otherwise availability as requested
   usually needs no note. Source the outcome from
   Chris/LPS findings or submitted AR `note_from_supplier`, never from a bare
   price-list gap. Keep unverified cultivar/proxy caveats and supplier-directed
   questions such as `Plum Delight cultivar not confirmed` or `RED Avail?`
   internal or in the supplier ask, not `note_for_customer`. In `note_internal`,
   retain only material current supplier, price and response information, actual
   current item-line changes/substitutions, and unresolved sourcing or quantity
   choices that affect the next decision. Resolve or remove the choice when
   decided; do not leave a running deliberation. Identify the actual
   catalogue plant/size behind a proxy price where useful, without narrating
   who approved it or calling it an actual substitution. Include a supplier
   response only after actually received;
   never add `AR response pending` or similar boilerplate already evident in
   AR status. Do not append the work performed, requests sent or follow-up log.
   Split mixed notes by audience; never copy the whole
   supplier reply into a quote. Preserve unrelated customer-facing supplier
   details and customer-origin `note_from_customer`; do not blanket-clear notes.
   If intended audience is unclear, keep that detail internal until clarified.
   Use [quote-generation: notes for customer](../../quote-generation/artifacts/shared-notes.md)
   for wording and rendering.
4. Update the affected facts in place, preserving unrelated customer-facing
   notes and current customer constraints. Keep suppliers distinct internally
   where relevant. State the current supplier, priced plant/size, list or
   actual supplier-quoted price, and its brief received response. A catalogue
   price or LPS proxy is not a supplier quote or stock confirmation. A concise
   factual basis suffices, e.g. `APS generic crossvine 1 G — list $8`; do not
   add `Chris approved provisional proxy`, approval chronology, unnecessary
   identity caveats or source-lookup narration. Retain a short identity/price
   qualifier only if necessary to avoid a materially false claim, and keep
   approval evidence in the originating transcript/handoff and applicable
   structured fields rather than in job/item notes. Add the supplier's
   response only when actually received; replace superseded response facts
   rather than tracking their history. Record current actual line changes (offered
   size/quantity/variant or selected substitute versus original demand) on the
   affected item only; do not mistake a pricing-only proxy for an actual plant
   substitution or erase the original customer demand. Do **not** retain
   rejected decisions or unused substitutions (e.g. `No 7G substitution`) in
   internal notes: retain implemented changes, current supplier/price/response
   state and any still-material unresolved sourcing or quantity choice. Do not
   turn internal notes into an approval,
   sourcing-step or contact chronology; use structured records and transcripts.
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
`Plants need staking. Can order for Oct 1.` can yield `Requires staking; ETA
Oct 1` in `note_for_customer` for the applicable offering and `APS: can order;
ETA Oct 1` in `note_internal` if the supplier response needs internal tracking.
