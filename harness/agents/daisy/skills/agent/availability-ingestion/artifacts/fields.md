# Field rules — every inventory row you write or edit

These apply to full ingests and to one-row fixes alike. Write what the source
says. Unknown stays NULL. Never write `name` or any `*_key` column: the
database builds them.

## 1. Plant name — three columns

| Column | Holds |
|---|---|
| `common_name` | The printed common/trade name. Also the fallback for a name you can't split. |
| `botanical_name` | A botanical name **printed in the source**. Otherwise NULL. |
| `cultivar_variety_trade_name` | The rest: cultivar, variety, selection or trade name. Several → comma-separated. |

- The database builds `name` as `common - botanical - cultivar`, skipping empty
  parts (`Forest Pansy Redbud - Cercis canadensis - Forest Pansy`). The spaced
  dash is the separator, so `KN30-8` stays one name.
- Split using the source's own layout: columns, quotes, brackets, italics,
  repeated formatting. Never add a botanical name or cultivar from your own
  knowledge or the web.
- Can't tell how to split it? Put the whole printed name in `common_name` and
  leave the other two NULL. That is correct, not a failure.
- Keep a printed common name even when the botanical name is printed too.
- Several selection names: comma-separate them (`Wolff, Emperor 1®`). The
  database splits on `,` `;` `|` to build search keys. Never join them with `-`
  or `/`; that makes one key that matches neither name.
- Never in a name part: size/container, height/width/caliper, form or grade
  codes (`STD`, `Bush`, `Multi-Trunk`, `Clump`, `Globe`, `Low Graft`, `Spec`),
  pack counts. They go in their own columns or in `notes`:
  `Buxus x 'Green Mountain' Globe` → cultivar `Green Mountain`, `Globe` in
  notes; `Prunus serrulata 'Kwanzan' 4' Graft` → cultivar `Kwanzan`, height
  `4'`, `Graft` in notes.

| Source prints | common | botanical | cultivar |
|---|---|---|---|
| `Acer palmatum 'Wolff' - Emperor 1®` | — | `Acer palmatum` | `Wolff, Emperor 1®` |
| `Forest Pansy Redbud (Cercis canadensis 'Forest Pansy')` | `Forest Pansy Redbud` | `Cercis canadensis` | `Forest Pansy` |
| `Crape Myrtle - 'Muskogee'` | `Crape Myrtle` | — | `Muskogee` |
| `Purtis Pink Oleander` (one unclear cell) | `Purtis Pink Oleander` | — | — |

Quotes and brackets from the source layout are not part of a name. An
apostrophe inside a word is (`Bracken's Brown Beauty`, `O'Neil`).

## 2. `size` — the container or grade it is sold in

- Run the parsed value through `normalize_size(text)` and store its result.
  Read the result; it is a regex, not a judge. Canonical forms: `15 G`, `24"`,
  `6'`; compounds without spaces around `/` (`15 G/17"`, `24" box`, `3' cal`);
  no leading zeros.
- `#` means gallons, except on a box: `#24 Box` → `24" box`.
- Words are sizes when that is how the plant is sold: `B&B`, `Field Grown`,
  `Bare Root`, `Quart`, `Plug`, `Six Pack`, `Boxed`. Title Case, singular;
  trade abbreviations like `B&B` stay upper case. A bare `Gallon` with no
  number is not a size.
- Not a size:
  - height, width, caliper → their own columns (`B&B 4-5'` → size `B&B`,
    height `4-5'`). Only a height given → size NULL, height filled;
  - form/grade codes (`STD`, `TRUE`, `NS`, `CG`, `Bush`, `Specimen`, `Clump`) →
    `notes`;
  - counts (`(6ct)`, `18 Plants`) → `quantity`; the tray or flat itself is the
    size (`1801`, `128`, `10" Pot`);
  - anything you would have to guess → NULL.
- Old rows with qualifiers in `size` (`6 G; Bush`) are not yours to fix during
  an ingest. Mention bad ones in the report.

## 3. `size_std` — one bucket per real container

Write it for every row that has a `size`; NULL only when `size` is NULL.
Allowed values (the database rejects anything else):

- `<N>G` — gallons as printed (`1G`, `2.5G`, `35G`). Never round.
- `<N>" Pot` — a pot diameter with no gallon equivalent (`4" Pot`, `3.5" Pot`).
- `<N>" Box` — boxes, always inches (`9' box` → `108" Box`).
- `Bare Root`, `Liners`, `Plug`, `Trays`, `B&B`, `Field Grown`, `Grow Bags`,
  `Root Pruned` — exactly these words.
- `other` — a real container with no bucket (`Quart`, `Six Pack`, `10" Hanging
  Basket`, `Specimen`, `Boxed` without a number). `other` is a correct answer.

First matching rule wins:

1. Says **box** → `<N>" Box` from the box's inches (`45 G/24" BOX` → `24" Box`).
2. Has **gallons** → `<N>G`; drop the pot diameter and qualifiers
   (`15 G/17"` → `15G`, `6 G; Bush` → `6G`). Two gallon sizes in one value
   (`3 G/5 G`) → two rows (see "Price, quantity, dimensions").
3. **Burlapped** (`B&B`, `BB`, balled and burlapped) → `B&B`; a height/caliper
   printed with it goes to `height`/`caliper`. A different container named
   with it wins (`15 G B&B` → `15G`, `24" Box B&B` → `24" Box`).
4. A **bare inch diameter**:
   - has a gallon equivalent → that gallon: 6"→1G, 10"→3G, 12"→5G, 14"→7G,
     17"→15G, 20"→20G, 21"→25G, 28"→45G, 30"→60G, 32"→65G, 36"→100G,
     42"→150G, 48"→200G, 60"→300G;
   - a box the supplier didn't label (desert/palm growers printing `24"`,
     `36"`, `48"` next to other boxed rows or big specimens) → `<N>" Box`,
     never `36" Pot`;
   - otherwise a pot (`4" Pot`) — annuals, perennials, tropicals.
   - A diameter on merchandise (planter, bowl, basket, tool) → `other`.
5. **Word grades**, any case or plural: `BR`/bareroot → `Bare Root`;
   `LNR`/Rooted Liner → `Liners`; any plug → `Plug`; cell trays and flats
   (`128`, `1801`, `40 CEL`, `Flat`) → `Trays`; `FG`/In Ground → `Field Grown`;
   Fabric Bag → `Grow Bags`; `RP` → `Root Pruned`.
6. Any other real container → `other`.

## 4. Price, quantity, dimensions

- `unit_price`: a range → the lower number. No price printed → NULL. Zero only
  when the source prints zero. Never turn a blank into 0. Don't reinterpret old
  zero rows without checking their source. A missing price doesn't make a row
  invalid; don't write a note saying it is missing.
- `quantity`: stock counts only.
- **One quantity shared by combined sizes** (`3 G/5 G`, qty 40): one row per
  size, both with qty 40. Add a dated `internal_notes` line to each: the
  supplier's count is shared across the sizes and you split the offer. (Bhoumik,
  2026-07-31.)
- `height`, `width`, `caliper`: keep the printed text. Also fill `height_std`
  (feet) and `width_std`/`caliper_std` (inches) when clear:
  - a range → lower number (`10-12 ft` → 10; `2.5-2.75 in` → 2.5);
  - inches in a height ÷ 12; feet in width/caliper × 12; feet + inches added;
    fractions and decimals are fine;
  - leave the `*_std` NULL for `<`/`>`, mixed or conflicting units, several
    dimensions in one value, zero/negative/descending/unclear values.
  - If you change the printed text by hand, redo or clear its `*_std`; never
    leave a stale number.
- The source's section headings (`Shade Trees`) are not stored; there is no
  category column.

## 5. `notes` and `internal_notes`

| Column | What goes in | Example |
|---|---|---|
| `notes` | What the **supplier** said that no column holds: "limited", "coming soon", "B&B only", lead time, ordering limits, their item code or yard location, a stated future window, "price on request", "discontinued". | `Ready Nov 1` |
| `internal_notes` | What **you** concluded that a later reader would otherwise have to work out: why you split a row, a shared/tentative count, a parse caveat, a QA exception. Dated. Append; never overwrite. | `2026-09-28: split from "3 G/5 G"; qty shared` |

Never write, in either column: received/ingest dates, "available as of",
file or page names, a restatement of name/size/price/quantity/dimensions,
"price missing", or when the row was updated. The database already records
those. Most rows need no notes at all. (Chris, 2026-08-23.) Rows written
before 2026-08-14 mix the two columns; leave them.

To check whether the catalogue already knows a plant, use the
`search_inventory` RPC (typo-tolerant, follows aliases).
