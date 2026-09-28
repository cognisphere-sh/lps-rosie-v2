# Availability requests (ARs)

An AR asks a supplier whether they can supply specific lines. It is not an
order.

## Before creating

- **Approval**: creating an APS portal AR publishes it, so it needs Chris's
  yes for that scope (asked in the origin chat by the job thread). A quote is
  not needed first. Quick quotes and committed/direct orders get no AR unless
  Chris asks for one.
- **Pricing pass done**: the job thread has tried to price every row. Rows it
  skipped go back to it. Blank prices are fine; they don't block an approved
  AR.
- **Channel**: `suppliers.is_lps_partner = true` → the AR appears in their
  private portal. Otherwise → an AR with a public link, sent by HTML
  [email](email.md). (Don't change `is_lps_partner`; it comes from portal
  logins.)
- **Customer details**: read `suppliers.notes` for the sharing preference.
  None recorded → ask Chris once, save his answer there, and keep
  `share_customer_details = false` meanwhile. Private is the default. Naming
  the job in messages is always allowed (see SKILL.md).
- **Other suppliers**: only when Chris explicitly allows it for this job.

## What to ask for

- **Every active job line**, including plants not on the price list, unless
  Chris picks lines.
- **The original plant and size the customer asked for**, not the listing
  used for pricing and not the nearest listed size. The price list only shows
  what APS usually carries; it doesn't prove stock either way.
- Customer allowed options (`15 G or 30 G`): ask for the quoted size, and put
  the other option in the line note (`30 G acceptable`).
- An alternative plant or size is asked about only after Chris approved
  asking about that alternative (quote approval isn't enough).
- Unclear whether lines are separate plants or alternatives → send back to
  the job thread to resolve first. Never pick an option or repeat a total
  across options.
- Combine lines from several jobs only within Chris's approved scope. Keep
  each job's share and each job's special needs on its own line.

## Line values

| Field | Value |
|---|---|
| `name`, `size`, `demanded_quantity` | Snapshot of the requested line (demand = sum of allocations). Later job edits don't rewrite a sent AR. |
| `mapped_inventory_id` | The exact APS inventory row for this plant **and** size, else NULL. A generic, near-size or priced-from-another-listing row is NULL. Never replace a mapping the supplier chose. |
| `unit_price` (seed) | The job line's saved price: exact list price, a price-rules price, a price Chris gave or accepted. Else NULL. |
| `note_for_supplier` | See [notes](../../job-requests/artifacts/notes.md#note_for_supplier-ar-and-order-asks). |
| `allocations` | One entry per job line with its positive quantity. Unknown → NULL, and the line total NULL too. |

Never seed answer fields (`status`, `available_quantity`). Don't create empty
lines and fill prices later: that is a supplier answer and moves the AR to
Processing.

## Create

1. Read every linked job and its active lines, their notes, and this
   supplier's open ARs. Reuse an open AR for the same ask (no duplicates on
   retry). No new work on closed or inactive jobs.
2. Create in one call:

   ```sql
   SET app.actor TO 'rosie';
   SELECT public.create_availability_request(
     $supplierId,
     '[{"name":"Live Oak","size":"15 G","demanded_quantity":20,"mapped_inventory_id":null,"unit_price":null,"note_for_supplier":null,"allocations":[{"job_request_item_id":7,"quantity":12},{"job_request_item_id":9,"quantity":8}]}]'::jsonb,
     $shareDetails, $publicToken
   );
   ```

   `$publicToken`: NULL for a private (portal) AR; a new UUID for a public
   one. The call creates the header, lines and both junction tables. (The
   app's `POST /api/availability-requests` does the same.)
3. Save the header `note_for_supplier` with a guarded update (the RPC takes
   line notes only). Verify header and line notes.
4. Public link: `<configured app origin>/public/availability/<token>`.
   Never invent the host. A link is not a sent email.
5. Once actually delivered (portal publish, or email sent), record
   `availability_sent` for each linked job (moves Quote → Availability;
   [lifecycle](../../job-requests/artifacts/lifecycle.md#workflow-events)).
   A portal AR is not permission to also email.
6. Tell every linked job thread: AR id, lines, allocations, mappings and
   delivery result, with `[Open AR-<id>](ar:<id>)`. Call a pending send
   pending.

## Change an open AR

- **Adding lines** to an AR the supplier already answered is new work:
  agree the scope with the job thread first and keep the job in sync.
- <a id="chris-changes-an-open-ar"></a>**Chris changes an open AR**: while APS
  is the only supplier, a price, size or note Chris gives for a job is also
  the APS AR input. On his scope: re-read the AR, lines, allocations and
  answers. For unanswered lines of an open APS AR, update only the LPS-side
  fields (`size`, seed `unit_price`, `note_for_supplier`, exact mapping if
  one exists) with a guarded update. Keep name, quantity and allocations
  unless he changes them. Don't write answer fields or send anything new. If
  the edit moved an unanswered AR to Processing, set it back to New
  (guarded). This applies to APS only.
- **Deleting an AR** and closing/reopening: see
  [job lifecycle](../../job-requests/artifacts/lifecycle.md#deleting).
