# LPS data model in brief

Full detail: `skills/agent/database-access/scripts/schema <topic>`. This page is the map.

## Jobs

- `job_requests`: one job. `name`, `status`, `customer_id`,
  `expected_install_date` (shown as EDD: requested pickup/delivery date),
  `fulfillment_method`, `note_for_customer`, `note_internal`.
- `job_request_items`: its lines. `demanded_quantity` = what the customer
  wants (NULL = unknown). `total` is generated from demand × `unit_price`;
  never write it. The old `quantity` column is retired.
- `available_quantity` on a job line is set by Chris, or by you only under
  Chris's standing APS-submission instruction (`job-requests` → supplier
  responses). Otherwise put supplier quantities in `note_internal`.
- `selected_availability_request_item_id` = the supplier AR line chosen for
  this job line (app "Suppliers" capsule). Only Chris chooses it.
- `job_request_changelog`: audit trail (`actor`, `action`, `item_id`,
  `changes`). Written by triggers only.

## ARs and orders

- `availability_requests` (header) and `availability_request_items` (lines).
  A line's `demanded_quantity` is the total asked of the supplier.
- Links to jobs only through `availability_request_jobs` (AR ↔ job) and
  `availability_request_item_jobs` (AR line ↔ job line, with each job's
  `quantity`). There is no job id on the AR tables.
- `orders` and `order_items`; `order_item_job_request_items` links order lines
  to job lines with each job's `quantity`. Related ARs are found through the
  job lines, same supplier only.
- Deleting an AR = `is_active = false`; status, token and answers stay.
  Reopening a job never reopens ARs. `hidden` is no longer a status.

## Notes

`note_for_customer` (jobs, job lines, orders, order lines),
`note_internal` (jobs, job lines), `note_for_supplier` (AR header/lines,
orders, order lines; LPS asks and supplier replies share it). Content rules:
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
