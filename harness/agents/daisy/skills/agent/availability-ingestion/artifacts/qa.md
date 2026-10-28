# QA — before you commit and before you report

Don't trust the parse or the write until it matches the original source.
Fix anything material before committing; if you can't, roll back and report
it. Never record a success receipt for a failed or partial ingest.

## 1. Against the source (you do this by eye)

- Re-open the **original** pages (not your own CSV) and compare with the
  staged rows.
- Each page's ledger balances: plant lines → offerings (after splits and
  continuations) → decisions (update / insert / reactivate / park). Non-plant
  lines are accounted for. Then the pages add up to the whole source, per
  location. If anything doesn't balance, go back to that page.
- Check **every** risky row: wrapped names, blank prices, continuation lines,
  repeated names or sizes, SALE / COMING SOON / LIMITED / READY statuses,
  dimensions, calipers, quantities, footnotes, page breaks. Each value sits on
  the right plant; nothing crossed from a neighbouring row or got dropped.
- Price and quantity changes on updated rows look like a real new list, not a
  shifted column.
- Every stated field won; every field the source didn't mention is unchanged.
  A withheld overwrite must be one of the quotable exceptions in
  [write](write.md) and be in the report.
- Manual current receipt: the source note has channel, handoff time and
  printed dates; the rows have the confirmation caveat.

## 2. Mechanical checks (one command)

Before commit: `apply-plan <plan>` (dry run) shows the counts. After commit:

```sh
skills/agent/availability-ingestion/scripts/qa-check --source <uuid> [--source <uuid> …]
```

It shows rows per location (updated vs inserted), `size_std` buckets, and
must show `OK` for: size without `size_std`, empty names, stray quotes or
brackets, selection names joined with `-`/`/`, bookkeeping text in `notes`,
obvious restatements in `internal_notes`. Fix any `FAIL` rows, then run it
again. Read the `LOOK` lines (zero prices, dimensions without `*_std`,
duplicates, aliases) and fix what is wrong.

- **Mostly inserts** from an established supplier means matching went wrong
  and you duplicated the catalogue: re-check a sample with `match-candidates`
  and `search_inventory` before you report.
- An unexpected bucket (a `100G` in a perennial list, everything `other`) is a
  parse miss.
- Per-location counts match [locations](locations.md): "no location named" →
  every active location, equal counts; per-row/section → the counts you
  parsed for each; one location → only that one.
- Each new alias: run `search_inventory` on both names and record observed
  scope. Wrong source-derived pairs → deactivate; Chris's explicit same-name
  correction → retain and report any collision once ([aliases](aliases.md)).
- Spot-check two or three searches for the plants you touched: the exact plant
  should come first, without sibling cultivars.
- A name kept whole in `common_name` because you couldn't split it is correct,
  not a failure.
- New supplier or contact rows: run the `supplier-onboarding` checks.
