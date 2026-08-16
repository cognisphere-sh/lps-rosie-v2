---
name: plant-photo-catalogue
description: Catalogue a plant photo into the searchable photo catalogue, and search it. Covers the `plant_photos` table and the private `plant-photos` bucket, its identity/size columns being `inventory`'s (so the alias graph and the `name_key` join both work), the intake checklist (hash, dimensions, MIME, dedupe by SHA-256), the object-path convention, what may and may not be written into a photo's identity/size/supplier fields, where photos come from — **attached files only**, so a photo that exists as a URL is never downloaded and the URL is captured instead (inventory.image_url, or the report) — the `search_plant_photos` RPC with its filters and how it differs from `search_inventory`, sharing a photo with a signed URL, retiring one, and what app users can change under you from the /photos lightbox (metadata yes, provenance and attribution no) including the size_std repair their size edits leave behind. Use when Chris, Bhoumik or a thread sends a plant photo, asks to "catalogue this photo", "add this to the photo library / visual plant library", "find a photo of <plant>", "what does <plant> look like", "do we have photos from <supplier>", or asks about the /photos page. (v1.4.0)
metadata:
  author: lps
  version: "1.4.0"
---

# Cataloguing and searching plant photos

Read `knowledge/files/SCHEMA.md` before writing any query.

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

## 1. Cataloguing a photo

### Step 1 — file facts, before anything else

Cheap work first. Compute these from the file on disk:

```sh
sha256sum <file> | cut -d' ' -f1     # exact-duplicate key
stat -c%s <file>                     # byte size
file -b --mime-type <file>           # must be image/jpeg|png|webp|heic|heif
```

Pixel dimensions come from the file too (any image tool, or the JPEG SOF
header). The bucket rejects anything over **25 MB** or outside those MIME
types, so a bad file fails at upload rather than after you have written a row.

### Step 2 — dedupe on the hash

```sql
select id, name, source from public.plant_photos where sha256 = '<hash>';
```

**A hit means do not upload again.** The same file arriving twice is one object
and one row. Append the new origin to `source` instead:

```sql
update public.plant_photos
set source = source || ' | also received: <who, channel, when>'
where id = '<uuid>';
```

If the *same plant* was photographed twice, those are two different files with
two different hashes — two rows. That is correct.

### Step 3 — upload to the private bucket

Generate the photo's UUID first and use it for both the object name and the
row id, so the path and the record can never drift apart.

```
suppliers/<supplier-id>/YYYY/MM/<uuid>.<ext>     when a supplier is known
unassigned/YYYY/MM/<uuid>.<ext>                  when one is not
```

`YYYY/MM` is when we **received** it. The path is built from ids, never from a
supplier name — names get edited, paths do not.

```sh
scripts/agent/supabase/upload \
  --bucket plant-photos \
  --path suppliers/1/2026/08/<uuid>.jpg \
  --file <local-file> \
  --content-type image/jpeg \
  --no-upsert
```

`--no-upsert` is deliberate: with a fresh UUID an "already exists" error means
something is wrong, and silently overwriting an object would be worse.

### Step 4 — insert the row

```sql
insert into public.plant_photos (
  id, storage_path, mime_type, byte_size, image_width, image_height, sha256,
  supplier_id, common_name, botanical_name, cultivar_variety_trade_name,
  size, size_std, height, width, caliper, tags, caption, notes, source, captured_at
) values (
  '<uuid>', 'suppliers/1/2026/08/<uuid>.jpg', 'image/jpeg', 171530, 1280, 964,
  '<sha256>', 1, 'Windmill Palm', 'Trachycarpus fortunei', null,
  '30 G', '30G', '4-5 ft', null, null,
  array['label'], '<what is visible>', '<what is unresolved>',
  'Chris, Telegram main message 682, 2026-08-12 08:56 CDT', null
);
```

`name`, `name_key`, `common_name_key`, `botanical_name_key` and `cultivar_keys`
are **derived** — never write them. Tags are lowercased, trimmed, deduped and
sorted for you.

> **Identity and size are `inventory`'s columns, on purpose.** Same three name
> parts, same derived `name` and keys, same `size` / `size_std`. So every rule
> you already follow on an inventory row applies here unchanged, the alias graph
> reaches photos the same way, and the two tables join on `name_key`:
> ```sql
> select inv.id, ph.id as photo_id
> from public.inventory inv
> join public.plant_photos ph on ph.name_key = inv.name_key and ph.is_active
> where inv.supplier_id = 1 and inv.is_active;
> ```
> `name_key` is the **whole composed identity** (`crapemyrtlelagerstroemianatchez`),
> so it answers "is there a photo of *this row*". To ask "do we already have a
> photo of this plant", use the part keys or `search_plant_photos` — the bare
> `normalize_plant_key('Crape Myrtle')` matches nothing.
>
> The one column `inventory` has and photos do not: `height_std` / `width_std` /
> `caliper_std`. Photos keep the raw text only.

#### What each field may hold

- **The three name parts** — each holds only what a source actually said, the
  same rule as `inventory`. `name` is composed from them.
- **`size` / `size_std`** — only from an explicit statement: a printed label, a
  price list, or someone telling you. Run `size` through `normalize_size()` and
  write `size_std` alongside (`<N>G`, `<N>" Box`, a word grade, or `other`).
  **Never infer size from how big the plant looks in the frame.** No evidence
  means both stay null.
- **`height` / `width` / `caliper`** — same rule. Stated, or null.
- **`supplier_id`** — only when someone said which supplier it is. A photo with
  no supplier is a perfectly good catalogue photo; guessing one is worse than
  leaving it blank.
- **`tags`** — short descriptive terms. Reuse what the catalogue already has
  before inventing one:
  ```sql
  select distinct unnest(tags) tag from public.plant_photos where is_active order by 1;
  ```
  The starter vocabulary is context (`nursery`, `field`), production form
  (`container`, `box`, `root ball`), and features (`label`, `multi-stem`,
  `red foliage`).
- **`caption`** — what is visibly in the frame, described plainly.
- **`notes`** — what is *not* established: the unknowns, and any conflict
  between sources. Conflicts are preserved, never reconciled — if a label says
  `25 Gallon` and Chris says catalogue it as `30 G`, record the instruction in
  `size` and say so in `notes`. Do not overwrite one with the other.
- **`source`** — verbatim provenance: who handed us the file, through which
  channel, which message, when. Every row has one, because every row is a file
  someone gave us.
- **`captured_at`** — when the photo was **taken**, and only if you know. It is
  not "now"; `created_at` already records when we received it. Leave it null
  rather than guessing — freshness is read off this column.

### Where photos come from — attachments only

Most photos arrive during an ingest. `availability-ingestion` §6 sorts the
drop's images and hands the plant ones here; it also supplies the two things a
bare file can't carry — the supplier its §0 resolved (**only** when the drop
mapped to exactly one location) and the drop's provenance string. Everything
about *how* the row is written is still this skill's.

**Every row in this table is a file someone handed us.** An email attachment, a
Telegram photo, a file Chris gave you. That is the whole admission rule, and it
is what makes the rest of the schema honest: `sha256` describes bytes we hold,
`storage_path` points at an object in our bucket, and the app signs it.

**A photo that exists as a URL is not catalogued here — the URL is captured
instead.** Never download an image in order to insert it. A photo on a
supplier's site is theirs, on their server, already addressable; copying it in
takes a licence nobody has stated and leaves us maintaining a duplicate that
goes stale the day they replace it. The link is the better record.

So if you are ever handed a URL and asked to catalogue "that photo":

- Belongs to an inventory row? It goes in **`inventory.image_url`**, which is a
  link column — `availability-ingestion` §4 writes it.
- Belongs to nothing yet? Report the URL. Don't create a row here with an
  invented `storage_path`, and don't park it in `notes`.
- Someone **sends** you that same image as a file later? Then it is an
  attachment and this skill applies normally.

**The rest of the drop is not evidence about the photo.** A photo that arrived
beside a 400-row availability sheet is not about those 400 rows, does not inherit
the sheet's size column, and gets no link to an `inventory` row — there is no
such column, by design. Identity and size come from the photo's own evidence: a label in the
frame, the filename, or what the sender wrote.

### Step 5 — confirm

```sql
select id, name, size, tags, supplier_id from public.plant_photos where id = '<uuid>';
```

Then say what was catalogued, what was left unknown and why, and any
discrepancy you preserved.

---

## 2. Searching the catalogue

```sql
select id, name, supplier_name, size, tags, relevance
from public.search_plant_photos('windmill palm')
order by relevance desc limit 20;
```

**It behaves exactly like `search_inventory`**, over a different document — read
the `plant-and-supplier-search` skill for how the ranking thinks. In short:

- The document is **name + size + caption + tags + notes**.
- Typo tolerant, matches **partially at both ends**, and expands your terms
  through `plant_aliases` — so `Chusan Palm` finds a photo catalogued as
  *Trachycarpus fortunei* even though those words appear nowhere on it.
- **Ranked, not filtered.** Results are everything matching *any* term; read
  `relevance` and the top of the list, don't report the row count as "how many
  photos we have".
- A typed size **ranks** rather than filters: `30g palm` puts 30 G palms on top
  without removing the others.
- **An empty `search` returns nothing.** To *list* rather than search, select
  from `plant_photos` directly with an `ORDER BY` and a `LIMIT`.

Two parameters, neither a filter. Scope and filter **over** the result — the
same columns the `/photos` page offers as dropdowns:

```sql
select * from public.search_plant_photos('maple')
where supplier_id = 1
  and size_std = '36" Box'
  and cultivar_keys && array['bloodgood']   -- normalized, never the display name
  and tags && array['nursery'];
```

The one difference from `search_inventory`: photos join `suppliers` **LEFT**,
so `supplier_name` is null on an unattributed photo rather than the photo being
missing. Never write `where supplier_name is not null` unless you mean it.

### Sharing a photo

The bucket is private, so paste a signed link — never a bucket URL, which will
not load:

```sh
scripts/agent/supabase/sign-url --bucket plant-photos \
  --path suppliers/1/2026/08/<uuid>.jpg --expiry 604800
```

For a person already signed into the app, `https://<app>/photos?q=<plant>` is
better than a link to one file — it gives them the whole match set.

---

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
| Upload returns 4xx immediately | file over 25 MB, or a MIME type the bucket does not allow |
| `duplicate key value violates unique constraint "plant_photos_sha256_idx"` | this exact file is already catalogued — step 2 was skipped |
| `..._object_idx` violation | that object path already has a row; you reused a UUID |
| Row inserted but `/photos` shows a broken image | the upload did not happen, or `storage_path` does not match the object |
| Search finds nothing for a plant you just catalogued | check `is_active`, and check the term is in name/size/caption/tags/notes — height and caliper are **not** in the search document |
| A written `name` reappears as something else | `name` is derived; write the three parts |
