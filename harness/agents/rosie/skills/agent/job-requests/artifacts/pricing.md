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
   chat without selecting them or widening supplier scope. A different size is
   not a very close color/variant price proxy merely because it is nearby.
   No price means NULL, never zero. Catalogue stock stays
   catalogue evidence: new item status remains `pending`; pricing alone does
   not change existing availability/status fields.
3. A likely equivalent catalogue name follows the direct-pricing and necessary
   source-qualification rule in `plant-and-supplier-search`; no needless alternative
   label or approval for the name difference alone. A genuinely different
   plant/size or unsupported equivalence is a candidate alternative, never a silent change
   to the customer's ask. Report it in chat and record APS gap alternatives
   under [notes](notes.md). If the original requested plant has no listed price,
   keep its price NULL and, on the ordinary approved availability path, ask APS
   about the **original plant** rather than silently substituting a priced
   alternative or blocking that original-plant ask on a missing price. Only ask
   Chris **which price to use** when a listed, genuinely very close alternative
   differs in color or variant at the requested size; present the original
   price gap and the alternative's actual price, and wait for his selection
   before applying that proxy. A different size or materially different form
   is not covered by this close-variant price-choice rule. If no such close
   price exists, do not ask him to choose an alternative price; preserve the
   gap. A selected proxy price does not change the original plant/size in the
   supplier ask, establish identity or stock, or authorize an inventory mapping.
   Always obtain Chris's explicit confirmation in the original request chat
   before quoting an actual alternative offering or creating/sending an AR for
   that alternative; confirmation must cover the intended action. Other suppliers'
   candidate prices can be recorded internally when useful under [notes](notes.md).
   An explicitly requested supplier may price the item directly.
4. **When APS has no matching inventory, report the gap in chat and offer to look
   for other suppliers.** Wait for Chris's instruction before widening; absent
   that instruction, any approved APS availability ask retains the original
   requested plant and size even if no catalogue price or exact mapping exists.
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
   completion and send-approval evidence, exact inventory UUID mappings/prices
   or Chris-accepted proxy seed prices (explicitly marked unmapped), separate
   alternative approvals, and supplier-relevant `note_from_customer` from
   the job and its items for AR header/line `note_for_supplier`. Preserve note scope
   and omit private customer details unless sharing is authorized.
   A request may combine several jobs;
   use [allocation relationships](allocated-orders.md) and retain each origin conversation.
   The supplier thread follows `supplier-coordination` and reuses the same
   request on retry.
7. Relay later supplier/customer changes through their owning threads. Keep
   current supplier/price/response facts in minimal internal notes when useful;
   track AR preparation, delivery, ask changes, submission, closure and follow-ups
   in the structured workflow/transcripts, not a running note history.
   Unsubmitted supplier edits stay local;
   classify submitted supplier notes by audience under [notes](notes.md).
   A pending send must be labelled as pending.
   Report the priced lines, open requests and unresolved decisions on this
   job's chat; send any required approval to the original request thread.

For a submitted supplier `diff_size_qty_sub` response, follow [supplier
responses](supplier-responses.md) before repricing. Only after Chris approves
an actual different-size/variant offering for a specified item and selects a
supported new-offering price or authorized proxy may that item's selected quote
use the alternative; the original size/variant's price is never the fallback
for the newly selected offering, even when it remains listed. Preserve the
original request and any already accepted customer terms until their scoped
change is authorized. A missing new-offering price remains unresolved, not an
excuse to reuse the old one.

The existing Chris-approved cultivar/color pricing convention remains:
crape myrtles, plumbago and salvias may use APS's generic line at the same
size when the requested variety/color is unlisted. Explain `Generic price`
in chat and in internal notes where needed; it does not confirm that variety
or authorize a size substitution.
