- **Price**: `unit_price` is nullable; use the lower bound if the source gives a range. Store `NULL` when the supplier provides no price, and preserve a numeric zero only when the source explicitly prints zero. Never coerce a missing/blank price to `0`, and never silently reinterpret legacy zero rows without source-level review. Missing price does not make an inventory row invalid or free. Don't note the absence in `internal_notes` — a `NULL` `unit_price` already says it; if the supplier themselves printed "price on request", that is their text and belongs in `notes`. Stock counts go in `quantity`.
- **Combined sizes with one shared quantity**: create one inventory row for each printed size (for example, a `3 G/5 G` offer becomes separate `3 G` and `5 G` rows). Copy the source's shared quantity to both rows; quantities are tentative sourcing signals. State in each row's dated `internal_notes` that the quantity is the supplier's shared/tentative count across the combined sizes and that you split the offering, so reviewers do not add the copied values together as guaranteed stock. (Approved by Bhoumik, 2026-07-31.)
- **Two note columns, and they are not interchangeable.** Every row can carry
  both; keep each one's content in its own column — and keep both **lean**.
  - **`notes` — what the supplier said that no column captures.** A per-row
    qualifier ("limited", "coming soon", "B&B only"), a lead time, an ordering
    constraint, the supplier's own item code or yard location, a stated
    future-availability window — supplier-stated facts a person sourcing that
    plant should know. **Never write what the database already records**: no
    "available as of <date>" / "ingested on" / received or retrieved dates
    (the row's `source_id` and its `inventory_sources` row carry when we got
    the list), no source file or page names, and no verbatim restatement of
    the row itself (name, size, price, quantity and dimensions live in their
    columns). **Most rows need no `notes` at all** — a plain line item on a
    current list says nothing beyond its columns. It is written from the
    source and nothing else. (Rule tightened 2026-08-23, per Chris; the old
    provenance boilerplate in existing rows was mechanically cleaned the same
    day.)
  - **`internal_notes` — what you concluded.** Why you split a combined size,
    that a quantity is the supplier's shared/tentative count, a parse caveat, a
    QA exception, anything a later reader would otherwise have to re-derive from
    the file. Date these too, and **append** rather than clobber on a later drop.

  A reviewer must be able to tell "the supplier says two weeks" from "we guessed
  two weeks". Putting your reasoning in `notes` destroys that, and putting the
  supplier's words in `internal_notes` hides the evidence. Rows written before
  2026-08-14 have a mix of both in `notes` — leave them; the split applies to
  what you write from now on.

  **`internal_notes` is not a log of the obvious.** It earns its place only when
  a later reader could not get the same fact from the row itself. Never write an
  observation the database already answers:

  - that a price or quantity is missing — `unit_price` / `quantity` is `NULL`,
  - when the row was last touched — `updated_at`,
  - when the drop landed or which file it came from — the row's `source_id` and
    its `inventory_sources.created_at`,
  - a restatement of `size`, the dimensions, or any part of the plant name.

  A drop that adds nothing but these leaves every row's `internal_notes` longer
  and no more informative, and buries the caveats that do matter. If you have
  nothing to conclude about a row, write nothing.
- **Dimensions — write the source string and numeric standard together.** Preserve `height` / `width` / `caliper` as printed. Also write `height_std` in feet and `width_std` / `caliper_std` in inches when the measurement is unambiguous. For a range, use its **lower number** (`10-12 ft` → `height_std = 10`; `2.5-2.75 in` → `caliper_std = 2.5`) while preserving the full range string. Convert explicit inches in height ÷ 12, explicit feet in width/caliper × 12, and exact mixed feet+inches by addition. Fractions/decimals are allowed. Leave the standard value `NULL` for inequalities, conflicting units, combined/multiple dimensions, malformed/nonpositive/descending values or anything requiring a guess. A manual source-string edit clears the companion standard value until reviewed; never leave a stale numeric value. The source's own grouping (e.g. `Shade Trees`) is **not** stored — there is no `category` column on `inventory`.
- To check "does the system already know this plant?", call the `search_inventory` RPC — typo-tolerant, follows the alias graph.
