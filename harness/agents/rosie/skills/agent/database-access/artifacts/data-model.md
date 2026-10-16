# LPS data model in brief

Full detail: `skills/agent/database-access/scripts/schema <topic>`. This page is the map.

## Jobs

- `job_requests`: one job. `name`, `status`, `customer_id`,
  `expected_install_date` (shown as EDD: requested pickup/delivery date),
  `fulfillment_method`, `note_for_customer`, `note_internal`.
- `job_request_items`: its lines; a line owns only the customer's ask:
  `name`, `size` (the requested size), `demanded_quantity` (NULL = unknown;
  the only demand its candidates have, 0136), `note_internal`. Changing it
  re-checks the line's candidates: Available with 0 < Avail < Qty becomes
  Partial Qty, Partial Qty with Avail >= Qty becomes Available. Its `unit_price`, `total`, `status`, `available_quantity`
  and `note_for_customer` are deprecated (0130; dropped by 0131): never read
  or write them. The old `quantity` column is retired.
- `default_candidate_id` = the line's APS original ask, created (unpriced) and
  selected by the database when the line is inserted; it can't be hidden,
  deactivated, deleted or demoted. `selected_candidate_id` = the candidate
  the line shows (app "Selected" column; never NULL).
  `select_candidate(item, candidate)` only sets it; `unselect_candidate(item)`
  returns it to the default, as does deactivating the selected candidate.
  Chris picks; you select only by his direction or a selection rule.
- **Read lines from the view `job_lines`**: the line's columns
  (`requested_size` = the line's `size`) plus its selected candidate's
  `size`, `unit_price` (as stored: NULL = not priced, 0 = $0), `demand`, `available_quantity`, `total`,
  `note_for_customer` (effective: the override, else the supplier's reply),
  `candidate_status`, `quote_name` (the line's name, or a substitute's
  description), `is_substitute`. The line's status is `candidate_status`:
  the selected candidate's status as stored, nothing derived (0137; there is
  no `job_lines.status`). Line status vocabulary: `pending` (NULL),
  `available`, `partial_qty`, `unavailable`, `diff_size_sub` (Diff Sz/Sub),
  `need_to_order` (= `can_order`), `arriving_soon`. A candidate of another
  size or plant reads Diff Sz/Sub only when its status is `diff_size_sub`.
- LPS edits of a line's values: `update_job_line(item, changes)` with keys
  `status` (line vocabulary), `unit_price`, `available_quantity`,
  `note_for_customer` (`''` = blank override, null = follow the supplier),
  `size` (blank = none) and `name` (required) for the size/name the line
  shows (0133). A status other than Partial Qty, Unavailable or Pending sent
  without a quantity sets it to the demand (0134). It writes the selected candidate, also on a closed AR, and
  never moves the AR; size/name on an original also change the line's ask,
  on a substitute only the substitute. A generated "<size> <name>"
  description follows, a "<size> <own text>" one swaps its size, any other
  custom one is kept (an unasked default's too, via the line sync).
  Supplier facts never go in `note_internal`.
- `job_request_changelog`: audit trail (`actor`, `action`, `item_id`,
  `changes`). Written by triggers only.

## Candidates, ARs and orders

- `candidates`: the supplier/plant/size options for one job line
  (`job_request_item_id`, `supplier_id`, `name`, `size`, `unit_price`; NULL =
  price not found, which stays blank on a selecting line; 0 is a $0 price, 0143). `description`
  (required) = what it is, for Chris (`5 G Shumard Oak`); `is_original` marks
  a supplier's original-ask row (APS's is the line's default). `hide_from_lps`
  (0124) keeps a candidate off the sourcing page: substitute options for the
  supplier's Diff Sz/Sub dialog (a supplier's pick clears it), and this AR's
  other alternatives after a submission.
  `availability_request_id` is set once it is asked on an
  AR; then it is that AR's line, and the supplier answers `status`,
  `available_quantity`, `unit_price`, `note_from_supplier` (never `size`).
  Statuses: `available`, `partial_qty`, `can_order`, `arriving_soon`,
  `unavailable`, `diff_size_sub`. A substitute: the asked candidate is
  `unavailable` with `offered_candidate_id` (the AR row reads Diff Sz/Sub and
  shows the substitute's values), and the substitute is `diff_size_sub` and
  linked to the AR from the moment the supplier saves, but not listed as its
  own AR row in the app; a typed one (`offer_description`) is a placeholder
  named with the raw text, no price, for Rosie to enrich. Shown
  status is derived: No price (unanswered, price NULL) → Pending (priced;
  no AR or only an unsent draft) → AR sent (sent AR, `status` NULL) → the
  answer. A status never changes a price; it sets the quantity on every
  writer: available = demand, unavailable = 0, `diff_size_sub` = demand
  unless given, back to pending = unknown (NULL). A candidate has no demand of its
  own (no `demanded_quantity` column since 0139): the AR asks for its job line's
  `demanded_quantity`. Every candidate has a job line and every AR a job
  (`job_request_item_id` / `job_request_id` NOT NULL, 0139). Deleting =
  `delete_candidate` (soft; lines selecting it fall back to their default;
  refused for a default).
- `availability_requests` (header): **one AR per job and supplier**
  (`availability_requests.job_request_id`; 0128 refuses a second insert for
  the same job and supplier); an AR holds only that job's candidates. Status: `draft` (LPS only; the supplier can't see it) →
  `send_availability_request` → `new` → `processing` → `submitted` →
  `closed`. Submitting an AR moves open job lines (Quote/Availability) whose
  selected asked row was answered Unavailable with a substitute onto that
  substitute, then hides that supplier's other alternatives on the AR's
  lines, asked or not (not defaults,
  selections, the supplier's originals or their substitutes). Nothing is
  copied. `reopen_availability_request(ar)` is the only way back to `new`
  (from submitted, processing, or closed on an open job);
  `add_candidates_to_availability_request` refuses a submitted, processing or
  closed AR until then.
- `orders` and `order_items`; `order_item_job_request_items` links order lines
  to job lines with each job's `quantity`. Related ARs are found through the
  job lines, same supplier only.
- ARs cannot be deleted and have no deletion flag (0127). Move a published
  AR to Draft to hide it from the supplier and revoke its public link; answers
  and candidate links stay. LPS edits never change an AR's status; draft
  preparation stays private. Reopening a job never reopens ARs.

## Notes

`note_for_customer` (jobs, candidates, orders, order lines; only
information for the customer — on a candidate it is LPS's override: NULL
follows `note_from_supplier`, `''` is blank; a line shows its selected
candidate's),
`note_internal` (jobs, job lines; the customer's requirements and open
points, never supplier or price facts), `note_for_supplier` (AR header,
candidates, orders, order lines; on candidates only LPS's ask),
`note_from_supplier` (candidates: the supplier's reply). Content rules:
`job-requests` → notes. There is no `orders.notes` column.

## Catalogue

- `inventory`: supplier price-list rows (`name`, `common_name`,
  `botanical_name`, `cultivar_variety_trade_name`, `size`, `size_std`,
  `unit_price`, `internal_notes`). Price evidence, not stock. Daisy owns it.
- `plant_aliases`: pairs of names for the same plant; search expands them, also misspelt or partly typed (`search_query_groups` shows which).
  Daisy adds them.
- `customers` / `suppliers`: `rosie_thread_id` is each one's thread.
  `suppliers.is_lps_partner` = has the private portal.

## Writing safely

- Every write starts `SET app.actor TO 'rosie';`.
- Re-read right before updating. Change only the columns you mean to.
- Guard with the old value so an app edit made meanwhile isn't lost, then
  check the row count:

  ```sql
  UPDATE candidates SET unit_price = 25
  WHERE id = 4120 AND unit_price IS NOT DISTINCT FROM 0;
  ```

  Zero rows → someone changed it. Re-read and reconcile; don't retry blindly.
- For notes use `skills/agent/database-access/scripts/set-note` (it guards
  for you).
- Never write generated, trigger-owned or deprecated fields (`total`,
  `updated_at`, `*_thread_ref`, changelog rows, audit timestamps, the line
  values listed above).
- Real newlines: from a file (`set-note`) or `E'line 1\nline 2'`. A plain
  `'\n'` is two characters.
- Deleting or deactivating anything needs Chris's explicit word.
