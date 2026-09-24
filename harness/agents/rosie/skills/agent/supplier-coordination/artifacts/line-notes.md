# Availability notes and job handoffs

Read the request, current lines, linked jobs/items, allocations and source
before editing. Keep the two voices separate and preserve unmentioned fields.

| Field | Content and presentation |
|---|---|
| `availability_requests.note_for_supplier` | Supplier-useful job-wide customer requirements and Chris/LPS instructions for the request. |
| `availability_request_items.note_for_supplier` | Additional information LPS/Chris shares with the supplier: relevant customer details, variety/cultivar, special requests, handling/site requirements and other supplier-useful instructions. Rendered below the plant name. |
| `availability_requests.note_from_supplier` | The supplier's response conditions or additional information for the whole request. |
| `availability_request_items.note_from_supplier` | Additional details the supplier provides about this AR line for LPS/Chris or the customer: qualifications, alternatives, ETA, conditions or other response details. Rendered in the **Note from supplier** column. |

1. Read `job_requests.note_from_customer` and every allocated
   `job_request_items.note_from_customer` when preparing or correcting an authorized
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
   `S`. Keep notes brief, positive and supplier-facing: describe the requested specs
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
3. Write `note_from_supplier` only from the supplier's actual response, under the
   existing portal-transcription or Chris-authorized write rules. Use the
   `answer_availability_request` RPC for line notes with the string key `note_from_supplier`;
   blank clears that field. Never put LPS instructions into a supplier answer
   or seed invented supplier notes when creating an ask.
4. Re-read to verify the correct field and exact content. Note ownership does
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
