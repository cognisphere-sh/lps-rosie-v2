# Availability notes and job handoffs

Read the request, current lines, linked jobs/items, allocations and source
before editing. Both LPS requirements and actual supplier replies use the same
field. Preserve current requirements and response facts when updating it.

| Field | Content and presentation |
|---|---|
| `availability_requests.note_for_supplier` | Shared request-wide sourcing requirements, instructions and actual supplier response conditions. |
| `availability_request_items.note_for_supplier` | Shared line-specific sourcing requirements and actual supplier response details: cultivar, color, alternatives, purchasing units, availability/ETA or relevant conditions. Rendered once in the **Note for supplier** column, never beneath the plant name. |

1. Read `job_requests.note_for_customer` and every allocated
   `job_request_items.note_for_customer` when preparing or correcting an authorized
   ask. Select only information the supplier needs for sourcing: job-wide
   requirements into header `note_for_supplier`, line-specific requirements
   into item `note_for_supplier`, together with Chris's applicable instructions.
   Do not copy a project/section heading or customer name merely to label the
   request (e.g. `Radia` / `Wilkinson`); include one only if it conveys an actual
   supplier-relevant requirement and sharing it is authorized. The structured
   line already displays plant, size, requested quantity and seed price: do not
   repeat these as `Please price Gilt Edge 15 G` or similar redundant notes.
   An unresolved price alone remains a NULL seed price, not a reason to add a
   line note. Trim qualifiers that add no sourcing meaning: write
   `Atrosanguinea or Shalimar Red cultivar`, not `Atrosanguinea or Shalimar Red
   cultivar acceptable`; remove accidental stray characters such as a trailing
   `S`. Exclude planting spacing, layout and installation details unrelated to sourcing.
   Keep notes brief, positive and supplier-facing: describe the requested specs
   and any genuine question for the supplier, not instructions about which sizes
   or cultivars it may or may not substitute. For example, write `140 individual
   4-inch pots packed in trays; unit price per pot`, not `not 140 trays`, and
   omit `do not substitute 7 G` or `do not substitute Purple Pixie`. The supplier
   may recommend differences; a recommendation is not an approved alternate
   ask or customer acceptance. Preserve relevant color, alternatives and
   special requests within the approved ask, but do not turn internal sourcing
   concerns into a ban on supplier recommendations. Use NULL when there is
   nothing useful to add. Keep internal sourcing and irrelevant/private
   customer information out, and preserve existing customer-sharing and
   alternative-approval rules.
2. Use the narrowest scope. For shared ARs, keep job/allocation-specific
   requirements attributable without exposing unauthorized customer identity;
   do not apply one job's conditions to all demand. Keep incompatible asks on
   separate lines. Do not repeat header notes on every line or use notes in
   place of structured quantity, price or status.
3. For LPS context, update the shared `note_for_supplier` without submitting a
   response. For actual supplier replies, use `answer_availability_request` with
   the string key `note_for_supplier`; read and retain still-relevant requirements
   in the replacement text. Blank clears the whole shared note. A note-only LPS
   edit does not mark the request processing; a supplier answer through the RPC
   does. Header submission saves the shared request note through
   `submit_availability_request_note`. Never invent a supplier reply from a seeded
   instruction or treat existing ask text as evidence of availability.
4. Re-read to verify the correct field and exact content. A note update does
   not authorize sending, submitting or messaging a customer. Submitted supplier
   notes are relayed with their header/line scope under [responses](responses.md).
   The job thread uses [job note audiences](../../job-requests/artifacts/notes.md)
   to populate `note_internal` for internal progress or `note_for_customer` for
   customer-facing information, splitting mixed content. This applies to both
   jobs and items. Preserve customer-origin notes and unrelated existing notes;
   do not treat a supplier response as approval to change the offering or send
   a customer message. Unsubmitted edits stay on the supplier thread.

`demanded_quantity` is the total requested on the availability line;
`available_quantity` is the supplier's response. Each job item's requested share
remains `availability_request_item_jobs.quantity`. All item associations come
from that table; the former direct `job_request_item_id` column is removed.
