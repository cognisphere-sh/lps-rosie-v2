# Cataloguing a photo

A catalogued photo says "this is what the plant looks like", never "this
supplier has it in stock". Rows live in `public.plant_photos`; bytes in the
**private** `plant-photos` bucket. The app shows them at `/photos` and uses
the same `search_plant_photos` RPC as you.

## What gets catalogued

- **Files someone handed us** (email attachment, Telegram photo, a file from
  Chris) → catalogue them.
- **A photo that only exists at a URL** (supplier website, link in an email) →
  never download it. If it shows an offering you are ingesting, write the URL
  to that row's `inventory.image_url` (one per row, the one that shows the
  offering). Otherwise list the URL in your report. No `plant_photos` row, no
  URL in `notes`, no crawling the site.

## Steps

1. **Prepare:** `skills/agent/plant-photo-catalogue/scripts/prepare-photo <file>`.
   It prints JSON; its column-named fields are the column values. It strips
   metadata (including GPS), fixes rotation, caps the long edge at 2048 px and
   makes a WebP. Upload `prepared`, never the original. Exit 3 = not an image
   we accept: say so and stop. Mention a big `saved_pct` and anything in its
   `notes` in the report.
2. **Dedupe:** `select id, name, source from public.plant_photos where sha256 = '<sha256>';`
   (`sha256` is of the file we were handed, on purpose). A hit → don't upload;
   append the new origin:
   `update public.plant_photos set source = source || ' | also received: <who, channel, when>' where id = '<uuid>';`
   Two different photos of the same plant are two rows.
3. **Upload:** make a UUID and use it for both the object name and row id.
   Path `suppliers/<supplier-id>/YYYY/MM/<uuid>.webp`, or
   `unassigned/YYYY/MM/<uuid>.webp` with no supplier (YYYY/MM = when received;
   ids, never names).

   ```sh
   scripts/agent/supabase/upload --bucket plant-photos \
     --path suppliers/1/2026/08/<uuid>.webp --file <prepared> \
     --content-type image/webp --no-upsert
   ```

4. **Insert:**

   ```sql
   insert into public.plant_photos (
     id, storage_path, mime_type, byte_size, image_width, image_height, sha256,
     supplier_id, common_name, botanical_name, cultivar_variety_trade_name,
     size, size_std, height, width, caliper, tags, caption, notes, source, captured_at
   ) values ('<uuid>', 'suppliers/1/2026/08/<uuid>.webp', 'image/webp', 337582,
     1280, 964, '<sha256>', 1, 'Windmill Palm', 'Trachycarpus fortunei', null,
     '30 G', '30G', '4-5 ft', null, null, array['label'], '<what is visible>',
     '<what is unresolved>', 'Chris, Telegram main message 682, 2026-08-12 08:56 CDT', null);
   ```

5. **Confirm:** `select id, name, size, tags, supplier_id from public.plant_photos where id = '<uuid>';`
   Report what was catalogued, what stayed unknown and why, and any conflict
   you kept.

## What each field may hold

- **Name parts, `size`/`size_std`, `height`/`width`/`caliper`:** the same rules
  as inventory (`availability-ingestion` → [fields](../../availability-ingestion/artifacts/fields.md)),
  and only from the photo's own evidence: a readable label, the filename, or
  what the sender wrote. Never judge size from how the plant looks. No
  evidence → NULL. Photos have no `*_std` dimension columns. Never write
  `name` or `*_key`.
- **`supplier_id`:** Chris-provided plant photos default to Austin Plant Supply (APS) unless he explicitly names another supplier; do not repeatedly ask (Chris, Telegram 1316, 2026-09-30: “if I don’t explicitly say, its APS.”). This default applies only to Chris's photo submissions, not arbitrary email photos. Otherwise set a supplier only when someone said which supplier it is; NULL is fine.
- **`tags`:** short terms; reuse existing ones first
  (`select distinct unnest(tags) from public.plant_photos where is_active order by 1;`).
  Starter set: `nursery`, `field`, `container`, `box`, `root ball`, `label`,
  `multi-stem`, `red foliage`.
- **`caption`:** what is visible, plainly.
- **`notes`:** what is not known, and conflicts kept side by side (label says
  `25 Gallon`, Chris says `30 G` → `size` = Chris's value, the label in notes).
- **`source`:** who handed it over, channel, message id, time.
- **`captured_at`:** when the photo was taken, only if known; never "now".

## Photos from an ingest

Finish the inventory and its QA first. Then:

- **Supplier:** the location the drop resolved to, only when it mapped to
  exactly **one** location. A company-wide list → `supplier_id` NULL unless
  the photo itself names the farm.
- **Source:** `<sender>, Gmail MessageId <id>, <time>`.
- The sheet next to a photo says nothing about the photo: no identity, no size,
  no link to an inventory row (there is no such column) from the sheet.
- Account for every image in the report: catalogued (ids), duplicate of an
  existing `sha256`, not a plant (logo etc.), or URL captured (row it went to,
  or the URL itself).
- Check: `SELECT id, name, size, size_std, supplier_id, tags, source FROM plant_photos WHERE sha256 = ANY(ARRAY[<hashes>]);`

## Photos from the Photos page

The app's Photos page has a camera and an attach button. They send the photos
to the **`photo-catalogue`** thread as one web message with only attachments,
from the signed-in team member (`SenderName`). Do the whole job in that thread;
no task threads.

- Catalogue every attachment with the steps above, in order.
- **Source:** `<SenderName>, Photos page (photo-catalogue message <MessageId>), <time>`.
- **Supplier:** Chris's photos default to APS as above; anyone else's stay
  NULL unless they name one.
- **Identity:** a camera photo often has no label. Catalogue it with what the
  photo shows (NULL name parts, caption, tags), then ask **once** for the whole
  batch with `webchat-cli ask` — what each unlabelled plant is, offering your
  best guesses as choices. Write the answer to the rows (it is "what the sender
  wrote"; set `source` accordingly) and verify.
- Reply once in the thread: each photo's name (or *unidentified*) and id,
  duplicates, and anything rejected (`prepare-photo` exit 3). Later messages in
  this thread are answers or corrections; apply them to the rows you made.
