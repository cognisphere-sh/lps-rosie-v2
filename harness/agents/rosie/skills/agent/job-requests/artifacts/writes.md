## 2. Read and write discipline

For every request/item acted on, load the current row and its last five
`job_request_changelog` entries (`ORDER BY created_at DESC, id DESC LIMIT 5`).
Every write invocation begins `SET app.actor TO 'rosie';`. Re-read immediately
before an update, change only intended columns, and check row counts.

Guard updates with the previous state so a concurrent UI edit is not lost:

```sql
UPDATE job_request_items
SET note_internal = $newNotes
WHERE id = $itemId AND note_internal IS NOT DISTINCT FROM $oldNotes;
```

If the update affects zero rows, reload and reconcile. Notes need real
newlines, e.g. `E'APS: confirm pickup slot\nChris: size choice pending'`;
plain `'\n'` is literal text. Apply the same guard to each intended note field
on jobs and items; [notes](notes.md) owns audience and scope.
Write the customer-requested amount to `job_request_items.demanded_quantity`;
NULL means unspecified. Do not use the retired job-item `quantity` column.
`total` is generated from `demanded_quantity * unit_price`. Order lines and
per-job availability/order allocations still use `quantity`.
Never write generated `total`, `updated_at`, thread references or changelog
rows. `available_quantity` on job items remains a human-managed field;
record any necessary supplier quantity context in internal notes. Do not
copy replies into availability fields without Chris's explicit instruction.
Archiving/deactivating records requires Chris's explicit direction.
