---
name: job-requests
description: Manage customer job requests from quote to closure. Covers intake and concurrent writes, APS price-list quotes, quick-quote stopping, Chris approval before availability sends and response-driven job-line changes, compact latest supplier snapshots and the row selection/price outcome, install and fulfillment fields, committed jobs and orders, supplier confirmation on Orders only, and many-to-many job/availability/order allocations. Use for new job requests, quick quotes, sourcing, supplier/customer updates, order creation or closure; pricing-only questions create no job. (v5.2.0)
metadata:
  author: lps
  version: "5.2.0"
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

   Save a supplied expected install date in `expected_install_date` and
   pickup/delivery choice in `fulfillment_method` (`pickup` or `delivery`).
   Keep unknown values NULL. The install date is the customer's planning date,
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

### Multiple requested sizes: standing quote rule

Chris's instruction (2026-09-11): for alternatives such as `3 G / 5 G`,
quote/use the price of the **smallest requested size with supported applicable
price data**, not the lowest-priced option and not an assertion of physical
stock. Search each requested size, skip sizes without a supported positive
price, and use the smallest priced requested size directly. Do not ask Chris
to choose again unless the instruction conflicts with an explicit allocation,
plant identity or another material requirement. No priced requested size
means a price gap, not permission to choose an unrequested size.

Preserve the original requested size alternatives in the item demand/customer
context when recording the quoted size and price. Put the other larger
requested sizes' supported prices in shared/customer-visible item
`external_notes`, e.g. `5 G $25.00`. Where the row identifies the plant,
use only size and price; follow `quote-generation` for minimal-word shared
notes. Use actual prices only, without internal supplier/cost commentary or
availability claims.
State the chosen quoted size clearly and include larger-size prices only
when actually supported; no extra demand rows or duplicated quantities.
An unrequested size remains an approval-gated alternative. This rule authorizes
quote sizing/pricing only: supplier AR scope must still respect the original
requested alternatives and total quantity unless separately resolved.

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
except for the standing APS job-row instruction below.

**Standing APS job-row instruction (Chris, 2026-09-11):** For actual order
sourcing and quick quotes using APS, add/update an APS sourcing entry on
**every active requested item row in that APS scope**, including exact priced
matches and rows with missing prices or no inventory match. This is Chris's
explicit note instruction; no AR or supplier selection is required. It does
not extend to standalone pricing/general questions or a research-only supplier
lookup, even on an existing job, and does not override an APS exclusion.
Record the supported requested-line price/size or concise gap (`Price unknown`,
`No exact match`), distinguishing inventory evidence from supplier answers.
First distinguish likely naming equivalents from real substitutions using
`plant-and-supplier-search`. Chris authorizes supported pricing directly for
likely same-plant catalogue names, including his Agave parryi truncata /
Artichoke Parry’s Agave / Agave Parryi example. Record a brief catalogue-name
mapping and evidence/pricing basis in the APS entry, not an `Alternative` or
approval-pending marker for a mere name difference. Keep requested identity
and size; use only an applicable supported price. This is pricing evidence,
not confirmed identity for AR mapping or availability.
For remaining pricing/match gaps, research and record **1–2 closest evidence-supported
APS alternatives**, when found: candidate plant/cultivar, size and known price,
with `Alternative · Chris approval pending`. Prefer the same plant in a nearby
size, then a defensible related cultivar/plant; similarity must be supported
by identity/size evidence, not merely search rank. Do not invent alternatives
or prices, force two weak options, or widen to other suppliers without instruction.
If none is supportable, record `No supported APS alternative found`.
Keep candidates in the original requested row's APS entry; do not replace its
requested identity, size, quantity or applicable price with candidate values.
Ask Chris in the original request chat whether to **quote the specific
alternative and/or request availability for it**. Obtain explicit confirmation
for the intended action before any affected quote (including a draft) or AR
creation/send, including an alternative in supplier-visible notes. Note-taking
is not approval; approval to quote is not approval to request availability,
or vice versa. Continue independent work on the original/unambiguous lines.
Use the current-snapshot format below. Preserve current supplier facts and
human decisions/constraints without carrying superseded history forward; no
duplicate APS entries or invented availability/selection.

For other sourcing entries, add a note only when at least one applies:

- An availability request was actually delivered to that supplier's portal
  or sent by email. A created record, unsent draft or public link alone is
  not evidence of delivery.
- A concrete supplier action is required for the current order, such as an
  authorized availability send, supplier follow-up or coordination of an
  agreed substitution. State the actual pending action; do not invent a
  follow-up or treat an optional candidate as actionable to justify a note.
- Chris explicitly asks to add or record the sourcing note.
- Chris makes a supplier selection or another sourcing decision about the
  plant, or an explicit approved decision is already recorded. Capture it in
  that plant's sourcing note, even if no AR has been sent yet.

This applies to both job-level and item-level `sourcing_notes`. Research-only
supplier lists, prices and alternatives stay in chat outside the standing APS
job-row instruction. A lookup is not an
instruction to contact suppliers or send ARs. Keep supported structured price
updates and job intake moving under their own rules. Once a supplier entry
qualifies, keep only its latest relevant request/response and pending action;
preserve other suppliers' current snapshots and current human decisions/constraints.

| Field | Content |
|---|---|
| `customer_notes` | Customer's words that structured fields do not hold: constraints, deadlines and identity clues. Preserve evidence; do not duplicate plant/size/quantity/address. |
| Item `sourcing_notes` | One compact current row outcome plus one latest snapshot per qualifying supplier; no event history. |
| Job `sourcing_notes` | Current job-level sourcing actions/decisions only; no event history or duplicate item outcomes. |
| `external_notes` | Customer-safe offer and delivery details; never internal sourcing. |

### Compact current snapshot (Chris, 2026-09-15)

Sourcing notes answer **where this row stands now**. Keep one short overall
row outcome and **one latest entry per supplier**. Replace the supplier's
previous update in place; do not append an event history, dated diary, old AR
states, repeated quotes, conversation summaries or a list of completed steps.
The existing changelog and contact transcript retain history.

1. Read the current row, supplier evidence and Chris's latest decisions under
   section 2. Keep only facts needed to understand the current offering,
   availability, alternative or remaining decision. Preserve active human
   constraints and approval scope; omit superseded facts and resolved actions.
   If evidence conflicts, retain a short uncertainty instead of guessing.
2. Put a single **`Row:`** summary first: selected supplier, selected size/variant
   when needed, and the supported selected supplier price. Use `$105/unit` to
   make the price basis clear. If also showing the customer's selling price,
   label it `Quote $140/unit`; never confuse the two. No selection means state
   the actual next decision, such as `Awaiting Chris selection` or `Awaiting
   Chris alternative approval`, not an invented supplier choice. A quick quote
   can say `Quote $105/unit · Availability not requested`; do not invent a
   pending approval or follow-up after quote-only work stops.
3. Keep each supplier entry to **supplier: size/name/variant: price, current
   AR state, availability or alternative**, including only applicable facts.
   Use `**<u>Supplier name</u>**: ...` and short fragments separated by ` · `.
   The row already names the requested plant, so repeat its name/variant only
   to distinguish an offered alternative or material catalogue-name mapping.
   Include the actual current AR reference/state (`[AR-42](ar:42) Completed`),
   useful quantity/ETA, or `AR not requested` when it explains the decision.
   A price list alone is not stock confirmation. Keep active alternatives
   compact and explicitly pending the applicable Chris approval; remove
   rejected/superseded alternatives from the current snapshot.
4. Update the one row summary and affected supplier entry together when their
   facts change. Keep other suppliers' latest relevant entries, not their
   histories. Several current ARs/scopes for one supplier still belong in one
   supplier entry with brief scope distinctions; do not collapse distinct live
   allocations or duplicate a combined quantity onto each job. Retain an older
   price or constraint only if it remains applicable, never solely to show what
   happened earlier. A later catalogue search must not erase a still-current
   supplier response.

Use blank lines between the row outcome and supplier entries. **No tables,
pipe-delimited rows, divider lines or narrative paragraphs.** Store the
Markdown itself in `sourcing_notes`, without a fenced code block. Only the
attribute-free `<u>` tag is used for underline. These are formatting examples,
not supplier selection, price or availability evidence:

```markdown
**Row:** Selected APS · 15 G · $105/unit

**<u>Austin Plant Supply</u>**: 15 G: $105/unit · [AR-42](ar:42) Completed · 12 available
```

```markdown
**Row:** Awaiting Chris alternative approval

**<u>Austin Plant Supply</u>**: 15 G: No exact match · 30 G $175/unit alternative pending Chris · AR not requested
```

```markdown
**Row:** Quote $105/unit · Availability not requested

**<u>Austin Plant Supply</u>**: 15 G: $105/unit price list
```

A selection appears only after Chris actually selects that supplier. Preserve
an existing decision until he changes it; availability, price or being the
only respondent does not mean selected. Use concise current markers such as
`Excluded`, `30 G approved`, `Split qty 10` or `Hold` only where material.
Mention a catalogue date or generic-price basis only when it qualifies the
current price. Note updates do not authorize availability/status writes,
substitutions, quotes or external communication beyond their existing gates.

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
Actual APS job sourcing and quick quotes do require the item notes in section 3.

1. Read explicit supplier instructions and supplier preferences. **LPS
   currently works exclusively with Austin Plant Supply (`supplier_id = 1`).**
   Use APS's price list for quotes and APS for approved availability requests.
   Chris may explicitly authorize an exception, including combined grower
   sourcing; research or a missing APS match does not imply that authorization.
2. Search APS inventory for every plant using `plant-and-supplier-search`,
   or the instructed supplier's inventory. Check actual plant identity,
   cultivar, size and positive price; retain the inventory UUID and source
   evidence. Copy the applicable price into `unit_price`; write a supplier
   entry under section 3, including every APS-scoped row and evidence-supported
   alternatives for gaps. No price means NULL, never zero. Catalogue stock stays
   catalogue evidence: item status remains `pending`.
3. A likely equivalent catalogue name follows the direct-pricing and concise
   mapping-note rule in `plant-and-supplier-search`; no needless alternative
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
availability**. Surface each safely matched response to Chris in the original
request conversation: supplier, requested plant/size, reported quantity/price,
AR reference/state, source and any uncertainty. Update the affected supplier's
current snapshot and the single row outcome under section 3; replace its older
update, preserve Chris's current selection and keep correspondence in chat.
Present the specific proposed job-line status/quantity changes to Chris and
ask for approval in the original request conversation. If he approves, apply
only that scope after a fresh read and report the saved result. For combined
AR rows, show each job's allocation alongside the shared supplier total before
asking; never assign the whole available total to every job.

Do not automatically change job/item availability or status, available
quantity, selected source or customer-facing offering from a supplier's reply
or portal submission. Do not infer job availability from AR answer fields.
This applies with one supplier too, and especially when several are being
considered: keep their responses separate for Chris to compare. Neither the
first available response nor the cheapest quote selects the supplier. An
unavailable response does not mark the whole plant unavailable.

Only Chris's explicit instruction authorizes Rosie to change availability;
apply it to the specified item/field after a fresh read. Selecting a supplier
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
