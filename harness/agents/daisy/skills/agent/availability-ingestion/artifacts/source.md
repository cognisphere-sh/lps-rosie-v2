# The source — what arrived, has it changed, and how to read it

## 1. What kind of receipt is it?

| It arrived as | Treat it as | Dates |
|---|---|---|
| A router forward or a raw `email_received` on this thread | **Current drop** (the default) | Received time = the email's `ReceivedAt`. |
| A file, image or link from Chris/Bhoumik (via main or the panel) | **Manual current receipt** | Received time = the handoff timestamp. An old printed date (e.g. `2023`) does **not** make it historical. |
| A brief that says **historical** or **backfill** | **Historical** — see "Historical backfill" below | Effective date if printed, else received time. |
| A list that says it starts later ("effective Oct 5") | **Future-dated** — not effective yet | Store the file now; ingest on the effective date via a one-shot `scheduler-cli add --once --thread-id <supplier thread>`. |

Read the email yourself: `scripts/gws/email read <MessageId> --attachments`
(files land in `plugins/gws/inbox/<MessageId>/`). The body is part of the
source: it can change prices, name a farm, drop a tab, or identify a photo.

**Manual current receipt:** in each new `inventory_sources.notes` write the
channel/identifier, the handoff time and every printed date word for word. In
each written row's `internal_notes` add a dated line: manually received at
<time>, printed date "<date>", availability and price need confirmation. It
still wins over older data like any current drop.

## 2. Has it changed since the last good ingest?

Run before any expensive conversion on a recurring source. It only compares
fingerprints; it never proves stock.

1. Resolve the locations first ([locations](locations.md)). Use one scope key
   per location/channel/type, e.g. `farm:24|weekly-list|current`.
2. Put the whole effective source in `/tmp`: every attachment, plus a text file
   with the body changes, printed dates, receipt type and scope. Don't hash only
   your parsed output. A changed body is a changed source.
3. Check:

   ```sh
   skills/agent/availability-ingestion/scripts/source-check check \
     --scope 'farm:24|weekly-list|current' \
     --file /tmp/receipt-context.txt --file /tmp/list.pdf \
     --state workspace/threads/<ThreadId>/files/source-receipt.json
   ```

   - `process` → ingest normally.
   - `unchanged` → no database writes. Report the skip with the earlier source
     ids; don't claim fresh stock. If Chris asks to re-ingest anyway, do it.
   - The fingerprint includes this skill's text, so a rule change forces a
     fresh ingest.
4. Record a receipt **only after everything succeeded** (rows, photos, QA).
   Write `{"verified":true,"source_ids":["<uuid>"],"summary":"<per-location result>"}`
   to `/tmp/ingest-evidence.json`, then run the same command with `record`,
   `--expected '<fingerprint from check>'` and `--evidence /tmp/ingest-evidence.json`.
   Failed, partial, skipped-historical or photo-only work records nothing.
   One ingest per scope at a time.

## 3. Historical backfill — later-date check per farm

Only when the brief says historical/backfill.

1. Resolve each farm to its own numeric `supplier_id` ([locations](locations.md)).
   A head branch, sender or sister farm never stands in for another farm. If a
   farm or the incoming date is unclear, stop and report it.
2. For each farm, look for a later active source at **that farm only** (never
   through `head_branch_id`):

   ```sql
   SELECT id, created_at, file_path, notes FROM inventory_sources
   WHERE supplier_id = <farm_id> AND is_active
     AND created_at > '<incoming ISO timestamp>'::timestamptz
   ORDER BY created_at DESC;
   ```

3. Found one → skip that farm entirely (no source, row, alias, photo, contact or
   upload writes) and record: incoming date and basis, farm id, the later
   source id/date/path, "Skipped — later availability already exists".
   None → ingest that farm normally. One mixed drop can skip some farms and
   ingest others. Example: a later Mill Creek (1231) source skips Mill Creek
   only, never Escondido (1395).
4. `scripts/historical-backfill-gate` is retired; don't use it.

## 4. Convert and read it — one page at a time

(Chris, 2026-09-25, after missed Austin Plant Supply rows.)

**First survey the whole source** for scope: count pages, sheets and
attachments; read headers, footers, farm names and body notes. This decides
locations; it is not the parse.

**Then work page by page.** For each page, before starting the next:

1. Compare the extracted text with the original page (render it and look).
2. List every line: plant offerings (plant × size/grade) and non-plant lines
   (headings, totals, terms, footnotes).
3. Join wrapped names and page-break continuations to the plant they belong
   to; count that offering once, on the page where it starts.
4. Split one printed line into separate offerings only when it really lists
   separate sizes/grades; note the split. Never merge grades or invent an
   offering from a heading.
5. Normalize the page ([fields](fields.md)) and match it against the location's
   existing rows and earlier pages' decisions ([write](write.md)), so repeats
   don't become duplicates.
6. Keep a page ledger: page number, plant lines, offerings, non-plant lines,
   splits, continuations, unclear rows, location evidence, and the
   update/insert/reactivate/park decision for each offering.

Stage decisions; commit once, after whole-source QA ([qa](qa.md)). A plant
missing from a page or from the new list is **not** retired and not proof of
anything.

**Converters:**

- Text PDF, xlsx, docx → `scripts/agent/markitdown <file>` first. Don't start
  with `pdftotext` or a custom parser because the text looks tidy. Unclear
  rows → check the page image, don't guess.
- Scanned/image PDF → `pdftoppm -png` and read the images row by row.
  `pdftotext -layout` only as a check when a text layer exists.
- **Workbooks:** markitdown writes each sheet under `## <sheet name>`. Check
  every heading against the workbook's tabs. Watch for: hidden sheets (last
  season's tab is not a location), a title row pushed into the header (header
  cell = sheet title or `Unnamed: 1`), and empty sheets that still print a
  one-cell table. Parse every sheet you include.
- A link in the body that may hold the list → open it (`markitdown` or
  `scripts/agent/agent-browser`); download a linked file and look before
  calling it irrelevant.
- Scratch files (converted text, page images, parse output) go in `/tmp`.

**Images — decide what each one is first:**

| It is | Do |
|---|---|
| A photo or scan of a price list or screen | A source: read it like a scanned page. |
| A photo of a plant (pot, field, truck, label) | A catalogue photo: `plant-photo-catalogue` → "Photos from an ingest". |
| Logo, signature, banner, icon, map, letterhead, portrait | Skip. Usually under 200 px or 20 KB, named `logo`, `sig`, `banner`, `icon`, `header`, `image001`. Check size first. |

A label photo with the plant behind it is both: parse it and catalogue it. An
image that only exists as a URL is never downloaded (see the photo skill).

## 5. Unclear things

Pick the best-supported reading, write it, and note why in `internal_notes`
or thread notes. A missing price, an unclear size or an odd section are not
questions. Park only real blockers (see `1-agent.md` → "What needs a yes"), and
keep working on everything else.
