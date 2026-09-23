## 3. Retiring a photo

Soft delete, like everything else in this schema. `query` blocks `DELETE`, and
that is correct — a retired photo is a record that it was rejected.

```sql
update public.plant_photos set is_active = false where id = '<uuid>';
```

Retired rows leave search and the `/photos` grid immediately. **Leave the object
in the bucket** unless someone asks for it to be destroyed for a rights or
privacy reason; deleting bytes is not reversible and the row still points at
them.

### Reclaiming the bytes behind retired photos

Those objects are never reclaimed automatically, so they accumulate. The sweep:

```sh
skills/agent/plant-photo-catalogue/scripts/reclaim-orphans              # dry run, 30-day grace
skills/agent/plant-photo-catalogue/scripts/reclaim-orphans --reason orphan
skills/agent/plant-photo-catalogue/scripts/reclaim-orphans --delete     # actually remove
```

**Dry run is the default and nothing is deleted without `--delete`.** It reads
`plant_photo_reclaimable(older_than_days)` (migration 0054), which is where the
safety rule lives: **an object belonging to an active photo can never be
returned**, however the script is called.

Two kinds come back, and they deserve different treatment:

| `reason` | What it is | Sweeping it |
|---|---|---|
| `orphan` | no row at all — an upload whose insert then failed | **safe.** Nobody has ever seen it and nothing can |
| `retired` | a soft-deleted photo's object; the row survives as a tombstone | **destroys someone's undo.** Only with their say-so |

`--reason orphan` sweeps just the first kind. Reach for it by default: it is the
housekeeping half, and it cannot cost anyone a photo they wanted back.

> ⚠ **Reclaiming makes retirement permanent.** The row keeps its
> `storage_path`, so reactivating a photo whose bytes were swept gives a broken
> image with no way back. The grace period is the only protection — 30 days by
> default, and under a day needs `--force`.
>
> This is not hypothetical: on 2026-08-16 a `--older-than-days 0 --delete
> --force` run intended for two test orphans took a real retired photo with it.
> It was restorable **only** because the intake original was still on disk. Scope
> the sweep with `--reason`, and prefer the default grace.

**Deleting is still a deliberate act needing approval** — report what the dry run
found and let Chris or Bhoumik decide, rather than sweeping because the list was
long.

Retiring a supplier does **not** retire its photos, and neither does retiring
inventory. That is deliberate — a photo is evidence of what a plant looks like,
not a claim about stock.

**Anyone signed into the app can do this too**, from the delete control on each
card at `/photos`. It runs the same soft delete. So a photo you catalogued may
be gone without a word to you — if one you expect is missing, check
`is_active = false` before assuming the insert failed:

```sql
select id, name, is_active, updated_at from public.plant_photos
where sha256 = '<hash>';
```

Restoring one is `set is_active = true`, which `query` allows.
