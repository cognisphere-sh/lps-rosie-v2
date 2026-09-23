## 4. What app users can change under you

The `/photos` lightbox has a pencil, and it writes to the same row you did. A
signed-in user can edit the **three name parts, size, height/width/caliper,
tags, caption and notes** — so a photo's metadata is not yours alone once it is
catalogued, and `updated_at` moving without a note from you is normal.

They cannot touch `supplier_id`, `captured_at`, `source`, `storage_path`,
`sha256` or anything derived: attribution and provenance stay cataloguing
decisions, which means **your `source` line and supplier attribution are safe**,
and a photo whose identity looks wrong was either catalogued that way or
corrected in the app — `updated_at` against `created_at` tells you which.

One consequence to know: **editing `size` in the app nulls `size_std`**, by the
same rule that invalidates a standardized dimension when its source text is
hand-edited. The photo drops out of the Size filter until someone sets the
bucket. Repairing that is yours:

```sql
select id, name, size, size_std from public.plant_photos
where is_active and size is not null and size_std is null;

update public.plant_photos
set size_std = '<bucket>'   -- <N>G, <N>" Box, a word grade, or other
where id = '<uuid>';
```

---

## Failure modes

| Symptom | Cause |
|---|---|
| Upload returns `InvalidMimeType` / HTTP 415 | you uploaded the source instead of `prepared` — the bucket takes `image/webp` only (0053). Re-run step 1 and upload its `prepared` path |
| Upload returns 4xx on size | over 8 MB, which a 2048px WebP never is — the normaliser was skipped or its `--max-edge` was raised |
| `prepare-photo` exits 3 | not an image, truncated, or a format we do not accept. HEIC needs `pillow-heif`; re-run `bash bootstrap/bootstrap.sh` if it is missing |
| `duplicate key value violates unique constraint "plant_photos_sha256_idx"` | this exact file is already catalogued — step 2 was skipped |
| `..._object_idx` violation | that object path already has a row; you reused a UUID |
| Row inserted but `/photos` shows a broken image | the upload did not happen, or `storage_path` does not match the object |
| Search finds nothing for a plant you just catalogued | check `is_active`, and check the term is in name/size/caption/tags/notes — height and caliper are **not** in the search document |
| A written `name` reappears as something else | `name` is derived; write the three parts |
