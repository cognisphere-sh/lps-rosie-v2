# Availability requests (ARs)

An AR asks a supplier whether they can supply specific **candidates** (the
options created for each job line at intake). An asked candidate is that AR's
line. It is not an order.

## Before creating

- **Approval**: an AR starts as a **Draft** the supplier can't see. Only you
  send it (`send_availability_request`); Chris can't send from the app. Create
  the draft with the candidates Chris chose, and send it once he approves
  that scope (asked in the origin chat by the job thread). He may also ask
  you to send an existing draft. A quote is
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

- **The original-ask candidate of every active job line**, including plants
  not on the price list, unless Chris picks candidates.
- **The original plant and size the customer asked for**, not the listing
  used for pricing and not the nearest listed size. The price list only shows
  what APS usually carries; it doesn't prove stock either way. A missing
  original-ask candidate → have the job thread add it first.
- Customer allowed options (`15 G or 30 G`): ask for the selected option's
  candidate (else the first), and put the other in its `note_for_supplier`
  (`30 G acceptable`).
- An alternative candidate is asked about only after Chris approved asking
  about that alternative (quote approval isn't enough).
- Chris asks a supplier in the app by dropping a candidate on that
  supplier's tablet in the job header: the app adds it
  (`add_candidates_to_availability_request`) to the supplier's newest
  non-closed AR for the job (a submitted one reopens as New; a sent one shows
  it to the supplier at once). The tablet only exists once the job has an AR
  with that supplier, so the first AR is yours to create. A draft stays
  invisible until you send it with his approval. A sent
  non-partner AR's public link still has to be emailed ([email](email.md))
  with his approval.
- Options are candidates on one line, never separate lines; don't ask the
  job thread to resolve them. Never pick an option or repeat a total across
  options.
- **One AR per job.** Never combine several jobs in one AR; each job gets its
  own AR per supplier.

## Line values

The candidate already holds them (set at intake); check before asking.

| Field | Value |
|---|---|
| `name`, `size` | The candidate's. Later job edits don't rewrite a sent AR. |
| `demanded_quantity` | Filled from the job line's demand when the candidate is added, if empty. |
| `mapped_inventory_id` | The exact APS inventory row for this plant **and** size, else NULL. A generic, near-size or priced-from-another-listing row is NULL. Never replace a mapping the supplier chose. |
| `unit_price` (seed) | The candidate's price: exact list price, a price-rules price, a price Chris gave or accepted. 0 = price not found. |
| `note_for_supplier` | LPS's ask, including the customer requirements from the line's and job's `note_internal` that matter to the supplier (`Single trunk`); see [notes](../../job-requests/artifacts/notes.md#note_for_supplier-ar-and-order-asks). |

Never seed answer fields (`status`, `available_quantity`,
`note_from_supplier`). Don't fill prices after asking: that is a supplier
answer and moves the AR to Processing.

## Create

1. Read the job, its active lines and candidates (`job-snapshot`),
   and this supplier's open ARs. Reuse an open AR for the same ask (no
   duplicates on retry). No new work on closed or inactive jobs.
2. Save each candidate's `note_for_supplier` (`set-note --table candidates`),
   then create in one call:

   ```sql
   SET app.actor TO 'rosie';
   SELECT public.create_availability_request(
     $supplierId, ARRAY[$candidateId1, $candidateId2]::bigint[],
     $shareDetails, $publicToken
   );
   ```

   Every candidate must be this supplier's, active, not yet asked and on an
   open line of **one** job (the AR stores that job). It starts as `draft`.
   Pass `$publicToken` NULL: Send gives non-partners a public link. To add
   candidates to an open or draft AR instead:
   `SELECT public.add_candidates_to_availability_request($arId,
   ARRAY[...]::bigint[]);`.
3. Save the header `note_for_supplier` with a guarded update. Verify header
   and line notes.
4. Send it once Chris approves:
   `SELECT public.send_availability_request($arId);` → status `new`; the
   supplier sees it now. Public link (non-partners, created at send):
   `<configured app origin>/public/availability/<token>`. Never invent the
   host. A link is not a sent email.
5. Sending a partner (portal) AR records `availability_sent` for its job
   (moves Quote → Availability). For a public-link AR, record it once the
   email is actually sent
   ([lifecycle](../../job-requests/artifacts/lifecycle.md#workflow-events)).
   A portal AR is not permission to also email.
6. Tell the job thread: AR id, candidates asked, mappings and
   delivery result, with `[Open AR-<id>](ar:<id>)`. Call a pending send
   pending.

## Change an open AR

- **Adding lines** to an AR the supplier already answered is new work:
  agree the scope with the job thread first and keep the job in sync.
- <a id="chris-changes-an-open-ar"></a>**Chris changes an open AR**: while APS
  is the only supplier, a price, size or note Chris gives for a job is also
  the APS AR input. On his scope: re-read the AR, its candidates and
  answers. For unanswered candidates of an open APS AR, update only the
  LPS-side fields (`size`, seed `unit_price`, `note_for_supplier`, exact
  mapping if one exists) with a guarded update. Keep name and quantity
  unless he changes them. Don't write answer fields or send anything new. If
  the edit moved an unanswered AR to Processing, set it back to New
  (guarded). This applies to APS only.
- **Deleting an AR** and closing/reopening: see
  [job lifecycle](../../job-requests/artifacts/lifecycle.md#deleting).
