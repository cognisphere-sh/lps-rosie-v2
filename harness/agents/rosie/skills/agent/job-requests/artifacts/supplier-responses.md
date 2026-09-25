## 5. Surface supplier responses; Chris controls availability

Supplier responses are evidence for Chris, **not instructions to change
availability**, except Chris's standing, narrowly scoped first-APS-submission
instruction below (JR-72 webchat message 36, 2026-09-24 01:49:21 CDT). Accept a supplier-thread relay only for an explicit AR
submission; a local/saved, unsubmitted supplier edit never reaches this thread,
Chris or job/item notes. Surface each safely matched submitted response to
Chris in the original request conversation: supplier, requested plant/size,
reported quantity/price, AR reference/state, source and any uncertainty.
The merged supplier note includes original sourcing requirements as well as
responses. Derive outcomes only from actual supplier-provided facts and evidence;
do not turn the original ask into availability or acceptance. When an explicitly
submitted APS answer unambiguously says the requested item is available, use
that answer as-is for the authorized linked-job update; do not reflexively ask
APS or Chris to confirm availability again. Clarify only a material ambiguity
in identity, allocation, quantity, conflicting answer or customer constraint.
Chris identified Carolina Cherry Laurel in a 24-inch box as equivalent to 30 G
(JR-78 webchat messages 33–34, 2026-09-24 11:40 CDT). For that plant and those
container descriptions, do not treat the stated equivalence alone as a different
size requiring a substitution/price question; retain the customer's requested
wording and any independently material difference. This is not a blanket
24-inch-box/30-G equivalence for other plants or nursery specifications.

Read the submitted header and line `note_for_supplier`, then update the matched
job/item notes under [notes](notes.md): internal progress or follow-ups in
`note_internal`, information intended for the customer in `note_for_customer`.
Split mixed content and keep uncertain audience/offer applicability internal.
Request-wide conditions belong on applicable jobs; line details belong on
linked items. Preserve `note_for_customer`, unrelated customer-facing notes and Chris's
selection; replace superseded facts without copying the correspondence log.
Do not duplicate structured response/status fields or expose supplier costs
and internal comparisons. A note must not offer an unapproved alternative or
present an unselected supplier's terms as the customer's accepted offering.
Except on the qualified first APS submission below or a separate explicit
Chris instruction covering the linked job and specified changes (such as JR-78
webchat message 33), present the specific proposed job-line status/quantity
changes to Chris and ask for approval in the original request conversation.
If he approves, apply only that scope after a fresh read and report the saved result. For combined AR rows, show each job's allocation
alongside the shared supplier total before asking; never assign the whole
available total to every job. A supplier AR answer marked `available` carries
that AR row's authoritative allocated demand total; it still does not set any
job-item available quantity without Chris's exact approval.

Outside that first-APS-submission exception or Chris's separate explicit
instruction for the exact scope, do not automatically change job/item
availability or status, available quantity, selected source or customer-facing
offering from a supplier's reply or portal submission. Do not infer job
availability from AR answer fields. This applies with one supplier too, and especially when several are being
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
| `diff_size_qty_sub` | `status='alternative_proposed'` only when scoped and safe; a single clear offered size and supported price may use the [different-size JR display rule](#different-size-jr-display). Otherwise preserve the requested fields and record the unresolved proposal internally. |
| `unavailable` | `status='unavailable'` only for the exact original requested offering and attributable job scope; do not erase a different selected source or equate a different offering's unavailability with the whole plant. |
| `arriving_soon`, NULL, unclear or conflicting answer | Notes/evidence only until actionable status and quantity are clear; do not invent an ETA or availability. |

For an unambiguous `available` answer, the supplier's affirmative status does
not require an additional availability question. Still verify that the answer
applies to the exact requested offering (including any Chris-confirmed narrow
equivalence), linked item and allocation before changing status or quantity.
A customer-facing note should add only a meaningful supported outcome not
already apparent from the saved status; preserve the original customer's
requirements. Do not mistake a merely proposed alternative for availability of
the requested item.

For a shared AR, a combined available/offered quantity is **not** distributable
by assumption. Use the junction share only if APS's answer supports that share;
if the answer is insufficient or contradicts allocations, keep affected quantity
and status unresolved and report the allocation gap. A quantity difference never
changes `demanded_quantity` silently. Preserve the original ask in
`note_for_customer` when recording an actual different offering; do not
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
an explicitly qualified proxy, never stock or supplier confirmation. The structured job-item plant/size and unit price normally represent the
customer's requested offering (Chris, JR-75 webchat message 13); the narrow
[different-size JR display rule](#different-size-jr-display) supersedes that
convention for a supported unaccepted size proposal, without accepting it.
Otherwise keep proposed alternative identity/size, price evidence and unresolved
gaps in `note_internal`; do not offer an unsupported proposal in customer notes. Never silently null
or change an accepted customer price. A quantity-only difference does not itself reprice a
unit. No revised customer quote/order is published on an unresolved price.
Report any unsupported identity, allocation, price or accepted-term conflict
as a narrow blocker; complete other safe lines without a blanket approval ask.
Verify saved status, attributed available quantity, proposed identity/size,
price, notes and generated total. Later submissions revert to the ordinary
Chris-specific approval path unless Chris explicitly instructs the relevant later submission's scoped job/field
updates. His JR-78 instruction to use the APS response as-is for that request,
and “Always do this,” remove needless re-confirmation of clear supplier facts;
they do not turn every later submission or other supplier's response into
standing authority for automatic job writes. For an expressly approved later
submission, re-read and map the exact submitted answer and linked allocations,
then update supported status and customer-safe notes within his instruction;
keep unresolved quantities, unsupported substitutes and customer constraints
intact. No customer send follows from a saved note.

### Submitted Diff Size/Qty/Variant (outside first APS submission)

When a safely matched, explicitly submitted supplier line is marked
`diff_size_qty_sub` outside the first-APS-submission standing scope, update the
existing JR's **current evidence** and brief
item `note_internal` with the supplier's actual different size, quantity or
variant and response. Preserve customer-origin demand. The submitted answer
alone does not authorize changing job status, available quantity, selected
source, offering or price outside an otherwise authorized job update. Apply the
[different-size JR display rule](#different-size-jr-display) only when its
separate predicates are met; do not describe a proposal as accepted or send
it to the customer without applicable approval.

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
conversation for a scoped decision. A proposal is not customer acceptance. A qualified single-size proposal may
change JR display size and price under the narrow rule below, but not make it
a selected quote/order offering. Any separately represented alternative
quote/order line needs its own verified new-offering price; never carry forward
the requested size/variant's price. A different quantity alone does not establish
a new unit price; verify the applicable terms rather than guessing. Preserve the original customer request in structured fields except under the
narrow display rule below; when display size changes, preserve the original
request in `note_for_customer` and proposal evidence in `note_internal`.
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
order, verify its identity, size, quantity and customer price and keep the
original ask and any accepted terms recoverable. Where both original and
alternative need selectable representations, use an explicitly supported
separate quote/order workflow; if none exists, ask rather than invent a row.
Verify the authorized display and generated total; reconcile concurrent edits.
Do not change unapproved fields.

### Different-size JR display

Chris's JR-78 webchat message 45 (2026-09-24 12:16:31 CDT) supersedes the
JR-75 preserve-requested-size display convention **only** for updating an
uncommitted/unaccepted JR item with one clear APS-submitted `diff_size_qty_sub`
size offer: show that offered size and its own supported positive customer
unit price in `size` and `unit_price`, and a concise original-versus-offered
fact in `note_for_customer`. Write `1 G unavailable; 3 G only` **only if** APS
actually confirms both claims; a different-size status alone establishes
neither `NA` nor `only`. Where the original-size outcome is unknown, say
`Requested 1 G; 3 G offered`, not that the customer has accepted it. Keep the
customer's original requested plant/size and relevant constraints recoverable
in the note and source AR/transcript; source/price qualifications remain
internal. Retain `status='alternative_proposed'` until separately selected;
merely showing the proposal does not make it `available`.

This is display authority, **not** authority to accept a substitute, send a
quote/customer message, select a source, place an order or overwrite accepted
terms. It runs only within an otherwise authorized submitted-response job
update: qualified first APS submission or Chris's scoped instruction for a
later submission. Before guarded writes, verify one unambiguous offered plant
and size, attributable quantity consistent with job allocation/demand, a
supported applicable customer selling price (clear supplier quote, Chris's
price for that offering, or an exact APS list price qualified as list-based),
and no competing offered sizes/variants, accepted terms or contradictory
manual edits. An old requested-size AR seed, a different species' same-size
listing, or a 4-inch-pot price is **not** a new 1 G price. An APS list price
alone proves no stock and never supersedes a human-provided price. If a
predicate fails, leave affected size/price unchanged, flag the narrow gap and
hold any quote/order for that line; complete independent lines. Do not change
`demanded_quantity` silently or equate 18 four-inch pots with 18 one-gallon
plants. Preserve accepted terms, reconcile concurrent human edits instead of
overwriting them, guard previous size, price, quantity, notes and status, and
verify the generated total. A size-only answer does not change plant/variant.
This rule narrows the prior blanket prohibition on JR display changes, not
the supplier-response approval gate.

A supplier chat giving only a quantity does not confirm a seeded price.
Preserve requested quantities and customer prices; do not infer customer
acceptance from supplier availability.
