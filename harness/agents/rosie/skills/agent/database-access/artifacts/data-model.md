# LPS data model in brief

Full detail: `skills/agent/database-access/scripts/schema <topic>`. This page is the map.

## Jobs

- `job_requests`: one job. `name`, `status`, `customer_id`,
  `expected_install_date` (shown as EDD: requested pickup/delivery date),
  `fulfillment_method`, `note_for_customer`, `note_internal`.
- `job_request_items`: its lines. `demanded_quantity` = what the customer
  wants (NULL = unknown). `total` is generated from demand × `unit_price`;
  never write it. The old `quantity` column is retired.
- `selected_candidate_id` = the candidate chosen for this line (app
  "Selected" column). `select_candidate(item, candidate)` sets it and copies
  the candidate's size, price, capped quantity, status and
  `note_for_customer` onto the line. Editing a selected line's
  `note_for_customer` writes it back to the candidate. You select only the
  exact match at intake; Chris picks the rest.
- `available_quantity`, `size`, `unit_price`, `status` of a selected line
  come from its candidate. The line status is computed: the original
  request's answer (`partial_qty` included; one offering a substitute reads
  `alternative_proposed`), and `alternative_proposed` (Diff Sz/Sub) for any
  other answered candidate. Supplier facts never go in `note_internal`.
- `job_request_changelog`: audit trail (`actor`, `action`, `item_id`,
  `changes`). Written by triggers only.

## Candidates, ARs and orders

- `candidates`: the supplier/plant/size options for one job line
  (`job_request_item_id`, `supplier_id`, `name`, `size`, `unit_price`; 0 =
  price not found, which stays blank on a selecting line). `description`
  (required) = what it is, for Chris (`5 G Shumard Oak`); `is_original` marks
  the line's original request as asked. `hide_from_lps` (0124) marks a
  substitute option kept only for the supplier's Unavailable/Sub dialog: the
  sourcing page leaves it out until a supplier picks it, which clears it.
  `availability_request_id` is set once it is asked on an
  AR; then it is that AR's line, and the supplier answers `status`,
  `available_quantity`, `unit_price`, `note_from_supplier` (never `size`).
  Statuses: `available`, `partial_qty`, `can_order`, `arriving_soon`,
  `unavailable`, `diff_size_qty_sub` (older answers only). A substitute
  (0123): the asked candidate is `unavailable` with `offered_candidate_id`
  (the portal shows it as Diff Sz/Sub), and the substitute is Available and
  linked to the AR from the moment the supplier saves, but not listed as its
  own AR row in the app (0124); a typed one (`offer_description`) is created with the raw
  text as its name for Rosie to enrich. `link_candidate_offer(answered,
  substitute)` records one by hand. Shown
  status is derived: No price (unanswered, price 0/NULL) → Pending (priced;
  no AR or only an unsent draft) → AR sent (sent AR, `status` NULL) → the
  answer. A status never changes a price: Unavailable sets only the quantity to 0 (0122).
  `demanded_quantity` is what the AR asks for. Deleting = `delete_candidate`
  (soft; also unselects).
- `availability_requests` (header): **one AR per job and supplier**
  (`availability_requests.job_request_id`; 0128 refuses a second insert for
  the same job and supplier); an AR holds only that job's candidates. Status: `draft` (LPS only; the supplier can't see it) →
  `send_availability_request` → `new` → `processing` → `submitted` →
  `closed`. Submitting an AR turns each
  reply answered since the last submission into that candidate's
  `note_for_customer`, then re-applies selected candidates to open job lines
  (Quote/Availability).
- `orders` and `order_items`; `order_item_job_request_items` links order lines
  to job lines with each job's `quantity`. Related ARs are found through the
  job lines, same supplier only.
- ARs cannot be deleted and have no deletion flag (0127). Move a published
  AR to Draft to hide it from the supplier and revoke its public link; answers
  and candidate links stay. LPS edits to published AR content reset it to New;
  draft preparation stays private. Reopening a job never reopens ARs.

## Notes

`note_for_customer` (jobs, job lines, candidates, orders, order lines; only
information for the customer — a line's follows its selected candidate),
`note_internal` (jobs, job lines; the customer's requirements and open
points, never supplier or price facts), `note_for_supplier` (AR header,
candidates, orders, order lines; on candidates only LPS's ask),
`note_from_supplier` (candidates: the supplier's reply). Content rules:
`job-requests` → notes. There is no `orders.notes` column.

## Catalogue

- `inventory`: supplier price-list rows (`name`, `common_name`,
  `botanical_name`, `cultivar_variety_trade_name`, `size`, `size_std`,
  `unit_price`, `internal_notes`). Price evidence, not stock. Daisy owns it.
- `plant_aliases`: pairs of names for the same plant; search expands them.
  Daisy adds them.
- `customers` / `suppliers`: `rosie_thread_id` is each one's thread.
  `suppliers.is_lps_partner` = has the private portal.

## Writing safely

- Every write starts `SET app.actor TO 'rosie';`.
- Re-read right before updating. Change only the columns you mean to.
- Guard with the old value so an app edit made meanwhile isn't lost, then
  check the row count:

  ```sql
  UPDATE job_request_items SET unit_price = 25
  WHERE id = 912 AND unit_price IS NOT DISTINCT FROM NULL;
  ```

  Zero rows → someone changed it. Re-read and reconcile; don't retry blindly.
- For notes use `skills/agent/database-access/scripts/set-note` (it guards
  for you).
- Never write generated or trigger-owned fields (`total`, `updated_at`,
  `*_thread_ref`, changelog rows, audit timestamps).
- Real newlines: from a file (`set-note`) or `E'line 1\nline 2'`. A plain
  `'\n'` is two characters.
- Deleting or deactivating anything needs Chris's explicit word.
