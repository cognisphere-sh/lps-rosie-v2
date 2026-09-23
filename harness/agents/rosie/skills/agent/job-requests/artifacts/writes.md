## 2. Read and write discipline

For every request/item acted on, load the current row and its last five
`job_request_changelog` entries (`ORDER BY created_at DESC, id DESC LIMIT 5`).
Every write invocation begins `SET app.actor TO 'rosie';`. Re-read immediately
before an update, change only intended columns, and check row counts.

Guard updates with the previous state so a concurrent UI edit is not lost:

```sql
UPDATE job_request_items
SET sourcing_notes = $newNotes
WHERE id = $itemId AND sourcing_notes IS NOT DISTINCT FROM $oldNotes;
```

If the update affects zero rows, reload and reconcile. Notes need real
newlines, e.g. `E'**<u>Supplier</u>**\nQty 20'`; plain `'\n'` is literal text.
Never write generated `total`, `updated_at`, thread references or changelog
rows. `available_quantity` on job items remains a human-managed field;
record reported supplier quantities in qualifying sourcing entries. Do not
copy replies into availability fields without Chris's explicit instruction.
Archiving/deactivating records requires Chris's explicit direction.
