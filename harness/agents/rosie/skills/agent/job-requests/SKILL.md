---
name: job-requests
description: Manage customer job requests from intake to closure. Covers new intake without plant-based duplicate-job searches, known-job reuse, Quote to optional Availability to Order, already committed intake, supplied-price precedence and APS fallback, direct quote-to-order creation without ARs, quick-quote stopping, concurrent writes, Chris approval for availability sends and response-driven job-line changes, APS-only manual quote/AR inputs, minimal audience-specific notes, EDD intake with Unknown, fulfillment fields, New/Processing/Order Ready orders, post-placement change notes and supplier notifications, and many-to-many allocations. Use for new or already committed requests, accepted quotes, quick quotes, sourcing, supplier/customer updates, order creation or closure; pricing-only questions create no job. (v5.17.0)
metadata:
  author: lps
  version: "5.17.0"
---

# Job requests

The `jr-<id>` thread owns its job and items. Customer and supplier threads
own correspondence and relay order updates here. Read
`knowledge/files/SCHEMA.md` before querying; read
`artifacts/database-access.md` for SQL/storage command syntax on first use.
Use `message-routing` for
handoffs and approvals; drafting on this thread never requires Chris to move
here to approve. The usual business workflow is **Quote → Availability → Order**,
but availability is optional. An already committed request enters through job
intake and proceeds directly to an order; an accepted quote can also go straight
to an order. Preserve supplied/accepted prices and use APS's price list only for
missing prices on these paths. Do not create an AR or require a fresh quote.
The Order stage is stored as Job **Committed** with a separate Order **New**;
there is no job status `order`. Supplier confirmation moves the Order to
**Processing**, then **Order Ready**; the Job remains Committed until closure.

### Choose the path before starting availability work

| Request intent | Route |
|---|---|
| Ordinary request needing pricing and availability | Create/reuse job/items → APS quote → Chris-approved availability request → order on customer acceptance. |
| Already committed order, including a confirmed PO or Chris relaying customer commitment | Create/reuse job/items → preserve supplied prices and fill only missing prices from APS → direct order, without an AR or a new quote. |
| Existing quote accepted for ordering, without an availability step | Reuse the job/items and accepted offering/prices → direct order; do not create an AR as a prerequisite. |
| Explicit quick quote only | Create/reuse job/items → quote → stop, with no AR or availability approval ask. |
| Price lookup or general question | Answer the question without creating a job, AR or order. |

Commitment must identify the accepted scope; an enquiry or supplier response is
not customer acceptance. Resolve only material uncertainty. Do not require a
second acceptance or a special “skip availability” phrase when the request is
already committed. A later acceptance supersedes an earlier `quote_only` handoff
for its accepted scope and uses the existing job. Follow the direct-order
procedure in section 6; an ordinary unaccepted quote does not authorize an order.

## 1. Intake: an order request or quick quote

**New intake creates a new job without a duplicate-plant search.** Do not search
existing job requests for matching or similar plants, sizes, quantities or item
lists, even for the same customer. Do not merge requests or ask whether to reuse
a job because its plants overlap. In this skill, “create/reuse” means create a
new job unless the request explicitly identifies an existing job, the current
job thread/context establishes it, or the work is a retry/continuation of the
same known or reserved job id. Accepted-quote conversion uses that quote's
identified job; plant similarity is not a job reference.

You may ask any clarifying question about an order request before generating
a quote (including a quick quote), creating/sending an availability request,
or creating the affected order.
**Complete all authorized actions that do not depend on an answer before
asking.** Once order/quick-quote intent is established, perform the intake
writes below: create/reuse the job and `jr-<id>` thread, create item rows from
the supplied details, and save known customer/job information. Do not stop at
a plan or hold all records until every detail is clarified. Review the current
request history and any identified job's records; use `plant-and-supplier-search` to gather
missing pricing, preserve supplied/accepted prices, save supported prices and
only the sourcing notes allowed by section 3, and record completed pricing
through the lifecycle hook. Research clearly labelled candidate
alternatives without selecting them. Verify writes before reporting them.
Missing details block only actions that depend on those details.

Post the created/updated job and rows, pricing and other findings, with any
gaps or uncertainty, in the original request conversation via `message-routing`;
external customer communication stays with `customer-coordination`. Then ask
concise questions about anything still unclear that affects the quote,
availability ask or order.
Questions may cover any relevant detail, such as plant/cultivar, size,
quantity, alternatives, budget, delivery timing/location, supplier or scope;
these are examples, not a required checklist. Use answers already provided.
Wait for needed answers before generating the affected quote or creating/
sending the affected AR or creating the affected order. On the availability
path, Chris must also approve the availability send after the quote; creating
an APS portal request is itself publication. Committed intake and direct
quote-to-order work skip this availability approval ask entirely.
Continue independent work, including supported record updates, while waiting.
Apply answers to the existing job/items with guarded writes; do not recreate
the job or duplicate rows when clarification arrives. Preliminary
pricing findings do not establish stock availability or resolve an ambiguous
requirement. If the request is clear, proceed without extra questions.

1. Distinguish a price lookup/general question from an order or quick-quote
   request. Simple pricing/general questions create no job or AR. **Before any
   quick-quote output (including a partial quote or draft), create/reuse the
   job, its `jr-<id>` thread and every supplied item row**; never treat a
   quote as exempt from intake. A quick quote creates/sends no AR. Preserve
   `quote_only: true` in the quick-quote handoff and stop after delivering the
   quote internally; do not follow it with an availability-send approval ask.
   Ask if the intent is unclear; do not infer quick-quote intent from a simple
   question about pricing.
2. For a new order or quick quote arriving outside a job thread, reserve its id
   directly without searching other jobs' plants, using
   `SELECT reserve_job_request_id();` and hand the complete ask, id and
   interaction context to `jr-<id>`. The app's New job request action also
   reserves an id and opens this thread. On main acknowledge with
   `[Continue in JR-<id> chat](thread:jr-<id>)`; the receiving job thread
   creates the records. Existing-job messages go to its existing thread.
3. Read `job_requests WHERE id = <id>` for the known or reserved id only. If
   present, work on that row; never duplicate that same job on retry. This is
   an exact-id check, not a search for jobs with matching plants.
   Find an existing customer by email, phone,
   then known name/company. Do not infer a person's name from an address.
   A new, identified customer gets its own `rosie_thread_id` through
   `message-routing`. If unidentified, `customer_id` stays NULL and any
   identity clues go in `customer_notes`.
4. Insert the reserved id with `OVERRIDING SYSTEM VALUE`. Explicitly set
   `status = 'quoted'` (displayed **Quote**). Store a job/site name only when
   supplied: a real residence, address, PO or project. Leave `name` NULL
   otherwise; the app constructs the company/job display title. Even committed
   intake creates this job record first; successful order creation advances it
   to `committed` atomically. Do not generate a quote just because the initial
   database status is `quoted`, or mark a job Committed without its order.

   ```sql
   SET app.actor TO 'rosie';
   INSERT INTO job_requests
     (id, customer_id, name, status, customer_notes,
      expected_install_date, fulfillment_method)
   OVERRIDING SYSTEM VALUE
   VALUES ($jobId, $customerId, $name, 'quoted', $customerNotes,
           $expectedInstallDate, $fulfillmentMethod);
   ```

   **Capture EDD during every job ingestion/creation, including quick quotes.**
   Read the supplied message, attachments and ingestion context for the
   expected install date (displayed as EDD). Save a supported, unambiguous
   date in `expected_install_date`; use a date already supplied without asking
   again. Resolve relative dates only when the source date and intended day
   are clear. Do not substitute the ingestion/creation date, quote deadline
   or supplier fulfillment date, or invent a day from a vague date range.

   If EDD is missing or ambiguous, create/reuse the job and its known rows
   first, leave `expected_install_date` NULL, then ask in the original request
   conversation: "What is the expected install date (EDD)? Enter a date, or
   choose Unknown." Every EDD question, including a webchat questionnaire,
   must offer **Unknown** explicitly and allow the user to enter a date.
   Unknown means SQL NULL, not the string "Unknown" or a placeholder date.
   If the user/source already says the date is unknown, accept that without
   asking again. Missing/unknown EDD does not block intake, sourcing, quoting
   or direct orders; continue work that does not depend on the date. Save a later answer
   on the existing job using the guarded-write discipline in section 2.
   Re-ingestion with no date must not erase an existing known EDD; clarify
   conflicting dates before replacing it.

   Save pickup/delivery choice in `fulfillment_method` (`pickup` or `delivery`)
   and keep an unknown choice NULL. EDD is the customer's planning date,
   separate from the supplier order's actual confirmation and fulfillment dates.

5. Create item rows before asking questions: one per clearly separate
   requested line, preserving the supplied plant name, size and quantity.
   Missing size, quantity or price stays NULL and does not prevent creating
   a row with a supplied plant name. If the plant name itself is missing,
   record the unresolved request in job notes and create the other rows;
   do not invent a name to satisfy the required column.
   Preserve unresolved alternatives in the original line without choosing,
   splitting or combining requirements. For example, record
   `20 live oaks, 15 G or 30 G` as one row with name `live oaks`, size
   `15 G or 30 G` and quantity `20`, then research both sizes. For size-only
   alternatives, apply Chris's standing rule below without redundant clarification;
   do not assume a mix or duplicate the total.
   Follow an explicit allocation already supplied. For plant alternatives,
   unclear separate demands or an unresolved mix, clarify separate
   requirements versus alternatives and per-option versus total quantities
   after completing independent work, before splitting/combining items,
   selecting a plant/size, or generating the affected quote/availability ask.
   Never duplicate a total across options or assume every named plant is
   required. Report prices for unresolved alternatives in chat; add them to
   sourcing notes only when section 3 applies. Leave `unit_price` NULL until
   a price applies to the requested line.
   Normalize gallon tokens to `G` (`30 gal or larger` → `30 G or larger`).
   A duplicate-key error on the job means re-read, then add only genuinely
   missing items. Continue independent sourcing with the recorded lines;
   report completed intake work and remaining gaps accurately.
6. Later customer mapping is guarded with `WHERE customer_id IS NULL`; a
   concurrent app mapping wins. Never write derived thread references; the
   database links each job to `jr-<id>`.

### Multiple requested options: standing quote rule

Chris's instruction (2026-09-15): for alternatives such as `3 G / 5 G`, quote/
use the price of the **cheapest supported requested option**, not the smallest
size, an assertion of physical stock or an unrequested option. Search every
requested option, skip options without a supported positive price, and use the
lowest supported price directly. Do not ask Chris to choose again unless the
instruction conflicts with an explicit allocation, plant identity or another
material requirement. No priced requested option means a price gap, not
permission to choose an unrequested option.

For an already accepted offering, preserve its selected size and price; this
quote-selection rule does not authorize changing committed order terms.

Preserve the original requested alternatives in the item demand/customer context
when recording the quoted size/variant and price. Put every other supported
requested-option price in shared/customer-visible item `external_notes`, e.g.
`5 G $25.00`. The item `name` and `size` are the customer-facing **quoted
offering**, so each must hold exactly the one actual quoted plant and size—never
an `or` list or source proxy name. An explicitly approved pricing proxy does
not relabel the requested offering or establish cultivar identity. Record its
basis internally, not as a shared substitution note. For actual approved
offering differences (plant, cultivar/variant, size or quantity), keep only the
necessary short exception in `external_notes`; follow `quote-generation` for
the canonical minimal-word rule, confirmed-evidence-only availability wording,
and neutral unpriced-option notes. No phase labels, pricing-identity explanations,
supplier names or price-sheet references belong in shared notes. Preserve
phases in customer/original-demand context and separate output grouping. Preserve the original
demand in `customer_notes`; do not silently rewrite it. Use actual prices only,
without internal supplier/cost commentary or availability claims. State the
chosen quoted option clearly and include every other supported requested-option
price; no extra demand rows or duplicated quantities. An unrequested option
remains an approval-gated alternative. This rule authorizes quote sizing/pricing
only: supplier AR scope must still respect the original requested alternatives
and total quantity unless separately resolved.

## 2. Read and write discipline

For every request/item acted on, load the current row and its last five
`job_request_changelog` entries (`ORDER BY created_at DESC, id DESC LIMIT 5`).
Every write invocation begins `SET app.actor TO 'rosie';`. Re-read immediately
before an update, change only intended columns, and check row counts.

Guard updates with the previous state so a concurrent UI edit is not lost:

```sql
UPDATE job_request_items
SET sourcing_notes = $newNotes
WHERE id = $itemId AND sourcing_notes IS NOT DISTINCT FROM $oldNotes;
```

If the update affects zero rows, reload and reconcile. Notes need real
newlines, e.g. `E'**<u>Supplier</u>**\nQty 20'`; plain `'\n'` is literal text.
Never write generated `total`, `updated_at`, thread references or changelog
rows. `available_quantity` on job items remains a human-managed field;
record reported supplier quantities in qualifying sourcing entries. Do not
copy replies into availability fields without Chris's explicit instruction.
Archiving/deactivating records requires Chris's explicit direction.

## 3. Notes and sourcing entries

**A supplier search is answered in chat first, including for an existing
job.** When Chris asks to look for suppliers, return the options and evidence
in his original request conversation. Do not add sourcing notes merely
because a supplier was considered or a catalogue price/alternative was found,
unless a material decision, exception or required action below needs recording.

**Simpler notes default (Chris approved, 2026-09-17):** Notes contain only
additional information needed by their audience, once at the narrowest useful
scope. This supersedes the every-APS-row research-note instruction and the
mandatory overall-summary-plus-supplier-entry format. Exact supported prices,
missing prices and ordinary AR/order statuses already visible elsewhere do
not require duplicate notes, including on quick quotes.

Continue researching every requested line and 1–2 closest supported APS
alternatives for genuine gaps. Report findings in the original chat; record
only a material unresolved decision/exception or required action in sourcing.
Do not fill rows with `Price unknown`, `No exact match` or `No supported APS
alternative found` when the fields/chat already make that clear. A necessary
pending alternative identifies the plant/size and action-specific Chris
approval still needed; do not replace demand or price with an unapproved
candidate. Prefer the same plant in a nearby size, then a defensible related
plant; do not invent options/prices or widen suppliers without instruction.

Use `plant-and-supplier-search` to distinguish likely naming equivalents from
real substitutions. Its approved direct-pricing conventions remain unchanged.
Keep a concise pricing-proxy/cultivar qualification when necessary to avoid
false identity or availability claims; routine catalogue spelling mappings
need not be repeated if accessible source evidence suffices. Pricing permission
never establishes exact AR identity or availability. Ask Chris in the original
request chat to approve **quoting and/or requesting availability for the specific
alternative** before that action, including drafts or supplier-visible hints.
Quote approval is not AR approval, nor vice versa.

A sourcing entry is eligible when at least one applies, but eligibility does
not require a redundant note:

- An availability request was actually delivered to that supplier's portal
  or sent by email. A created record, unsent draft or public link alone is
  not evidence of delivery.
- A concrete supplier action is required for the current order, such as an
  authorized availability send, supplier follow-up or coordination of an
  agreed substitution. State the actual pending action; do not invent a
  follow-up or treat an optional candidate as actionable to justify a note.
- Chris explicitly asks to add or record the sourcing note.
- Chris makes a supplier selection or another sourcing decision about the
  plant, or an explicit approved decision is already recorded. Capture any
  additional decision once at its item/job scope, even without an AR; do not
  repeat a selection already clearly accessible in linked structured records.

This applies to job-level and item-level `sourcing_notes`. Research-only
supplier lists/prices stay in chat; a lookup authorizes no contact or AR.
Continue supported structured pricing/intake updates under their own rules.
Preserve material supplier comparisons, final current decisions, necessary
source/override provenance and unresolved constraints without event history.

| Field | Content |
|---|---|
| `customer_notes` | Only customer-origin additional information/requests that structured fields do not hold: constraints, preferences, deadlines, phase membership and original demand/options displaced by the quoted offering. Preserve customer evidence; never add Chris's pricing, offering or sourcing decisions, approval wording or exploration. Do not duplicate unchanged structured fields. |
| Item `sourcing_notes` | Brief current internal decisions, exceptions or constraints not clear elsewhere; NULL when nothing additional is needed. Preserve necessary source/proxy evidence and meaningful supplier comparisons. |
| Job `sourcing_notes` | Job-wide decisions, constraints and admin-override provenance once, visibly accessible with the job; do not repeat them on each row. |
| `external_notes` | Only additional customer-useful exceptions/options, in short fragments; NULL when redundant. No phase names, pricing identity/basis or supplier/price-sheet references. Follow `quote-generation`. |

**Note ownership (Chris, 2026-09-17):** Record Chris's final/current pricing,
offering and sourcing decisions only in `sourcing_notes`, never in
`customer_notes`. Do not retain intermediate choices, superseded approvals,
exploration or a decision trace in either field; history remains in the
changelog/transcript. Preserve genuine customer requests and alternative
allowances separately from Chris's choices. When cleaning mixed notes, remove
only the internal decision text from `customer_notes`, retain customer-origin
phase/original-demand details, and ensure the final decision is captured once
in the current sourcing snapshot. Keep necessary current source evidence,
approval scope and unresolved constraints; a still-pending decision is not a
final approval. Do not change offering, prices, availability or shared notes
merely to clean note ownership.

### Minimal current notes: update and cleanup

1. Read the current row, recent changelog, source evidence and Chris's latest
   decisions under section 2. Preserve final/current decisions, active constraints,
   customer agreement and uncertainty; never invent a new business fact to
   shorten a note. History stays in the existing changelog/contact transcript.
2. Keep customer-origin requests, phase membership and displaced original
   demand in `customer_notes`; keep short customer-useful exceptions/options
   in `external_notes`. Put internal decisions/exceptions in `sourcing_notes`.
   Do not move internal decision traces into customer notes or remove a genuine
   customer condition just because it resembles an internal decision.
3. Record job-wide context once in accessible job-level sourcing notes. This
   includes the scope and authority of a Chris/admin availability override,
   explicitly **not supplier-confirmed**, and necessary delivery unknowns.
   Keep relevant publication-approval/source provenance there without copying
   ordinary Order/AR statuses or repeating it across rows. If job-wide context
   cannot be shown accessibly, retain the minimum row qualifier rather than
   losing meaning; do not silently delete essential provenance.
4. On each item keep only additional material information: an approved proxy
   and unresolved identity, actual outstanding alternative approval, meaningful
   supplier comparison, or a selected-source decision not otherwise clear.
   Exact-match rows may be NULL when selected supplier and necessary source/
   override evidence are clearly accessible through job/linked structured data.
   Otherwise retain a minimal `APS selected` (only if genuinely selected) or
   the necessary evidence qualifier. Do not use a blank note to erase a source
   selection, cultivar uncertainty or active constraint.
5. Use short plain-text fragments; supplier labels are useful only to distinguish
   material offers from different suppliers. No mandatory summary, supplier
   heading, price, AR link/status or boilerplate on every row. Omit information
   already clear in structured fields; a materially different supplier price
   may remain for a real comparison, labelled distinctly from the customer price.
   Keep suppliers' evidence separate and preserve allocation scopes; do not
   copy a shared available total onto each job. Replace superseded current facts,
   never append a diary or turn catalogue evidence into supplier confirmation.
6. Guard note-only writes and verify exact field changes. Cleanup does not
   authorize changes to prices, quantities, offerings, statuses, AR answers,
   orders or history. Preserve meaningful shared notes and customer evidence;
   report what changed and what stayed operationally unchanged.

Examples are formatting only, not business evidence:

```text
Chris-approved Purple Pixie pricing basis; cultivar unconfirmed.
```

```text
APS selected; grower alternative excluded by Chris.
```

```text
APS 30 G alternative — Chris quote approval pending.
```

A selection exists only after Chris actually selects the supplier; availability,
price or being the only respondent does not select it. Note cleanup changes no
approval gates for substitutions, quotes, AR publication or external sends.

- Preserve phase separation in customer/original-demand context and output
  grouping, not item shared notes. An approved Purple Pixie price for unspecified
  dwarf loropetalum retains the requested identity and needs no shared note;
  identity and availability remain unconfirmed. Keep the pricing basis internal.
- Keep approved offering differences clear in customer-visible data. When
  `external_notes` is needed, use only the necessary distinction, e.g.
  `Muskogee 30 G instead` or `12 instead of 10`. Omit `Quoted for ...` and
  redundant selection statements already evident in the row. A required
  variety question can be `Does this variety work?` when the row identifies
  it. Preserve meaningful differences/caveats; follow `quote-generation`.
  A different catalogue name for the same plant is not a substitution.
- Customer output uses requested/approved offered plants, sizes, selling
  prices and `external_notes`. Supplier names, internal prices, stock-list
  details and agent messages stay internal unless Chris explicitly asks to
  show those specific details.

## 4. Sourcing and pricing

Choose the request's path first. For an already committed request or an accepted
quote moving directly to an order, prepare prices under the next paragraph and
continue to section 6 without quote generation or availability work. A quick-quote
instruction uses `quote-generation` and skips AR creation and supplier contact.
A request only to look for a supplier uses `plant-and-supplier-search` and
returns findings to Chris first, even on an existing job; it does not start
the normal job's availability-request workflow or create sourcing entries.
Actual APS job sourcing and quick quotes use the same minimal-note standard in section 3.

**Committed-order pricing precedence:** use the applicable line prices supplied
with the committed request, or the accepted prices already on its job/quote.
Save them in `job_request_items.unit_price` before creating the order. Preserve
their source and acceptance evidence in the originating message/attachment;
record only material exceptions in notes. For a partly priced request, retain
every supplied price and search APS only for missing prices. With no supplied
pricing, use the supported APS price list for each line. A catalogue difference
does not authorize replacing an agreed price or offering, or choosing a cheaper
size after acceptance. Resolve conflicting prices or unclear unit-versus-total
amounts without guessing; a budget or supplier cost is not an agreed selling
price. Missing APS matches stay NULL and are surfaced for resolution, never
zero or invented. Complete unblocked intake/pricing work while resolving gaps;
do not create an AR merely to fill a price gap. This workflow expects supported
prices on ordered lines; the RPC's nullable price field is not permission to
silently order an unpriced line. Resolve the affected scope before ordering it.

For ordinary quote/availability work:

### Chris-directed APS manual inputs

While APS is the exclusive supplier, an explicit Chris-directed manual **price**,
**size**, or supplier-useful **note** change is an APS quote and availability-request
input for the stated scope. Save the corresponding job offering/current internal
decision under the normal guarded-write and note rules, then carry that exact scoped
input into an active APS AR when Chris directs it. Re-read the AR, its items and
allocations first; correct only unanswered LPS-side ask fields, preserve quantities
and requested identity unless Chris explicitly changes them, and do not add a new
request or send a new communication solely for the correction. A manual price may
seed an APS AR even where no exact inventory mapping exists; keep `mapped_inventory_id`
NULL for a generic/proxy/unverified identity. It is neither a supplier answer nor
proof of stock, cultivar, substitute selection, availability, or order confirmation.
Use `supplier-coordination` for the safe AR write/state check; do not write answer
fields or change job availability/status from the manual input.

1. Read explicit supplier instructions and supplier preferences. **LPS
   currently works exclusively with Austin Plant Supply (`supplier_id = 1`).**
   Use APS's price list for quotes and APS for approved availability requests.
   Chris may explicitly authorize an exception, including combined grower
   sourcing; research or a missing APS match does not imply that authorization.
2. Search APS inventory for every plant using `plant-and-supplier-search`,
   or the instructed supplier's inventory. Check actual plant identity,
   cultivar, size and positive price; retain the inventory UUID and source
   evidence. Copy the applicable price into `unit_price` only where no supplied
   or accepted price applies; write only additional material
   sourcing decisions/exceptions under section 3; report research gaps and
   supported alternatives in chat. No price means NULL, never zero. Catalogue stock stays
   catalogue evidence: new item status remains `pending`; pricing alone does
   not change existing availability/status fields.
3. A likely equivalent catalogue name follows the direct-pricing and necessary
   source-qualification rule in `plant-and-supplier-search`; no needless alternative
   label or approval for the name difference alone. A genuinely different
   plant/size or unsupported equivalence is a candidate alternative, never a silent change
   to the customer's ask. Report it in chat and record APS gap alternatives
   under section 3. Always obtain Chris's explicit confirmation in the original
   request chat before quoting an alternative or creating/sending an AR for
   it; confirmation must cover the intended action. Other suppliers' candidate prices stay in chat
   unless section 3 permits a sourcing entry. An explicitly
   requested supplier may price the item directly.
4. **When APS has no matching inventory, report the gap in chat and offer to look
   for other suppliers.** Wait for Chris's instruction before widening.
   On an instructed wider search, verify the exact plant/size, price, source date
   and location; catalogue stock remains unconfirmed. Newly discovered
   suppliers go to Daisy for onboarding before order-side coordination.
5. After an actual pricing lookup, including no-match results, record
   `pricing_fetched`, then generate the APS price-list quote using
   `quote-generation`. Keep the job at Quote; later stages remain unchanged.
   Resolve quote-blocking gaps without claiming unsupported prices or stock.
   **If Chris asked only for a quick quote, stop here.**
6. Re-read the latest intent and acceptance before starting availability work.
   If the quote is now accepted for direct ordering, continue to section 6
   without an AR or availability-send question. Otherwise, for a request
   following the availability path, ask Chris in the original request chat
   whether to send the availability request to APS. Wait for his approval;
   quote generation, an ordinary job request and supplier research do not
   authorize publication. Preserve an explicit approval already given for
   this exact send, while still producing the quote first. After approval and
   scope clarification, route the ask to APS's supplier thread, including
   unlisted items unless Chris limits the scope. Preserve customer-details
   preferences. Include every job/item id and allocated quantity, quote
   completion and send-approval evidence, exact inventory UUID mappings/prices,
   and separate alternative approvals. A request may combine several jobs;
   use the allocation relationships below and retain each origin conversation.
   The supplier thread follows `supplier-coordination` and reuses the same
   request on retry.
7. Relay later supplier/customer changes through their owning threads. Keep
   qualifying sourcing entries current on actual AR delivery, edits, submission,
   closure and required follow-ups. A pending send must be labelled as pending.
   Report the priced lines, open requests and unresolved decisions on this
   job's chat; send any required approval to the original request thread.

The existing Chris-approved cultivar/color pricing convention remains:
crape myrtles, plumbago and salvias may use APS's generic line at the same
size when the requested variety/color is unlisted. Explain `Generic price`
in chat and on any qualifying supplier entry; it does not confirm that variety
or authorize a size substitution.

## 5. Surface supplier responses; Chris controls availability

Supplier responses are evidence for Chris, **not instructions to change
availability**. Accept a supplier-thread relay only for an explicit AR
submission; a local/saved, unsubmitted supplier edit never reaches this thread,
Chris or sourcing notes. Surface each safely matched submitted response to
Chris in the original request conversation: supplier, requested plant/size,
reported quantity/price, AR reference/state, source and any uncertainty.
Update only material current sourcing exceptions/decisions under section 3;
replace superseded facts, preserve Chris's selection and keep correspondence
in chat. Do not duplicate structured response/status fields. Present the specific proposed job-line
status/quantity changes to Chris and ask for approval in the original request
conversation. If he approves, apply only that scope after a fresh read and
report the saved result. For combined AR rows, show each job's allocation
alongside the shared supplier total before asking; never assign the whole
available total to every job. A supplier AR answer marked `available` carries
that AR row's authoritative allocated demand total; it still does not set any
job-item available quantity without Chris's exact approval.

Do not automatically change job/item availability or status, available
quantity, selected source or customer-facing offering from a supplier's reply
or portal submission. Do not infer job availability from AR answer fields.
This applies with one supplier too, and especially when several are being
considered: keep their responses separate for Chris to compare. Neither the
first available response nor the cheapest quote selects the supplier. An
unavailable response does not mark the whole plant unavailable.

Only Chris's explicit instruction authorizes Rosie to change availability;
apply it to the specified item/field after a fresh read. **Whenever that
instruction changes a job item to displayed Can Order, write the schema-valid
`status = 'need_to_order'` and set `available_quantity` in the same guarded
update to the approved demand scope: the item's `quantity` for the whole line,
or its explicitly approved allocated quantity for a limited allocation. Never
use a combined supplier total for every linked job item.** Selecting a supplier
alone is a sourcing decision to record, not an instruction to mark the item
available. Supplier-entered portal answers remain as saved by the supplier;
Rosie reads and reports them without overwriting them. For supplier messages
outside the portal, follow `supplier-coordination` before any AR answer write.

A supplier chat giving only a quantity does not confirm a seeded price.
Preserve requested quantities and customer prices; do not infer customer
acceptance from supplier availability.

## 6. Job lifecycle and orders

| Display | Stored status | Trigger |
|---|---|---|
| Quote | `quoted` | Initial job record and quoting; committed intake passes through this initial state without generating a quote. Quote-only work stops here. |
| Availability | `availability` | Optional stage: Chris approves and the availability request is delivered. |
| Committed (Order stage) | `committed` | Customer commitment is established and supplier orders exist for the accepted lines, with or without a prior AR. |
| Won | `closed_won` | Request explicitly closed as won. |
| Lost | `closed_lost` | Request explicitly closed as lost. |

`archived` is legacy, not a new workflow stage. Active/`sourcing` and job
`confirmed` are retired. Customer acceptance is **Committed**. Supplier
confirmation changes the **Order** from **New** to **Processing** while the
**Job Request remains Committed**. Neither event closes the job. Do not infer a lost sale
from silence. Never assign `confirmed` to a job or use the compatibility
`supplier_confirmed` job event to advance its stage; confirm the order below.
Historical customer-confirmed jobs migrate to Committed without invented order
records; inspect their evidence before preparing any outstanding supplier order.

```sql
SET app.actor TO 'rosie';
SELECT public.record_job_workflow_event($jobId, 'pricing_fetched');
```

Record pricing/quote events only after the work occurs: a draft is not a
shared quote, and a failed send is not sent. `availability_sent` advances
Quote → Availability. Repeated pricing/quote events never move later stages
backward or reopen a terminal job. Create accepted supplier orders through
`create_direct_order(...)` or `create_order(...)` below; do not represent
customer acceptance by changing a job status without creating its order records.
Explicit lookup completion is still recorded when no price is saved.

Close with a fresh read and the explicit won/lost outcome. Use
`close_order(orderId, 'closed_won' | 'closed_lost')` for an order. A job may
be closed directly when the quote/request is lost before an order exists.
Closing the last order closes a job automatically only when all active demand
is known and fully allocated to terminal orders. Partial or unknown demand
stays open for Chris's explicit closure decision. A closed order's Won/Lost
outcome cannot be reclassified through `close_order`.
Do not close a shared AR or another customer's order because only one linked
job ended; database hooks preserve work for its other open jobs. Closed ARs
cannot be edited; do not reuse revoked public links after reopening.
Quote, Availability and Committed are the open job stages, separate
from an AR's New/Processing/Completed/Closed state.

### Direct orders: committed intake and quote-to-order

Use this path for already committed requests and accepted quotes that skip
availability. Migration 0100 provides `public.create_direct_order`; the earlier
internal/admin support-AR workaround and its hidden-AR blocker are obsolete.
No AR, supplier answer or availability override is required.

1. Create/reuse the job, its `jr-<id>` thread and every supplied item before
   ordering. Read current rows, recent changes and **all** existing order
   allocations for those identified job-item ids, including AR-backed orders.
   Do not search other jobs by plant to decide whether to reuse a job.
   Preserve exact commitment evidence,
   accepted offerings and positive quantities. Use APS (`supplier_id = 1`)
   unless Chris explicitly selected another supplier. Resolve only material
   ambiguity; do not re-ask for acceptance already established in the request.
2. Apply section 4's pricing precedence and save the resolved offering and
   `unit_price` on each accepted job item. The RPC snapshots those fields;
   it does not look up APS prices. Preserve original demand and phases. Do not
   use a cheaper option to replace an accepted size or price. A separate quote
   document, quote delivery, AR or availability-send approval is not required.
3. Create the order atomically with real ids and accepted quantities:

   ```sql
   SET app.actor TO 'rosie';
   SELECT public.create_direct_order(
     $supplierId,
     '[{"job_request_item_id":7,"quantity":10}]'::jsonb,
     $fulfillmentMethod, $fulfillmentDate, $notes, true
   );
   ```

   The final argument represents actual customer commitment, including an
   already committed request relayed by Chris. For multiple jobs, every
   included allocation needs its own customer's acceptance. Set method/date
   only when supported; unknown values stay NULL and do not block creation.
   Never copy customer EDD into the supplier's fulfillment date by assumption.
4. The transaction creates an Order **New** and its allocations and moves
   represented Quote/Availability jobs to **Committed**. Its order rows have
   `availability_request_item_id = NULL` and snapshot job-item name, size, price,
   shared note and current item status. Do not mark job items available, set
   `available_quantity`, fabricate supplier answers/submissions or confirmation
   dates, or create even a hidden/support AR to enable the order. An explicit
   separate availability instruction follows section 5 with its own provenance.
5. Verify the saved order, exact lines/prices/quantities, allocations and job
   stage. After an uncertain result, inspect existing orders before retrying:
   the RPC's remaining-demand cap does not make repeated partial orders
   idempotent. Reuse an order already covering the accepted scope. Both direct
   and AR-backed orders consume the same remaining customer demand.
6. Report the actual order and relay its id/allocations to the supplier thread
   with `skip_availability: true`, acceptance and pricing evidence, and origin
   context. The order appears in the supplier portal's Orders tab; the committed
   request authorizes this scoped creation. Do not ask to publish an AR or send
   a separate email/customer message without its applicable authorization.

If the deployed database lacks `create_direct_order`, report that specific
capability gap with the prepared job/items; do not revive the support-AR
workaround, fabricate availability or claim an order exists.

### Order creation and many-to-many allocations

Availability requests and orders are separate records. A job can have many
ARs and orders, and an AR or order can serve several jobs. A consolidated
grower request may combine compatible quantities from different job items;
one job item may be split across AR items or orders. Never assume the legacy
scalar `job_request_id` or `job_request_item_id` is the complete relationship.

- `availability_request_jobs` connects AR headers to all jobs;
  `availability_request_item_jobs` connects AR rows to job items and preserves
  each allocated `quantity`.
- `orders` and `order_items` hold supplier-facing commitments;
  `order_item_job_request_items` allocates each order row back to job items.
  AR-backed order rows retain their `availability_request_item_id` as source
  evidence; direct order rows have NULL and link to the job items instead.
- Read every allocation before relaying answers, changing quantities or
  creating orders. A combined supplier quantity is a shared total, never the
  amount available to every linked job. Preserve job-specific demand, prices,
  dates and customer privacy; combine only the exact approved scope.

When the availability path has suitable answered AR rows and explicit customer
acceptance, create the supplier order atomically with the accepted allocations
and any known fulfillment details:

```sql
SET app.actor TO 'rosie';
SELECT public.create_order(
  $supplierId,
  '[{"availability_request_item_id":42,"allocations":[{"job_request_item_id":7,"quantity":10}]}]'::jsonb,
  $fulfillmentMethod, $fulfillmentDate, $notes, true
);
```

The final argument records actual customer acceptance, never a guess. Every
allocation needs that customer's acceptance; one customer's go-ahead cannot
commit another job. Use the real ids and accepted quantities, inspect existing
allocations before retrying and never over-order or duplicate demand. Order
creation makes an Order **New** and its jobs **Committed**, maps AR `can_order`
to order `need_to_order`
(**Need to Order**), and exposes the order in the supplier portal's Orders tab
and every linked job's Orders tab. If acceptance arrives before suitable AR
rows exist, use the direct-order path above. Existing ARs do not force a new
availability round; never fabricate responses or duplicate demand already ordered.
Preserve existing ARs and their answers; a direct order alone is not permission
to delete, hide or close a request still serving other work.

Store a known `orders.fulfillment_method` as `pickup`/`delivery` and
`orders.fulfillment_date` as the agreed pickup/delivery date, separate from
`job_requests.expected_install_date`. Do not guess a shared order's plan from
one linked job when their requirements differ; unknown method/date stays NULL.
Explicit supplier order
confirmation uses `confirm_order(orderId, supplierId, confirmationDate,
fulfillmentDate)`, moves the Order **New → Processing** and records `confirmation_date`.
The next order stage is **Order Ready** (`order_ready`), via `update_partner_order`.
The **Job Request remains Committed**; it has no Confirmed stage. An
availability submission does not confirm an order. Resolve ambiguous supplier
confirmation before applying it; relay the actual order status/date to every
affected job thread.

### Changes after order placement

Whenever an existing placed order is updated, including its lines, quantities,
prices, allocations, fulfillment details, instructions or status, record a
brief change summary in `orders.notes` and notify the supplier through
`supplier-coordination`. This applies to direct and AR-backed orders and to
changes learned from Chris, customer/supplier relays or saved order events.
Order creation is placement; an order need not be confirmed first.

1. Re-read the order, affected lines, allocations and recent changes. Establish
   the actual before/after values and authorization for the underlying edit;
   this notification rule does not authorize additional order changes.
2. Apply only the authorized edit with guarded writes/RPCs and verify the saved
   result. For an update already saved by someone else, verify it without
   replaying it. No-op edits and retries are not new changes.
3. Add one concise, dated summary to `orders.notes`, preserving existing
   instructions and unrelated notes. Example: `09-22: Wax myrtle 15 G quantity
   10 → 12; pickup moved 09-24 → 09-25.` Use verified values only. This is an
   explicit exception to avoiding history in notes; keep the summary brief
   and supplier-safe. Do not put it only in job sourcing notes or overwrite
   `orders.supplier_notes`, which belongs to the supplier. Re-read/guard the
   note write against concurrent edits and do not append it again on retry.
4. Relay the order id, supplier id, exact verified change summary, affected
   allocations and originating context to the supplier thread. This standing
   instruction authorizes the factual change notification without a fresh
   draft approval. A portal record update or internal handoff alone is not
   supplier notification. Follow `supplier-coordination` for the actual send.
5. Track completion until both the saved order note and successful supplier
   message are verified. Report a failed/blocked note or send accurately and
   retain the pending follow-up; do not describe the notification as sent.
   Relay the saved changes to every affected job thread, preserving customer
   privacy. Do not notify again merely because this summary was added or
   notification bookkeeping changed.

## 7. Quotes and customer updates

Use `quote-generation` for the output, including quick quotes. Send the
customer-safe draft to `customer-coordination`; obtain any required approval
through `message-routing` in the original request thread. The customer thread
sends exactly the approved content and relays the result here. Only actual
customer delivery records `quote_shared`; save the shared quote link in
`external_notes` without exposing internal notes. A customer confirmation
relayed by the customer thread supplies evidence for **New** order creation
and a **Committed** job, including the direct path without an AR. No quote
output or new customer send is required for already committed intake. Use the
order procedures above; resolve ambiguous or partial acceptance rather than guessing.
