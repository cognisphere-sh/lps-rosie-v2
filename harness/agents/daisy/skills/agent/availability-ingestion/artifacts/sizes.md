### Size standard

(Expanded 2026-08-05, **approved by Bhoumik** — the previous one-line rule
covered unit spelling only, and the column had drifted to 2,769 distinct values
across 69k active rows. Migration 0019 applied the spelling half retroactively.)

**`size` is the container or grade the plant is sold in — nothing else.**

**1. Canonical units.** Write these forms and only these:

| Unit | Canonical | Accepts |
| --- | --- | --- |
| Gallons | `15 G` (space before `G`) | `#15`, `15gal`, `15 GAL`, `15G`, `15 Gallon` |
| Inches | `24"` | `24 inch`, `24 in`, `24 IN.` |
| Feet | `6'` | `6ft`, `6 feet`, `6 foot` |

Drop leading zeros (`024 Inch Box` → `24" Box`). Compounds keep both units and
take no spaces around the slash: `15 G/17"`, `24" box`, `3' cal`. `45 G / 28"`
is `45 G/28"`.

**The database has the reference implementation: `normalize_size(text)`.** Run
your parsed value through it and store what it returns, rather than hand-applying
the table above — it is the same function migration 0019 used, so old and new
rows agree. Read its output before storing: it is a regex, not a judge.

**One exception it gets wrong:** `#` means gallons *except* on a box, which the
trade sizes in inches. `#24 Box` is a 24-inch box, not 24 gallons. Write `24"
box` and leave `#` off. Twelve legacy rows with this shape were deliberately
left unconverted for source review.

**2. Words are valid sizes** when that is genuinely how the supplier sells the
plant — `B&B`, `Field Grown`, `Bare Root`, `Quart`, `Plug`, `Six Pack`,
`Boxed`. Use Title Case and the singular (`Quart`, not `QUARTS`/`QT`/`quart`);
`B&B` and other established trade abbreviations stay upper case. A bare
`Gallon` with no number is **not** a size — find the number or leave `size`
null.

**3. What does NOT go in `size`:**

- **Height, width and caliper.** They have their own columns. A `size` of
  `5-6'`, `2-2.5"` or `B&B 4-5'` is a parsing miss — the container belongs in
  `size`, `5-6'` in `height`, `2-2.5"` in `caliper`. If the source gives only a
  height grade and no container, `size` is null and `height` carries it.
- **Form, grade and condition codes** — `STD`, `TRUE`, `NS`, `CG`, `Bush`,
  `Multi-Trunk`, `Specimen`, `Clump`. These describe the plant, not its
  container. They are the supplier's own words about the plant, so they go in
  the row's dated `notes`.
- **Counts and pack quantities** — `(6ct)`, `18 Plants`, `12ct`. The count goes
  in `quantity`; the tray/flat itself is the size (`1801`, `128`, `10" Pot`).
- **Anything you had to guess.** Leave `size` null rather than invent a
  container. Null means "the source didn't say", which is a fact; a wrong size
  is a wrong offering.

**4. Legacy rows still violate 3.** Qualifier-carrying values (`6 G; Bush`,
`3 G TRUE`, `1 G <24"`) remain. Do **not** bulk-fix them as a side effect of an
ingest — that is a separate job against the original sources. Follow this
standard for the rows you write, and report anything egregious you notice under
*Learnings*. The 2026-08-13 `size_std` backfill (migration 0030) moved the
whole-value height/width/caliper misfits out of `size` into their own columns;
what is left is mostly container-plus-qualifier compounds.
