# Cataloguing and searching plant photos

Read the relevant schema with `database-access` before writing queries.

A catalogued photo is a **reference record**, not an availability record. It
says "this is what this plant looks like", never "this supplier has this in
stock right now". Nothing here writes to `inventory`, and a photo outlives the
inventory rows it was taken beside.

Everything lives in two places:

| Where | What |
|---|---|
| `public.plant_photos` | one row per catalogued photo — identity, size, supplier, tags, provenance, timestamps |
| `plant-photos` bucket | the image bytes. **Private** — unlike `lps`, an object key is not fetchable |

The web app shows the same rows at **`/photos`** and signs each image through
its own `/api/photos/<id>/image`. You and the app use the **same RPC**; there is
no agent-only photo search.

---
