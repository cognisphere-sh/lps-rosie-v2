# supplier-onboarding-and-ingestion — changelog

## 2.0.0

Approved by Bhoumik, 2026-08-14. Three changes, one of which is incompatible
with how every previous ingest wrote rows.

- **Ingestion updates in place and retires nothing** (§4, rewritten). An ingest
  used to insert a whole new version of the supplier's availability and then flip
  the previous rows `is_active = false`. It now matches each parsed offering on
  `(supplier_id, name_key, size)` — `IS NOT DISTINCT FROM` on `size` — and
  **updates** the row it finds, **inserts** only when there is none, and
  **reactivates** rather than duplicates a row the supplier has brought back.
  There is no retirement pass, on `inventory` or on `inventory_sources`: an
  offering the supplier stopped listing keeps `is_active = true` and its older
  `source_id`, which becomes the staleness signal. Retiring an offering is now a
  deliberate act outside an ingest, so a discontinued item is reported under
  *Flags needing Chris* instead of flipped. §5 gains the check that catches the
  dangerous failure of this model: a repeat drop that is mostly inserts means the
  match key missed and the catalogue has been duplicated.

  **Row matching is retrieval-and-judgement, not a key.** §4 step 1 no longer
  looks a row up by `(supplier_id, name_key, size)`. A key looks decisive and
  isn't: a supplier who respells, re-punctuates, adds a cultivar, changes
  container, or switches between botanical and common name makes an existing
  offering invisible to it, and the ingest duplicates the row. Instead the new
  `scripts/match-candidates` returns, per parsed entry, up to five of that
  supplier's **active** rows plus the single best **retired** one — ranked by
  trigram similarity on the plant identity with a size-agreement bonus, over a
  narrow column set (`id`, `name`, `size`/`size_std`, price, quantity,
  dimensions, `is_active`, `dupes`), notes excluded. The agent reads the
  candidates and decides update / insert / reactivate / flag. The script's
  `SUGGEST` line buckets by score only and is explicitly a sort aid, with two
  named traps: a high score is not identity (sibling cultivars score close), and
  no candidates does not mean new (a botanical↔common rename needs a
  `search_inventory` cross-check first).

  **Multi-match handling is split, because the key is not unique today.** A
  2026-08-14 count found 5,714 `(supplier_id, name_key, size, height, width,
  caliper)` keys across 77 suppliers matching more than one active row — ~13,500
  rows, about two-thirds of them carrying the same price and printed name, i.e.
  duplicates the old replace-and-retire model left behind. So survivors with the
  same price and name are treated as duplicates: update the one with the newest
  source, leave the rest, and list them under a new *Duplicates found* report
  line. Survivors that differ in price or printed name are genuinely different
  offerings and **touch no row** — they are flagged for Chris. Without this split
  the update model would flag thousands of rows on every drop from an established
  supplier.
- **`notes` and `internal_notes` are separate columns** (§2, §4, §5, *Recording
  availability status*). `notes` is what the supplier said — their row
  description, dated availability status, lead time, qualifiers. `internal_notes`
  is what we concluded — why a combined size was split, that a quantity is the
  supplier's shared/tentative count, that no price was printed, parse caveats, QA
  exceptions. On an update `notes` is replaced with the current drop's text and
  `internal_notes` is appended to. Requires migration 0039.
- **One source file is not one supplier** (§0.1, rewritten). The unit of mapping
  is the availability *row*, not the file: a multi-location group's single sheet
  routinely covers several farms, so each parsed offering gets its own
  `supplier_id`. Precedence is most-specific-wins — per-row/column beats section
  heading beats file header — and only when the file names no location anywhere
  does every active location in the group get its own copy of every offering.
  Ambiguity is never resolved by falling back to "all locations".

Also, to keep this skill and `availability-drop-intake` mutually exclusive: the
duplicate supplier-identification search in §0.2 is now a confirmation check on
the main agent's lookup, *Your inputs* points at the intake skill's dispatch
contract instead of restating it, and the report contract is labelled as the
canonical definition that intake §4 consumes. A boundary paragraph up front says
this skill owns every database write and never talks to a human directly.

## 1.0.0

- Initial version: migrated verbatim from
  `knowledge/SOPs/supplier-onboarding-and-ingestion.md` when harness 0.8.12 made
  skills the home for procedural memory. Covers location routing, onboarding,
  contacts, source conversion, parsing/normalization, provenance, versioned
  `inventory` writes, post-ingestion QA, and the report contract.
