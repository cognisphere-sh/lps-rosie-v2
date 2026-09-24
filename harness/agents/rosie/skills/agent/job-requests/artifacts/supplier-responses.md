## 5. Surface supplier responses; Chris controls availability

Supplier responses are evidence for Chris, **not instructions to change
availability**, except Chris's standing, narrowly scoped first-APS-submission
instruction below (JR-72 webchat message 36, 2026-09-24 01:49:21 CDT). Accept a supplier-thread relay only for an explicit AR
submission; a local/saved, unsubmitted supplier edit never reaches this thread,
Chris or job/item notes. Surface each safely matched submitted response to
Chris in the original request conversation: supplier, requested plant/size,
reported quantity/price, AR reference/state, source and any uncertainty.
Read the submitted header and line `note_from_supplier`, then update the matched
job/item notes under [notes](notes.md): internal progress or follow-ups in
`note_internal`, information intended for the customer in `note_for_customer`.
Split mixed content and keep uncertain audience/offer applicability internal.
Request-wide conditions belong on applicable jobs; line details belong on
linked items. Preserve `note_from_customer`, unrelated customer-facing notes and Chris's
selection; replace superseded facts without copying the correspondence log.
Do not duplicate structured response/status fields or expose supplier costs
and internal comparisons. A note must not offer an unapproved alternative or
present an unselected supplier's terms as the customer's accepted offering.
Except on the qualified first APS submission below, present the specific
proposed job-line status/quantity changes to Chris and ask for approval in the
original request conversation. If he approves, apply only that scope after a
fresh read and report the saved result. For combined AR rows, show each job's allocation
alongside the shared supplier total before asking; never assign the whole
available total to every job. A supplier AR answer marked `available` carries
that AR row's authoritative allocated demand total; it still does not set any
job-item available quantity without Chris's exact approval.

Outside that first-APS-submission exception, do not automatically change
job/item availability or status, available quantity, selected source or
customer-facing offering from a supplier's reply or portal submission. Do not infer job availability from AR answer fields.
This applies with one supplier too, and especially when several are being
considered: keep their responses separate for Chris to compare. Neither the
first available response nor the cheapest quote selects the supplier. An
unavailable response does not mark the whole plant unavailable.

Only Chris's explicit instruction authorizes Rosie to change availability;
this includes his first-APS-submission standing instruction for the exact linked
scope below. Apply it to the specified item/field after a fresh read. **Whenever that
instruction changes a job item to displayed Can Order, write the schema-valid
`status = 'need_to_order'` and set `available_quantity` in the same guarded
update to the approved demand scope: the item's `demanded_quantity` for the whole line,
or its explicitly approved allocated quantity for a limited allocation. Never
use a combined supplier total for every linked job item.** Selecting a supplier
alone is a sourcing decision to record, not an instruction to mark the item
available. Supplier-entered portal answers remain as saved by the supplier;
Rosie reads and reports them without overwriting them. For supplier messages
outside the portal, follow `supplier-coordination` before any AR answer write.

### First explicit APS submission: scoped standing instruction

Chris authorized direct linked-job updates without another question when APS
(`supplier_id = 1`) **first explicitly submits** an active AR (JR-72 webchat
message 36, 2026-09-24 01:49:21 CDT). Verify the first-submission transition
from current AR status/submission evidence and recent changes/event context;
`submitted_at` alone does not prove this is the first submission if a later
unsubmitted edit or resubmission occurred. If first-submission evidence is
unavailable, hold affected writes and report the uncertainty; do not replay on
retry. A saved edit, trusted transcription without submission, later explicit
resubmission, inactive/closed AR, non-APS supplier, or older unrelated AR is
not covered. Re-read the submitted snapshot, job/item rows, original customer
ask, decisions, accepted terms and both junctions; match each AR line to exact
linked job items and allocated shares. Relay first, then the job owner writes
only its own affected items; avoid duplicate writes from parallel event handlers.

For a safely matched, uncommitted/unaccepted line with no competing source or
contrary Chris/customer decision, apply these **supported** response mappings
as one guarded job-item update where a quantity is set:

| Submitted APS answer | Linked job-item action |
|---|---|
| `available` | `status='available'`; set `available_quantity` only to the verified job allocation bounded by that item's remaining requested demand, never the combined supplier total. |
| `can_order` | `status='need_to_order'` and `available_quantity` to that verified bounded allocated demand in the same guarded update; if supplier quantity is absent, note that APS gave no separate quantity confirmation, not that its combined quantity is per-job stock. |
| `diff_size_qty_sub` | `status='alternative_proposed'` only when scoped and safe; preserve the customer's requested plant/size, demanded quantity and requested-offering price in structured fields. Record the proposed alternative and attributable quantity in `note_internal`, not as a replacement offering. |
| `unavailable` | `status='unavailable'` only for the exact original requested offering and attributable job scope; do not erase a different selected source or equate a different offering's unavailability with the whole plant. |
| `arriving_soon`, NULL, unclear or conflicting answer | Notes/evidence only until actionable status and quantity are clear; do not invent an ETA or availability. |

For a shared AR, a combined available/offered quantity is **not** distributable
by assumption. Use the junction share only if APS's answer supports that share;
if the answer is insufficient or contradicts allocations, keep affected quantity
and status unresolved and report the allocation gap. A quantity difference never
changes `demanded_quantity` silently. Preserve the original ask in
`note_from_customer` when recording an actual different offering; do not
rewrite customer-origin words. Record current supplier evidence in
`note_internal`; put verified, relevant customer-safe response facts and
factual *proposed* differences in `note_for_customer`, without cost, unverified
cultivar claims, acceptance, or a customer send. No automatic supplier source
selection, order, quote publication or customer outreach follows.

Whenever APS proposes a different size/plant/variant (e.g. 7 G for a
requested 15 G), look up the proposed alternative's price in the APS price
list and add its supported result to the affected item's `note_internal`
sourcing facts, even if Chris has not selected that alternative. Record its
actual listed plant/size and price as an APS **list** price, or briefly record
that no exact applicable price was found; distinguish any qualified identity
proxy from an exact match. This research neither selects the alternative nor
replaces the requested item's price, and a list price is not stock or an APS
supplier quote (Chris, JR-75 webchat message 11, 2026-09-24 04:49:43 CDT).
For a genuinely different proposed size/plant/variant, identify the exact
alternative and research its applicable positive customer unit price under
`plant-and-supplier-search`. A supplier amount must clearly be a customer
selling price, not cost or an ambiguous quote; an APS catalogue list price is
an explicitly qualified proxy, never stock or supplier confirmation. The structured job-item plant/size and unit price represent the customer's
requested offering: never replace them with the APS-proposed alternative or
its list price (Chris, JR-75 webchat message 13, 2026-09-24 04:52 CDT).
Keep proposed alternative identity/size, price evidence and unresolved gaps
in `note_internal`; do not add a proposal to customer-facing notes until its
separate approval and applicable pricing are resolved. Never silently null
or change an accepted customer price. A quantity-only difference does not itself reprice a
unit. No revised customer quote/order is published on an unresolved price.
Report any unsupported identity, allocation, price or accepted-term conflict
as a narrow blocker; complete other safe lines without a blanket approval ask.
Verify saved status, attributed available quantity, proposed identity/size,
price, notes and generated total. Later submissions revert to the ordinary
Chris-specific approval path.

### Submitted Diff Size/Qty/Variant (outside first APS submission)

When a safely matched, explicitly submitted supplier line is marked
`diff_size_qty_sub` outside the first-APS-submission standing scope, update the
existing JR's **current evidence** and brief
item `note_internal` with the supplier's actual different size, quantity or
variant and response. Preserve customer-origin demand and the current offered
line. This is the note/evidence handoff Chris requested by “update the JR,”
not permission to change job availability/status, available quantity, selected
source, offering or price. Do not describe a merely proposed alternative as an
implemented line substitution or offer it in `note_for_customer` before the
applicable approval.

For an identifiable APS-proposed alternative, look up its own applicable APS
price-list entry even when a supplier answer includes an amount; retain the
exact listed plant/size and price (or concise no-exact-match result) in item
`note_internal`, distinguish a qualified proxy, and do not overwrite the
requested offering's price. First check whether the submitted supplier answer
itself quotes a positive price clearly for that alternative; compare it with
the list evidence without conflating a supplier quote and a list price. If
there is no applicable supplier quote, use `plant-and-supplier-search` (or
Chris's authorized supplier exception) to assess the APS list price, checking
exact alternative identity, size and positive price. Distinguish an inventory list price from a
supplier-confirmed quote and neither from actual availability. Verify whether
any supplier-entered amount is an applicable customer-facing unit price rather
than a supplier cost or an ambiguous amount. Present the alternative and supported price to Chris in the original request
conversation for a scoped decision. Approval to consider the alternative does
not change the existing job item's requested plant/size or its price. Any
separately represented alternative quote/order line must carry its own verified
new-offering price; never carry forward the requested size/variant's price. A different quantity alone does not establish
a new unit price; verify the applicable terms rather than guessing. Preserve the original customer request in the structured job-item fields and
`note_from_customer` as applicable; record proposed alternative details only
in internal sourcing notes until a separately authorized offer is appropriate.
Preserve already accepted customer terms until Chris authorizes their change. If the new offering has
no supported customer-facing price, leave the affected new-offering price
unresolved rather than reuse the old price or invent one; do not publish a
revised quote/order for that affected scope until resolved. If no reliable
price is found, tell Chris the gap and ask specifically whether to contact the
supplier for **that alternative's price**. Only after his approval, hand the
exact AR, supplier, alternative and original-chat approval evidence to the
supplier thread for the price question; receiving a different offering is not
itself outreach authorization. A new supplier price answer is evidence for
Chris, not automatic acceptance or permission to change the JR line. Keep
unaffected jobs/lines moving while resolving the affected scope; a shared AR
line does not broaden any other customer's acceptance.

If Chris approves an alternative for a distinct customer-facing quote or
order, preserve the original job item's requested plant/size and price;
use an explicitly supported separate representation under the applicable
quote/order workflow rather than replacing requested fields; if none is
established, ask Chris how to proceed instead of inventing a row. Verify requested identity, size,
demand, price and generated total remain intact; reconcile concurrent edits
before writing. Do not change unapproved fields.

A supplier chat giving only a quantity does not confirm a seeded price.
Preserve requested quantities and customer prices; do not infer customer
acceptance from supplier availability.
