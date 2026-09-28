## 1. Acquire and convert the source

**Paginated sources — one page at a time.** First enumerate the complete
source's pages (and any separate attachments/sheets), inspect headers, footers,
location statements and email amendments across the *whole* source for scope;
this is not permission to parse all offerings in one pass. For each page in
order, compare the approved extraction with the original rendered page, then
build a page ledger of logical plant × size/grade offerings. Account explicitly
for headings, footnotes, totals, terms and other nonplant lines (not inventory).
Join wrapped descriptions and page-break continuations to their originating
plant; if the next page is needed to finish a line, inspect just that boundary
before closing the current page, count the offering **once** on its originating
page, and don't treat the continuation as a second plant. Split genuinely
separate size/grade offerings on a printed line and note the split; do not
silently collapse grades into one row or manufacture an offering from a heading.
For each page record its original page number, raw plant lines, logical offerings,
nonplant/excluded lines, splits, continuations, uncertain rows and location
assignment evidence. Normalize, match against the correct location's existing
rows and resolve update/insert/reactivation/park decisions for **every** offering
on that page before starting the next; [writes](writes.md) specifies the matching
checks. Check repeated entries across pages against the current page ledger and
prior pages rather than blindly creating duplicates. Do not interpret absence
from a page or the new source as a retirement or as proof of an older row's
current availability. Keep page decisions staged for whole-source QA and commit
under [qa](qa.md). Finally sum page ledgers by location, reconcile the aggregate
against every page/section and the complete source (including any exclusions),
and only then attest successful coverage. Unresolved material ambiguity is
parked with evidence, not guessed.

- **Text-based PDFs:** use `scripts/agent/markitdown <file>` as the primary extractor and inspect its Markdown tables/continuation lines before parsing. Do not default to `pdftotext` or write an ad hoc custom PDF parser merely because fixed-width text looks usable. If MarkItDown leaves wrapped/ambiguous rows, preserve the extracted evidence and resolve it with visual row-level review rather than a heuristic that can silently cross or drop cells.
- **Scanned/image-only PDFs:** `pdftotext` cannot OCR pixels unless the file already contains a hidden text layer. Render with `pdftoppm -png`, then use image reading/OCR/vision with page- and row-level visual checks. `pdftotext -layout` may be used only as a diagnostic/fallback when an actual text layer exists, not as the primary parser for scans.
- **Other attachments:** use `scripts/agent/markitdown <file>` for xlsx/docx and supported office formats. Avoid one-off custom parsers when the standard converter preserves the source structure; if conversion remains ambiguous, retain raw evidence and flag the affected rows instead of guessing.
- **Workbooks with several sheets:** `markitdown` converts **every** sheet, in workbook order, writing the tab name as a `## <name>` heading above that sheet's table — so tab names survive conversion, and under [locations](locations.md) they are location evidence. Enumerate all `##` headings against the workbook's tabs, then parse each included sheet in bounded chunks: a per-farm workbook parsed as its first table alone silently loses every other farm, and [qa](qa.md)'s per-supplier count check cannot see the difference because the locations it never wrote to simply don't appear. Three converter behaviours will mislead you if you don't look for them. **Hidden sheets convert like any other**, with nothing in the output marking them hidden — last season's tab is not a location that got this drop. **Each sheet's first row becomes its header**, so a title or logo row above the table pushes the real headers down into the first data row; the tell is a header cell holding the sheet's title, or `Unnamed: 1` where a merged/blank cell was. And **an empty sheet still emits a table**, a degenerate one-cell row rather than nothing. Check the header row of every sheet you parse.
- If the email **body** contains a URL that may hold the availability (link to a price list / catalog / sheet), open it with `markitdown` or `scripts/agent/agent-browser` — don't treat a bare link as unparseable. If the URL is a downloadable file, download it and check its contents before deciding it's irrelevant.
- **Triage every image before you parse it. An image is one of three things**,
  and mistaking one for another is how a drop goes wrong quietly:

  | The image is | What it is | What to do |
  |---|---|---|
  | a photograph **of a price list, sheet or screen** | a *source* | render and parse it here, as a scanned document above |
  | a photograph **of a plant** — in a pot, in a field, on a truck, with or without a label | a *catalogue photo* | [photos](photos.md) |
  | a logo, signature graphic, banner, icon, map, letterhead, staff portrait | neither | skip it |

  The third row is most of what an email actually carries. Signature and
  letterhead assets are typically **under 200 px on a side or under 20 KB**, and
  their filenames say so (`logo`, `sig`, `banner`, `icon`, `header`, `image001`
  from Outlook). Check the dimensions before you spend anything on an image; a
  20 KB inline graphic is not a plant.

  A photo can be **both** a source and a catalogue photo — a shot of a printed
  label with the plant behind it. Parse it and catalogue it; they are different
  records made from the same file, and [photos](photos.md) says how the second one is written.

  **This table is about files you were given.** An image that exists on a page
  as a URL is never downloaded — [photos](photos.md) says what to do with it instead.
- Intermediate files (converted markdown, page images, parse chunks) go to `/tmp` — they are not records.
