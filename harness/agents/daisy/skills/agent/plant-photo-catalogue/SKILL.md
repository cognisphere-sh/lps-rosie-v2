---
name: plant-photo-catalogue
description: Catalogue, find, share or retire plant photos. Includes prepare-photo and orphan-reclaim scripts, private storage and concurrency rules. Use for attached photos or catalogue requests. (v1.7.0)
metadata:
  author: lps
  version: "1.7.0"
---

# Plant photo catalogue

Use `database-access` for the needed schema. Read only the matching task:

| Task | Read |
|---|---|
| Normalize/dedupe/upload attached photo | [storage](artifacts/storage.md), [intake](artifacts/intake.md) |
| Search or share an existing photo | [search/share](artifacts/search-share.md) |
| Retire a record or reclaim objects | [retirement](artifacts/retire.md) |
| Write when app users may have edited | [concurrent edits and failures](artifacts/concurrent-edits.md) |

Use existing `scripts/prepare-photo` for normalization and `scripts/reclaim-orphans`
only under the retirement procedure. Catalogue attached files; image URLs stay
URLs and are never downloaded into the bucket. Read current rows before writes,
preserve manual edits and verify the resulting record/object before reporting.
