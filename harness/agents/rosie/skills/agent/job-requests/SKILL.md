---
name: job-requests
description: Manage customer job requests from quote to closure. Covers intake and concurrent writes, APS price-list quotes, quick-quote stopping, Chris approval before availability sends and response-driven job-line changes, minimal audience-specific notes and source/override safeguards, source-based EDD intake with an Unknown option and fulfillment fields, committed jobs and orders, supplier confirmation on Orders only, submitted supplier-response handling, Can Order quantity updates, Chris-authorized no-AR order overrides and many-to-many job/availability/order allocations. Use for new job requests, quick quotes, sourcing, supplier/customer updates, order creation or closure; pricing-only questions create no job. (v5.13.0)
metadata:
  author: lps
  version: "5.13.0"
---

# Job requests

The `jr-<id>` thread owns its job and items. Customer and supplier threads
own correspondence and relay order updates here. Read
`knowledge/files/SCHEMA.md` before querying; read
`artifacts/database-access.md` for SQL/storage command syntax on first use.
Use `message-routing` for
handoffs and approvals; drafting on this thread never requires Chris to move
here to approve. A job starts at **Quote**. Generate its APS price-list quote
before any availability request. An explicit quick-quote-only request stops
after the quote; otherwise ask Chris whether to send APS an availability
request and wait for his approval. Customer acceptance creates supplier
orders at **Committed**. Supplier confirmation advances the **Order** to
**Confirmed**; the **Job Request remains Committed** until Won/Lost closure.

## 1. Intake: an order request or quick quote

You may ask any clarifying question about an order request before generating
a quote (including a quick quote) or creating/sending an availability request.
**Complete all authorized actions that do not depend on an answer before
asking.** Once order/quick-quote intent is established, perform the intake
writes below: create/reuse the job and `jr-<id>` thread, create item rows from
the supplied details, and save known customer/job information. Do not stop at
a plan or hold all records until every detail is clarified. Review existing
records and conversation history, use `plant-and-supplier-search` to gather
pricing, save supported prices and only the sourcing notes allowed by section
3, and record completed pricing through the lifecycle hook. Research clearly labelled candidate
alternatives without selecting them. Verify writes before reporting them.
Missing details block only actions that depend on those details.

Post the created/updated job and rows, pricing and other findings, with any
gaps or uncertainty, in the original request conversation via `message-routing`;
external customer communication stays with `customer-coordination`. Then ask
concise questions about anything still unclear that affects the quote or
availability ask.
Questions may cover any relevant detail, such as plant/cultivar, size,
quantity, alternatives, budget, delivery timing/location, supplier or scope;
these are examples, not a required checklist. Use answers already provided.
Wait for needed answers before generating the affected quote or creating/
sending the affected AR. Chris must also approve the availability send after
the quote; creating an APS portal request is itself publication.
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
2. For a new order or quick quote arriving outside a job thread, reserve its id with
   `SELECT reserve_job_request_id();` and hand the complete ask, id and
   interaction context to `jr-<id>`. The app's New job request action also
   reserves an id and opens this thread. On main acknowledge with
   `[Continue in JR-<id> chat](thread:jr-<id>)`; the receiving job thread
   creates the records. Existing-job messages go to its existing thread.
3. Read `job_requests WHERE id = <id>` first. If present, work on that row;
   never duplicate a job on retry. Find an existing customer by email, phone,
   then known name/company. Do not infer a person's name from an address.
   A new, identified customer gets its own `rosie_thread_id` through
   `message-routing`. If unidentified, `customer_id` stays NULL and any
   identity clues go in `customer_notes`.
4. Insert the reserved id with `OVERRIDING SYSTEM VALUE`. Explicitly set
   `status = 'quoted'` (displayed **Quote**). Store a job/site name only when
   supplied: a real residence, address, PO or project. Leave `name` NULL
   otherwise; the app constructs the company/job display title.

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
   asking again. Missing/unknown EDD does not block intake, sourcing or a
   quote; continue work that does not depend on the date. Save a later answer
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

For a normal job, run the following on this thread. A quick-quote instruction
uses `quote-generation` and skips AR creation and supplier contact.
A request only to look for a supplier uses `plant-and-supplier-search` and
returns findings to Chris first, even on an existing job; it does not start
the normal job's availability-request workflow or create sourcing entries.
Actual APS job sourcing and quick quotes use the same minimal-note standard in section 3.

1. Read explicit supplier instructions and supplier preferences. **LPS
   currently works exclusively with Austin Plant Supply (`supplier_id = 1`).**
   Use APS's price list for quotes and APS for approved availability requests.
   Chris may explicitly authorize an exception, including combined grower
   sourcing; research or a missing APS match does not imply that authorization.
2. Search APS inventory for every plant using `plant-and-supplier-search`,
   or the instructed supplier's inventory. Check actual plant identity,
   cultivar, size and positive price; retain the inventory UUID and source
   evidence. Copy the applicable price into `unit_price`; write only additional material
   sourcing decisions/exceptions under section 3; report research gaps and
   supported alternatives in chat. No price means NULL, never zero. Catalogue stock stays
   catalogue evidence: item status remains `pending`.
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
6. Otherwise, after producing the quote, ask Chris in the original request
   chat whether to send the availability request to APS. Wait for his approval;
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
| Quote | `quoted` | Initial request and APS price-list quote; quote-only requests stop here. |
| Availability | `availability` | Chris approves and the availability request is delivered. |
| Committed | `committed` | Customer accepts and supplier orders are created for the accepted lines. |
| Won | `closed_won` | Request explicitly closed as won. |
| Lost | `closed_lost` | Request explicitly closed as lost. |

`archived` is legacy, not a new workflow stage. Active/`sourcing` and job
`confirmed` are retired. Customer acceptance is **Committed**. Supplier
confirmation changes the **Order** to **Confirmed** while the **Job Request
remains Committed**. Neither event closes the job. Do not infer a lost sale
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
`create_order(...)` below; do not represent customer acceptance by changing
a job status without creating its order records.
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

### Chris-authorized order without an AR

Standing authorization from Chris (2026-09-17, JR-61): when he explicitly asks
Rosie to create an order without an availability request, treat that as authority
to mark the accepted, specified job demand available and, only if required and
safely supported, create an internal/admin AR with available answers to support
the order. This is Chris's override, not supplier-reported availability or
supplier confirmation. It is not triggered by a price lookup, ordinary quote,
customer acceptance alone or an instruction from a supplier.

1. Read current job/items, last five changes and existing AR/order allocations.
   Resolve material offering/quantity ambiguity; preserve accepted offerings,
   original demand, phases and approved pricing-proxy identity distinctions.
   For the authorized scope only, guard updates to `status = 'available'` and
   `available_quantity` equal to its full demand or explicitly accepted partial
   quantity. Record `Available by Chris instruction; not supplier-confirmed`
   once at the accessible job level for a job-wide override (row level for a
   limited scope); do not repeat it on every item. Preserve customer acceptance evidence and
   selected supplier; never claim supplier evidence or invent prices/dates.
2. Inspect the current supported order and AR contracts. Reuse existing suitable
   records idempotently; do not duplicate allocated demand. An authorized admin
   answer is distinct from a supplier submission: no invented sender,
   `submitted_at`, confirmation date or supplier acknowledgement. Do not submit
   merely to satisfy an assumed gate; the current `create_order` requires an
   answered source, not explicit submission.
3. A required support AR is **internal-only** unless Chris explicitly changes
   that constraint in the original request chat. This standing rule authorizes
   neither APS portal publication nor an email/customer send. NULL public token
   and `share_customer_details = false` do not hide an APS partner request.
   Do not create-then-hide, temporarily publish, bypass triggers or direct-insert
   order records to defeat the supported API's gates.
4. Current verified limitation (2026-09-17): `create_availability_request` has
   no hidden-from-creation argument and creates a portal-visible New AR; hidden
   ARs reject item creation/edits and `answer_availability_request`. Admin
   answers without submission work only on nonhidden, portal-visible ARs.
   Therefore no supported internal-only construction meets this standing rule
   today. Complete the authorized job updates, preserve acceptance, and report
   the blocker through the original chat. Ask Nova for a reviewed workflow/DB
   capability (Bhoumik-owned), or obtain Chris's explicit publication approval;
   do not assume either. Re-check the contract before a future attempt.
5. Only once a supported, authorized path exists, create/reuse the order with
   authoritative allocations and true customer acceptance. Re-read to verify
   quantities/provenance/status and report actual records, not a promised order.
   Current schema creates Order **New** (`new`) and Job **Committed**; Orders
   then use Processing/Order Ready, not the older order labels elsewhere in this
   skill. Never infer supplier confirmation from Chris's availability override.
   Leave the job's lifecycle unchanged when no order could be created.

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
  Order rows retain their `availability_request_item_id` as source evidence.
- Read every allocation before relaying answers, changing quantities or
  creating orders. A combined supplier quantity is a shared total, never the
  amount available to every linked job. Preserve job-specific demand, prices,
  dates and customer privacy; combine only the exact approved scope.

When customer acceptance is explicit and the accepted quantities, source AR
rows and pickup/delivery plan are resolved, create the supplier order atomically:

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
creation records **Committed**, maps AR `can_order` to order `need_to_order`
(**Need to Order**), and exposes the order in the supplier portal's Orders tab
and every linked job's Orders tab. If acceptance arrives before suitable AR
rows exist, preserve its evidence and complete the approved availability
workflow before order creation; do not fabricate supplier responses.

Store `orders.fulfillment_method` as `pickup`/`delivery` and
`orders.fulfillment_date` as the agreed pickup/delivery date, separate from
`job_requests.expected_install_date`. Do not guess a shared order's plan from
one linked job when their requirements differ. Explicit supplier order
confirmation uses `confirm_order(orderId, supplierId, confirmationDate,
fulfillmentDate)`, makes the **Order Confirmed** and records `confirmation_date`.
The **Job Request remains Committed**; it has no Confirmed stage. An
availability submission does not confirm an order. Resolve ambiguous supplier
confirmation before applying it; relay the actual order status/date to every
affected job thread.

## 7. Quotes and customer updates

Use `quote-generation` for the output, including quick quotes. Send the
customer-safe draft to `customer-coordination`; obtain any required approval
through `message-routing` in the original request thread. The customer thread
sends exactly the approved content and relays the result here. Only actual
customer delivery records `quote_shared`; save the shared quote link in
`external_notes` without exposing internal notes. A customer confirmation
relayed by the customer thread supplies evidence for **Committed** order
creation above. Resolve ambiguous or partial acceptance rather than guessing.
