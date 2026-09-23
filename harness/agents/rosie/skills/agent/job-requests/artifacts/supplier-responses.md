## 5. Surface supplier responses; Chris controls availability

Supplier responses are evidence for Chris, **not instructions to change
availability**. Accept a supplier-thread relay only for an explicit AR
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
Present the specific proposed job-line
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
update to the approved demand scope: the item's `demanded_quantity` for the whole line,
or its explicitly approved allocated quantity for a limited allocation. Never
use a combined supplier total for every linked job item.** Selecting a supplier
alone is a sourcing decision to record, not an instruction to mark the item
available. Supplier-entered portal answers remain as saved by the supplier;
Rosie reads and reports them without overwriting them. For supplier messages
outside the portal, follow `supplier-coordination` before any AR answer write.

A supplier chat giving only a quantity does not confirm a seeded price.
Preserve requested quantities and customer prices; do not infer customer
acceptance from supplier availability.
