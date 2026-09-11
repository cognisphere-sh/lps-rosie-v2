---
name: job-requests
description: Manage actual customer job requests from intake to closure. Covers job/thread and item creation before clarification, completing independent work and pricing updates, order clarification before quotes or availability requests, multiple-plant/size demands, concurrent database writes, APS-first sourcing and short supplier rows, supplier-answer reconciliation, and lifecycle hooks. Use when creating or updating an order request, sourcing its items, receiving supplier/customer job updates or recording customer confirmation; pricing-only questions do not create a job, while quick quotes create a job/thread without an availability request. (v4.4.0)
metadata:
  author: lps
  version: "4.4.0"
---

# Job requests

The `jr-<id>` thread owns its job and items. Customer and supplier threads
own correspondence and relay order updates here. Read
`knowledge/files/SCHEMA.md` before querying; read
`artifacts/database-access.md` for SQL/storage command syntax on first use.
Use `message-routing` for
handoffs and approvals; drafting on this thread never requires Chris to move
here to approve.

## 1. Intake: an order request or quick quote

You may ask any clarifying question about an order request before generating
a quote (including a quick quote) or creating/sending an availability request.
**Complete all authorized actions that do not depend on an answer before
asking.** Once order/quick-quote intent is established, perform the intake
writes below: create/reuse the job and `jr-<id>` thread, create item rows from
the supplied details, and save known customer/job information. Do not stop at
a plan or hold all records until every detail is clarified. Review existing
records and conversation history, use `plant-and-supplier-search` to gather
pricing, save supported prices and sourcing rows, and record completed
pricing through the lifecycle hook. Research clearly labelled candidate
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
sending the affected AR, including automatically published APS requests.
Continue independent work, including supported record updates, while waiting.
Apply answers to the existing job/items with guarded writes; do not recreate
the job or duplicate rows when clarification arrives. Preliminary
pricing findings do not establish stock availability or resolve an ambiguous
requirement. If the request is clear, proceed without extra questions.

1. Distinguish a price lookup/general question from an order or quick-quote
   request. Simple pricing/general questions create no job or AR. **A quick
   quote creates a job and `jr-<id>` thread**, reusing an existing job when
   applicable, but creates/sends no AR. Preserve `quote_only: true` in the
   quick-quote handoff so normal sourcing does not start an availability ask.
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
   `status = 'sourcing'` (displayed **Active**). Store a job/site name only when
   supplied: a real residence, address, PO or project. Leave `name` NULL
   otherwise; the app constructs the company/job display title.

   ```sql
   SET app.actor TO 'rosie';
   INSERT INTO job_requests (id, customer_id, name, status, customer_notes)
   OVERRIDING SYSTEM VALUE
   VALUES ($jobId, $customerId, $name, 'sourcing', $customerNotes);
   ```

5. Create item rows before asking questions: one per clearly separate
   requested line, preserving the supplied plant name, size and quantity.
   Missing size, quantity or price stays NULL and does not prevent creating
   a row with a supplied plant name. If the plant name itself is missing,
   record the unresolved request in job notes and create the other rows;
   do not invent a name to satisfy the required column.
   Preserve unresolved alternatives in the original line without choosing,
   splitting or combining requirements. For example, record
   `20 live oaks, 15 G or 30 G` as one row with name `live oaks`, size
   `15 G or 30 G` and quantity `20`, then research both sizes before asking
   whether either size is acceptable or a particular mix is required.
   Follow an explicit allocation already supplied. Otherwise clarify separate
   requirements versus alternatives and per-option versus total quantities
   after completing independent work, before splitting/combining items,
   selecting a plant/size, or generating the affected quote/availability ask.
   Never duplicate a total across options or assume every named plant is
   required. Keep prices for unresolved alternatives in sourcing notes;
   leave `unit_price` NULL until a price applies to the requested line.
   Normalize gallon tokens to `G` (`30 gal or larger` → `30 G or larger`).
   A duplicate-key error on the job means re-read, then add only genuinely
   missing items. Continue independent sourcing with the recorded lines;
   report completed intake work and remaining gaps accurately.
6. Later customer mapping is guarded with `WHERE customer_id IS NULL`; a
   concurrent app mapping wins. Never write derived thread references; the
   database links each job to `jr-<id>`.

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
newlines, e.g. `E'first row\nsecond row'`; plain `'\n'` is literal text.
Never write generated `total`, `updated_at`, thread references or changelog
rows. `available_quantity` on job items remains a human-managed field;
record supplier quantities in sourcing rows and the AR's answer fields.
Archiving/deactivating records requires Chris's explicit direction.

## 3. Notes and sourcing rows

| Field | Content |
|---|---|
| `customer_notes` | Customer's words that structured fields do not hold: constraints, deadlines and identity clues. Preserve evidence; do not duplicate plant/size/quantity/address. |
| Item `sourcing_notes` | Current short rows, one for each supplier considered for that plant. |
| Job `sourcing_notes` | Job-level sourcing decisions/constraints, not copies of every plant's rows. |
| `external_notes` | Customer-safe offer and delivery details; never internal sourcing. |

Use this shape for each item's supplier row, omitting empty optional cells:

```text
Austin Plant Supply | $105.00 | 15 G | Listed; AR-42 New
Acosta | $98.00 | 15 G | AR-43 Completed; 20 available
Everde | Price unknown | 30 G | Awaiting reply
```

- Supplier name and price (`Price unknown` if missing) are always explicit.
  Add offered plant/size when it differs, then the latest AR state/response:
  `Sub: Muskogee 30 G`, `8 available`, `Unavailable`, `ETA Sep 18`.
- Two suppliers for one plant means two rows. Update the existing supplier
  row when pricing, AR state, quantity, ETA or response changes. Preserve
  other suppliers' rows and any human notes. Do not append response history;
  the changelog keeps it. Never replace a supplier response with catalogue
  evidence after a later search.
- Mention a catalogue date or generic-price basis when it materially
  qualifies the price. Do not write narrative sourcing paragraphs.
- A changed offering belongs in `external_notes` as
  `Quoted for Muskogee Crape Myrtle 30 G.` or `Quoted for 12 rather than 10.`
  A different catalogue name for the same plant is not a substitution.
- Customer output uses requested/approved offered plants, sizes, selling
  prices and `external_notes`. Supplier names, internal prices, stock-list
  details and agent messages stay internal unless Chris explicitly asks to
  show those specific details.

## 4. Sourcing and pricing

For a normal job, run the following on this thread. A quick-quote instruction
uses `quote-generation` and skips AR creation and supplier contact.

1. Read explicit supplier instructions and supplier preferences. **Austin
   Plant Supply (`supplier_id = 1`) is the current default.** Use a named
   supplier when instructed; do not invent future region/order-size/plant-type
   selection rules. Preserve exclusions such as "don't ask Austin".
2. Search APS inventory for every plant using `plant-and-supplier-search`,
   or the instructed supplier's inventory. Check actual plant identity,
   cultivar, size and positive price; retain the inventory UUID and source
   evidence. Copy the applicable price into `unit_price` and write its
   supplier row. No price means NULL, never zero. Catalogue stock stays
   catalogue evidence: item status remains `pending`.
3. A different plant/size is a candidate alternative, never a silent change
   to the customer's ask. Record it in the supplier row; a material choice
   between offerings goes to Chris. Other suppliers' candidate prices stay
   on their rows until Chris/customer selects that source. An explicitly
   requested supplier may price the item directly.
4. **When APS has no matching inventory, record the gap and offer to look
   for other suppliers.** Wait for Chris's instruction before widening.
   On an instructed wider search, verify the exact plant/size, price, source date
   and location; catalogue stock remains unconfirmed. Newly discovered
   suppliers go to Daisy for onboarding before order-side coordination.
5. After an actual pricing lookup, including no-match results, call the
   lifecycle hook below with `pricing_fetched`. This is work done, so the
   job moves from Active to Quote even if no price was found; later stages
   remain unchanged.
6. Once questions affecting the availability ask are resolved, route an APS
   availability request for every ordinary job to APS's supplier
   thread by default, including items absent from its inventory. An explicit
   supplier override/exclusion takes precedence. The supplier thread follows
   `supplier-coordination`: APS portal requests publish automatically,
   privately by default; preserve the customer-details sharing preference. Send one
   handoff per job/supplier with job/item ids, requested quantities, exact
   inventory UUID mappings and prices, alternatives labelled as such, and
   interaction context. Do not create duplicate ARs on retry.
7. Relay later supplier/customer changes through their owning threads. Keep
   sourcing rows current on AR creation, edits, submission and closure.
   Report the priced lines, open requests and unresolved decisions on this
   job's chat; send any required approval to the original request thread.

The existing Chris-approved cultivar/color pricing convention remains:
crape myrtles, plumbago and salvias may use APS's generic line at the same
size when the requested variety/color is unlisted. Record `Generic price`
on the supplier row; it does not confirm that variety or authorize a size
substitution.

## 5. Supplier answers and item status

A listing never confirms availability. Apply the supplier's answer relayed
by its own thread, or Chris's explicit instruction for that item:

| Supplier answer | Item status |
|---|---|
| Available as asked | `available` |
| Must order it | `need_to_order`; ETA on supplier row |
| Arriving | `arriving_soon`; ETA on supplier row |
| Different size/quantity/substitute | `alternative_proposed`; customer-safe offer in `external_notes` |
| No supply | `unavailable` if no suitable source remains; otherwise keep sourcing |
| Unanswered | `pending` |

A response from one supplier does not invalidate another supplier's answer.
Reconcile the selected/remaining sources before changing the overall item.
Read response price against its inventory prefill: a supplier chat that gives
only a quantity does not newly confirm a seeded price. Preserve requested
quantity; do not infer customer acceptance from supplier availability.

## 6. Job lifecycle hooks

The app labels intentionally differ from stored keys:

| Display | Stored status | Trigger |
|---|---|---|
| Active | `sourcing` | Actual order or quick quote recorded; no processing yet. |
| Quote | `quoted` | Pricing fetched or quote shared. |
| Availability | `availability` | Availability request delivered through a partner portal or sent email. |
| Confirmed | `confirmed` | Customer explicitly confirms the order. |
| Won | `closed_won` | Request explicitly closed as won. |
| Lost | `closed_lost` | Request explicitly closed as lost. |

`archived` is legacy, not a new workflow stage. Customer confirmation is
**Confirmed**, not closure. Do not infer a lost sale from silence.

```sql
SET app.actor TO 'rosie';
SELECT public.record_job_workflow_event($jobId, 'pricing_fetched');
```

Events are `pricing_fetched`, `availability_sent`, `quote_shared`, and
`customer_confirmed`. Call only after the event actually occurs: a draft is
not a shared quote, a failed send is not sent. `pricing_fetched` and
`quote_shared` advance Active → Quote. `availability_sent` advances Active
or Quote → Availability. `customer_confirmed` advances Active, Quote or
Availability → Confirmed; quick quotes can skip Availability. Repeated
pricing/quote events leave Availability unchanged, and no workflow event
regresses Confirmed or reopens Won, Lost or archived jobs. Price writes and
partner AR creation also have database hooks; explicit lookup completion is
still needed when no price is saved.

Close with a fresh read, a guarded status update and the explicit won/lost
instruction. Database hooks close the job thread and all associated ARs,
revoke public links and prevent closed AR edits. Reopening a closed job
restores each AR to its previous stage through the database hook; do not
reset all requests to New or reuse revoked public links. Active, Quote,
Availability and Confirmed keep availability requests open; the job stage
Availability is separate from each supplier request’s New/Processing/Completed/Closed status.

## 7. Quotes and customer updates

Use `quote-generation` for the output, including quick quotes. Send the
customer-safe draft to `customer-coordination`; obtain any required approval
through `message-routing` in the original request thread. The customer thread
sends exactly the approved content and relays the result here. Only actual
customer delivery records `quote_shared`; save the shared quote link in
`external_notes` without exposing internal notes. A customer confirmation
relayed by the customer thread records `customer_confirmed` with its actual
evidence. Resolve ambiguous acceptance rather than guessing.
