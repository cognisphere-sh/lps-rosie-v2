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

For an ordinary non-quick-quote request, get supplier pricing, then pursue an APS AR if Chris approves that specific scope; quote generation is optional and does not gate AR preparation or publication. If Chris asks for a quote, generate it from supported prices. An explicit quick quote requires the quote and stops without AR or availability approval ask. The job's Quote → Availability → Committed stages describe records, not mandatory sequential tasks.

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
2. Before handing an ordinary request to the supplier thread for AR publication,
   make a best-effort pricing pass over **every in-scope job row**, not just the
   easiest matches: search APS inventory using `plant-and-supplier-search`, or
   the instructed supplier's inventory. Check actual plant identity, cultivar,
   size and positive price; retain the inventory UUID and source evidence.
   Copy the applicable price into `unit_price` only where no supplied or
   accepted price applies; keep useful sourcing progress under [notes](notes.md).
   Re-read the rows after pricing so the AR handoff reflects all saved prices
   and remaining NULLs, rather than leaving supported rows unpriced.
   For real gaps, research 1–2 closest supported APS alternatives, preferring
   the same plant/nearby size, then defensible related plants; report them in
   chat without selecting them or widening supplier scope. When the exact
   requested size is absent, record a genuinely relevant closest listed size
   or variant, its actual APS list price and any identity/size limitation in the
   affected item's `note_internal`; omit merely genus-related but materially
   different species without a sensible sourcing connection. Keep the original
   requested size/identity and NULL price untouched. A different size is
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
   price gap and the alternative's actual price, and wait for his scoped
   selection before applying that proxy to the row or seeding the AR. In each
   proxy-price question, offer a separate `Use this proxy price always` option
   alongside a one-time use and a decline. Explain that `always` means the
   selected inventory item's *current* same-size price may be used for this
   specifically named requested variant in future requests when its exact
   listing is absent—not a fixed price, botanical alias, substitution, stock
   confirmation or exact AR mapping. On selection, save the scoped authorization
   in that selected proxy inventory row's `internal_notes` under
   `plant-and-supplier-search` before future reuse; preserve existing notes and
   the approval evidence. A different size or materially different form is not
   covered by this close-variant price-choice rule. If no such close price exists, do not ask
   him to choose an alternative price; preserve the gap. An unanswered proxy
   choice leaves that row's price NULL; finish independent rows and, once the
   original-plant AR scope and send are approved, the unresolved price alone
   does not indefinitely hold up publication. A selected proxy price does not
   change the original plant/size in the supplier ask, establish identity or
   stock, or authorize an inventory mapping.
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
   `pricing_fetched`. For an explicit quick quote or another specifically
   requested quote, resolve quote-blocking gaps and generate the supported
   APS price-list quote using `quote-generation`; do not claim stock or invent
   prices. Keep the job at Quote; later stages remain unchanged. **If Chris
   asked only for a quick quote, stop here** without an AR or approval ask.
   For an ordinary non-quick-quote request, do not generate a quote merely to
   reach availability; retain unresolved price gaps and the original requested
   plant/size in the supplier ask rather than inventing a seed price.
6. Re-read the latest intent and acceptance before starting availability work.
   If the request is committed or an existing quote is accepted for direct
   ordering, continue to [direct orders](direct-orders.md) without a new quote,
   AR or availability-send question. Otherwise, for an ordinary request
   following the availability path, ask Chris in the original request chat
   whether to send the availability request to APS. Wait for his specific
   approval; pricing, an ordinary job request, supplier research and any
   optional quote do not authorize publication. Preserve an explicit approval
   already given for this exact send; do not wait for or manufacture a quote.
   After the all-row best-effort pricing pass, approval and scope clarification,
   route the ask to APS's supplier thread, including unlisted items unless
   Chris limits the scope. Preserve customer-details preferences. Include every
   job/item id and allocated quantity, the workflow path (quote
   requested/completed or intentionally skipped) and send-approval evidence,
   each supported saved price and exact inventory UUID mapping, Chris-accepted
   proxy seed prices (explicitly marked unmapped), and each unresolved NULL
   price or pending close-variant price decision. Include separate alternative
   approvals, and supplier-relevant `note_for_customer` from
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
responses](supplier-responses.md#different-size-jr-display) before repricing.
Chris's JR-78 display instruction permits one clearly offered size and its
supported price in an unaccepted JR line **only within an otherwise authorized
job update**; it does not select the alternative for quote/order, accept it
for the customer or authorize outreach. Later submissions still need Chris's
scoped job-update instruction. The old size's price is never a fallback for
the new offering. Preserve the original request in the customer note when
display changes, and all accepted terms until their scoped change is approved.
A missing new-offering price stays unresolved.

The existing Chris-approved cultivar/color pricing convention remains:
crape myrtles, plumbago and salvias may use APS's generic line at the same
size when the requested variety/color is unlisted. Explain `Generic price`
in chat and in internal notes where needed; it does not confirm that variety
or authorize a size substitution.
