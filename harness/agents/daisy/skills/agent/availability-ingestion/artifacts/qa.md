## 5. Post-ingestion QA — required before commit

Treat extraction and writing as untrusted until the drop passes source-to-database QA. Run these checks **before committing the transaction whenever possible**; if a material check fails, roll back and report the exception instead of publishing partially verified data. Because [writes](writes.md) updates rows in place, a bad parse now overwrites good data rather than sitting alongside it — QA matters more under this model, not less.

- **Re-open the original source with the approved primary converter** and compare it to the staged/database output — not only to an intermediate CSV made by the same extraction logic.
- **Reconcile counts:** source offering count versus rows **updated + inserted**, totals by page/section, priced/unpriced rows, quantities, photos, and distinct source ids. The two numbers should account for every source offering between them. Explain every exclusion, deduplication, split combined size, and ambiguous multi-match you skipped; a matching grand total alone is insufficient.
- **Sanity-check the update/insert split.** A repeat drop from an established supplier should be mostly updates with a few inserts. **Mostly inserts means you took `match-candidates` at face value on entries you should have looked at** — a supplier who respelled or re-sized their list produces exactly that shape — and you have just duplicated the catalogue. Stop and investigate before committing: re-run `match-candidates` on a handful of the inserted entries, read the candidates you passed over, and re-run the [candidate matching](writes.md) `search_inventory` check scoped to this supplier — an insert that search would have matched is a duplicate you just created.
- **Check source coverage:** review representative rows from every page/section and **100% of risky rows** — wrapped/multi-line names or descriptions, blank prices, continuation lines, repeated names/sizes, SALE/COMING SOON/LIMITED/READY statuses, dimensions, calipers, quantities, footnotes, and page breaks.
- **Verify row boundaries:** each raw description/status/spec belongs to the correct plant row and no neighboring cell was crossed, truncated, or silently dropped. The uploaded source file is the raw evidence — **never copy verbatim row descriptions into `inventory.notes`**; derive `height`, `width`, `caliper`, `quantity` and status into their columns and keep in `notes` only what [lean notes](values-notes.md) allows.
- **Check the note split and the lean rule:** nothing you concluded ended up in `notes`, no supplier text ended up in `internal_notes`, and no row's `internal_notes` was clobbered by this drop. No `notes` value this drop wrote carries a receipt/ingest date, a source-file or page name, or a restatement of the row's own columns ([normalization](normalization.md)). Also check that nothing you appended to `internal_notes` merely restates the row — a missing price or quantity, when it was last updated or ingested, the size, the dimensions, the name. Delete those before committing rather than publishing them.
- **Validate normalization:** no malformed names/sizes, no zero price presented as free, no guessed missing values, no unsafe cultivar/species alias edges, and no source dimensions left only in notes when they can be mapped unambiguously to structured fields. For every populated human-readable dimension, verify its `*_std` companion uses the approved unit/lower-bound rule or is deliberately `NULL` with an ambiguity reason; never publish a stale standard value after changing its source string.
- **Every row with a `size` has a `size_std`**, and it is one the standard
  allows. Run it and expect zero rows:
  ```sql
  SELECT size, count(*) FROM inventory
  WHERE source_id = ANY(ARRAY[<new source ids>]::uuid[])
    AND size IS NOT NULL AND size_std IS NULL
  GROUP BY size;
  ```
  Then list `SELECT size_std, count(*) … GROUP BY size_std` for the drop and read
  it: a bucket you did not expect from this supplier's sheet (a stray `100G` in a
  perennial list, everything collapsing to `other`) is a parse miss, not a
  quirk. A `size` that turned out to be a height/width/caliper belongs in that
  column with its `*_std`, leaving both `size` and `size_std` `NULL`.
- **Check the name classification.** Every row this drop wrote preserves the
  source's explicit parts without fabrication, or intentionally keeps one
  uncertain complete printed atom in `common_name` with the other identity fields
  NULL; its derived `name` reads the way [normalization](normalization.md) says. Expect zero rows from each of
  these:
  ```sql
  -- a part that is neither NULL nor real text, or an identity with no name at all
  SELECT id, common_name, botanical_name, cultivar_variety_trade_name, name
  FROM inventory
  WHERE source_id = ANY(ARRAY[<new source ids>]::uuid[])
    AND coalesce(common_name, botanical_name, cultivar_variety_trade_name) IS NULL;

  -- a part that still carries a bracket, a size, or a stray/wrapping quote:
  -- a quote/apostrophe between alphanumeric characters is valid name text
  SELECT id, common_name, botanical_name, cultivar_variety_trade_name
  FROM inventory
  WHERE source_id = ANY(ARRAY[<new source ids>]::uuid[])
    AND (common_name ~ '\[|(^|[^[:alnum:]])[''‘’“”"]|[''‘’“”"]($|[^[:alnum:]])'
      OR botanical_name ~ '\[|(^|[^[:alnum:]])[''‘’“”"]|[''‘’“”"]($|[^[:alnum:]])'
      OR cultivar_variety_trade_name ~ '\[|(^|[^[:alnum:]])[''‘’“”"]|[''‘’“”"]($|[^[:alnum:]])');

  -- valid (no result): Bracken’s Brown Beauty, Bracken's Brown Beauty,
  -- O'Neil; invalid (must result): 'Bracken’s Brown Beauty', “O'Neil”,
  -- or a leading/trailing unmatched quote. A wrapping quote belongs to the
  -- source display syntax, not to a stored identity part.

  -- two selection names run together instead of comma-separated: the row would
  -- key as one string and match neither name
  SELECT id, cultivar_variety_trade_name, cultivar_keys
  FROM inventory
  WHERE source_id = ANY(ARRAY[<new source ids>]::uuid[])
    AND cultivar_variety_trade_name ~ '\s[-/]\s'
    AND cardinality(cultivar_keys) = 1;
  ```
  Then read a sample of `name` values back. Flag a botanical identity in
  `common_name`, or a cultivar left there, **only when the source convention and
  evidence support a confident split**. A complete source atom intentionally
  preserved in `common_name` under [name uncertainty fallback](names.md) is correct and
  must not be falsely flagged.
- **Verify every alias pair you wrote — mechanically, not by eye.** For each new
  pair run `search_inventory('<other_name>')` and `search_inventory('<the row's
  name>')` and list the identities each returns. If either returns an identity
  that is not the plant you just ingested, the pair is wrong: retire it before
  committing. A cultivar-level pair that returns rows of the same species
  **without** that cultivar is the classic bad edge — retiring it is the only
  fix. Report every pair with the verbatim source line that attests both sides;
  it must also be stored in `plant_aliases.source_line`. "It looked like a
  synonym" is not evidence and does not pass.
- **Check the row → location mapping from [locations](locations.md).** Every row this drop touched now
  carries one of the new source ids, so group by supplier and compare against
  what [locations](locations.md) said should happen:
  ```sql
  SELECT supplier_id, count(*) FROM inventory
  WHERE source_id = ANY(ARRAY[<all new source ids>]::uuid[])
  GROUP BY supplier_id ORDER BY supplier_id;
  ```
  - **No location named in the file** → one group per active location, all with
    **equal counts**, none skipped, none outside the company.
  - **The file named locations per row/section** → the per-supplier counts match
    the counts you parsed for each of those locations, and no location the file
    never mentioned appears at all.
  - **One location named for the whole file** → exactly one `supplier_id`, and it
    is the one named.
- **If you onboarded anything**, [supplier-onboarding: verify](../../supplier-onboarding/artifacts/verify.md) has the checks for the
  supplier and contact rows — run them there, not here.
- **Compare against what was there before:** inspect price/quantity/spec changes on the rows you updated, plants that are new to this supplier, and duplicate inflation. Spot-check several important searches afterwards to confirm exact identities rank correctly without sibling-cultivar leakage.
- **Check that the newest source actually won** ([writes](writes.md)). Every field this drop
  stated is now the stored value, and every field it didn't mention is
  untouched — a row whose price this sheet listed but which still carries the
  previous figure means an update was skipped, and a field this sheet was silent
  about that is now null means silence was treated as a value. Both are worse
  than a parse miss, because neither shows up in a count. If you *withheld* an
  overwrite under one of [source-precedence exceptions](precedence.md), that is not a QA failure — but it
  must be quotable and it must be in the report.
- **Manual/current-receipt QA:** when applicable, verify each new source note
  identifies the manual channel/identifier and inbound handoff timestamp, and
  every affected row preserves the printed date/currentness caveat with
  confirmation required in the correct notes column. An old or non-ISO printed
  year alone must not have triggered the exact-farm historical date check.
- **Record QA evidence in the outcome record:** converter used, source counts versus updated/inserted counts, pages/sections checked, risky-row count and result, ambiguous multi-matches skipped, search spot-checks, and whether the transaction committed or rolled back. Do not report an ingest as Catalogued without this QA summary.
