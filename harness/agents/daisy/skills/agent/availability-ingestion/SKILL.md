---
name: availability-ingestion
description: Load supplier availability and fix inventory. Includes receipts, change checks, monthly designated hosted reviews, page-by-page reading, locations, fields, aliases, match/write/QA helpers, labels, reports, repairs and exports. Use for availability drops, hosted review schedules, backfills or inventory edits. (v3.2.0)
metadata:
  author: lps
  version: "3.2.0"
---

# Availability ingestion

Runs on the supplier's own thread (`suppliers.daisy_thread_id`). This skill
owns `inventory`, `inventory_sources` and `plant_aliases`. Supplier and
contact rows → `supplier-onboarding`; photos → `plant-photo-catalogue`. No
email to suppliers from here.

| Task | Read |
|---|---|
| A drop (email, file, link) | The steps below, loading each file when you reach it |
| Fix a row, a price from Chris, "price X like Y", export CSV | [repairs](artifacts/repairs.md) + [fields](artifacts/fields.md) |
| Add or review an alias | [aliases](artifacts/aliases.md) |
| Designated monthly hosted-list check or its schedule | [hosted monthly](artifacts/hosted-monthly.md), then the normal drop steps for changed content |

## A drop, step by step

1. **Start.** Post the arrival block to the supplier panel
   (`supplier-communications` → transcript). Then one read for the company:
   `skills/agent/availability-ingestion/scripts/ingest-context --thread <ThreadId>`
   (locations, supplier notes with known quirks, recent sources). Apply the
   quirks.
2. **What is it, and has it changed?** [source](artifacts/source.md): receipt
   type, `source-check`, historical check. Unchanged → label, close, done.
3. **Where does each row go?** [locations](artifacts/locations.md).
4. **Read it page by page.** [source](artifacts/source.md) "Convert and read", with
   [fields](artifacts/fields.md) for every value. Write each page's entries to
   `/tmp/<thread>-p<N>.json`.
5. **Match.** Per page and location:
   `skills/agent/availability-ingestion/scripts/match-candidates --supplier <id> --entries /tmp/<thread>-p<N>.json --plan /tmp/<thread>-p<N>-plan.json`.
   Decide every `review` row ([write](artifacts/write.md)), drop fields the
   source didn't state, merge the page plans for the location.
6. **Store and write.** Upload the file and create source rows
   ([write](artifacts/write.md) "Store the file"), put the location's `source_id` in
   its plan, then
   `skills/agent/availability-ingestion/scripts/apply-plan /tmp/<thread>-<id>-plan.json`
   (dry run), check the counts against your ledger, and rerun with `--commit`.
7. **QA.** [qa](artifacts/qa.md): compare with the original, run `qa-check`.
8. **Photos** in the drop → `plant-photo-catalogue`.
9. **Finish.** [finish](artifacts/finish.md): label, panel close, daily note,
   success receipt, one report if someone asked.

A plain one-page list can skip the per-page files; the rules stay the same.
If a helper doesn't fit an unusual source, write the SQL yourself following
[write](artifacts/write.md), and say so in the report.

## Always

- The newest source wins for what it states; silence changes nothing; no
  inventory row is retired during an ingest (only empty, superseded sources
  are, at the finish).
- Never invent names, botanical names, sizes, prices or locations. Unknown
  stays NULL.
- Make the best-supported call on routine gaps and note why. Park only rows
  with two materially different readings, and finish your own parked rows
  when the answer comes; don't hold the whole list for them.
- Supplier item codes/SKUs printed on the list and stored on the rows (e.g.
  `Item code:` in `notes`) are the best match key; use them first.
