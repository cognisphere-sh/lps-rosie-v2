# supplier-onboarding-and-ingestion — changelog

## 3.4.0

Bhoumik's call, 2026-08-14. **`search_inventory` is now a required gate before
any insert**, not a fallback for when `match-candidates` came back empty (§4
step 1).

`match-candidates` ranks by trigram similarity on the identity key, so it misses
a plant the supplier renamed, respelled across name forms, or now prints
botanically where it used to print the common name — exactly the entries an
update-in-place ingest then duplicates. The RPC is typo tolerant, matches
partially at both ends and expands the query through `plant_aliases`, so it
catches what similarity cannot.

- §4 step 1 spells out the call: `search_inventory` takes **no supplier
  filter**, so search first and scope with `WHERE supplier_id = …` in the outer
  query, once per name form the entry gives you. A hit in the same container is
  an update however low `match-candidates` scored it.
- The decision table's *insert* row and step 3 both now say an insert is an
  offering the search check cleared.
- §5's update/insert sanity check re-runs the same search on a sample of the
  inserted entries.

Also trimmed the frontmatter description back under the 1024-character limit pi
enforces — it covers the same ground, but 3.3.0's was 1,054 characters and the
new clause would have pushed it to 1,152, where truncation eats the trailing
`(vX.Y.Z)` that tells a running agent to re-read the skill.

## 3.3.0

2026-08-14, with migration 0045. **The alias quality bar is load-bearing again.**

Aliases now expand the search query rather than matching identity columns, and
an expanded query has no column to be restricted to — so `alias_type` no longer
constrains what a pair can reach. 3.0.0 said getting the type right meant "a
whole class of past damage cannot happen"; that is no longer true, and §2 says
so plainly instead.

Nothing about how you *write* a pair changes: same evidence rule, same bar, same
`alias_type` on every insert (it still records what the pair asserts and still
drives the *Also known as* split). What changes is the stake. A pair joining a
species to one of its cultivars now turns a search for that cultivar into a
search for the whole species — measured, not predicted — and because such a
query is one word the multi-word safety gate never runs to catch it. §5's alias
verification is the check that catches it before it ships.

## 3.2.0

Bhoumik's call, 2026-08-14, with migration 0043. Display format only — no column,
no matching, no row changes.

- **`inventory.name` joins its parts with ` - ` instead of bracketing the tail**
  (§2, *Name*). `Forest Pansy Redbud - Cercis canadensis - Forest Pansy`, not
  `Forest Pansy Redbud [Cercis canadensis, Forest Pansy]`. One separator between
  every part, because the comma is no longer available as a part separator —
  since 3.1.0 the cultivar column is itself comma-separated, so
  `Acer palmatum - Wolff, Emperor 1` has to read as "botanical, then a
  two-name cultivar column". The dash is spaced, which is what distinguishes it
  from the hyphen inside `KN30-8`, and it is how the trade prints it.

  Still derived, still never written by hand. Safe by construction:
  `normalize_plant_key()` keeps letters only and `normalize_search_text()` maps
  punctuation to spaces, so the bracket and dash forms share one identity key and
  one token array.

## 3.1.0

Bhoumik's correction to 3.0.0, 2026-08-14, with migrations 0041 and 0042.

- **`cultivar_variety_trade_name` is the residual, not just the cultivar** (§2,
  *Name*). It captures **everything in the printed name that the common and
  botanical name don't** — cultivar, variety, selection, trade name — because
  sources don't reliably distinguish them and guessing which is which loses
  information. 3.0.0 said to store the cultivar and carry the trade name only as
  an alias edge; that was wrong. `Acer palmatum 'Wolff' - Emperor 1®` now stores
  `Wolff, Emperor 1®`.

  **Comma-separate multiple names**, and the comma is load-bearing: migration
  0041 replaced the scalar `cultivar_key` with `cultivar_keys text[]`, split on
  the comma, so each name gets its own identity key. Run two names together with
  a dash and they key as one string matching neither, and the row silently stops
  answering searches for either — §5 gains a query that catches exactly that.
  (`;` and `|` are tolerated by the trigger; `-` and `/` are deliberately not
  split, because `KN30-8` is one cultivar code.)

- **An explicit exclusion list** (§2, *Name*). Size, container, height / width /
  caliper, form and grade codes (`STD`, `Bush`, `Multi-Trunk`, `Clump`, `Globe`,
  `Low Graft`, `Spec`) and pack counts never enter the column however the source
  prints them inline — with the worked cases the 0035 residual note flagged:
  `Buxus x 'Green Mountain' Globe` is cultivar `Green Mountain` with `Globe`
  noted, not `Green Mountain Globe`.

- **Aliases now enrich the query** (migration 0042, no SOP change needed). The
  alias branch used to require the *whole* query to match one edge's text, and
  pgroonga's `&@~` is AND across tokens — so `Live Oak Boardwalk` could never
  reach the `Live Oak` ↔ `Quercus virginiana` edge. It now also matches any
  contiguous run of query words against an edge's endpoint key. This makes the
  alias directory an ingest writes actually pay off on multi-word searches;
  before it, a species alias plus a cultivar term only worked when the pg_trgm
  fallback happened to fire on string similarity.

- **`scripts/match-candidates`** compares cultivars as sets: an entry and a
  candidate mismatch when both name at least one selection and they share none.
  Multi-name rows made the old scalar `<>` test wrong in both directions.

## 3.0.1

2026-08-14, harness 0.8.18 upgrade. Path-only change: the schema doc is now
read from `knowledge/files/SCHEMA.md`. No behaviour change.

## 3.0.0

Approved by Bhoumik, 2026-08-14, alongside migration 0040. Incompatible: the
columns an ingest writes for a plant's identity have changed, and so has the
table its aliases go in.

- **The name is three columns now, and `inventory.name` is derived** (§2,
  *Name*, rewritten). An ingest writes `common_name`, `botanical_name` and
  `cultivar_variety_trade_name` — each carrying **only what the source
  explicitly prints for that offering** — and a database trigger composes
  `name` as `Common [Botanical, Cultivar]`. That is byte-for-byte the format
  2.0.0 asked writers to assemble by hand, so nothing about the printed result
  moved; what moved is who assembles it. **Writing `name` on a row that has
  parts is silently overwritten**, and `name_key` / `common_name_key` /
  `botanical_name_key` / `cultivar_key` are derived too. §4 step 3 says so at
  the point of insert.

  Cultivar, variety and trade name deliberately share one column: sources do
  not distinguish them reliably, and a row that prints both a cultivar and a
  trade name (`Acer palmatum 'Wolff' - Emperor 1®`) records the cultivar in the
  column and the pair as a `cultivar` alias, rather than inventing a second
  column to hold half of it.

- **Aliases move to `plant_aliases`, and they are typed** (§2, *Aliases*,
  rewritten). `plant_other_names` is gone. Every pair now declares an
  `alias_type`: `plant` (two names for the same plant — common ↔ botanical,
  synonym, spelling variant) is compared against a row's common/botanical name,
  and `cultivar` (two names for the same selection) is compared against its
  cultivar column **only**.

  This is the substantive change, not bookkeeping. A `cultivar` edge cannot
  reach a generic row of the same species, because it is never compared to a
  column that a generic row fills — which is precisely the failure that
  migrations 0006, 0007, 0021, 0025, 0028 and 0029 each existed to clean up
  after. The old rule "no cultivar, selection, variant, trade name or patent
  code in `other_name`" is therefore **gone**: those pairs are now expressible,
  and valuable, as long as they are typed `cultivar`. Every other bar (attested
  on this line, never two line items from the same list, same thing not a
  relative, nothing generic, a name not data, not redundant) still holds, and
  mis-typing a cultivar pair as `plant` throws the guarantee away.

  Pairs now carry their evidence: **`source_id` and `source_line` are written
  with every insert**, so an audited edge is distinguishable from a fresh guess
  and traceable to the drop that wrote it. The old table recorded neither, which
  is why 0029 had to attribute a bad edge by reading id ordering. The dedupe
  trigger also rejects the **mirrored** orientation, closing the hole that let
  168 retired pairs come back reversed.

- **`scripts/match-candidates` reads the parts.** Entries take `common_name` /
  `botanical_name` / `cultivar`; a pre-0040 entry with only a whole `name` still
  works and is matched exactly as before. Candidates now show their `cultivar`,
  and a candidate whose cultivar contradicts the entry's is marked
  **`CULTIVAR MISMATCH`** and can never be suggested as an update — sibling
  selections score almost identically on the identity as a whole, which 2.0.0
  could only warn about in prose. The mark fires only when *both* sides name a
  cultivar; one side naming one and the other not is still a judgement call.

- **§5 gains a name-split check**: no row left with all three parts NULL, no
  part still carrying a bracket, a quote or a size, and a read-back of composed
  `name` values (a botanical name filed as the common name is invisible to a
  query and obvious to a reader). The alias check gains the `alias_type`
  diagnosis: a `cultivar` pair returning rows of the species without that
  cultivar was typed `plant` by mistake.

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
