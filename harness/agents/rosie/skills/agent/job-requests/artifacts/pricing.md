## 4. Sourcing and pricing

Choose the request's path first. For an already committed request or an accepted
quote moving directly to an order, prepare prices under the next paragraph and
continue to [direct orders](direct-orders.md) without quote generation or availability work. A quick-quote
instruction uses `quote-generation` and skips AR creation and supplier contact.
A request only to look for a supplier uses `plant-and-supplier-search` and
returns findings to Chris first, even on an existing job; it does not start
the normal job's availability-request workflow. Record useful progress on an
existing job under [notes](notes.md); a lookup alone creates no job.

**Committed-order pricing precedence:** use the applicable line prices supplied
with the committed request, or the accepted prices already on its job/quote.
Save them in `job_request_items.unit_price` before creating the order. Preserve
their source and acceptance evidence in the originating message/attachment;
keep useful progress and qualifications in internal notes. For a partly priced request, retain
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
   or accepted price applies; keep useful sourcing progress under [notes](notes.md).
   For real gaps, research 1–2 closest supported APS alternatives, preferring
   the same plant/nearby size, then defensible related plants; report them in
   chat without selecting them or widening supplier scope.
   No price means NULL, never zero. Catalogue stock stays
   catalogue evidence: new item status remains `pending`; pricing alone does
   not change existing availability/status fields.
3. A likely equivalent catalogue name follows the direct-pricing and necessary
   source-qualification rule in `plant-and-supplier-search`; no needless alternative
   label or approval for the name difference alone. A genuinely different
   plant/size or unsupported equivalence is a candidate alternative, never a silent change
   to the customer's ask. Report it in chat and record APS gap alternatives
   under [notes](notes.md). Always obtain Chris's explicit confirmation in the original
   request chat before quoting an alternative or creating/sending an AR for
   it; confirmation must cover the intended action. Other suppliers' candidate
   prices can be recorded internally when useful under [notes](notes.md). An explicitly
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
   If the quote is now accepted for direct ordering, continue to [direct orders](direct-orders.md)
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
   separate alternative approvals, and supplier-relevant `note_from_customer` from
   the job and its items for AR header/line `note_for_supplier`. Preserve note scope
   and omit private customer details unless sharing is authorized.
   A request may combine several jobs;
   use [allocation relationships](allocated-orders.md) and retain each origin conversation.
   The supplier thread follows `supplier-coordination` and reuses the same
   request on retry.
7. Relay later supplier/customer changes through their owning threads. Keep
   sourcing progress current on AR preparation, delivery, authorized ask changes,
   submission, closure and follow-ups. Unsubmitted supplier edits stay local;
   classify submitted supplier notes by audience under [notes](notes.md).
   A pending send must be labelled as pending.
   Report the priced lines, open requests and unresolved decisions on this
   job's chat; send any required approval to the original request thread.

The existing Chris-approved cultivar/color pricing convention remains:
crape myrtles, plumbago and salvias may use APS's generic line at the same
size when the requested variety/color is unlisted. Explain `Generic price`
in chat and in internal notes where needed; it does not confirm that variety
or authorize a size substitution.
