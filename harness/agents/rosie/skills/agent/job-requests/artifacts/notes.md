# Job and item notes

Use two fields on `job_requests` and `job_request_items`: `note_for_customer`
and `note_internal`. Put job-wide facts on the job and line details on the item.
Orders and order items also use `note_for_customer` for customer-facing sourcing
requirements and outcomes, and `note_for_supplier` for supplier context/responses.
AR headers and items share a single `note_for_supplier` field.

| Field | Purpose |
|---|---|
| `note_for_customer` | Concise sourcing requirements supplied by the customer, together with customer-useful sourcing outcomes from Chris/LPS or submitted supplier evidence. Preserve original sourcing constraints/options when adding outcomes. Shown once in the **Note for customer** column, never beneath the plant name. |
| `note_internal` | Brief current supplier/price/received-response facts, actual line changes and material unresolved sourcing or quantity choices. Never shared externally. |

Capture only information needed to source plants: meaningful cultivar, color,
form, acceptable alternatives, purchasing units and actionable availability/ETA.
Do not capture planting spacing, landscape layout, installation instructions,
project labels or unrelated additional details in customer notes. Do not repeat
plant, size, quantity, price or status already clear from structured columns.
Chris's JR-78 webchat message 13 (2026-09-24 10:52:38 CDT) clarified that
internal work and original-to-current decision history belong in `note_internal`,
not `note_for_customer`. For example, remove `Originally 15 G or 20 G; 15 G only
for this request` from the customer note when structured size already reads
`15 G`; a past option needs no internal note either unless it remains material.
For a flat resolved to individual pots, retain a concise conversion and per-pot
pricing basis internally when needed to prevent a purchasing-unit error; do not
put `Originally 1 flat ... 18 pots per flat for this request` in the customer
note. Genuine current customer sourcing constraints/preferences still belong in
`note_for_customer`. Keep unrelated context in its source message; source
transcripts retain original wording. Never add supplier identity, internal prices or deliberation to a
customer-facing note. Use NULL if there is no sourcing information to add.

Keep notes concise and current, not an action log. Chris reiterated minimal
internal wording (JR-72 webchat message 38, 2026-09-24 01:51:54 CDT): retain
only material supplier/price/response facts and unresolved risks; omit status,
quantity and price already conveyed adequately by structured fields, project
labels, chronology and needless qualifications. Leave `note_internal` NULL if
nothing remains. Do not copy a transcript or list steps taken; replace
superseded facts in place. On an existing job,
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
2. Read the existing merged `note_for_customer` before editing. Preserve current
   customer sourcing constraints and supported customer-facing outcomes together.
   Keep original demand/options clear when an offering changes, without attributing
   an internal interpretation or unresolved proposal to the customer. Retain job-wide
   context once on the job. Remove spacing, layout, installation directions and
   other information unrelated to plant sourcing from the note being revised.
3. Add the shortest supported customer-useful outcome. Examples: `15G only`,
   `3G only, 5G NA`, `Can order Tuesday`, or `5G @ $25, 1G NA` when the
   customer price and availability evidence support every claim. These are wording
   examples, not evidence, selected substitutes or authorization to send.
   Save only the concise, actionable customer-useful outcome in
   `note_for_customer`: an actually unavailable original plant and approved
   recommended alternative (if any), a short factual description of an actual
   size/quantity/variant difference, or ETA/other meaningful supplier details
   when the plant can be ordered. Add only facts that cannot already be inferred
   from other job/item columns: a status of unavailable needs no separate
   `unavailable` note, but a distinct offered size or order date may. For an
   orderable date, state the positive
   actionable fact (`Can order for Sep 29`), not a redundant comparison to the
   requested pickup date. Never include a supplier's name or attribution in
   customer-facing notes, even when the supplier supplied the alternative;
   keep source identity in internal/supplier records when material. Do not
   disclose that an internal substitution was declined or narrate selection
   history. For a supplier-proposed alternative intended for customer
   consideration, state its verified identity/size and supported updated
   customer price, not the old offering's price. If identity or customer price
   is unresolved, keep the proposal internal until resolved for the affected
   customer draft; do not imply a final offering or customer acceptance.
   Follow the applicable alternative/price selection and customer-send approval
   boundaries; a supplier proposal alone authorizes neither an offer nor a send.
   Prefer the verified offered-versus-requested fact over an unsolicited
   customer-choice question; ask the customer separately only when authorized.
   A concise confirmation of a previously ambiguous customer unit/quantity
   (for example, individual 4-inch plants rather than trays) may be useful
   even when available as requested. Otherwise availability as requested
   usually needs no note; do not fill a customer note with a redundant
   “available” claim or repeat a clear APS answer as a clarification question.
   For Carolina Cherry Laurel only, Chris confirmed 24-inch box and 30 G as
   equivalent (JR-78 webchat messages 33–34, 2026-09-24); retain the customer's
   requested size wording and note the box description only when customer-useful,
   not as an unapproved different-size offering. This does not establish a
   general container equivalence for other plants. Source the outcome from
   Chris/LPS findings or actual supplier responses in submitted AR `note_for_supplier`, never from a bare
   price-list gap. Keep unverified cultivar/proxy caveats and supplier-directed
   questions such as `Plum Delight cultivar not confirmed` or `RED Avail?`
   internal or in the supplier ask, not `note_for_customer`. In `note_internal`,
   retain only material current supplier, price and response information, actual
   current item-line changes/substitutions, and unresolved sourcing or quantity
   choices that affect the next decision. Resolve or remove the choice when
   decided; do not leave a running deliberation. Identify the actual
   catalogue plant/size behind a proxy price where useful, without narrating
   who approved it or calling it an actual substitution. For an APS-proposed
   alternative, retain its own price-list lookup result in the affected item's
   sourcing note: exact listed plant/size and list price, a qualified proxy
   with its actual catalogue identity, or a concise no-exact-price finding.
   Do not overwrite the requested offering's structured plant/size or price
   **merely** because an alternative was proposed or has a list price. Chris's
   JR-78 different-size JR display instruction permits the narrowly supported
   and otherwise authorized exception in [supplier responses](supplier-responses.md#different-size-jr-display);
   preserve the original ask in the customer note if using that exception. For a missing exact requested size, keep the closest
   genuinely plausible APS size/variant and its actual list price in this
   item's internal note, explicitly qualifying a size or identity mismatch;
   omit unrelated species even if the catalogue name is similar. The listing
   does not establish a price for the requested row, acceptance or stock
   (Chris, JR-78 message 23, 2026-09-24). Keep unresolved alternative identity/size/pricing internal. A confirmed,
   priced single-size proposal can be displayed factually under the
   [different-size JR display rule](supplier-responses.md#different-size-jr-display)
   without claiming acceptance or authorizing customer delivery. Include a supplier
   response only after actually received;
   never add `AR response pending` or similar boilerplate already evident in
   AR status. Do not append the work performed, requests sent or follow-up log.
   Split mixed notes by audience; never copy the whole
   supplier reply into a quote. Preserve unrelated customer-facing supplier
   details and customer-origin `note_for_customer`; do not blanket-clear notes.
   If intended audience is unclear, keep that detail internal until clarified.
   Use [quote-generation: notes for customer](../../quote-generation/artifacts/shared-notes.md)
   for wording and rendering.
4. Update the affected facts in place, preserving unrelated customer-facing
   notes and current customer constraints. Keep suppliers distinct internally
   where relevant. Mention current supplier, priced plant/size, list-versus-
   supplier-quoted price or brief received response only where the distinction
   is material and not already obvious from structured fields. A catalogue
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
5. Guard note-only writes and verify the saved fields. Note updates alone do
   not change prices, quantities, offerings, availability, statuses, source
   selection or orders, and do not authorize sends. The separate
   [first-APS-submission standing instruction](supplier-responses.md) permits
   supported scoped job-line status updates and factual customer-safe
   proposed-alternative notes; the [different-size JR display rule](supplier-responses.md#different-size-jr-display)
   governs any offered-size/price display change. Neither is approval to
   publish a quote, send a customer message, issue an alternative AR, select
   an order source or change accepted terms. Outside that exception,
   a real alternative still needs Chris's action-specific quote/AR approval
   before it is offered or requested; quote approval is separate from AR approval.

## AR handoffs

When preparing an authorized AR, read both the job's and each item's
`note_for_customer`. Pass supplier-relevant job context into
`availability_requests.note_for_supplier` and line details into
`availability_request_items.note_for_supplier`. Pass only requirements needed
for sourcing, such as meaningful color, alternatives, handling or special
requests within the approved ask; do not forward project headings/customer
names that add no sourcing value. Structured AR rows already show plant, size,
requested quantity and seed price: do not repeat them in supplier notes or add
`Please price Gilt Edge 15 G` just because the seed price is NULL. Keep internal
sourcing context and irrelevant/private customer information out. Shared ARs
must preserve which job/allocation a requirement applies to; never apply one
customer's conditions to every linked job. Follow
[supplier-coordination: line notes](../../supplier-coordination/artifacts/line-notes.md).

For a safely matched, explicitly submitted AR response, identify the actual
supplier-provided facts within its shared header and line `note_for_supplier` to populate the corresponding job/item `note_internal`
or `note_for_customer` by audience. Request-wide conditions go on the applicable
jobs; line-specific details go on the linked items. Apply only relevant scope,
and retain shared totals as shared totals. Unsubmitted edits stay on the
supplier thread. Follow [supplier responses](supplier-responses.md); recording
a customer-facing detail does not select a supplier, accept a substitution or
authorize customer delivery.

Examples (wording only): customer `Red flowers only; single trunk` can be
carried into the relevant AR line's `note_for_supplier`. A submitted supplier note
`Can order for Oct 1.` can yield `Can order Oct 1` in `note_for_customer` for the applicable offering and `APS: can order;
ETA Oct 1` in `note_internal` if the supplier response needs internal tracking.
