# Store the source, match, and write rows

## 1. Store the file and make source rows

- Upload the file once:
  `scripts/agent/supabase/upload --bucket lps --path suppliers/<slug>/rate-cards/<YYYY-MM-DD>/<file> --file <local>`
  (`<slug>` = kebab-case supplier name). A web page → use its URL.
- One `inventory_sources` row per file (or URL) **per location**, all pointing
  at the same `file_path`. Keep each location's id; each row gets its own
  location's source id.

  ```sql
  INSERT INTO inventory_sources (supplier_id, file_path, notes)
  VALUES (<location id>, '<object key or URL>', '<channel, MessageId, received time; shared company list if so>')
  RETURNING id;
  ```

- `file_path` is the bucket object key (no scheme) or the original `http(s)`
  URL. Never a signed URL.
- Keep every source that rows point at. A source with **no** inventory rows
  is retired once a newer source with rows exists for the same farm (Bhoumik
  2026-08-18, confirmed 2026-09-29); see [finish](finish.md). Always keep the
  farm's newest source and any source a pending schedule names.

## 2. The newest source wins

An ingest **refreshes**; it never replaces. For each offering, find its
existing row and update it; insert only when there is none. Rows the new list
doesn't mention are left alone (still active, older `source_id`). That older
`source_id` is how anyone sees a row is stale.

- Every value the new source **states** replaces the stored one, even if it
  looks odd. A repriced plant is not a parse error; write it and flag it.
- **Silence is not a value.** A field the source doesn't mention stays as it
  is. Only an explicit statement ("call for price", "0 available", a crossed-out
  price) clears or zeroes a value.
- **The email body beats its attachment** ("prices go up 10% Monday", "ignore
  tab 2", "the 15 G are gone"). Put the body's instruction in the affected
  rows' `notes`; flag it if you had to interpret it.
- Exceptions — only when you can quote them:
  1. Chris or the brief says so ("keep existing prices").
  2. The source says it is superseded, archived, or not yet effective
     ("effective Oct 5" → future-dated, see [source](source.md)).
  3. You knowingly hold an **older** file than the row's current source (a
     backfill or a re-send). `created_at` is when *we* ingested, not how new
     the list is. Don't overwrite conflicting fields; report both values and
     both sources under *Flags for Chris*.
- Never retire inventory rows during an ingest (no `is_active = false`), and
  no source that rows point at. A supplier saying "discontinued" → put it in `notes` and flag it.

## 3. Match each offering to existing rows

Exact keys miss respelled, re-punctuated, renamed and re-sized plants, so look
at the nearest candidates and decide:

```bash
skills/agent/availability-ingestion/scripts/match-candidates \
  --supplier <location id> --entries /tmp/<thread>-page<N>.json
```

Entries are a JSON array: `common_name`, `botanical_name`, `cultivar`, plus
`size`, `unit_price`, `quantity`, `height`, `width`, `caliper` when known.
Run it per location, one page at a time for paginated sources. It returns up
to five active rows plus the best inactive one. `SUGGEST` is a sort aid, not
a decision.

| You see | Do |
|---|---|
| One clear match: same plant, same container | Update it. |
| Only good match is `INACTIVE` | Reactivate and update it. Never insert a second copy. |
| Nothing close, or only other plants/containers | Run the search check below; insert only if it also finds nothing. |
| Two or more plausible matches that differ (price or printed name) | Touch none. List plant, size and ids under *Flags for Chris*. |
| Several rows that are the same offering (same name and price) | Update the top one; list the rest under *Duplicates found*. |

- A high score is not a match. Sibling cultivars score close; `CULTIVAR
  MISMATCH` marks them only when both sides name a cultivar. Read the names.
- **Search before every insert.** `search_inventory` follows aliases and
  typos and finds renames that similarity misses. Run it for each printed form
  (common and botanical):

  ```sql
  SELECT id, name, cultivar_variety_trade_name, size, size_std, unit_price, quantity, is_active, relevance
  FROM search_inventory('<name as printed>')
  WHERE supplier_id = <location id>
  ORDER BY relevance DESC LIMIT 10;
  ```

  Same plant and container → it's an update. A species returned for a
  cultivar is not that cultivar.
- Duplicates are common on established suppliers (thousands of old
  same-price groups). They are a cleanup backlog: update one, report the rest.
- A brand-new supplier's first ingest is all inserts.

## 4. Write

- **Update:** `source_id` (this location's), `unit_price`, `quantity`, `size`,
  `size_std`, dimensions and their `*_std`, `image_url` if the source links a
  photo of that offering, `is_active = true`. `notes` = this drop's supplier
  text (usually NULL; a qualifier the drop no longer prints comes off). If the
  drop doesn't mention the row, don't touch it. `internal_notes`: append only.
- **Insert:** the [fields](fields.md) columns plus `supplier_id` and
  `source_id`. Never `name`, `*_key`, `updated_at`.
- Compare plant names by key, never by raw text: `name_key`,
  `common_name_key`, `botanical_name_key`, `cultivar_keys && …`, or
  `normalize_plant_key(<text>)`.
- Aliases printed in the source → [aliases](aliases.md).
- Put all writes for the scope in one SQL file and one transaction
  (`scripts/agent/supabase/query -f /tmp/<thread>-write.sql`). Run it with
  `ROLLBACK` first and read the counts; then `COMMIT`. Write text with
  dollar-quoting (`$q$…$q$`) so `$` and quotes stay literal.
- A location the drop didn't cover keeps everything it had.
