# Retiring photos and reclaiming storage

**Retire** (soft delete; `DELETE` is blocked on purpose):
`update public.plant_photos set is_active = false where id = '<uuid>';`
Restore with `is_active = true`. Leave the file in the bucket unless someone
asks for it to be destroyed for a rights or privacy reason.

App users can also retire photos from `/photos`. A photo you expect but can't
find: check `select id, name, is_active, updated_at from public.plant_photos where sha256 = '<hash>';`
before assuming the insert failed. Retiring a supplier or inventory does not
retire photos.

**Reclaiming storage** (`scripts/reclaim-orphans`, reads
`plant_photo_reclaimable`, which never returns an active photo's file):

```sh
skills/agent/plant-photo-catalogue/scripts/reclaim-orphans                  # dry run, 30-day grace
skills/agent/plant-photo-catalogue/scripts/reclaim-orphans --reason orphan  # uploads with no row
skills/agent/plant-photo-catalogue/scripts/reclaim-orphans --delete         # actually deletes
```

- `orphan` (upload with no row) is safe to sweep. `retired` (a soft-deleted
  photo's file) removes someone's undo: only with their say-so.
- Deleting makes retirement permanent. Keep the default grace; under a day
  needs `--force`. (On 2026-08-16 a `--older-than-days 0 --delete --force` run
  took a real retired photo.)
- Any `--delete` needs Chris's or Bhoumik's yes: report the dry run and let
  them decide.
