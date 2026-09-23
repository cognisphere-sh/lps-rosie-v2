## 3. Stash the source and create provenance

- File drop → upload: `scripts/agent/supabase/upload --bucket lps --path suppliers/<slug>/rate-cards/<file> --file <local>` (`<slug>` = kebab-cased supplier name, e.g. `austin-plant-supply`). Website → use the page URL.
- One `inventory_sources` row per file/URL in the drop; capture each `id`:
  ```sql
  INSERT INTO inventory_sources (supplier_id, file_path, notes)
  VALUES (<supplier_id>, '<object key or URL>', '<where/how sourced>') RETURNING id;
  ```
- **One per file × location.** `inventory_sources.supplier_id` is a single
  location, so a drop that [locations](locations.md) mapped to several gets a row per location
  pointing at the **same** `file_path` — upload the file once. Keep the ids per
  location; [writes](writes.md) stamps each row with its own location's source id, and mixing
  them up attributes one farm's stock to another. Say in `notes` that the file is
  the company's shared list.
- **Never retire a supplier's previous sources.** Live `inventory` rows still
  point at them, and an inactive source blanks the app's derived
  `ingestion_date` for every row that references it.
- `file_path` is the bucket **object key** (e.g. `suppliers/<slug>/rate-cards/<file>`, no scheme — the app signs it on demand) or a full `http(s)://` URL. Never store a signed URL.
