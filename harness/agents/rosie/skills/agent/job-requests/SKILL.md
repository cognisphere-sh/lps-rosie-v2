---
name: job-requests
description: Manage actual customer job requests from intake to closure. Covers job/thread and item creation before clarification, independent pricing work, order clarification, multiple-plant/size demands, concurrent writes, APS-first sourcing, smallest-priced-requested-size quoting, likely equivalent catalogue-name pricing, mandatory APS job-row notes and evidence-supported alternatives with Chris approval, concise Markdown supplier entries and sourcing decisions, surfacing supplier responses without automatic availability changes, and lifecycle hooks. Use when creating or updating an order request, sourcing its items, receiving supplier/customer job updates or recording customer confirmation; pricing-only questions do not create a job, while quick quotes create/reuse a job, thread and supplied item rows before quote output, without an availability request. (v4.13.0)
metadata:
  author: lps
  version: "4.13.0"
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
sending the affected AR, including automatically published APS requests.
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
   `quote_only: true` in the quick-quote handoff so normal sourcing does not start an availability ask.
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
Use the existing Markdown format below and preserve supplier answers and human
notes; no duplicate APS entries or invented availability/selection.

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
qualifies, keep its request/response and pending action current; preserve
other suppliers' existing entries and human notes.

| Field | Content |
|---|---|
| `customer_notes` | Customer's words that structured fields do not hold: constraints, deadlines and identity clues. Preserve evidence; do not duplicate plant/size/quantity/address. |
| Item `sourcing_notes` | Markdown supplier entries for every APS-scoped job row under the standing instruction, sent ARs, required actions, explicit note instructions, and actual supplier selections/plant-sourcing decisions. |
| Job `sourcing_notes` | Job-level sourcing actions/decisions or explicitly requested notes, under the same rule; plant-specific selections stay on their item. |
| `external_notes` | Customer-safe offer and delivery details; never internal sourcing. |

Write sourcing notes as **Markdown entries, never tables or pipe-delimited
rows**. Start each entry with the supplier name in bold and underline:
`**<u>Supplier name</u>**`. Follow it with only important keywords and numbers
to track: price, size, quantity, AR reference/state, ETA, required action or
explicit sourcing decision.
Use short fragments separated by ` · ` or line breaks, not full sentences or
narrative statements. Omit irrelevant or unsupported details.

Separate supplier entries with a blank line. **Do not add `----`, horizontal
rules or other divider lines**; the bold, underlined names separate them.
Apply this format when adding or updating entries. Store the Markdown itself in
`sourcing_notes`, without wrapping it in a fenced code block; the Jobs page
renders it. Use only the attribute-free `<u>` tag for underline.

```markdown
**<u>Austin Plant Supply</u>**
$105 · 15 G · [AR-42](ar:42) · Sent · Pending

**<u>Acosta</u>**
$98 · 15 G · Offered qty 20 · [AR-43](ar:43) · Completed · Selected by Chris

**<u>Everde</u>**
30 G · Price unknown · Send approved AR
```

- Keep the supplier name explicit and include relevant known prices/quantities.
  Add offered plant/size when it differs, then the latest AR state/response:
  `Sub: Muskogee 30 G`, `8 available`, `Unavailable`, `ETA Sep 18`.
- Two qualifying suppliers for one plant means two separate entries. Update
  the existing entry when pricing, AR state, quantity, ETA or response changes.
  Preserve
  other suppliers' entries and any human notes. Do not append response history;
  the changelog keeps it. Never replace a supplier response with catalogue
  evidence after a later search.
- Mention a catalogue date or generic-price basis when it materially
  qualifies the price. Do not write narrative sourcing paragraphs.
- Record explicit supplier selection and other sourcing decisions about the
  plant with concise markers, such as `Selected by Chris`, `Excluded`,
  `30 G approved`, `Split qty 10` or `Hold`. State the affected supplier,
  plant/size or quantity when needed. Preserve the current decision when a
  new supplier response arrives; update it only on an explicit new decision.
  Availability, a low price, a completed AR or being the only respondent
  does not mean selected. Never invent a selection or let one supplier's
  response override a decision or another supplier's entry.
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

1. Read explicit supplier instructions and supplier preferences. **Austin
   Plant Supply (`supplier_id = 1`) is the current default.** Use a named
   supplier when instructed; do not invent future region/order-size/plant-type
   selection rules. Preserve exclusions such as "don't ask Austin".
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
   inventory UUID mappings and prices, alternatives labelled with separate
   quote/AR approval evidence (unapproved candidates are internal-only), and
   interaction context. Do not create duplicate ARs on retry.
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
AR reference/state, source and any uncertainty. Update the qualifying sourcing
entry with concise response facts and retain any explicit sourcing decision.

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
