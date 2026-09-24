# Job and item notes

Use the same three fields on `job_requests` and `job_request_items`. Put
job-wide information on the job and line-specific information on the item.
These definitions replace the older exception-only and sourcing-entry
eligibility rules.

| Field | Purpose |
|---|---|
| `note_from_customer` | Concise customer-supplied information only: alternatives, color, special requests and other requirements. Preserve original demand/options when the quoted offering changes; do not add the agent's interpretation, uncertainty or a retelling of structured item fields. |
| `note_for_customer` | Notes included in the quote and shared with the customer. They may come from Chris/LPS's sourcing work or an AR supplier response. Include only information meant for the customer. |
| `note_internal` | Brief current supplier/price/received-response facts, implemented line changes and material unresolved sourcing or quantity choices. Do not turn open choices into selected offerings or customer-origin statements. No approval/provenance narration or pending-response boilerplate. |

**JR-75 examples (Chris, webchat message 15, 2026-09-24 04:52:44 CDT):**
For item 629, `note_from_customer`: `Wilkinson Project;` **only**.
The original email wording `140 4-inch frogfruit (trays)` and Chris's
clarification `140 individual pots` belong compactly in `note_internal`,
not in that item's `note_from_customer`; do not duplicate structured quantity
unnecessarily. Example internal wording: `Email said “trays”; Chris clarified
individual 4-inch pots.` For a different line with APS proposing 7 G against
a requested 15 G, retain the proposal and its own verified APS list price in
`note_internal`, while the requested size and price stay structured and
`note_for_customer` is only `15G only` when supported. For an APS orderable
Tuesday response, `note_for_customer`: `Can order Tuesday` (not date-verification
narration); `note_internal` needs no duplicate if the response is otherwise
clear. An AR's `note_for_supplier` can contain a necessary customer sourcing
constraint such as `Red flowers only`; submitted supplier
`note_from_supplier` remains supplier evidence and is split by the relevant
job/item audience, never copied wholesale into a customer note. These examples
illustrate the fields, not proof of stock, price or alternative acceptance.

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
2. Keep only customer-supplied information in `note_from_customer`; Chris's
   internal decisions, supplier replies, and the agent's explanation or inferred
   ambiguity do not become customer-origin notes. Keep it brief and do not
   restate name, size or quantity already in structured fields. Preserve
   customer conditions, original options and phases; retain a project section
   on an item only when needed to distinguish lines within a multi-project job.
   For JR-75 item 629, Chris specified exactly `Wilkinson Project;` in
   `note_from_customer`; the email's `(trays)` wording and his subsequent
   individual-pot clarification instead stay briefly in `note_internal`.
   Do not treat his interpretation as a new customer-authored note or repeat
   structured `140`/`4-inch` fields in the customer-origin note.
   Put a material unresolved quantity/unit interpretation in `note_internal`,
   not in a statement attributed to the customer. Retain job-wide context once
   on the job rather than repeating it on every item.
3. Keep `note_for_customer` LIMITED to the shortest customer-useful fact,
   not a supplier-proposal narrative, pending-price/cultivar caveat or date
   qualification. Chris's JR-75 corrections (webchat message 10, 2026-09-24
   04:48:57 CDT): `7 G proposed instead of requested 15 G; price pending`
   → `15G only`; `5 G proposed instead of requested 3 G; cultivar and price
   pending` → `3G only, 5G NA`; `Can order for Tuesday; exact date to confirm.`
   → `Can order Tuesday`. For supported supplier-proposed different-size
   options, Chris further corrected the customer-note wording
   to `5G @ $25, 1G NA` and `7G @ $65, 15G NA` (webchat message 12,
   2026-09-24). Use these terse size/price and unavailable-requested-size
   facts instead of a proposed-alternative narrative or generic/cultivar-
   unconfirmed explanation, only where the relevant customer price and
   supplier availability evidence support each claim. These are scoped wording
   examples, not independent evidence or permission to invent availability,
   select a substitute, or send it. Keep unresolved identity/price and other
   unselected proposals in `note_internal`.
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
   who approved it or calling it an actual substitution. For an APS-proposed
   alternative, retain its own price-list lookup result in the affected item's
   sourcing note: exact listed plant/size and list price, a qualified proxy
   with its actual catalogue identity, or a concise no-exact-price finding.
   Do not overwrite the requested offering's structured plant/size or price
   merely because an alternative was proposed or has a list price: the job
   item represents the customer-requested size (Chris, JR-75 messages 11 and
   13, 2026-09-24). Keep alternative identity/size/pricing in internal sourcing
   notes until a separately supported offering is authorized. Include a supplier
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
   supported scoped job-line status/price updates and factual customer-safe
   proposed-alternative notes without another approval question; it is not
   approval to publish a quote, send a customer message, issue an alternative
   AR, select an order source or change accepted terms. Outside that exception,
   a real alternative still needs Chris's action-specific quote/AR approval
   before it is offered or requested; quote approval is separate from AR approval.

## AR handoffs

When preparing an authorized AR, read both the job's and each item's
`note_from_customer`. Pass supplier-relevant job context into
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
