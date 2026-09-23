## 6. Catalogue any plant photos in the drop

A drop that carries photographs of plants carries two things, not one. The sheet
becomes `inventory`; the photographs become `plant_photos`. **Do the inventory
first** — [locations](locations.md) has to have resolved the supplier before a photo can be attributed
to one, and QA has to have passed before you spend anything else on the drop.

**Follow the `plant-photo-catalogue` skill for the write itself** — hash,
dedupe on `sha256`, upload to the private bucket at an id-built path, insert.
Don't restate it and don't improvise it; that skill owns every `plant_photos`
row. What follows is only what *this* context adds.

### What the ingest knows that a bare photo doesn't

- **The supplier.** Use the location [locations](locations.md) resolved — but only when the drop mapped
  to **exactly one**. A file that fanned out to a company's five farms tells you
  the company, not which farm the photo was taken at, so leave `supplier_id`
  null unless the photo's own context names one. A null supplier is a working
  catalogue photo; a wrong one is worse than none.
- **The provenance.** `source` gets the channel and identifier the file came
  through — `Chris, Telegram main message 682, <ts>` or `<sender>, Gmail
  MessageId <id>, <ts>`. Whoever reads the photo later needs to find its origin
  without your transcript. It is always a *handover*, never a page address: a
  photo that only exists at a URL never gets a row at all (below).

### What the drop is *not* evidence for

**The sheet beside a photo says nothing about the photo.** This is the rule that
matters most here, because everything in the drop looks related:

- **Identity** comes from the photo's own evidence only — a label legible in the
  frame, the filename, or the email/message text naming what was sent. A photo
  attached to a 400-row availability sheet is not "about" those 400 rows, and it
  is not about the row that happens to sit nearest it in the file.
- **Size is stated or null.** It does **not** inherit the sheet's size column,
  and it is never read off how big the plant looks. If the body says "here's the
  30 G windmill palm", that is stated. If it says nothing, `size` and `size_std`
  are null.
- **No inventory link.** There is no link between a photo and an `inventory`
  row, by design — photos outlive the rows beside them. Don't invent one in
  `notes` either; write what the source said, not which row you think it matches.
- A photo is a **reference record, never an availability claim.** Cataloguing a
  supplier's photo does not mean they have it in stock, and nothing you write in
  [photos](photos.md) may read as though it does.

### Attached files only — a URL stays a URL

**We hold bytes only for photos someone handed us.** That is the line, and it is
about what we take a copy of, not about what we know:

| The photo arrived as | Do |
|---|---|
| an **attachment or file** — an email attachment, a Telegram photo, a file Chris gave you, anything already on disk from the brief | **Catalogue it.** Follow `plant-photo-catalogue`: hash, dedupe, upload, insert |
| a **URL** — an image on a supplier's availability page, a link in an email body, a photo on their site | **Capture the URL. Never download it.** No bucket object, no `plant_photos` row |

A photo on a supplier's website is theirs, sitting on their server, already
addressable. Copying it into our bucket takes a licence nobody has stated and
leaves us maintaining a duplicate that goes stale the day they replace it. The
link is the better record and costs nothing.

**Where a captured URL goes:**

- **On the plant it belongs to** — `inventory.image_url`, written in [writes](writes.md) with the
  rest of that row's values, when the page shows a photo for an offering you are
  ingesting. One URL per row; if the page shows several, take the one that
  depicts the offering.
- **Otherwise, in your report.** A gallery page, a general photo page, an image
  that maps to no row you wrote — the URL goes under *Photos* and nowhere else.
  Don't invent a `plant_photos` row without a file, and don't park a URL in
  `notes` to be found later.

**Never fetch an image in order to catalogue it.** Opening a page to read the
availability is normal; downloading its photographs so they can be uploaded to
our bucket is the thing this rule forbids. And **don't crawl** — you are reading
the page you were given, not surveying the site.

### Before you move on

```sql
SELECT id, name, size, size_std, supplier_id, tags, source
FROM plant_photos WHERE sha256 = ANY(ARRAY[<hashes from this drop>]);
```

Every image in the drop is accounted for by exactly one of four outcomes —
catalogued, skipped as a duplicate of an existing `sha256`, skipped as
not-a-plant, or **captured as a URL and not downloaded**. The report says which,
and the last one is the only outcome with nothing to show for it in this query,
which is why it has to be written down.
