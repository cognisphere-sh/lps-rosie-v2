# App edits and common failures

Signed-in users can edit a photo's name parts, size, height/width/caliper,
tags, caption and notes from `/photos`. They cannot change `supplier_id`,
`captured_at`, `source`, `storage_path`, `sha256` or derived columns. Read the
current row before writing and don't overwrite their edits; `updated_at`
later than `created_at` means someone changed it.

Editing `size` in the app clears `size_std`. Fix those:

```sql
select id, name, size, size_std from public.plant_photos
where is_active and size is not null and size_std is null;
update public.plant_photos set size_std = '<bucket>' where id = '<uuid>';
```

| Symptom | Cause |
|---|---|
| `InvalidMimeType` / HTTP 415 on upload | You uploaded the original. The bucket takes WebP only (max 8 MB); upload `prepared`. |
| 4xx on size | `prepare-photo` was skipped or `--max-edge` raised. |
| `prepare-photo` exits 3 | Not an image, truncated, or unsupported. HEIC needs `pillow-heif` (`bash bootstrap/bootstrap.sh`). |
| `plant_photos_sha256_idx` violation | Already catalogued; dedupe was skipped. |
| `..._object_idx` violation | That path already has a row; UUID reused. |
| Row exists, image broken in `/photos` | Upload failed or `storage_path` doesn't match. |
| Search misses a new photo | Check `is_active` and that the term is in name/size/caption/tags/notes. |
| Written `name` changed | `name` is derived; write the three parts. |
