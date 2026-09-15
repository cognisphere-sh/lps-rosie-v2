---
name: html-quote
description: Create a compact Gmail-ready HTML quote table with rich-copy controls. Covers fresh job/item pricing checks, concise existing shared notes, email-safe inline styling, content-fit columns, a reusable self-contained template, rich HTML and plain-text clipboard fallbacks, manual selection, visual/copy checks, private artifact previews and durable downloadable HTML. Use when Chris requests an HTML quote or a formatted table to copy into Gmail; not for an APS-branded PDF. (v1.2.0)
metadata:
  author: rosie
  version: "1.2.0"
---

# HTML quote for Gmail

Chris authorized this workflow on 2026-09-11 after reviewing the compact email
table. `quote-generation` owns intake, price/offer approval, customer safety,
shared-note brevity and quote delivery rules. Read it before generating.
`job-requests` owns database reads/writes and lifecycle; `publish-artifact`
owns responsive hosting and privacy. Do not create competing rules here.

## 1. Read current evidence

1. Read the schema and database-access reference as required by `job-requests`.
   Reload the job, active items and recent per-row changelog before generating;
   preserve concurrent human edits. Follow intake requirements before any quote.
2. Use current approved offerings, requested quantities and supported customer
   unit prices. The name and size cells must show only the one actual quoted
   plant and size, never an original-demand alternative list; material
   differences use the exact customer-visible note `Substitute: <actual offering> instead of <original demand>`, not a reason or unavailable price. Preserve
   plant order; resolve material gaps before the affected quote. HTML generation
   alone does not authorize alternatives, an AR or email.
3. Calculate line totals and subtotal with decimal arithmetic and cross-check
   against current rows. Never use available quantities for quote totals.
4. Use concise existing item shared `external_notes` only for table notes;
   follow `quote-generation` to omit redundant selection statements and
   “Quoted for” introductions. Contextual size options need only size/price.
   Preserve necessary questions/caveats; do not reconstruct notes from internal
   sourcing or chat. Unknown tax/delivery must not be presented as zero or included.

## 2. Build the compact table

Start from `artifacts/gmail-copy-template.html` in this skill. It contains no
customer data and includes responsive preview controls, an isolated `#quote`
copy region, clipboard handlers and a manual-selection fallback.

- Fill all placeholders with HTML-escaped current values. `ITEM_ROWS` and
  `HEADER_CELLS` are generated markup: escape every text value before insertion.
- Use six columns: Qty, Size, Plant, Note, Each, Total. Keep one row per item
  and a final subtotal; do not duplicate quantities for size options.
- Use **content-fit width**, not `width:100%`, a forced wide minimum or equal
  column widths. The approved example measured about 559px with 15 lines;
  that is a reference, not a mandatory fixed width. Allow plant/note wrapping
  where needed and keep numeric currency cells unbroken and right-aligned.
- Keep compact readable type (template 0.85rem), cell padding around
  0.25rem vertically / 0.35rem horizontally, and short headers. Do not shrink
  below 0.85rem just to fit. Use simple collapsed borders and modest header color.
- Put **all email-critical styles inline** on the copied table/cells: font,
  colors, padding, borders, alignment and width behavior. Preview-only CSS does
  not reliably survive copying into Gmail. Avoid external fonts/styles/images.
- Example cell styles: `border:1px solid #d1d5db;padding:0.25rem 0.35rem;`
  plus `text-align:right;white-space:nowrap` for currency, or
  `text-align:left;max-width:12rem;white-space:normal` for plant/note content.
- Keep source/as-of information in the preview footer and date/context in the
  quote. No internal supplier comparisons, cost evidence or operational notes
  belong in the copied region. Keep template placeholders out of final output.
- Save the final self-contained HTML in the owning thread's `files/` directory.
  Test/scratch renders belong in `/tmp`. This is an explicitly requested email
  table, not a replacement APS PDF design; use the approved APS document template
  via `quote-generation` when the request is for that document.

## 3. Copy behavior

The template's **Copy table** writes both `text/html` and `text/plain` in a
`ClipboardItem`, so normal Gmail paste can retain formatting. Only `#quote`
is copied; preview controls/instructions/source footer are excluded.

Clipboard access may be blocked by the hosted artifact's sandbox or browser
permissions. Keep all these fallbacks:

1. Rich clipboard API.
2. Selected quote plus a temporary copy-event handler and `execCommand('copy')`
   setting both MIME types; report success only when actually handled.
3. **Select table** for manual Ctrl/Cmd+C and normal paste.
4. Explicit **Copy plain text**, clearly saying formatting is omitted.

Do not silently call plain-text fallback a formatted-table success. Instruct:
open preview → Copy table → normal paste in Gmail, with Plain text mode off.
If blocked, Select table → Ctrl/Cmd+C → paste. The downloaded HTML can be opened
in a browser as an alternate copy surface. Pasting raw HTML source into Gmail
compose does not render a table. Do not send email merely to test it.

## 4. Verify, publish and hand off

1. Open the local file with `scripts/agent/agent-browser`, an isolated session,
   `--json`, and `--allow-file-access`. Keep the same flags on subsequent calls;
   confirm `location.href`/body content before trusting screenshot or copy tests.
2. Verify row count, offered names/sizes, every price/total, minimal notes and
   subtotal. Inspect the clipboard payload to ensure it contains the inline
   styled table but not controls/internal notes. Test Copy and selection.
3. Visually inspect desktop and a 360px viewport. Check no page/body horizontal
   overflow; the table may scroll inside `.scroll`. Check compact widths, legible
   names, note wrapping, currency alignment and no clipped values. Keep large
   tap targets on controls even though table cells are tight.
4. Follow `publish-artifact`: publish **private by default**, use a stable slug,
   and return its exact printed URL. For revisions, inspect the current privacy
   flag and republish the same slug rather than creating duplicate previews.
5. Upload final HTML to `lps/rosie_shared/YYYY-MM-DD/` through the documented
   Supabase upload script. That bucket is public: upload only the customer-safe
   deliverable, not internal evidence. Keep the local HTML for an attachment;
   obtain a signed link if needed. The private artifact and public bucket copy
   have different access properties—do not describe both as private.
6. Report URL, local HTML path, storage key, verified subtotal, checks performed
   and caveats to the owning thread. If Gmail paste itself was not tested, say
   so; local clipboard success is not a guarantee about hosted sandbox/Gmail.
   The parent/communication owner delivers as authorized. No quote-shared event
   until actual customer delivery under `quote-generation`.
7. For a requested revision, preserve values/notes unless separately authorized,
   update preview and durable HTML in place, retest and tell the user to refresh
   and copy again. Close the test browser session when finished.
