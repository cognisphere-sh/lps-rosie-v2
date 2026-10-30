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

The app's Photos page has a camera and an attach button. The sender must write
a note saying what the photos are (plant name, size, supplier…). The app
catalogues each photo **itself** as soon as it is uploaded: it does what
`prepare-photo`, dedupe, upload and insert do, under
`unassigned/YYYY/MM/<uuid>.webp`, with only `source` filled
(`<sender>, Photos page, <time> UTC, note: “<note>”`). Then it sends one message
to the **`photo-catalogue`** thread: the note, then the row ids
(`(already in the catalogue)` marks a duplicate; the app appended
`also received` to its `source`).

### The `photo-catalogue` thread: one task thread per photo

Each photo is an independent task. For every id in the message, start a task
thread `photo-catalogue-§-[TASK]-§-photo-<first 8 characters of the id>` (base
prompt → Task threads). The brief: the task-thread declaration, "Follow
`plant-photo-catalogue` → intake, *One photo's task thread*", the row id,
whether it is a duplicate, the sender (`SenderName`), the web `MessageId` and
the note verbatim. Log each one under `## Tasks` in this thread's `notes.md`
(slug, row id, status), then end the turn; don't look at the photos here.

As reports come in, update `## Tasks`. When every task of a message has
reported (done, or waiting on Chris), reply once in the web thread: each
photo's name (or *unidentified*) and id, duplicates, and what is waiting on
Chris. When a waiting one finishes later, one short line. Later web messages
in this thread are answers or corrections: pass each to the task thread of the
photo it is about.

### One photo's task thread

- **Don't prepare, upload or insert again**, and don't move the object. Fill in
  the existing row with an `update` by `id`.
- **Look at the photo:** `scripts/agent/supabase/sign-url --bucket plant-photos --path <storage_path> --expiry 600`,
  download it to `/tmp`, and read it.
- **Fields:** the rules above. The note is "what the sender wrote": name parts,
  size/dimensions and supplier come from it or from a readable label in the
  photo. `caption`, `tags` and `notes` as usual. If the note covers several
  photos and you can't tell which part is this one, that part is missing. A
  duplicate: leave its fields alone unless the note adds something it lacks.
- **Supplier:** from the note. Chris's photos default to APS as above; anyone
  else's with no supplier named is missing.
- **Missing name, size or supplier:** write what is known (unknown stays NULL),
  then ask Chris **once** through `main`, which owns Telegram:

  ```sh
  bash scripts/agent-msg/send --to-agent daisy --thread-id main --message '<question>'
  ```

  First line: "Photo catalogue question for Chris — send on Telegram with the
  photo, and send his answer back to `<this thread id>`." Then, in plain short
  lines: who sent it, the photo id, the path of your `/tmp` copy (main sends
  it with `telegram-cli send-file --type photo`), what is known and what is
  missing. Report to the parent that you are
  waiting on Chris and end the turn. When main forwards his answer, write it to
  the row, append `| <field>: Chris, Telegram main message <id>` to `source`.
- **Check:** `select id, name, size, supplier_id, tags, source from public.plant_photos where id = '<uuid>';`
- **Report** to `photo-catalogue` with `--silent` unless something is waiting
  on Chris: the name (or *unidentified*), id, what was filled and what is still
  NULL.
