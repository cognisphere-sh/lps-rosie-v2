# Changelog

Notable changes to this app home — the app (`app/`), the harness data dir
(`harness/`), and the deploy scripts. Loosely [Keep a
Changelog](https://keepachangelog.com/en/1.1.0/); dates are `YYYY-MM-DD` in
`America/Chicago`.

This project is deployed from `main` rather than tagged, so entries are dated,
not versioned. The `cognisphere-harness` dependency has its own version, called
out when it moves — its upstream changelog is
[`docs/base-harness/CHANGELOG.md`](docs/base-harness/CHANGELOG.md) (read-only
here).

> Entries before 2026-07-27 were reconstructed from git history when this file
> was started, so they are coarser than what follows. `git log` remains the
> complete record.

## 2026-08-14

### Changed

- **`supplier-onboarding-and-ingestion` 3.3.0 → 3.4.0: `search_inventory` is now
  a required gate before any insert** (§4 step 1), not a fallback for when
  `match-candidates` came back empty. Trigram similarity on the identity key
  misses a plant the supplier renamed or now prints botanically where it used to
  print the common name — precisely the entries an update-in-place ingest then
  duplicates. The skill spells out the call shape: the RPC takes no supplier
  filter, so search first and scope with `WHERE supplier_id = …` in the outer
  query, once per name form the entry gives. §5's update/insert sanity check
  re-runs it on a sample of the inserted entries.
- **Upgraded `cognisphere-harness` 0.8.17 → 0.8.18 and migrated both agents'
  on-disk notes to the new layout.** The 0.8.18 base prompt reorders itself
  around the agent's actual reading path, drops the `# Guidelines` grab-bag,
  and — the part that needed migrating — moves where notes, knowledge and
  memory live. Per agent:
  - `workspace/memory/*.md` became a single grep-able `knowledge/memory.md`,
    one section per memory (`name` / `lastUpdated` / `description`, separated by
    `-----$-----$-----$-----`). Daisy's four files became nine sections, split
    so each standing rule greps independently; nova's one became one.
  - Reference docs moved from `knowledge/` to `knowledge/files/`, indexed by a
    new `knowledge/index.md`. Daisy's `SCHEMA.md` symlink was re-pointed one
    level deeper and still resolves to `docs/supabase-schema.md`; every
    `knowledge/SCHEMA.md` / `knowledge/gmail-labels.md` reference in
    `1-agent.md`, `1.1-supabase.md` and three skills was updated to match.
  - `workspace/taskThreads/<ThreadId>/tasks.md` was folded into the parent's
    `workspace/threads/<ThreadId>/notes.md` under `## Tasks` (108 files for
    daisy, 1 for nova) and the directory removed.
  - Each thread's `summary.md` was folded into `notes.md` under `## Context`
    and deleted (336 daisy threads); loose files in a thread dir moved to
    `files/`, and a subdirectory whose name exactly matches a known task slug
    moved to `tasks/<slug>/`.
  - `workspace/index.md` was rebuilt into the new shape — 457 thread entries
    preserved and de-duplicated, dead `summary.md` paths rewritten, and the two
    stale `## Memory` sections dropped in favour of `knowledge/`.

  Skills whose only change was a reference path were bumped:
  `availability-drop-intake` 2.0.1 → 2.0.2 (it also now files results into
  `notes.md` rather than the removed `summary.md`), `plant-and-supplier-search`
  1.1.0 → 1.1.1, `supplier-onboarding-and-ingestion` 3.0.0 → 3.0.1.

  Note that `harness/agents/*/workspace/` is gitignored, so the notes half of
  this migration is not visible in the diff.

- **Column filters run in SQL now, not in the browser** (migration
  `0044_search_inventory_cultivar_keys_out`, plus `app/lib/server-filters.ts`).
  Filtering happened after the server had already paginated, so it could only
  narrow the page in hand. Measured on `Crape Myrtle`: 570 matches, 105 of them
  `15G`, but only **73** in the 300-row first page — 32 were unreachable by
  ticking the size box, and the header's "Showing 73 of 570" was wrong twice
  over. Every filter (size, cultivar, price, quantity, the three dimensions,
  supplier type/city/state, the text columns) is now applied by PostgREST as an
  outer query over the RPC result, *before* its own pagination, so the page and
  the count describe the same set.

  Adding a filter is a line in a spec rather than a migration, since the RPC
  already projects the columns; `cultivar_keys` was added to the projection
  because the cultivar cell is a comma-separated residual and selecting one name
  needs the normalized array. Option lists moved to a separate facet call keyed
  on the search term — otherwise picking one value would remove every other
  value from its own dropdown. The six dimension parameters are kept on the
  function but no longer sent, after verifying the two forms agree on three
  fixtures. Sorting, `# Items`, and a size typed into the query stay client-side,
  each for a stated reason.

- **The composed plant name is dash-delimited** (migration
  `0043_dash_delimited_plant_name`). `Forest Pansy Redbud - Cercis canadensis -
  Forest Pansy`, not `Forest Pansy Redbud [Cercis canadensis, Forest Pansy]` —
  one ` - ` between every part, in the order common, botanical, cultivar. The
  comma stopped being usable as a part separator when the cultivar column became
  comma-separated, and a spaced dash is what distinguishes the separator from
  the hyphen inside a name like `KN30-8`. Display only: the bracket and dash
  forms share one identity key and one token array, so no search result moves
  and no index was rebuilt. Ingestion skill v3.2.0.

- **A size typed into the search now ranks instead of filtering** (migration
  `0047_size_as_ranking_group`). `15g Live Oak` puts 15 G live oaks on top and
  keeps every other size below them rather than removing them; `15 gal`,
  `15 gallon` and `24 inch box` all behave the same way.

  This needed code because the tokenizer splits `15g` into `15` and `g`, which
  are close to the two least selective terms in the catalogue — `g` is in 63% of
  active rows — so the query used to return 42,099 rows with 5 G, 45 G and 200 G
  tied against 15 G. A size span is now one phrase group with a real weight, so
  it returns 6,935 rows with every top row a 15 G live oak and the 1,728 other
  sizes ranked below.

  The client-side special case is gone with it: no more `parseSizeQuery`, no
  `matchesSizeFilter`, no removable "Size: 15 gal" chip, and the query reaches
  the server whole. That closed the last filter-after-pagination fault, since
  the chip only ever filtered the 300 rows the browser held. The Size
  multiselect is unchanged — filtering by size is still its job.

- **Search rewritten: ranked, not gated** (migration `0046_bm25_search`). It now
  matches **names, size and notes**, is **typo tolerant**, matches **partially at
  both ends** (`sycamor` *and* `ycamor` find `sycamore`), expands query terms
  through aliases, and ranks by **IDF-weighted term coverage** — overlap, with
  rare terms weighted heavily. Filtering and sorting run over the ranked result.

  This replaced three mechanisms with one. The identity-intent gate is gone: it
  hard-excluded every row not matching the rarest query word, which is what IDF
  does natively without discarding anything. The pg_trgm fallback is gone —
  substring matching is what it approximated. Two pgroonga indexes now cover one
  document expression, a bigram one for substring and a whole-word one for
  fuzzy, because edit distance over a bigram lexicon is meaningless (measured:
  the typo `mvskogee` returns 0 rows through the bigram index and 188 through
  the word index).

  `Crape Myrtle Muskogee` now ranks in three clean tiers — 10.38 for rows
  matching both groups, 5.82 for the rare word alone, 4.55 for generic crape
  myrtles. **Result sets are much larger and that is deliberate**: retrieval is
  OR, so it returns 755 rows where the gated version returned 116, with the
  weakly-matched tail ranked last. Empty searches now return nothing instantly,
  retiring the long-standing "never call it with an empty search" footgun.

- **Aliases now enrich the search query, and the cultivar column takes every
  selection name** (migrations `0041_multi_name_cultivar_keys`,
  `0042_alias_query_term_expansion`). Two corrections to the change below, made
  the same day.

  `cultivar_variety_trade_name` captures **everything the printed name carries
  that the common and botanical name don't** — cultivar, variety, selection and
  trade name, comma-separated — not just the cultivar. Sources don't reliably
  distinguish them and guessing which is which loses information. Its key
  therefore became the array `cultivar_keys`, one per name, matched by overlap:
  without that, `Wolff, Emperor 1` keyed as `wolffemperor`, matched neither
  name, and the row would have silently stopped answering searches for either.
  The comma is load-bearing and the ingestion SOP now QAs for it. The app's
  Cultivar filter follows — it lists one option per name, not one per
  combination.

  **Aliases were not enriching the query at all.** The alias branch selected an
  edge only when the *whole* query matched that edge's text, and pgroonga's
  `&@~` is AND across tokens — measured, not assumed. So `Live Oak Boardwalk`
  could never reach the `Live Oak` ↔ `Quercus virginiana` edge, and the cases
  that appeared to work were the pg_trgm fallback firing on string similarity,
  which is why the same query worked through a plant's botanical name and
  returned nothing through its common name. An edge is now reached by **any
  contiguous run of query words**. The change is additive, admission is still
  exact key equality, and the identity-intent gate still runs after it, so an
  invented cultivar still returns nothing. Not observable on live data until the
  re-ingest — `plant_aliases` is empty — so the live fixtures are unchanged by
  construction; the behaviour is verified against synthetic rows. Ingestion
  skill v3.1.0, `plant-and-supplier-search` v1.2.0.

- **A plant's identity is three columns now, and the alias table is typed**
  (migration `0040_typed_plant_identity`). `inventory` gains `common_name`,
  `botanical_name` and `cultivar_variety_trade_name`, each holding **only what
  the availability source explicitly prints**, and `inventory.name` becomes the
  composition of them — `Forest Pansy Redbud [Cercis canadensis, Forest Pansy]`
  — written by trigger. That is byte-for-byte the format the ingestion SOP
  already required, so no existing row moved and the search index was not
  rebuilt; what changed is that the parts are separately readable, filterable
  and aliasable instead of having to be re-parsed out of a bracket. `name` and
  all four `*_key` columns are now derived and must never be written.

  `plant_other_names` is replaced by **`plant_aliases`**, where every pair
  declares what kind of thing its two sides name: a `plant` edge (`Live Oak` ↔
  `Quercus virginiana`) is matched against a row's common/botanical name, a
  `cultivar` edge (a variety name ↔ its trade name) against its cultivar column
  **only**. That is the point of the change — a cultivar edge is never compared
  to a column a generic row fills, so it cannot make every row of a species
  answer a search for one of its selections. Six migrations (0006, 0007, 0021,
  0025, 0028, 0029) existed to clean up exactly that; it is now closed by the
  schema rather than by a quality bar, and cultivar/trade-name pairs become
  expressible for the first time. Pairs also carry their evidence (`source_id`,
  `source_line`), and the dedupe trigger now rejects mirrored orientations —
  168 retired pairs had come back reversed in the old table.

  `search_inventory` was dropped and recreated with the three parts in its
  return type, and — since the drop was unavoidable — with `internal_notes`,
  which 0039 had left out and the app had been hydrating with an extra read per
  page. **No backfill:** all 235,976 existing rows have NULL parts and the
  13,700 alias pairs went with their table, at Bhoumik's instruction, ahead of a
  full re-ingest. Fixtures `Abelia Francis Mason` (10 rows / 9 suppliers) and
  `Japanese Holly Compacta` (4 / 2) are unchanged; `Crape Myrtle` moved 548/35 →
  532/30, which is the retired alias directory and is temporary.

  App-side: the plants table's **Plant** column shows the composed identity and
  is now read-only, with **Cultivar** visible beside it (multi-select filter,
  both in the column header and as a **Cultivar: Any** dropdown in the Plant
  search toolbar) and common/botanical name available through the column picker.
  **Also known as** no longer repeats a name already spelled inside the Plant
  value. Ingestion skill v3.0.0, `plant-and-supplier-search` v1.1.0,
  `availability-drop-intake` v2.0.1; `match-candidates` reads the parts and
  marks a candidate whose cultivar contradicts the entry's as
  `CULTIVAR MISMATCH`.

- **An ingest now refreshes availability instead of replacing it** (ingestion
  skill v2.0.0). Every drop used to insert a fresh copy of the supplier's whole
  catalogue and then flip the previous rows `is_active = false`. It now finds the
  row each parsed offering already has and **updates** it, **inserts** only what
  is genuinely new, and **reactivates** rather than duplicates a plant the
  supplier has brought back. **Nothing is retired** —
  not `inventory` rows, not `inventory_sources`. An offering the supplier stopped
  listing keeps `is_active = true` and its older `source_id`, and that is now the
  staleness signal: "when did we last see this" is answered by the row's source,
  not by a flag. Taking an offering out of circulation became a deliberate,
  separately approved act, so a discontinued item is reported under *Flags
  needing Chris* rather than flipped mid-ingest.

- **Rows are matched by looking, not by key** — new
  `scripts/match-candidates` in the ingestion skill. Matching on
  `(supplier_id, name_key, size)` looks decisive and isn't: a supplier who
  respells a name, re-punctuates it, adds a cultivar, changes container, or
  switches between the botanical and common name makes an existing offering
  invisible to the key, and an update-in-place ingest then duplicates it. The
  script instead returns, per parsed entry, up to five of that supplier's
  **active** rows plus the single best **retired** one, ranked by trigram
  similarity on the plant identity with a size-agreement bonus, over a
  deliberately narrow column set — id, name, size/size_std, price, quantity,
  dimensions, is_active, and how many identical rows collapsed into each line.
  Notes are not fetched: they are long and never tell two offerings apart. The
  agent reads the candidates and decides update / insert / reactivate / flag;
  the script's `SUGGEST` column buckets by score alone and says so.

  Two details came out of testing it against live data. Retired history badly
  outnumbers live rows on established suppliers — supplier 32 carries 34.9k rows
  of which 5.4k are active — and a single ranking let dead clones take all five
  slots, so active and inactive are ranked separately. And identical rows are
  collapsed to one line with a count, because otherwise five copies of the same
  retired row crowd out the one you need. Measured cost: ~4.8s for 200 entries
  against the largest supplier.

  Two consequences of update-in-place worth knowing. A bad parse now
  **overwrites** good data instead of sitting beside it, so QA got stricter,
  including a new check for the characteristic failure of this model — a repeat
  drop that reports mostly *inserts* means candidates were taken at face value
  and the catalogue has just been duplicated. And the identity of a row is **not
  unique today**: a count run while
  writing this found 5,714 `(supplier_id, name_key, size, height, width,
  caliper)` keys across 77 suppliers matching more than one active row — roughly
  13,500 rows, about two-thirds of them carrying the same price *and* the same
  printed name, which is what the old replace-and-retire model left behind when a
  retirement pass missed. So the skill splits the multi-match case: same price and
  name means duplicates (update the one with the newest source, leave the rest,
  list them under a new *Duplicates found* report line), while differing price or
  name means two real offerings the key can't tell apart (touch nothing, flag for
  Chris). **That backlog is worth a cleanup migration** — under the no-retirement
  rule an ingest will never resolve it on its own.

- **`inventory.notes` and `inventory.internal_notes` are now separate columns**
  (migration 0039). `notes` is evidence — what the supplier printed or said about
  the offering, dated. `internal_notes` is commentary — why a combined size was
  split, that a quantity is the supplier's shared/tentative count, that no price
  was printed, parse caveats, QA exceptions. On an update `notes` is replaced
  with the current drop's text and `internal_notes` is appended to, so a later
  reader can tell "the supplier says two weeks" from "we guessed two weeks".
  `inventory_enriched` carries both. `search_inventory` deliberately still
  returns only `notes` — changing its fixed `RETURNS TABLE` means dropping and
  recreating the most load-bearing function in the app, which this change didn't
  warrant — so the app fills `internal_notes` in for the two RPC-backed paths
  with one keyed read per page and the column reads the same however the rows
  were fetched. **The plants table now has an editable "Internal notes" column**
  (hidden by default, like Notes). Rows written before today hold a mix of both
  kinds in `notes` and were not reclassified.

- **One availability file is not one supplier** (ingestion skill §0.1, rewritten).
  A multi-location group's single sheet routinely covers several farms, so the
  unit of mapping is the availability **row**, not the file: each parsed offering
  gets its own `supplier_id`, and one drop can legitimately write to five
  suppliers. Precedence is most-specific-wins — a per-row "Ship from" column beats
  a section heading, which beats the file header — and only when the file names no
  location *anywhere* does every active location in the group get its own copy of
  every offering (Everde's five farms × 900 offerings = 4,500 rows, each with its
  own source row and its own upsert pass). Ambiguity is never resolved by falling
  back to "all locations"; it stops and asks.

- **`availability-drop-intake` and `supplier-onboarding-and-ingestion` are now
  mutually exclusive** (both v2.0.0). They had drifted into restating each other:
  supplier identification appeared in both, and each enumerated the other's half
  of the handoff. Intake now coordinates and talks to humans and **writes no
  database row**; ingestion **owns every write** and talks to no one, routing
  anything a human must answer through its report. The two shared contracts are
  single-sourced — the brief is canonical in intake §2 and the report is canonical
  at the end of the ingestion skill, each pointing at the other instead of
  repeating it. Ingestion's leftover supplier search became a
  confirm-don't-re-derive check on the main agent's lookup.

- **cognisphere-harness 0.8.11 → 0.8.17, and Daisy's SOP became six skills.**
  0.8.12 made *skills* the home for procedural memory: a `1-*.md` prompt file is
  deployment-owned and carries identity, persona and behaviour only, and every
  step-by-step procedure lives in `skills/agent/<slug>/` with a version in its
  description, a `CHANGELOG.md`, and its own scripts/artifacts. So
  `knowledge/SOPs/supplier-onboarding-and-ingestion.md` is now the
  **`supplier-onboarding-and-ingestion`** skill (v1.0.0, content unchanged), and
  the procedures that had accreted in `1-agent.md` and `1.1-supabase.md` came out
  as **`availability-drop-intake`** (the coordinator loop: identify the supplier,
  brief the task thread, digest its report, label the email),
  **`plant-and-supplier-search`**, **`supplier-communication-log`**,
  **`supplier-email-reply`** and **`share-file-with-user`**. `1-agent.md` is
  roughly half its former size and now names the *situation* that triggers each
  skill instead of restating its steps; the standing rules that are behaviour,
  not procedure — never email a supplier unbidden, never write generated `*_key`
  columns, one row per location — stayed put. `knowledge/gmail-labels.md` keeps
  the label IDs (reference facts) and lost the apply-a-label steps.
  **Changing any of these skills still needs Chris's or Bhoumik's approval**,
  followed by a version bump; the approval rule moved with the content.

  The rest of the window: both agents' `0-base_prompt.md` reseeded (skills, the
  system-prompt ownership contract, per-call context checkpoints, one daily-note
  entry per thread per day, and 0.8.17's rule that task-thread delegation is
  aggressive by default); `context-meta.ts` rewritten and a new
  `skill-update-notice.ts` extension added, which tells a long-running agent when
  a skill it read has since changed; the shipped `create-skill` skill installed
  in both agents; and nova's persona file renamed `1-dev-agent.md` → `1-agent.md`.

- **App-specific deploy logic moved to `scripts/app/`.** 0.8.12 made the deploy
  scripts harness-owned and refreshed on upgrade, with deployment-owned hooks
  sourced at fixed points. The two local edits this home carried — passing
  `SUPABASE_URL`/`SUPABASE_SECRET_KEY` into `app/.env.local` from
  `scripts/server.sh`, and documenting those keys in the root `config.example` —
  are now `scripts/app/secrets.sh` and `scripts/app/config.example`. Behaviour is
  unchanged; the next upgrade no longer needs a hand-merge. Fresh-clone setup is
  `cp config.example config && cat scripts/app/config.example >> config`.

### Added

- **Multi-location suppliers are a first-class shape** (migration 0033). A
  nursery that grows or sells at several sites was already several `suppliers`
  rows — Everde has five, Moon Valley seventeen — but nothing tied them
  together, so "every Everde location" was a guess from names that don't parse:
  `Everde Growers`, `Everde Growers - Glen Flora Farm`, `EVERDE GROWERS -
  BUNNELL`, Newton with no dash at all, Calloway's with an em dash. A
  `supplier_groups` row now names the company and `suppliers.group_id` points at
  it; each location stays its own row, because stock, prices and pickup are per
  site. `group_id IS NULL` means one location, not "unknown".

  16 groups seeded over 57 supplier rows, identified by hand from a shared brand
  name **and** a shared website domain. Nothing was merged or retired. Families
  that matched only one half of that test — Hawkins TX/SC, New Life NJ/MI,
  Groundworks TX/FL, a possible fourth Tree of Life site — and three same-city
  sets that look like duplicates rather than locations (Acosta, R. Plants, Old
  Courthouse) are listed at the bottom of `0033_supplier_locations.sql` for
  Chris to confirm. A wrong group is not cosmetic: it fans a supplier's
  availability out to a nursery that never offered it.

  Daisy's ingestion SOP gained §0.1 for it: **a drop that names a location is
  written to that location alone; a drop that names none is written to every
  location in the group**, each with its own `inventory_sources` row and its own
  version swap, and per-location row counts in the report. Naming a location the
  group doesn't have onboards it as a new row in the same group. Anything
  ambiguous stops and asks rather than guessing which farm claims the stock.

- **One contact can be the point of contact for several nurseries** (migration
  0034). `contacts.supplier_id` said a person belongs to exactly one — wrong at
  a multi-location company, where one inside-sales rep quotes across every farm.
  It forced a duplicate contact row per location, five "same" people who drift
  apart as one of them gets a new number, and made "who else does she cover?"
  unanswerable. `contacts` now describes the person or inbox; the tie to a
  supplier is a `supplier_contacts` row, and `is_primary` moved onto it too
  because the rep who answers at Bunnell need not be the one at Canal Point.

  1,843 links backfilled one per existing contact, then **migration 0036 merged
  the duplicates that column had forced — 33 rows into 13**, every link kept.
  Jim Ord is one contact with six nurseries instead of six contacts; Ken Howard
  one with five; Jana Dean one across both Klepac sites. 20 rows retired, each
  noting where it went, and one link deleted where a contact had been entered
  twice at the same supplier.

  The match was email **and** phone, with no field of one contradicting the
  other. **Email alone would have been wrong**: `info@calloways.com` is three
  rows with three phone numbers and two different store managers, and the phone
  lives on the contact rather than the link, so merging on the shared inbox
  would have deleted working numbers. Twelve such groups were left alone and are
  listed at the bottom of `0036_merge_duplicate_contacts.sql`. Verified after
  apply: no link lost, no supplier left with two primaries, no name, title or
  note dropped — and reversible from the `contacts_merge_map` /
  `contacts_pre_merge` / `supplier_contacts_pre_merge` snapshots.

  There are now two levels of `is_active` and they say different things: the
  person left the company (`contacts`) versus they stopped covering this
  location (`supplier_contacts`). Removing a contact from a supplier in the app
  retires the link, not the person — their other locations are untouched — and
  the card says "Also covers X, Y. Edits here change them there too", because
  the edit form writes the shared person. Deactivating a supplier cascades to
  its links and retires a contact only when it was their last one.

  The SOP's §0.3 now says to **link, don't duplicate**: look for the person
  across the whole group before inserting, work out how many locations they
  cover from what the source actually says — a signature reading "Inside Sales —
  all farms" is every location, "Yard Manager, Bunnell" is one — and link only
  what is attested.

- **Suppliers and Plant search page through their full result set, and say how
  big it is.** Both headers ended at the first server page — Suppliers read the
  first 50 matches of `search_suppliers` and Plant search the first 300 rows of
  `search_inventory` — and their summaries counted only what had been fetched,
  so "Showing 50 of 50 suppliers" was really "of 1,376" and there was no way to
  see the 51st. Each toolbar now carries Previous / Next with `Page N of M`, and
  the summary reads `Showing 42 of 1,376 suppliers` — the total is the whole
  match count from PostgREST's `count: 'exact'`, not the page. It costs nothing:
  both RPCs are `plpgsql` and already materialize their full result before the
  page is sliced off (measured: 229ms with the count, 221ms without).

  The page number resets to 1 whenever the question changes — a new search term
  on either page, or a new dimension bound on Plant search — so a page 7 can
  never outlive the result set it belonged to. The count left of it is still the
  count *shown*, so client-side filters (supplier type, city, state, size, the
  numeric ranges) visibly shrink it while the total stays put. Those filters,
  and Plant search's supplier grouping, keep applying to the current page only.

### Changed

- **One plant, one name on the plants page.** `Thuja occidentalis 'Smaragd'`,
  `Thuja occidentalis [Smaragd]` and `Thuja occidentalis ['Smaragd']` were
  three rows-groups in the UI for one plant, because the cultivar delimiter
  drifted between suppliers and between ingests. Migration 0035 rewrites the
  quoted forms into the SOP's bracket form across **2,965 names / 7,691 active
  rows**, collapsing **1,013 duplicate display identities** (distinct active
  names 26,491 → 25,478). Active rows only; retired history keeps its printed
  text.

  Search is provably untouched: `normalize_plant_key()` strips non-alpha
  characters and `normalize_search_text()` maps punctuation to a space, so
  every affected row already shared one identity key *and* one search token
  stream with its twins — verified 0 key changes and 0 token-stream changes
  after apply. That is also why no `plant_other_names` edge moved, which is the
  thing that went wrong when 0005 last rewrote names and 0007 had to retire
  48,269 alias pairs behind it.

  **The bracket contents are not backfilled.** The SOP fills
  `Name [scientific name, variant]` from what the source printed, so the
  missing scientific and common names cannot be recovered with SQL — 0005 tried
  deriving them from the alias graph and abandoned it as too unreliable. That
  work is a per-supplier re-parse of the 491 stashed sources under SOP §5, and
  remains open. 642 names / 1,386 rows that still carry a quoted cultivar were
  also left alone on purpose: they mix in form/grade words, dash-separated
  trade names (`Acer palmatum 'Wolff' - Emperor 1®`), foot marks and internal
  apostrophes, and each needs a judgment a regex cannot make. Full list and
  rationale in `harness/agents/daisy/migrations/NOTE.md`.

### Fixed

- **Newton Nurseries Spring was routing to a closed company's inbox**
  (migration 0037). The 0036 merge flagged this as "a Newton location carrying
  another farm's contact details"; checking it before changing anything showed
  that read was half wrong, and the wrong half mattered. **Newton acquired Riley
  Fuzzel in 2023** — the site trades as "Riley Fuzzel - Newton Nurseries" at 630
  Riley Fuzzel Rd — so the phone `281-355-5495` is genuinely that yard's and is
  unchanged. The *email* was the problem: `info@rileyfuzzelfarm.com` is the
  acquired company's own inbox, now listed as closed, so availability requests
  for the Spring yard were reaching the previous owner. The location now has its
  own `Main line` contact with the verified phone and **no email** —
  `spring-sales@newnurseries.com` would match its three siblings on file, but no
  readable source prints it and the SOP forbids inventing a contact value. The
  old row keeps serving Riley Fuzzel Farm, unchanged.

- **Riley Fuzzel Farm retired — it was Newton Nurseries Spring under its old
  name** (migration 0038). The two supplier rows sat at the same street address
  because Newton acquired Riley Fuzzel in 2023; both were created by the same
  2026-08-05 backfill from different angles, and neither had ever been contacted
  or ingested from. 963 is soft-deleted with a note pointing at 1320, and
  **nothing was lost**: no inventory, sources, availability queries or notes were
  attached to it.

  1320 takes the address it should have had — Newton relocated the Spring yard
  to 21121 N Fwy Service Rd, Spring TX 77388, keeping the same phone. Because the
  retirement note names Riley Fuzzel and `suppliers.notes` is in the search
  document, searching "riley fuzzel" now returns exactly one row: Newton
  Nurseries Spring, at the current address. Coordinates stay null rather than
  inherit the retired row's, which point at the old site.

  This was also the first production run of 0034's rewritten deactivation
  cascade, and it did the new thing correctly: retiring the supplier retired its
  contact link and then the contact itself, because that was its last location.

- **A phone number stored with a leading colon.** Lynn Agee's row at YC Nursery
  - Prosper held `:214-213-0962`. The delimiter is stripped; the digits are left
  as printed, because that row and its sibling differ in the last digit
  (…0961 vs …0962) and only the source can say whether that is two lines or a
  typo.

## 2026-08-13

### Added

- **`inventory.size_std` — one checkbox per real container, instead of one per
  spelling.** The size facet listed raw `size` text, so `15 G`, `15G`, `15 gal`,
  `15 G/17"` and a 17" pot were five separate boxes out of 1,722 distinct active
  values, and picking "15 gallon" meant ticking whichever spellings you happened
  to spot. Migration 0030 adds `size_std` beside `size`, exactly as `height_std`
  sits beside `height`: `size` stays the supplier's printed evidence and is what
  the table cell shows, `size_std` is the one bucket the row belongs to and is
  what the filter selects on. Vocabulary approved by Bhoumik: `<N>G`,
  `<N>" Box`, `Bare Root`, `Liners`, `Plug`, `Trays`, `Field Grown`,
  `Grow Bags`, `Root Pruned`, `other`. The gallon and box families are **open
  sets** — the CHECK constraint tests the shape, not a fixed list — so a
  supplier who starts selling 12G needs no migration, and the number is always
  the one the source printed rather than a rounded neighbour. `inventory_enriched`
  and `search_inventory` both carry the column (the RPC had to be dropped and
  recreated for the return type; grants restored, `security_invoker` preserved
  on the view), and `inventory_supplier_size_std_idx` backs the facet. `size_std`
  is deliberately **not** in the pgroonga document — raw `size` already carries
  every spelling a search could type.
- **The size filter offers the standard, in the standard's order.** Word grades
  first, then gallons and boxes ascending **by number** (`2G`, `15G`, `100G` —
  not alphabetically), then the remaining word grades, then `other` last;
  sorting the Size column follows the same order. `app/lib/size-std.ts` holds
  the rule with a self-check (`node lib/size-std.check.mjs`). Stored selections
  moved to `lps.plant-search.size-choice.v3` and the two earlier keys are
  deleted on load, since raw-text selections mean nothing against buckets.

- **`B&B` and `<N>" Pot` buckets** (migration 0032, same day). The 0031 backfill
  left 8,589 rows in `other`, and its two biggest occupants were real containers
  a buyer would filter on: balled-and-burlapped stock (3,224 rows, 219 distinct
  spellings) and bare pot diameters with no gallon equivalent (2,122 rows, 52
  diameters). `B&B` joins the word grades — the burlapped ball *is* the
  container. `<N>" Pot` is a third open numbered family beside `<N>G` and
  `<N>" Box`; the three don't overlap, and which one a bare diameter joins is a
  judgment about the row: a diameter with a gallon equivalent stays a gallon
  (17" is `15G`), one that is really a box becomes `<N>" Box` even unlabelled
  (desert growers print a bare `36"`), and the rest are pots. A diameter
  attached to merchandise — Austin Plant Supply prices planters, bowls and hand
  tools the same way — stays `other`. **`other` fell 8,589 → 3,326**, now 5.3%
  of mapped rows and mostly quarts, six-packs and hanging baskets; buckets 52 →
  66. The filter orders pots before gallons, so the list runs smallest container
  to largest, and `B&B` sits with the field-dug grades.
- **Heights and calipers lifted out of B&B strings.** `B&B; 3-4' HT`,
  `4 - 5'; B&B` and `30 - 36"; B&B` printed the plant's size next to the
  container; those measurements moved into `height`/`caliper` with their
  `*_std`, **added only where the column was empty** and never substituted, so
  2,557 B&B rows now answer the height filter. 13 pairs were held back —
  topiary standards printing both a stem height and a head size, and sheared
  globes whose diameter is arguably width. Unlike 0031 the `size` text stays
  put, since these rows do have a real container in it.

### Changed

- **Every active row is bucketed, and 6,705 misfiled measurements left `size`.**
  Migration 0031 backfilled all 62,572 active rows: 54,821 carry a `size_std`
  across 52 buckets (`1G` 8,986, `other` 8,589, `3G` 7,445, `15G` 5,099, `5G`
  4,358, `Trays` 3,814), and the 7,751 with no container are `NULL` in both
  columns. 1,336 distinct printed size strings now collapse onto those 52
  checkboxes. Retired history rows are untouched by design (Bhoumik decision).
  The mapping came from 12 subagents classifying all 2,783 active
  `(supplier_id, size)` pairs against one shared ruleset — **the pair, not the
  string, is the unit**, because `2.5"` is a caliper at supplier 100 (Quercus,
  Magnolia, caliper column already holding 2.5) and a pot at supplier 73
  (Begonia, Narcissus). Verified afterwards: no active row has a `size` without
  a `size_std`, no `size_std` is stranded on a row whose size was lifted, and no
  supplier/size pair is split across two buckets.
- **`size` no longer holds heights and calipers.** 6,705 rows had a measurement
  the SOP has banned from `size` since 2026-08-05 — `5-6'`, `3/4'`, `30/36"`,
  `2.5"` on a shade tree — moved into `height`/`caliper` with the paired
  `*_std` in feet/inches, and both `size` and `size_std` cleared. The move is
  deliberately conservative: it fires into an empty column, one holding the same
  text, or one holding the range's own lower bound (`height = '4'` beside
  `size = '4/5'''` is one measurement, and the fuller range wins the text while
  `height_std` keeps the lower bound). A column holding a genuinely **different**
  value is left completely alone and only gets `size_std = 'other'` — a 4" pot on
  a 6"-tall Carex keeps both facts. 47 pairs whose reading was uncertain were
  likewise left in place rather than guessed.

- **"Soft leaf yucca" no longer returns Spanish Dagger.** Chris asked for
  Softleaf Yucca pricing at Austin Plant Supply and got a 15 G *Yucca gloriosa*
  at $101 alongside the correct rows. One false alias was responsible: id 44255,
  `Yucca gloriosa ↔ Yucca, Soft Leaf`. It was verified as the sole admission
  path — the Yucca gloriosa document matches neither
  `pgroonga_condition('soft leaf yucca', 0.34)` nor the `<%` trigram predicate
  (word_similarity 0.375), and of the ten active edges incident to
  `yuccagloriosa` only 44255 matches the query. Unfiltered it put **9 wrong rows
  across 4 suppliers** into a 20-row result. Approved migration 0028 retires it
  with 15 more Yucca edges of the class 0021 and 0025 already covered — a
  cultivar, selection or form name sitting in `other_name` against a bare
  species. Two of those searches were 100% wrong: `yucca jewel` returned 9 rows
  of plain *Yucca gloriosa* and `yucca rancho blue` 14 rows of plain *Yucca
  rostrata*, though no inventory row of either selection exists. After: `soft
  leaf yucca` 20 rows / 10 suppliers → 11 / 7, every one a genuine soft-leaf
  yucca; `yucca jewel` and `yucca rancho blue` → 0; controls `adams needle`,
  `red yucca`, `spanish dagger`, `yucca pendula` and `yucca recurvifolia`
  unchanged. Searching a bare species no longer reaches its cultivar rows
  through an alias — the same tradeoff 0021 and 0025 made deliberately, and the
  cultivar rows still match their own printed names. No inventory row changed.

- **The whole alias directory was audited; 4,654 false pairs retired (migration
  0029).** Chris's yucca bug was one bad edge, so the same defect classes were
  swept corpus-wide. Twenty reviewers covered all 13,553 active pairs against a
  rubric built around a **buyer's test** — "if someone ordered one and received
  the other, would that be a wrong shipment?" — because the previous audit had
  reviewed the yucca pair and cleared it by reasoning from taxonomy. Thirteen
  adversarial verifiers then tried to refute every flag, defaulting to *keep*
  when torn, since a wrongly retired alias breaks a real search silently while a
  wrongly kept one stays visible. Of 4,993 flags, 264 (5.3%) were refuted and 75
  low-confidence entries held back, leaving 4,654 retired: 3,981 cultivar-link,
  275 data-not-name, 194 generic-category and **204 wrong-taxon** — the last more
  than double the 96 the previous full-corpus pass found, and the class that
  produced the original complaint (`Abies alba ↔ White Fir`, which is
  *A. concolor*; `Acer truncatum ↔ Norway Maple`; `Araucaria bidwillii ↔ Monkey
  Puzzle`). Active pairs 13,553 → 8,899. The refutation pass rescued genuine
  trade names that would have broken searches — `Artemisia stelleriana ↔ Dusty
  Miller`, `Agave weberi ↔ Blue Weber Agave`, `Arecaceae ↔ Palms`, and the whole
  name-plus-grade class (`River Birch Multi Trunk`, `Chilean Mesquite standard`).
  Regression across 20 searches: rescued pairs and untouched hubs unchanged,
  wrong-taxon removals landed (`norway maple` 16→13 rows / 2→1 supplier,
  `monkey puzzle` 9→6), `red yucca` 57→54 as three generic *Hesperaloe funifera*
  rows stopped arriving through retired `RED YUCCA LITTLE GIANT` cultivar-links.
  Bare-hub counts barely moved (`acer palmatum` unchanged despite 75 retired
  edges, `rosa` −13 rows despite 187) because those rows match their own printed
  names — the aliases were redundant for finding them and load-bearing only for
  the false cross-matches. Coverage was proven, not assumed: each flag was mapped
  back to its position in the canonical ordering and checked against its
  reviewer's window. That check caught a real defect — concurrent agents sharing
  one scratchpad corrupted each other's cached tool results, so three windows
  collided and two (~1,356 pairs) went unreviewed while the row total still
  summed to 13,553. Those were re-run against explicit boundary ids. Evidence in
  `workspace/threads/main/alias-audit-complete-20260813/`. No inventory changed.

### Changed

- **The ingestion SOP now tests evidence instead of botanical knowledge.**
  Every alias guardrail was previously a knowledge test — "never two different
  species" only helps someone who knows soft-leaf yucca is *Yucca recurvifolia*,
  and knowledge tests fail silently. 44255 was created by pairing a supplier's
  printed label (`Yucca, Soft Leaf`) with a botanical name the writer chose,
  when that same source printed the right one on the row itself. §2 now requires
  **both sides of a pair to be printed in the source being ingested**, quotable
  from one line, never supplied from the writer's own knowledge, the web, or
  another supplier's list; adds "never two line items from the same list", since
  a supplier does not price one plant twice under two names; and settles
  taxonomic disputes with **the trade wins** — names sold as different products
  are different plants. §5 QA gains a mechanical alias check: search both sides
  of every new pair, retire it if either returns an identity that is not the
  plant just ingested, and report the source line that attests it.
  The schema doc records what the table cannot tell you (no `created_at`,
  `source_id` or confidence, so an audited edge looks like a fresh guess) and
  two holes in the dedupe trigger: it dedupes only one orientation, so a
  mirrored pair inserts cleanly — 168 mirrored rows exist and one retired pair
  already has an active mirror — and the 2026-07-31 cleanup deleted its retired
  pairs rather than keeping them as tombstones.

## 2026-08-12

### Changed

- **Ingestion SOP and schema doc now describe the post-0026 alias semantics.** Both still claimed search "hops between siblings" through the alias graph — the exact behavior migration 0026 removed. They now state that search and *Also known as* use only pairs directly incident to a row's identity, cite the 0021/0025 focal retirements as the standing cautionary record, and the schema doc's `plant_other_names` counts reflect the live directory (13,700 pairs / 13,563 active) instead of the pre-0021 "all active" snapshot.

## 2026-08-11

### Changed

- **Supplier geography/type filters are now searchable multiselects in both list-page toolbars.** Plant Search and Suppliers expose Supplier type, City and State beside the natural search field; multiple selections use OR within one field while type/city/state combine with each other and the text query. The controls share the existing column-filter state rather than creating a second filtering path, work in the wrapped mobile toolbar, remain visible before and during a Plant Search rather than appearing only after results load, and Clear all resets them with the other page filters. Plant Search keeps price and numeric dimensions in a compact mobile toolbar disclosure without duplicating those primary controls.
- **Mobile Plant Search results now arrive as a supplier shortlist.** The redundant second Filters/results-summary card is gone, and supplier inventory details start collapsed whenever a new result set arrives. Name, type, location and match count remain visible; the chevron expands an interesting supplier in place while its underlined name still opens the full profile.
- **Inventory dimensions now separate source evidence from numeric filtering.** Approved migration 0022 moved 2,309 explicit dimensions out of `inventory.size` into the existing human-readable height/width/caliper fields with exact guards. Migration 0023 adds nullable `height_std` (feet), `width_std` and `caliper_std` (inches), preserves lower-bound range semantics, appends the fields to both views and `search_inventory`, and applies six inclusive bounds before global result caps or supplier pagination. Desktop column headers and mobile filters show unit-labelled min/max controls while cells/cards retain source strings; invalid API bounds return 400, null standards remain unknown, and an unpaired manual string edit clears its numeric companion rather than leaving stale evidence. Guarded migration 0024 then backfilled 94,297 rows directly from their displayed fields: height 75,357, width 40,537 and caliper 22,589. Exact float conversions, full outside-target digests and display/filter regressions passed; no human string, timestamp, identity, source, price, quantity or activation value changed.

### Fixed

- **Cultivar-specific Plant Search no longer admits sibling cultivars through shared species hubs or generic fuzzy words.** After the approved 66-edge Crape Myrtle cleanup, migration 0026 removes reverse-hub sibling traversal from `search_inventory` and `inventory_enriched`, returns only direct reviewed aliases, and requires the least-common distinguishing token for multi-word identity searches with bounded typo/prefix tolerance independent of word order. `Crape Myrtle Muskogee` and its reverse fell from 442 rows / 30 suppliers / 344 wrong identities to 98 / 20 / zero; generic Crape Myrtle remains broad. The UI now says **Also known as**, and the browser no longer re-refines backend results through alias text. Follow-up migration 0027 applies explicit selected-word prefix matching in both intent selection and the final gate; the server also no longer splits an empty specific query into generic one-word searches, so invented cultivars fail closed. Abelia Francis Mason, Japanese Holly Compacta, Clusia Small Leaf, typo/prefix, dimension-bound, desktop and mobile regressions pass.
- **Francis Mason no longer inherits sibling Abelia cultivars through unsafe bare-species hubs.** With Bhoumik's approval, migration 0021 retired 15 audited Abelia alias edges while preserving four legitimate `Abelia × grandiflora` / Glossy Abelia mappings. Florida + 3 G now returns exactly Joe's Nursery Francis Mason instead of also returning Rose Creek; generic Abelia stays broad. No inventory changed.

### Security

- **RLS enabled on `inventory_pre_size_normalization`** (migration
  `harness/agents/daisy/migrations/0020_enable_rls_size_snapshot.sql`). The
  0019 rollback snapshot was created after the 0011 RLS sweep, so it was the
  one table PostgREST still served to `anon` — flagged by the dashboard's
  `rls_disabled_in_public` linter. No policies: only `postgres`/`service_role`
  read it, and it is still slated to be dropped once the size change settles.

## 2026-08-05

### Added

- **Suppliers record how their availability reaches us.** Migration 0018 adds
  three nullable columns to `suppliers` — `availability_source_type`
  (`Email` | `Hosted`), `availability_update_days` (a whole number of days) and
  `hosted_availability_url` — and the Suppliers table and supplier profile show
  and edit all three. This was previously prose in `notes` ("sends an XLSX every
  Monday"), which nothing could filter or sort on. Null means **not established
  yet**, not "none", so every one of the 910 rows starts blank, and nothing ties
  the URL to a `Hosted` source type: half-filled rows are normal while someone
  works out how a supplier publishes, and suppliers that both email a sheet and
  post one exist. `search_suppliers` was recreated to return the three columns
  (its return type is fixed, so the app cannot see a new column otherwise) and
  to accept them as sort keys; the pgroonga document was deliberately left
  alone, so searching "Hosted" does not find hosted suppliers — filter the
  column instead. Editing the source type uses a new `select` cell kind that
  saves on change, and the hosted URL is the first editable `url` cell: it keeps
  its link and puts the editor behind a hover pencil.
  Daisy's onboarding SOP now tells her to fill the three columns during browser
  enrichment and to report which she set (**approved by Bhoumik, 2026-08-05** —
  the SOP requires approval to edit). Two rules in that wording matter: the
  refresh interval is recorded **only when the supplier states it**, never
  inferred from two drops falling a week apart, and an existing non-null value
  is never overwritten without evidence it changed.
- **Supplier contacts are their own table.** `public.contacts` holds one row per
  person at a supplier (`name`, `email`, `phone`, `title_department`, `notes`,
  `is_primary`, `is_active`, `supplier_id`), replacing the single
  `suppliers.poc_name` / `poc_email` / `poc_phone` triple — a supplier can now
  have as many contacts as it has people. A partial unique index allows one
  active primary each, so promoting a contact means demoting the incumbent
  first. The supplier profile gains a **Contacts** tab of cards with edit, add,
  make-primary and remove; the Suppliers and Plant Search tables swap the three
  `PoC` columns for **Primary contact / email / phone** (read-only, resolved
  from the primary) plus an **Other contacts** column listing `Name [Title]` and
  deep-linking to that tab.
- **Supplier search reaches through people.** `search_suppliers` returns
  `primary_contact_*` from a lateral join over `contacts`, and matches a
  supplier when any of its active contacts matches on name, email, phone or
  title. Because an index expression cannot read another table, contact text
  left `suppliers_pgroonga_idx` for a new `contacts_pgroonga_idx`, and matching
  `supplier_id`s are folded in as a precomputed array — the same shape as the
  existing trigram fallback, so the main branch still uses its index.
  Contact-only matches score 0 and sort after direct matches.

### Changed

- **38,090 legacy `inventory.size` values standardised (migration 0019).** The
  cause was worth the dig: `normalize_size(text)` has been in the database all
  along and **nothing ever called it** — no trigger, no generated column, no
  default — so the SOP's size rule applied only when a parsing agent remembered
  to hand-apply it. `1G` (8,533 rows) and `1 G` (7,096 rows) were two values in
  the same table, as were `3G`/`3 G`, `15 G / 17"`/`15 G/17"` and `024 Inch
  Box`/`24" Box`. Running the existing function over the existing rows took
  distinct sizes 5,255 → 4,974 (2,769 → 2,671 active), which is what collapsed
  the duplicate checkboxes in the new size filter.
  **Syntactic only** — unit spelling, spacing and leading zeros. Qualifiers
  (`6 G; Bush`, `3 G TRUE`, `1 G <24"`) and height/caliper values parked in
  `size` (`5-6'`, `2-2.5"`) were left untouched; separating those is a semantic
  change needing source review, and it is why the filter still lists ~2,671
  choices. 12 `#N box|bag` rows were excluded because `#` means gallons but a
  box is sized in inches, so `#24 Box` → `24 G Box` may be flat wrong — they are
  listed in the migration NOTE for a human to check against the source.
  Verified: 0 rows lost alphanumeric content, 0 sizes nulled, row count
  unchanged, search unaffected. `inventory_pre_size_normalization` holds the
  pre-rewrite values until this settles.

- **Daisy's size rule became a size standard** (SOP §2, approved by Bhoumik).
  One line about unit spelling grew into: canonical units with a conversion
  table, `normalize_size()` named as the reference implementation, the `#N box`
  exception, when a word (`B&B`, `Field Grown`, `Quart`) is a valid size, and an
  explicit list of what must **not** go in `size` — height/width/caliper, form
  and grade codes, pack counts, and anything guessed. It also tells her not to
  bulk-fix legacy rows as a side effect of an ingest.

- **The Plant Search size filter now lists the raw `size` values, not
  categories.** The selector used to normalize each row into commercial buckets
  — collapsing `15 G`, `15G` and `15 G/17"` into one `15 gal` choice, splitting
  a `3–5 G` range into its endpoints, and inferring gallon/box/caliper types
  with plausibility guards (calipers had to be inch-qualified and ≤ 20 to keep
  known source noise like `caliper = 215` out). It read as tidy but hid what the
  rows actually say, and any size the classifier did not recognize was simply
  unfilterable. It is now a checkbox list of every distinct `size` string in the
  current matches, matched by exact text, which is what the Size column filter
  on desktop already did. Stored selections moved to
  `lps.plant-search.size-choice.v2` because the old keys (`gallon:15`) mean
  nothing now; the v1 key is cleaned up on load. Size typed *into the query*
  (`15g Agave Americana`) is unchanged — it still parses the token out of the
  plant name and matches by value, so it finds a row listed as `15 gal`.

- **Multiselect column filters have a search box.** Their options come from the
  rows on screen, so Size, City and similar columns list hundreds of values and
  finding one meant scrolling the whole dropdown. The search narrows the visible
  list only — selections outside the current search stay selected. Matches the
  supplier multiselect, which already had one.

- **Contact people moved out of `suppliers.notes`.** All 54 suppliers with notes
  were read by hand; the people written into that prose before `contacts`
  existed are now rows — 29 inserted (47 → 76), 12 existing rows gained the role
  the notes described, 3 a missing email or phone. 20 notes were trimmed, 5 of
  them to empty. Notes keep hours, addresses, policies, parsing quirks and
  business history. Verified after the fact: every name resolves to a contact
  row, and **no email or phone was lost**.

- **`contacts` is now the only place a supplier can be reached.**
  `suppliers.email` and `suppliers.phone` moved in and the columns were dropped,
  so `suppliers` describes the company and `contacts` holds every route to it —
  the main line included, as a row with `title_department = 'Main line'`. Where
  a name was recoverable from an address it came from a hand-curated allowlist
  of the values actually present, never a pattern, and each of those ~160 rows
  is stamped `Name inferred from the email address; unverified.` Most contacts
  have no name at all, which is expected: the add/edit form marks name optional
  and a contact needs only one of name / email / phone. Contacts 76 → 973 across
  907 suppliers. Supplier search now finds an address through the contacts
  branch rather than the supplier document.
- **The old `lps-rosie` app's public supplier form moved onto the service-role
  key** (that app lives outside this repo, at
  `projects/local_plant_supply/lps-rosie`). `/availability/[id]`, its three API
  routes and `/api/upload` are reachable without a login — suppliers open them
  from an emailed link — so they ran as `anon` and would have broken. They now
  use a new `lib/supabase/service.ts` client; the unguessable `friendly_id` in
  the URL remains the capability token, as before. Logged-in paths still use
  the anon-key + cookie client so per-user policies keep applying.

  One deliberate regression: that page's Realtime subscription on
  `availability_queries` subscribes as `anon` from the browser and now receives
  no events. It was redundant cross-tab sync — every edit, voice note and form
  upload already returns the updated rows in its own response — so the form
  itself is unaffected. Restoring it would mean giving `anon` read access to
  every availability query, which is the hole this change closed.

### Removed

- **`suppliers.poc_name` / `poc_email` / `poc_phone` are gone.** All 47 rows
  that used them were reconciled against the new `contacts` table before the
  drop — matching counts on every field and no value mismatches — so nothing was
  lost, but the drop is irreversible. Supplier deactivation now cascades to
  `contacts` alongside `inventory` and `inventory_sources`.
- **`suppliers.email` and `suppliers.phone` are gone too**, verified against a
  snapshot as **0 emails and 0 phones lost**. Anything that matched a supplier
  by `suppliers.email` must now join through `contacts` — Daisy's
  supplier-identification query and the onboarding SOP were updated to do so,
  and both tables plus the profile lost their Email/Phone fields.
- **`suppliers.fax` is gone**, and with it the last contact field on the table —
  `suppliers` now describes the company and nothing else. The 12 fax numbers
  moved into their supplier's main-line contact `notes` rather than `phone`,
  which the app renders as a dialable `tel:` link.
- **The 0015/0016 rollback snapshots were dropped.** `suppliers_notes_pre_contact_extraction`
  and `suppliers_contact_pre_move` are gone, so **the 0014–0017 column drops are
  no longer reversible from the database.** Every one was reconciled against its
  snapshot before the drop.

### Security

- **Row level security is on for every table.** `suppliers`, `inventory`,
  `chat_sessions`, `users` and `availability_queries` were running with RLS
  *disabled* — four of them already carried policies, which were therefore
  inert. Since `anon` holds table grants across `public`, the publishable key
  was in practice a full read-write handle on the whole database, `users`
  (which stores Gmail OAuth tokens) included. Migration
  `harness/agents/daisy/migrations/0011_enable_rls.sql` enables RLS on all
  five and gives `availability_queries` the `authenticated` full-access policy
  it never had. Verified against the live REST API: `anon` now returns `[]`
  for every table and both views.

  Nothing in this repo had to change to keep working — agents connect as
  `postgres` and the app uses the secret key, both of which hold `BYPASSRLS`.
  Both were re-verified after the migration (daisy's `query` bin, the search
  RPCs, and `inventory_enriched` over REST).

- **`inventory_enriched` and `rate_charts` are now `security_invoker`.** Both
  views are owned by `postgres`, so with Postgres's default they ran with the
  owner's `BYPASSRLS` rights and would have served `anon` the entire catalogue
  regardless of RLS on `inventory` — enabling RLS without this would have been
  security theatre. Any future `CREATE OR REPLACE VIEW` over these tables must
  set the option again; it is not inherited.

## 2026-08-04

### Changed

- **Inventory rows expose source ingestion time.** Plant rows now derive
  **Ingested** from their active source timestamp, and supplier list/profile
  views show the newest active-source **Last ingestion**. Manual/source-less
  rows remain blank; ingestion time is explicitly not the source's effective
  availability date.
- **Desktop Full chat uses the full canvas.** Selecting Full hides both the
  navigation and workspace; a centered edge handle reveals or hides a 240px
  supplier/search peek pane on demand. Restored Full state keeps that layout,
  while 50%/30%, resizing or hiding chat exits it. Desktop Full restoration is
  blocked/reset at the mobile breakpoint so it cannot zero-width Supplier or
  Plant Search during hydration.
- **Missing inventory prices retain their meaning.** The approved nullable-price
  migration stores an omitted supplier price as `NULL`; a follow-up cleanup
  converts all 28,998 historical zero-price placeholders to `NULL`. The app
  displays them as unavailable rather than `$0.00`; blank edits, range filters,
  and client/`search_inventory` sorting preserve the distinction and keep
  missing values last. Future numeric zero remains valid only when explicitly
  printed by the supplier.
- **Mobile agent navigation is consolidated.** One **Agents** bottom tab now
  opens Daisy, Rosie and Nova as channels; selecting an active agent opens the
  same existing conversation and Back returns to Agents. This is UI-only — no
  chat transport, routing, thread, model or API behavior changed.
- **Desktop supplier rows are uniform height.** Inventory sources show the
  newest filename as a direct link plus `+N` when older files exist; `+N`
  deep-links to that supplier's Files tab. Source counts no longer enlarge rows,
  and no API, source-record or ingestion behavior changes.

## 2026-08-03

### Added

- **The app installs as a PWA.** A static manifest, a service worker and a
  generated leaf icon set make the workspace installable to a phone home screen
  or a desktop dock, launching full screen at `/suppliers`. Chrome gets a
  one-per-session install offer; the desktop rail and mobile **⋯ More** both
  carry a manual **Install app** entry, which falls back to iOS
  Share → Add to Home Screen instructions on Safari and to an explanation when
  the browser cannot install (already installed, or a LAN address rather than
  HTTPS/localhost). The worker is network-first and caches only whole-page
  loads, so an offline launch shows the last page instead of a browser error
  while supplier data itself is never served stale. See
  [`docs/app/README.md`](docs/app/README.md#installable-app-pwa).

### Changed

- **Desert Night is available as a chat wallpaper.** The rights-confirmed
  user-provided cactus/agave pattern keeps its deep-black base while the icon
  strokes are selectively dimmed, including a further 20% reduction after live
  review. CSS color blending preserves luminance and subtly tints only the
  artwork forest/coral/violet with the active agent. Incoming bubbles now use a
  stronger tinted surface/border, while solid outgoing bubbles force white text;
  None and the original light line-art wallpaper remain available in Settings.
- **Pull-to-refresh works across mobile workspace pages.** Pulling down from a
  page pane's top refreshes its route; Suppliers and Plant Search additionally
  rerun the active client query while preserving its term and filters.
- **Chat history has edge navigation and pull-to-refresh.** Contextual arrows
  jump to the first/latest message, and pulling down from transcript top runs an
  immediate message poll without re-enabling unsafe document overscroll.
- **Keyboard-open PWA layout follows the visual viewport pan.** The Shell now
  tracks `visualViewport.offsetTop` as well as height; mobile bottom navigation
  hides while typing so the composer sits directly above the keyboard and
  returns when focus leaves the field.
- **PWA scrolling stays inside content panes.** The workspace Shell is fixed to
  the visual viewport and locks document overflow, so transcript/list swipes no
  longer move the header off-screen or leave blank space below the bottom nav.
- **Nova now recognizes its shared Telegram group.** Its system prompt records
  group `-1004330045748` as the communication channel with Bhoumik Shah and
  Chris and explicitly treats posts there as group-visible.
- **Mobile Plant Search opens a supplier only from its name.** The whole card
  header used to be the link, so a tap meant to read the category, location or
  match count navigated away. Only the underlined supplier name now navigates;
  the rest of the header is inert and the chevron still expands the plant list.
- **More → Settings works from an agent chat on mobile.** The chat sheet is a
  full-screen overlay over the outgoing page, which stays mounted until the new
  route commits — so the tap looked ignored. Both More-menu route entries now
  close the sheet as they navigate.
- **The viewport now declares `viewport-fit=cover`.** The mobile bottom tab bar
  already padded itself with `env(safe-area-inset-bottom)`, which resolves to
  zero without it — so the bar sat under the home indicator on notched phones,
  which the installed full-screen app would have made obvious.

## 2026-08-02

### Changed

- **Mobile navigation stays inside the Android PWA viewport.** The Shell now
  tracks the live visual viewport rather than trusting standalone-mode
  `100dvh`, keeping the bottom bar above system chrome through resize,
  orientation and keyboard changes.
- **Chat appearance is now a responsive Settings page.** `/settings` is enabled
  in the desktop rail and mobile More uses the same **Settings** label and route.
  The redundant
  mobile Back button/overlay are gone, so tapping another bottom-nav item always
  navigates normally.
- **Chat colors now follow each agent's profile art.** Daisy defaults to Forest
  Green, Rosie to Coral Rose and Nova to Electric Violet. The earlier Garden
  Green, Fuchsia Bloom and Agave Blue remain optional; Chat appearance can
  customize each mapping independently while wallpaper remains shared.
- **Agent chat uses Telegram-like typography.** Message bubbles, the composer
  and Chat appearance preview now use 16px Roboto with compact line spacing;
  timestamps remain small and the inventory/search workspace remains on Inter.
- **Mobile More is always visible.** All seven bottom-nav items now share the
  available width instead of overflowing horizontally, so Chat appearance and
  other More actions remain discoverable without swiping the tab bar.
- **Chat appearance settings are available on mobile.** More → Chat appearance
  provides a live preview, Garden Green / Fuchsia Bloom / Agave Blue palettes, an
  optional original dense cactus-agave-yucca-sun doodle wallpaper in green,
  blue and fuchsia, plus Reset. Preferences
  persist per device and remain scoped to chat rather than recoloring the app.
- **Generic list-page headers are removed on mobile.** Suppliers and Plant
  Search now start with their primary controls; highlighted bottom tabs already
  identify those pages. Desktop headers and supplier-specific identity headers
  remain unchanged.
- **Mobile chat now uses one compact header.** Avatar, agent name, short role
  (`Suppliers`, `Customers`, or `Developer`) and live status align on one line. Opening an agent
  replaces the underlying page-title row rather than stacking
  both headers above the conversation. The redundant close icon is removed;
  the highlighted active-agent tab remains the close toggle.
- **Mobile supplier profiles now prioritize inventory space.** The supplier
  name/category live in one sticky header; the duplicate title and mobile back
  link are gone. The pencil appears only at the bottom of expanded Supplier
  details, making expand → edit an intentional safety gate. Company data is
  collapsed behind a compact Supplier details summary by default, with one-tap
  call, email, website and
  map actions. The pencil expands the safe staged-edit form automatically;
  desktop details and its back link remain visible.
- **Supplier profiles now open directly to Inventory.** Tabs are ordered
  Inventory, Communications, Notes and Files; all four use compact mobile
  sizing and remain on one line.
- **Supplier profiles now require deliberate edit mode.** Profile fields are
  read-only until the pencil icon (**Edit supplier**) is pressed; edits are staged locally and a
  single **Save changes** action writes only changed fields atomically. Cancel
  warns before discarding changes, and reload/close gets an unsaved-change
  warning, preventing accidental mobile taps from entering or saving edits.
- **Mobile Plant Search rows now show availability specifications.** Height,
  width/spread and caliper appear beside the source size when present, rather
  than being stored correctly but hidden from mobile results. Tapping a row
  expands full other names, notes, update date and source link inline without
  leaving the supplier comparison.
- **Common-name + cultivar searches now recover from alias-combination gaps.**
  When a full multi-word search returns zero, the server searches its individual
  words in parallel and uses the smallest non-empty result set. `Live oak
  boardwalk` now reaches the same 32 Boardwalk rows as `Quercus boardwalk`,
  without adding fallback calls to normal successful searches.
- **Multi-word Plant Search now respects the full identity.** Broad fuzzy/alias
  results are refined to rows whose own name or aliases contain every requested
  word (with prefix support), falling back to the broad result only when none
  qualify. `Agave Americana` no longer pulls in unrelated `americana` trees,
  and their caliper sizes no longer contaminate its available-size selector.
- **Simplified size filtering in Plant Search.** Removed the permanent
  unit/min/max form. Users can type a natural query such as `15g Agave
  Americana`, or search the plant name first and choose from a compact selector
  containing conservative commercial categories from those matches. Gallon/box
  spellings collapse without inventing cross-unit equivalences; range descriptions
  contribute their endpoint categories; and bare dimensions, untyped numbers and
  implausible source-column values stay on result rows instead of becoming menu
  options. The compact selector now accepts multiple categories with OR logic;
  repeated URL parameters and browser storage preserve the selected set across
  navigation.
- **Plant Search now starts with a useful state instead of an unexplained
  sample.** A blank search shows a prompt and makes no catalogue request. The
  last term is restored from the URL or browser storage when returning, current
  results are fetched afresh, browser Back/Forward is honored, and Clear forgets
  the saved term.

## 2026-07-31

### Changed

- **Increased dark-mode contrast in the search workspace.** Muted labels,
  empty-state text, input outlines, borders, header rows, resize affordances and
  table hairlines are now brighter and easier to distinguish.
- **`cognisphere-harness` 0.8.7 → 0.8.11.** Two seeded artifacts moved, both
  re-seeded into daisy and nova (clean forks, no local edits): `context-meta.ts`
  now emits checkpoints as standalone prune-safe messages
  (`customType: "context-meta.checkpoint"`) instead of stamps fused onto
  neighboring messages — 0.8.9 fixed an 0.8.8 infinite-LLM-call regression and
  0.8.10 lands turn-ending checkpoints on `agent_settled` — and
  `0-base_prompt.md` documents the checkpoint messages as FYI-only telemetry.
  0.8.11 (no data migration) makes pi's own models.json mirror
  `.secrets/models.json` overrides, so spawned pi children and the dashboard
  agree on context windows. Scaffold refresh was a no-op apart from
  `docs/base-harness/CHANGELOG.md`; the local Supabase env wiring in
  `server.sh`/`config.example` was untouched upstream.

- **Plant identity now lives entirely in `inventory.name`.** The name is written
  `Name [scientific name, variant]` — the printed name in full, plus the
  scientific name and cultivar/trade name when the source gives them. The
  ingestion SOP (`harness/agents/daisy/knowledge/SOPs/`) and `SCHEMA.md` were
  rewritten to match; both had said the opposite ("botanical preferred; marketing
  names go to `plant_other_names`, never into `inventory.name`").
- **Dropped `inventory.category` and `inventory.variety`**
  (`harness/agents/daisy/migrations/0005_inventory_name_consolidation.sql`). The
  source's own grouping is no longer tracked, and the cultivar is part of the
  name. 101,678 rows had their variety folded in; both search indexes, the
  `rate_charts` and `inventory_enriched` views and `search_inventory` were
  rebuilt around the drop, and the RPC lost its `category_filter` parameter.
  `suppliers.category` is untouched. The app drops the plants table's Category
  and Variety columns to match. Pre-change values are kept in
  a rollback table (since dropped — see below); the scientific name was **not**
  backfilled, because deriving it from the existing alias graph proved
  unreliable (`Acer Palmatum` resolved to the cultivar `Oto hime`).
- **Purged the retired aliases and the rollback scaffolding**
  (`0010_purge_inactive_aliases_and_rollback_tables.sql`): 78,807 deactivated
  pairs deleted, leaving 13,429 — the entire table, all active — and both
  rollback tables dropped. Two consequences worth knowing: the name
  consolidation can no longer be reversed and the source `category` values are
  gone for good; and because the dedupe trigger ignores `is_active`, the retired
  rows had been silently acting as a blocklist against bad aliases returning.
  That guard is now the ingestion SOP's job alone.
- **Aliases are search equivalents only.** `plant_other_names.other_name` may now
  hold only another name for the *same plant* — common name, scientific name,
  synonym, abbreviation, spelling variant — never a cultivar, variant, trade name
  or patent code. Those linked a species to one of its selections, so every
  sibling cultivar matched every other one; the cultivar is searchable in the
  name instead (`0006_cultivar_alias_cleanup.sql`).
- **Retired 0005's alias carry-forward** (`0007_retire_carryforward_aliases.sql`),
  which turned out to be the largest single source of search false positives: it
  ran before the cleanup and copied unquoted cultivar compounds and sibling
  *species* onto cultivar rows, so `Redbud [Forest Pansy]` inherited
  `Cercis mexicana`. 48,269 pairs retired; 19,106 of 92,236 remain active.
  "Forest Pansy" and "Ruby Falls" now return zero false positives. The cost is
  that only 4,378 of 40,715 bracketed rows are still reachable through the alias
  graph — the durable fix is reparsing sources so the name carries the printed
  common-first identity. Cultivar cleanup is **not finished**: see
  `migrations/NOTE.md` for the Merlot-class residue and the token-OR noise, both
  left deliberately rather than fixed with a rule that deleted genuine names.
- **Audited and pruned the alias directory** (`0008_alias_quality_audit.sql`):
  generic category labels by fan-out ("Grass" was an alias for 64 distinct
  plants), non-plant junk (hardgoods, 31-char feed truncations, grade codes),
  nine hand-verified wrong-taxon pairs, and cultivar residue on single-word
  epithets. Active pairs 19,106 → 13,452; "Forest Pansy" and "Ruby Falls" return
  zero false positives and "Merlot Redbud" went 46 → 7. Four plausible rules
  were built, measured and **rejected** for destroying genuine names — the
  migration records why, so they don't get retried.
- **Cleared the last cultivar aliases** (`0009_residual_merlot_aliases.sql`): the
  four Merlot/Cercis pairs, plus a table-wide sweep for the same shape that found
  19 more (`Sedum rupestre` ↔ `Angelina Stonecrop`, `Ulmus` ↔ `Allee Elm`). The
  sweep is gated on trademark corroboration — ungated it also flags `Pinus taeda`
  ↔ `Loblolly Pine` and `Agave vilmoriniana` ↔ `Octopus Agave`, which are real
  names. Forest Pansy, Ruby Falls and Merlot Redbud now have **no alias false
  positives**; Loblolly Pine, Octopus Agave and Texas Redbud are unharmed.
- **The ingestion SOP now sets an explicit alias quality bar** — same plant only,
  no cultivars/trade names, nothing generic, names not data, and "when in doubt
  insert nothing", because search hops between siblings so one bad pair pollutes
  a neighbourhood. It also requires the printed **common name first** in
  `inventory.name`, since the name is the only place a printed common name
  survives.

### Added

- **Applied `0004_active_plant_aliases.sql`**, which had been prepared on
  2026-07-30 but held back because daisy's guarded query runner blocks
  `ALTER TABLE`. Adds `plant_other_names.is_active`, so inactive pairs power
  neither search nor the derived "Other names" column.

## 2026-07-30

### Changed

- **`cognisphere-harness` 0.8.6 → 0.8.7.** Fixes the gap we hit testing
  0.8.6: `context-meta.ts` (re-seeded into daisy and nova) now replays its
  stamping state machine over the persisted session on spawn, so
  `CheckpointTokens` stamps span batch boundaries — plain chat turns get
  stamped from a thread's second message on, instead of only tool
  results/steers within a single batch. No other seeded files changed.

- **`cognisphere-harness` 0.8.5 → 0.8.6.** Ships context-window telemetry
  for agents: a new seeded extension `context-meta.ts` (copied into daisy
  and nova) stamps per-step `CheckpointTokens` deltas into the session and
  injects ephemeral `Model`/`ContextUsage` figures into each LLM call, and
  the seeded `0-base_prompt.md` documents both (re-seeded in both agents —
  clean forks). Scaffold refresh was a no-op apart from
  `docs/base-harness/CHANGELOG.md`; the local Supabase env wiring in
  `server.sh`/`config.example` was untouched upstream.

- **Nova's webchat re-pointed to the `main` thread**
  (`harness/agents/nova/plugins/webchat/config.json`, now with the other
  keys' defaults spelled out), matching the telegram main-route pattern;
  daisy's `config.json` was dropped as redundant (the plugin default is
  already `main`). Nova's telegram bot is live (`lps_nova_bot`), but until
  a `main` chat route exists in its `plugins/telegram/state/routes.json`
  (runtime state, like daisy's), telegram messages still land on the
  `single` strategy's `default` thread rather than sharing `main` with the
  panel.

- **Harness upgraded 0.8.3 → 0.8.5.** Task-thread ids move to the
  unambiguous `<ThreadId>-§-[TASK]-§-<task-slug>` form and the admin UI
  groups task threads under their parent thread (no data migration —
  old-format threads keep working). Migration re-seeded both agents'
  `0-base_prompt.md`, `plugin-agent-messaging.md`, and `session-reader`
  (all were clean forks), and refreshed the harness-owned scaffold
  (`.claude/skills/`, `.agents/skills/`, `docs/base-harness/`); the local
  Supabase env wiring in `scripts/server.sh` / `config.example` was
  untouched upstream and survives intact. 0.8.4 also reworked the upgrade
  skill's scaffold refresh to audit local edits before copying.

### Added

- **Nova is now chattable from the web app**: the `webchat` plugin is enabled
  on `nova` (`harness/agents/nova/plugins/webchat/config.json` with
  `threadId: "default"` — the thread nova's `single` strategy computes, so the
  panel and Telegram share one conversation) and its seed CLI/prompt are
  checked in. In the app, Nova's `upcoming` flag is removed in `lib/agents.ts`
  (with dev-flavoured starter suggestions), the panel's empty-state line is now
  a per-agent `intro` instead of Daisy's hardcoded one, and the mobile tab
  bar's agent tabs now select which agent the chat sheet opens with (same tab
  toggles it closed). Rosie remains the only "Coming soon" agent.

- **Animated search loader**: while a search is in flight on Plant search, the
  Suppliers list or a supplier profile's Inventory tab, the results area dims
  under three sprouting seedlings (`components/workspace/search-loader.tsx`,
  theme-coloured, staggered, honours `prefers-reduced-motion`). The loader
  starts on the first keystroke — it also covers the 300ms debounce window that
  already gated the search RPCs — and empty states no longer flash while a
  search is pending. The caption under the seedlings rotates every 1.6s
  through a quirky set per search flavour (plant searches vs the suppliers
  list) instead of one fixed line per page. Its caption rotates through a set of quirky lines per
  search flavour ("Watering the seedlings…", "Ringing the nurseries…", …).

- **Know your Agents page (`/agents`)**: one card per agent showing its
  profile banner (`app/public/*_profile.png`) with an Active / Coming soon
  badge. Reachable from the nav rail's bottom section (above the user entry)
  on desktop and the ⋯ More menu on mobile.
- **Rosie and Nova listed as upcoming agents** in `lib/agents.ts` — they appear
  in the chat selector, the collapsed rail and the mobile tab bar as disabled
  "Coming soon" entries, and the chat proxy refuses them until the flag is
  removed. Daisy remains the only chattable agent.
- **New avatars for all three agents** (`daisy.png` replaced, `rosie.png` and
  `nova.png` added), cropped from the profile banners.

### Changed

- **Chat panel header simplified** — the agent selector tabs are gone; the
  header keeps only the Full / 50% / 30% size presets. Agents are picked from
  the collapsed rail.
- **Mobile chat no longer covers the bottom tab bar.** The sheet overlays the
  page content only, so navigation stays visible and usable while chatting.
- **Mobile bottom bar gained a ⋯ More menu** (Settings, theme toggle, Know
  your Agents, signed-in user + log out), replacing the bare Theme tab.

- **Upgraded `cognisphere-harness` 0.8.1 → 0.8.3.** No data-dir breaking
  changes (0.8.2 fixes `HARNESS_BASE_URL` export in the runner itself). Per
  0.8.3's new upgrade procedure, refreshed the harness-owned scaffold from the
  package: `scripts/` (upstream refactor of aws/contabo setup into
  `scripts/lib/remote-bootstrap.sh`; default `HARNESS_PORT` now 3142; dropped
  the now-redundant `HARNESS_BASE_URL` systemd line and the auto-retire of
  stale units), `config.example`, `docs/base-harness/`, and the
  `cognisphere-upgrade` skill (in `.claude/skills/`, `.agents/skills/`, and
  nova's `skills/agent/` mirror). Re-applied the local Supabase env wiring
  (`SUPABASE_URL`/`SUPABASE_SECRET_KEY` in `config.example` +
  `scripts/server.sh` gen_secrets) that the refresh reverted.

- **Upgraded `cognisphere-harness` 0.8.0 → 0.8.1** (prompt/script corrections
  from upstream): re-seeded `0-base_prompt.md` (drops the `ddgs -o json`
  advice, routes plugin requests to `nova` instead of the operator) and the
  `scripts/agent/` wrappers (`session-reader` help reflects the task-thread
  session layout; wrapper headers no longer cite the removed `pi -p` CLI) on
  both agents. Daisy's local `cd /tmp` guard in the `ddgs` wrapper was
  re-applied on top of the new seed.

- **Upgraded `cognisphere-harness` 0.7.1 → 0.8.0** (two-phase: dependency bump +
  data-dir migration per the upstream CHANGELOG window):
  - Sub-agent CLI removed upstream — deleted the seeded
    `scripts/agent/subagent` + `sub-agent-prompt.md` from both agents, and
    removed `subagentModel` from daisy's `agent.json`. Delegation now runs
    through **task threads** (self-messages via the core agent-messaging
    plugin); daisy's `1-agent.md` ingestion workflow was reworded accordingly.
  - `0.1-main-agent.md` merged upstream into `0-base_prompt.md` — replaced both
    agents' base prompt with the new seed (forks were pristine; daisy's former
    local edits are already covered by her `1-agent.md`) and deleted
    `0.1-main-agent.md`. Roster renamed `0.3-agent-directory.md` →
    `0.1-agent-directory.md`.
  - agent-messaging became a core plugin — removed daisy's now-redundant enable
    dir (config was `{}`, inbox/state empty).
  - Developer agent id frozen upstream to `nova` — renamed `agents/dory/` →
    `agents/nova/`, updated `agent.json`, daisy's roster entry, and the docs
    (`docs/harness/agent-dory.md` → `agent-nova.md`); replaced the pristine
    `1-dev-agent.md` fork with the new nova seed.

## 2026-07-29

### Changed

- **Harness upgraded 0.7.0 → 0.7.1.** Adds gws thread-routing on the raw
  Gmail thread id (`scripts/gws/routes add --gmail-thread-id RE`) — the
  precise way to keep replies to one mail in one thread; daisy's forked
  `scripts/gws/routes` and `system_prompts/plugin-gws.md` were pristine
  0.7.0 seeds and took the 0.7.1 seeds unchanged. (The registry publish
  lagged the git tag by a couple of hours; a briefly vendored tarball was
  replaced with the registry package once 0.7.1 appeared.)

### Fixed

- Agent chat now renders literal `\\n` sequences from CLI replies as line
  breaks, fixing paragraphs and bullet lists in both new and existing messages.

## 2026-07-28

### Changed

- Removed the delete/deactivate buttons from the Suppliers and Plant Search
  tables; their rightmost action columns now contain only the view-local hide
  control.

### Fixed

- **Word-prefix search returned nothing** — `search_inventory('Mexican
  Sycamor')` found 0 rows while the full word found 17. The pgroonga
  `TokenDelimit` index only matches whole tokens, its fuzzy path doesn't cover
  edits at the end of a token, and the trgm fallback excludes queries that are
  substrings of the document — typed prefixes fell between every branch. Both
  search RPCs now OR in a Groonga `*` prefix match on the query's last token
  (when ≥ 3 chars). Migration `040_search_prefix_match`
  (`harness/agents/daisy/migrations/0003_search_prefix_match.sql`); no app
  code changed.

## 2026-07-27

### Added

- **Agent chat in the app.** A chat panel for `daisy`, built on the Supplier
  Workspace design: a resizable docked panel on desktop, a 46px collapsed rail,
  and a full-screen sheet on mobile opened from the bottom tab bar. Panel state
  persists to `localStorage` (`lps.chat.v1`).
- **`webchat` harness plugin** (`harness/plugins/webchat/`) — the first
  user-space plugin in this deployment. HTTP inbox at
  `/webhook/<agent>/webchat/api/*`, replies via the seeded
  `scripts/webchat/webchat-cli`. Configured with `threadId: "main"`, so the web
  panel and Telegram **share one thread and one context** rather than being two
  separate conversations.
- **Attachments both ways.** Users can attach files, paste images, and record
  voice notes; the agent can return files with `--file`. Images render inline,
  audio in a player, everything else as a download.
- **Voice notes** with a WhatsApp-style player — play/pause, a seekable
  waveform decoded from real RMS amplitude, elapsed time — and a live level
  meter while recording.
- **"Working…" indicator** while the agent owes a reply: a typing bubble, an
  amber status dot, and a badge on the collapsed rail avatar.
- `lib/agents.ts` — the single list of chattable agents, driving the selector,
  rail, mobile tab and the `/api/chat/<id>/…` allowlist.
- `docs/harness/plugin-webchat.md`, and this changelog.
- Mobile filters on plant search, plus a shared `FilterControl` component.

### Changed

- **Mobile supplier cards on plant search collapse.** A chevron on each card
  toggles its plant list; the card header still opens the supplier profile.
- **Mobile bottom tab bar alignment.** Tabs stretch to equal height, so a
  two-line label ("Plant search") no longer knocks its icon out of line.
- **Plant search mobile filters** are now a fixed, useful set — supplier,
  supplier category, state, city, size, price — instead of mirroring every
  filterable plant column (plant name, other names, quantity are gone).
- Harness dependency upgraded to **0.7.0**.
- Root `README.md` no longer claims the app "does not talk to agents" — it now
  does.
- Daisy's `agent.json` description and docs note both reachable channels.

### Fixed

- **Voice notes could never have worked on iPhones.** Safari cannot record
  webm — it produces mp4/AAC — but the recorder hardcoded `.webm` /
  `audio/webm`. The container is now chosen with
  `MediaRecorder.isTypeSupported` and the extension follows the recorder's real
  `mimeType`.
- **The mic button failed silently off `localhost`.** `navigator.mediaDevices`
  is `undefined` outside a secure context, and the resulting `TypeError` was
  swallowed by a bare `catch`, so nothing happened at all. It now reports the
  cause — insecure origin, unsupported browser, denied permission, or no device.
  (Recording over plain `http://` remains impossible; the app must be served
  over HTTPS for it to work on a phone.)
- `api/file` sends `Content-Length` from `stat` rather than the client-declared
  size, which could truncate or hang a response, and adds `Accept-Ranges` so
  audio is seekable.
- `webchat-cli` builds its URL from `$PI_WEBHOOK_BASE` instead of a hardcoded
  port — the harness serves on **3142** here, not the library default, so the
  original fallback would have failed on every send.
- The transcript now scrolls to the bottom on load (a layout effect, so there is
  no flash of the top), unpins while the user reads history, and re-pins when a
  late image changes the height.
- `next.config.ts`: `allowedDevOrigins` type error that had been failing
  `pnpm build` and `pnpm typecheck`.

### Security

- Browser-facing `webchat` endpoints require a resolved harness session — the
  plugin forwards the cookie to `/api/auth/me` rather than trusting that
  `pi_sid` is present, since it is a signed stateless token. `api/reply`
  requires `COGNISPHERE_WEBHOOK_SECRET`. Attachment paths are rejected if they
  escape the inbox/outbox or the agent dir, and uploads are capped (25MB).
- **Chat transcripts are no longer committed.** `webchat`'s `state/` and
  `inbox/` are gitignored and the transcript that had been committed was
  untracked — it is session data (`CLAUDE.md` §6). Scoped to `webchat` so that
  telegram's `routes.json` and scheduler's `schedules.json`, which are real
  config, stay tracked.

## 2026-07-24

### Added

- Per-agent documentation under `docs/harness/` (`agent-daisy.md`,
  `agent-dory.md`) and system prompts for the developer agent.

## 2026-07-22

### Changed

- **App-home restructure** to the 0.4.0 layout: harness data dir moved to
  `harness/` (from `lps-harness/`), the web app to `app/` (from `web/`).
- Telegram and internal-messaging plugin documentation clarified.

### Added

- Contabo provisioning scripts; the S3 backup script made S3-compatible.

## 2026-07-15 – 2026-07-17

### Added

- User-scope **telegram** plugin override with its own CLI.
- Gmail message decoding and attachment handling (`format-email`).
- **agent-messaging** plugin for inter-/intra-agent communication.

## 2026-07-06 – 2026-07-14

### Added

- **`daisy`** — the supplier-onboarding and availability-ingestion agent, with
  Gmail labelling to track processing status.
- S3 backups on a cron job; AWS setup script made version-flexible.

### Fixed

- Supabase reached via the IPv4 pooler with a direct-host fallback.
- Agent bootstrap installs all dependencies reliably; shebang scripts made
  executable.

## 2026-06-17 – 2026-06-29

Initial build.

### Added

- The harness, and `rosie` as Austin Plant Supply's supplier-side agent (since
  removed — the deployment keeps the name as deploy identity).
- The Supplier Workspace UI: catalogue tables, customer/job workspace, an
  availability-request flow and a stock-check form (both since removed).
- Deploy scripts, systemd units, config template and the root README.
