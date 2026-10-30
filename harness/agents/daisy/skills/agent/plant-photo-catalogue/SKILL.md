---
name: plant-photo-catalogue
description: Catalogue, find, share or retire plant photos. Includes the prepare-photo and reclaim-orphans scripts, the rules for photos arriving with an availability drop or from the app's Photos page, and URL-only images. Use for any photo file handed over, a photo search/share request, or retiring photos. (v2.3.0)
metadata:
  author: lps
  version: "2.3.0"
---

# Plant photo catalogue

This skill owns every `plant_photos` row. Read only the part you need:

| Task | Read |
|---|---|
| Catalogue a photo file (also photos inside an availability drop, or sent from the Photos page) | [intake](artifacts/intake.md) |
| Search for or share a photo | [search and share](artifacts/search-share.md) |
| Retire a photo or reclaim storage | [retire](artifacts/retire.md) |
| Fix a row an app user edited, or an upload/insert error | [app edits and failures](artifacts/concurrent-edits.md) |

Always:

- Catalogue files someone handed us. An image that is only a URL stays a URL
  (`inventory.image_url` or the report); never download it.
- A photo is not a stock claim, and nothing next to it (the sheet, the email)
  tells you what it shows. Identity and size come from the photo's own evidence.
- Read the current row before writing; verify the saved row and file before
  reporting.
