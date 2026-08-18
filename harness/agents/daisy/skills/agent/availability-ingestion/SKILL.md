---
name: availability-ingestion
description: Ingest one availability drop into Supabase — every inventory-side write belongs here. Covers location mapping, source conversion, identity/size/price normalization, aliases, provenance, current-receipt manual intake, match/update/insert rules, photo triage, and a fail-closed historical-backfill gate with durable evidence and immediate revalidation before any business write. Use for supplier availability, historical backfill, and ingest-row fixes/reviews. (v1.5.1)
metadata:
  author: lps
  version: "1.5.1"
---

# Availability ingestion

Ingest one availability drop (price list, availability sheet, website catalog, or
photo) into Supabase. This procedure is normally run by a **task thread**
dispatched from the `availability-drop-intake` skill, and it owns **every
inventory-side database write** — parsing and all `inventory`,
`inventory_sources` and `plant_aliases` rows.

**Where the boundary is.** Four skills meet here, and each owns one thing:

- **`availability-drop-intake`** coordinates: it identifies the supplier, briefs
  you, digests your report, and talks to Chris. It never writes a row.
- **this skill** parses the drop and writes every `inventory`,
  `inventory_sources` and `plant_aliases` row.
- **`supplier-onboarding`** writes every `suppliers`, `contacts` and
  `supplier_contacts` row. **When §0 finds no supplier at all, or finds a farm
  the company has no row for, follow that skill to create it, then come back
  here with the new `supplier_id`.** Don't insert a supplier or a contact
  yourself.
- **`plant-photo-catalogue`** writes every `plant_photos` row and owns the
  private `plant-photos` bucket. **When the drop carries photos of plants as
  attached files (§6), follow that skill to catalogue them, then come back and
  report what you catalogued.** Don't upload an image or insert a photo row
  yourself — and don't download one: a photo that exists only as a URL is
  captured as a URL, never fetched into our bucket.

You **never talk to Chris, Telegram or the supplier directly** — anything you
need from a human goes in your report and the main agent relays it. If you find
yourself deciding *whether* to reply to someone, you are in the wrong skill.

**Don't change this skill on your own.** If you find something wrong, missing, or
inefficient in it, put the suggested change in the *Learnings* part of your
report — changes here require Chris's or Bhoumik's approval, and then a version
bump per the `create-skill` skill.

## Your inputs

Your brief follows the **dispatch contract in the `availability-drop-intake`
skill (§2)** — the supplier the main agent resolved, the source material, the
ThreadId, current timestamp, and its explicit intake classification. Read the
brief rather than re-deriving any of it. **A Chris/Bhoumik manual handoff
(image, attachment, or web source) classified `manual/current-receipt` is not a
historical backfill merely because its material prints an old or non-ISO date.**
Use the handoff timestamp as received/retrieved time and follow *Manual
current-receipt intake* below. Only an explicit `historical/backfill`
classification invokes the historical gate. Two things to read before you write
anything:

- **`knowledge/files/SCHEMA.md`** — before any query.
- **`workspace/suppliers/[<supplierId>]:<Name>/notes.md`** if it exists — this
  supplier's known quirks and parsing tricks. Apply them.

**If any input is missing or ambiguous** — you can't tell which supplier or
location the drop belongs to, a credential is needed, the source is unreadable —
**ask the main agent**: put your question(s) in the *Follow-up questions* part of
your report and stop at a safe point. You will be re-invoked with answers in the
same session. Ask early rather than guessing.

Any contact with the supplier during the ingest gets a timestamped entry in
`suppliers.communication_notes` — follow the `supplier-communications` skill.

## Historical backfill: mandatory pre-write supersession gate

**Applies only when the brief explicitly says historical/backfill (the
email/backlog path). This comes before every write path in this skill —
onboarding, source upload/provenance, inventory, aliases and photos.** A
historical source that fails the gate writes nothing. An old/non-ISO date printed
on a Chris/Bhoumik manual handoff does not itself make it historical; use
*Manual current-receipt intake* instead.
Do not create a provenance-only source, catalogue a photo, add a contact, or
onboard a location as a workaround.

1. Resolve each target by numeric `supplier_id` and read its `head_branch_id`,
never a display name. You may use §0's mapping evidence **read-only** to build
locations and parse offerings. A new/ambiguous supplier or location fails
closed: onboarding cannot precede this gate.
2. Review **all active later `inventory_sources` across each resolved head
branch**, not an arbitrary horizon. For every source attest and quote evidence
for one disposition: `authoritative-current` (a full current availability with
actual active offerings), `historical-static`, `withheld`, or
`escalated-partial`. A campaign label, Gmail label, timestamp or row count alone
is not authority. Static, future/prebook, withheld and partial/Escalated content
cannot supersede the historical source.
3. Create `/tmp/<thread>-backfill-gate-input.json` with `schema_version: 1`, an
`incoming` object containing ISO `effective_at`, `source_scope: "availability"`,
target `supplier_ids`, and parsed per-location `offerings` (supplier_id, printed
identity parts, size); plus `later_evidence`, one entry for **every** source the
script finds: source_id, disposition, nonempty reason and quoted evidence. An
`authoritative-current` entry also requires `scope: "full"`.
4. Before any business write run:

```bash
skills/agent/availability-ingestion/scripts/historical-backfill-gate preflight \
  --input /tmp/<thread>-backfill-gate-input.json \
  --record workspace/threads/<parent>/tasks/<slug>/files/backfill-gate.json
```

`SKIP` means a later full authoritative source has active offerings: make no
business write. `ALLOW` permits normal ingestion. `FAIL` is fail-closed: correct
evidence or report the blocker. The durable record captures resolved
supplier/head identities, all later sources, classifications, actual offering
counts and a direct normalized offering comparison.
5. After staging/QA but **immediately before `BEGIN` or the first write**, run
that command with `revalidate`. A changed landscape, mapping, input, decision,
or incomplete evidence fails closed; preflight/review again. This applies even
when the proposed write is only a photo, source, supplier, contact or alias.

Report the decision, record path, source dispositions, offering comparison and
revalidation result.

## Manual current-receipt intake

When Chris or Bhoumik manually hands over an image, attachment, or website and
the brief classifies it `manual/current-receipt`, ingest it as received now —
**not** as a historical backfill merely because it displays `2023`, another old
date, or a non-ISO year. No historical-backfill gate is required unless the
brief explicitly calls the source historical/backfill.

- Use the inbound handoff timestamp from the brief as the source's
  received/retrieved timestamp. `inventory_sources.created_at` remains the
  immutable database ingest time; it is not an effective date. In each new
  `inventory_sources.notes`, record the manual channel/identifier, the handoff
  timestamp, and every printed source date verbatim.
- Preserve the printed historical date and the currentness caveat rather than
  laundering it into a current claim. Put supplier-stated dated availability or
  price text in `inventory.notes`; append a dated `internal_notes` statement
  that the source was manually received at the handoff time, quote the printed
  date, and says **currentness/availability and pricing require confirmation**.
  This is a meaningful currentness caveat, not a duplicate of `created_at`.
- Treat current receipt as the source's operational precedence date under §4,
  while retaining that confirmation requirement. Do not withhold values merely
  because the printed year is old; an exception still requires an explicit
  historical/backfill or other quotable §4 instruction.
- Include the classification, handoff timestamp, printed date(s), and
  confirmation-required caveat in the report and QA it before commit.

## 0. Which location does each row belong to?

**One source file is not one supplier.** A company that grows or sells at
several sites is several `suppliers` rows — one per location — tied together by
`suppliers.head_branch_id`, which points at the company's head branch; a head
branch, and every single-site supplier, points at **itself**. Everde, Moon
Valley, Newton and thirteen others are stored that way, and they send **one
availability file covering several of their farms**. So the unit of mapping is
the **availability row**, not the file: every parsed offering gets its own
`supplier_id`, and one drop can legitimately write to five suppliers.

Read the `head_branch_id` / `supplier_contacts` sections of SCHEMA.md, then do
this **before parsing** — it decides where every row goes.

1. **Does this supplier have sister locations?** One query, from whatever
   supplier id the brief gave you:

   ```sql
   SELECT s.id, s.name, s.city, s.state
   FROM suppliers s
   WHERE s.head_branch_id = (SELECT head_branch_id FROM suppliers WHERE id = <supplier_id>)
     AND s.is_active
   ORDER BY s.id;
   ```

   One row back — the supplier itself — → single location, every offering maps
   to that one `supplier_id`. Carry on at §1.

   **If the brief says the sender matched no supplier at all**, there is nothing
   to map to yet: follow the **`supplier-onboarding`** skill to create the
   supplier, then come back here with the id it returns.

2. **Where does the file say a location?** Look in the sheet header, a tab or
   page per farm, a "Ship from" / "Grown at" / "Farm" column, a section heading,
   the branch in the sender's signature, or the email body. Take the **most
   specific** statement that covers a given row — a per-row column beats a
   section heading, a section heading beats the file header:

   - **Per-row or per-column location** → map each row to the location named on
     it. Rows in the same file going to different `supplier_id`s is the normal
     shape here, not an error.
   - **Per-section / per-tab / per-page location** → treat each section as its
     own set of rows for its own location. A workbook with a tab per farm is
     the common shape; §1 says how to convert one without losing tabs. A tab
     carrying no offerings — `Terms`, `Legend`, `Price Key`, an empty or hidden
     leftover — is **not a location**, whatever it is named: skip it and say
     which tabs you skipped in your report.
   - **One location for the whole file** → every offering maps to that location,
     and to no other.
   - **No location named anywhere → every active location of that company gets
     its own copy of every offering.** Everde with five active locations means the
     same 900 offerings written five times, 4,500 rows, each with its own
     `supplier_id`, its own `inventory_sources` row (§3) and its own upsert pass
     (§4). That is what a company-wide availability list means: any of their
     sites can supply it.

   **A location you can't find is usually a spelling, not a new farm.** Resolve
   the name against the sister locations from step 1 before you conclude
   anything: match on **city and state**, not just the supplier row's name, and
   read the company's own locations page if it still resolves to nothing. A
   tab labelled `Ft Pierce`, `Bunnell Farm`, `Loc 3` or a bare farm code is
   routinely a row you already have. Onboarding a duplicate location splits
   that farm's catalogue across two `supplier_id`s permanently, and no later
   ingest can tell the halves apart.

   Only a site that is **genuinely absent** is a new location: **follow the
   `supplier-onboarding` skill** to create it as a new supplier with the same
   `head_branch_id`, come back here with its id, and say so in your report. If it
   could plausibly be either — a near-match on name, a code you can't tie to a
   city — it is ambiguous, so step 3 applies: ask, don't onboard.

3. **Never guess a location from the sender's address or the file name.** If the
   mapping is ambiguous — a location name that matches no row, two plausible
   matches, a sheet that looks per-farm but isn't labelled, some rows labelled
   and some not — **ask the main agent** and stop. Don't fall back to "all
   locations" to resolve an ambiguity; that is a different claim from "the file
   named none". A row written to the wrong farm claims stock at a nursery that
   never offered it, and nothing downstream can tell.

4. **Suspect an unrecorded company?** If a supplier's list, signature or website
   shows sites the database doesn't have as rows, or shows that two existing
   rows are one company, don't tie them together yourself — report it under
   *Flags needing Chris* with the evidence. A wrong head branch multiplies wrong
   data by the number of locations under it.

Carry the resulting **row → `supplier_id` mapping** through §2 and §4; §5 checks
it. Report the per-location counts separately — one total hides a location that
silently got nothing.

**Contacts are not yours.** If the drop reveals a new person, a new phone number
or a rep who has left, that is `supplier-onboarding` §4 — follow it for those
writes, or hand the detail back in your report if the ingest is the only thing
you were asked for.

## 1. Acquire and convert the source

- **Text-based PDFs:** use `scripts/agent/markitdown <file>` as the primary extractor and inspect its Markdown tables/continuation lines before parsing. Do not default to `pdftotext` or write an ad hoc custom PDF parser merely because fixed-width text looks usable. If MarkItDown leaves wrapped/ambiguous rows, preserve the extracted evidence and resolve it with visual row-level review rather than a heuristic that can silently cross or drop cells.
- **Scanned/image-only PDFs:** `pdftotext` cannot OCR pixels unless the file already contains a hidden text layer. Render with `pdftoppm -png`, then use image reading/OCR/vision with page- and row-level visual checks. `pdftotext -layout` may be used only as a diagnostic/fallback when an actual text layer exists, not as the primary parser for scans.
- **Other attachments:** use `scripts/agent/markitdown <file>` for xlsx/docx and supported office formats. Avoid one-off custom parsers when the standard converter preserves the source structure; if conversion remains ambiguous, retain raw evidence and flag the affected rows instead of guessing.
- **Workbooks with several sheets:** `markitdown` converts **every** sheet, in workbook order, writing the tab name as a `## <name>` heading above that sheet's table — so tab names survive conversion, and under §0 they are location evidence. Read the whole output and count its `##` headings against the workbook's tabs before you parse: a per-farm workbook parsed as its first table alone silently loses every other farm, and §5's per-supplier count check cannot see the difference because the locations it never wrote to simply don't appear. Three converter behaviours will mislead you if you don't look for them. **Hidden sheets convert like any other**, with nothing in the output marking them hidden — last season's tab is not a location that got this drop. **Each sheet's first row becomes its header**, so a title or logo row above the table pushes the real headers down into the first data row; the tell is a header cell holding the sheet's title, or `Unnamed: 1` where a merged/blank cell was. And **an empty sheet still emits a table**, a degenerate one-cell row rather than nothing. Check the header row of every sheet you parse.
- If the email **body** contains a URL that may hold the availability (link to a price list / catalog / sheet), open it with `markitdown` or `scripts/agent/agent-browser` — don't treat a bare link as unparseable. If the URL is a downloadable file, download it and check its contents before deciding it's irrelevant.
- **Triage every image before you parse it. An image is one of three things**,
  and mistaking one for another is how a drop goes wrong quietly:

  | The image is | What it is | What to do |
  |---|---|---|
  | a photograph **of a price list, sheet or screen** | a *source* | render and parse it here, as a scanned document above |
  | a photograph **of a plant** — in a pot, in a field, on a truck, with or without a label | a *catalogue photo* | §6 |
  | a logo, signature graphic, banner, icon, map, letterhead, staff portrait | neither | skip it |

  The third row is most of what an email actually carries. Signature and
  letterhead assets are typically **under 200 px on a side or under 20 KB**, and
  their filenames say so (`logo`, `sig`, `banner`, `icon`, `header`, `image001`
  from Outlook). Check the dimensions before you spend anything on an image; a
  20 KB inline graphic is not a plant.

  A photo can be **both** a source and a catalogue photo — a shot of a printed
  label with the plant behind it. Parse it and catalogue it; they are different
  records made from the same file, and §6 says how the second one is written.

  **This table is about files you were given.** An image that exists on a page
  as a URL is never downloaded — §6 says what to do with it instead.
- Intermediate files (converted markdown, page images, parse chunks) go to `/tmp` — they are not records.

## 2. Parse and normalize

One logical row per **plant × size offering**. Normalize every line:

- **Size** (`inventory.size` **and** `inventory.size_std`) — see **Size
  standard** below. Write both, always, in the same INSERT: `size` is the
  container as the supplier printed it, `size_std` is the one standardized
  bucket it belongs to. The app's size filter is built from `size_std`, so a row
  you leave unmapped is invisible to every size checkbox — and `size` still has
  to be clean, because it is what the table cell shows and what search reads.
- **Name — three columns, classified from the source.** Since migration 0040
  the identity is split. Preserve every explicit printed part, then make the
  **best possible evidence-based classification** of the source's displayed
  identity; write the parts, never the whole, except for the intentional
  uncertain fallback below:

  | Column | Holds | Example |
  |---|---|---|
  | `common_name` | the printed common/trade-facing name, or the complete printed identity atom when classification is uncertain | `Forest Pansy Redbud` |
  | `botanical_name` | an explicitly printed botanical / scientific identity | `Cercis canadensis` |
  | `cultivar_variety_trade_name` | explicitly indicated residual cultivar, variety, selection or trade-name part | `Forest Pansy` |

  - **`inventory.name` is derived. Never write it.** A database trigger joins
    the parts it has with **` - `**, in the order common, botanical, cultivar —
    `Forest Pansy Redbud - Cercis canadensis - Forest Pansy` — omitting each
    part the source didn't give: common + botanical → `Eastern Redbud - Cercis
    canadensis`; common + cultivar → `Forest Pansy Redbud - Forest Pansy`;
    botanical + cultivar and no common name → `Acer palmatum - Bloodgood`.
    Anything you put in `name` on a row that has parts is silently overwritten.
    The dash is **spaced**, which is what tells it apart from the hyphen inside
    a name like `KN30-8`; and the separator is a dash rather than a comma
    because the cultivar column is itself comma-separated. `name_key`, `common_name_key`,
    `botanical_name_key` and `cultivar_keys` are derived too — never write those
    either.
  - **Classify from what the source gives you, not from outside knowledge.**
    Preserve explicit printed parts. Use the source's display convention and
    evidence — labels, typography, parentheses, quotation marks, column headers
    and repeated formatting — to separate a common name, an explicitly printed
    botanical identity, and residual cultivar/variety/selection/trade-name
    parts. Never manufacture or complete a botanical identity from knowledge,
    a web lookup, or recognition: `botanical_name` is NULL unless the source
    itself prints it. Likewise, do not invent a cultivar/selection merely
    because you recognise a word.
  - **When classification remains uncertain, use the safe fallback.** Preserve
    the **complete printed identity atom** in `common_name`; set
    `botanical_name` and `cultivar_variety_trade_name` to NULL. Do not split an
    ambiguous atom just because it looks partly botanical or cultivar-like. This
    is intentional preservation, not a parse failure.
  - **Keep an explicit common name.** If the source prints one, it goes in
    `common_name` even when the botanical name is printed too. Nothing else
    records it; dropping it loses it until someone reparses the source.
  - **`cultivar_variety_trade_name` takes an explicitly identifiable residual.**
    Once the printed common and botanical parts have been identified from the
    source's own convention, it holds the remaining explicitly indicated
    cultivar, variety, selection or trade name. Sources do not distinguish those
    residual types reliably, so preserve them together rather than guessing
    which kind each is. **Comma-separate them** when a row explicitly prints
    more than one. If the source gives only one unclassified identity atom, do
    **not** force a residual split; use the `common_name` fallback above.

    | Source prints | `common_name` | `botanical_name` | `cultivar_variety_trade_name` | derived `name` |
    |---|---|---|---|---|
    | `Acer palmatum 'Wolff' - Emperor 1®` | — | `Acer palmatum` | `Wolff, Emperor 1®` | `Acer palmatum - Wolff, Emperor 1®` |
    | `Forest Pansy Redbud (Cercis canadensis 'Forest Pansy')` | `Forest Pansy Redbud` | `Cercis canadensis` | `Forest Pansy` | `Forest Pansy Redbud - Cercis canadensis - Forest Pansy` |
    | `Crape Myrtle - 'Muskogee'` | `Crape Myrtle` | — | `Muskogee` | `Crape Myrtle - Muskogee` |
    | `Purtis Pink Oleander` (a lone, unclassified source cell) | `Purtis Pink Oleander` | — | — | `Purtis Pink Oleander` |

    The comma matters: the database splits on it to build `cultivar_keys`, one
    identity key per name, and that is what a `cultivar` alias edge and the
    app's Cultivar filter match against. Run two names together with a dash and
    they key as one string that matches neither — the row silently stops
    answering searches for either name. (`;` and `|` are tolerated; `-` and `/`
    are **not** split, because `KN30-8` is one cultivar code.)
  - **What never goes in it**, however the source prints it inline: size and
    container, height / width / caliper, form and grade codes (`STD`, `Bush`,
    `Multi-Trunk`, `Clump`, `Globe`, `Low Graft`, `Spec`), pack counts. Those
    have their own columns, or belong in the row's `notes`. `Buxus x 'Green
    Mountain' Globe` is cultivar `Green Mountain` with `Globe` noted, not
    `Green Mountain Globe`; `Prunus serrulata 'Kwanzan' 4' Graft` is cultivar
    `Kwanzan`, height `4'`, `Graft` noted.
- **Aliases** (`plant_aliases`): an alias exists for exactly one reason — so a
  search finds the row when the user types **another name for the same thing**.
  A pair is a plain undirected edge between two names: `Live Oak` ↔ `Quercus
  virginiana`, `Crape Myrtle` ↔ `Crepe Myrtle`, `Wolff` ↔ `Emperor 1`.

  **There is no `alias_type` and no distinction between kinds of pair.** Until
  migration 0045 a `cultivar` edge was only ever compared to the cultivar
  column, so it could not make a generic row of a species answer a search for
  one selection. Aliases now **expand the query** instead of matching columns,
  and an expanded query has no column to be restricted to, so every edge already
  behaved identically at match time; 0050 dropped the column that recorded the
  distinction.

  **That makes the quality bar below the only thing standing between a bad pair
  and a bad result**, exactly as it was before 0040. A pair joining a species to
  one of its cultivars turns a search for that cultivar into a search for the
  whole species, returning every sibling selection — the failure migrations
  0006, 0007, 0021, 0025, 0028 and 0029 each existed to clean up, and it is one
  word long so the multi-word safety gate never runs. Nothing downstream will
  catch it for you.

  ```sql
  INSERT INTO plant_aliases (name, other_name, source_id, source_line)
  VALUES ('Live Oak', 'Quercus virginiana', '<this drop''s source id>',
          'LIVE OAK (Quercus virginiana)  15G  $48.00');
  ```

  **Both sides must be printed in the source you are ingesting, for the same
  offering** — the botanical name beside the common name, a synonym in the same
  cell, a spelling variant of that line. **Never supply the other side from your
  own knowledge, from the web, or from another supplier's list.** If the source
  prints one name, insert nothing; the identity is already searchable through
  its own columns. This is not a style preference: alias 44255
  (`Yucca gloriosa` ↔ `Yucca, Soft Leaf`, retired by migration 0028) was created
  exactly that way and put nine wrong rows across four suppliers into Chris's
  "soft leaf yucca" search. Soft-leaf yucca is *Yucca recurvifolia*; the source
  that printed the label printed that botanical name too, right there on the row.

  **Quality bar — an alias is a liability, not a freebie.** Search substitutes
  only the opposite endpoint of an edge **directly incident** to a query span;
  there is no hopping through a shared hub to sibling names. A bad pair still
  wrongly equates two things in both directions. **When in doubt,
  insert nothing** — a missing alias costs one search; a wrong one corrupts many.
  Before inserting, every pair must pass all of these:

  - **Attested by this source, on this line, and recorded.** You can quote the
    line that prints both names, and you **put that line in `source_line`** with
    the drop's `source_id`. A botanical name you know but the source doesn't
    print belongs nowhere — not in `botanical_name`, not in a pair. **A pair you
    cannot quote a line for does not ship.**
  - **Never two line items from the same list.** If both names appear as
    separate offerings in this drop — or in any drop from this supplier — they
    are two products, not two names for one. A supplier does not price the same
    plant twice under different names in one availability sheet. Check before
    inserting; this is what 44255 got wrong.
  - **Same thing, not a relative.** Both sides must name the *same* plant — the
    same species, or the same selection. Never a species ↔ one of its cultivars,
    never sibling cultivars, and never two different species:
    `Cercis canadensis` ↔ `Cercis mexicana` is wrong, they are different plants.
    Genuine renames are fine. Where taxonomies disagree, **the trade wins**: if
    the two names are sold as different products they are different plants,
    however a botanist would classify them.
  - **Nothing generic.** A label that fits many plants — `Oak`, `Grass`, `Maple`,
    `Redbud`, `Perennial`, `Native`, `Shade Tree` — is a category, not a name.
    Text search already finds a name containing "Maple"; an alias only wires
    unrelated plants together. Rule of thumb: if it would fit more than a couple
    of distinct plants in the catalogue, don't insert it.
  - **A name, not data.** Never a size, grade, container or form code (`15 G`,
    `B&B`, `M/S`, `STD`, `Clump`), a price, a quantity, a SKU, a zone or shipping
    note, or a truncated fragment of a longer name.
  - **Not redundant.** Skip it if it differs from the column it would match only
    by punctuation, casing or spacing — those already match. A name already
    spelled inside the row's composed `name` is found by searching that name
    directly, so a pair that only restates the identity buys nothing.

  New pairs are `is_active = true` (the default). A BEFORE INSERT trigger
  silently drops duplicates, self-pairs, empty keys **and mirrored pairs**, so
  blind-insert without conflict handling. Inactive pairs are historical: they
  power neither search nor display, they block re-insertion of the same pair in
  either orientation, and you **never reactivate one** to "restore" a name.
- **Price**: `unit_price` is nullable; use the lower bound if the source gives a range. Store `NULL` when the supplier provides no price, and preserve a numeric zero only when the source explicitly prints zero. Never coerce a missing/blank price to `0`, and never silently reinterpret legacy zero rows without source-level review. Missing price does not make an inventory row invalid or free. Don't note the absence in `internal_notes` — a `NULL` `unit_price` already says it; if the supplier themselves printed "price on request", that is their text and belongs in `notes`. Stock counts go in `quantity`.
- **Combined sizes with one shared quantity**: create one inventory row for each printed size (for example, a `3 G/5 G` offer becomes separate `3 G` and `5 G` rows). Copy the source's shared quantity to both rows; quantities are tentative sourcing signals. State in each row's dated `internal_notes` that the quantity is the supplier's shared/tentative count across the combined sizes and that you split the offering, so reviewers do not add the copied values together as guaranteed stock. (Approved by Bhoumik, 2026-07-31.)
- **Two note columns, and they are not interchangeable.** Every row can carry
  both; keep each one's content in its own column.
  - **`notes` — what the supplier said.** Their verbatim row description,
    availability status, lead time, per-row qualifier ("limited", "coming soon",
    "B&B only"). Date it: `Available as of 2026-07-01. Lead time 2 wks.` This is
    evidence, so it is written from the source and nothing else.
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

### The standard bucket — `size_std`

`size` keeps the supplier's own spelling. `size_std` says which **one**
container that is, so the app can offer a single checkbox per real size instead
of one per spelling. Write it for every row that has a `size`.

**The vocabulary.** The database enforces the shape, not a fixed list:

| Bucket | Shape | Notes |
| --- | --- | --- |
| Pots | `<N>" Pot` | `4" Pot`, `8" Pot`, `3.5" Pot`. **Open set.** Only for diameters with no gallon equivalent — see rule 3 |
| Gallons | `<N>G` | `1G`, `15G`, `2G`, `35G`, `2.5G`. **Open set** — write the number the source printed. Never round to a "nicer" size |
| Boxes | `<N>" Box` | `24" Box`, `108" Box`. **Open set.** Always inches; `9' box` → `108" Box` |
| Word grades | `Bare Root`, `Liners`, `Plug`, `Trays`, `B&B`, `Field Grown`, `Grow Bags`, `Root Pruned` | exactly these strings |
| Catch-all | `other` | a real container the standard has no bucket for |

Anything else is rejected by `inventory_size_std_check`.

**Mapping, first rule that matches wins:**

1. **Says "box"** → `<N>" Box` from the box's inch number. `45 G/24" BOX` →
   `24" Box`: the box is the trade unit, the gallon figure is its volume.
   `Boxed` with no number is not a box → `other`.
2. **Has a gallon quantity** → `<N>G`. The pot-diameter half of a compound is
   dropped (`15 G/17"` → `15G`, `45 G/28"` → `45G`) and qualifiers are ignored
   (`6 G; Bush` → `6G`). Two different gallon sizes in one value (`3 G/5 G`) is
   a parse miss — split it into two rows per the *combined sizes* rule above,
   each with its own bucket.
3. **Names a burlapped root ball** — `B&B`, `BB`, `balled and burlapped` →
   `B&B`. The burlap *is* the container, so a height or caliper printed with it
   (`B&B; 3-4' HT`, `4 - 5'; B&B`) is the plant's size: bucket `B&B` and put the
   measurement in `height`/`caliper` with its `*_std`. A genuinely different
   container named alongside still wins by its own priority (`15 G B&B` → `15G`,
   `24" Box B&B` → `24" Box`).
4. **A bare diameter in inches** is one of three things, and the plant names
   decide which:
   - it **has a gallon equivalent** → that gallon, which is the pairing the
     trade prints: 6"→`1G`, 10"→`3G`, 12"→`5G`, 14"→`7G`, 17"→`15G`, 20"→`20G`,
     21"→`25G`, 28"→`45G`, 30"→`60G`, 32"→`65G`, 36"→`100G`, 42"→`150G`,
     48"→`200G`, 60"→`300G`;
   - it is an **unlabelled box** → `<N>" Box`. Desert and palm growers print a
     bare `24"`/`36"`/`48"` meaning a box; the supplier's other boxed rows and
     large specimen plant names give it away. Never write `36" Pot` for a boxed
     tree;
   - otherwise it is a **pot** → `<N>" Pot` (`4" Pot`, `8" Pot`, `3.5" Pot`).
     This is the annual / perennial / tropical end of the catalogue.

   A diameter attached to **merchandise** rather than a plant — the row names a
   planter, bowl, basket or tool — is `other`, never a pot.
5. **Word grades** map case- and plural-insensitively: `BR`/`bareroot` →
   `Bare Root`; `LNR`/`Rooted Liner` → `Liners`; anything naming a plug →
   `Plug`; cell trays and flats identified by a cell count or tray code
   (`128`, `1801`, `40 CEL`, `Flat`) → `Trays`; `FG`/`In Ground` →
   `Field Grown`; `Fabric Bag` → `Grow Bags`; `RP` → `Root Pruned`.
6. **Everything else that is still a container** → `other`. `Quart`,
   `Six Pack`, `10" Hanging Basket`, `Specimen` all land here. **`other` is a
   correct answer, not a failure** — it means "a real container the standard has
   no bucket for". Never invent a nearby bucket to avoid it.

`size_std` is `NULL` only when `size` is `NULL`. If the source printed no
container, both stay `NULL` — that is a fact, and §3's *anything you had to
guess* rule still holds.

## 3. Stash the source and create provenance

- File drop → upload: `scripts/agent/supabase/upload --bucket lps --path suppliers/<slug>/rate-cards/<file> --file <local>` (`<slug>` = kebab-cased supplier name, e.g. `austin-plant-supply`). Website → use the page URL.
- One `inventory_sources` row per file/URL in the drop; capture each `id`:
  ```sql
  INSERT INTO inventory_sources (supplier_id, file_path, notes)
  VALUES (<supplier_id>, '<object key or URL>', '<where/how sourced>') RETURNING id;
  ```
- **One per file × location.** `inventory_sources.supplier_id` is a single
  location, so a drop that §0 mapped to several gets a row per location
  pointing at the **same** `file_path` — upload the file once. Keep the ids per
  location; §4 stamps each row with its own location's source id, and mixing
  them up attributes one farm's stock to another. Say in `notes` that the file is
  the company's shared list.
- **Never retire a supplier's previous sources.** Live `inventory` rows still
  point at them, and an inactive source blanks the app's derived
  `ingestion_date` for every row that references it.
- `file_path` is the bucket **object key** (e.g. `suppliers/<slug>/rate-cards/<file>`, no scheme — the app signs it on demand) or a full `http(s)://` URL. Never store a signed URL.

## 4. Write to `inventory` — update what exists, insert what doesn't

An ingest **refreshes** a supplier's availability; it does not replace it.
**Nothing is retired.** For each parsed offering, find the row it already has and
update it; insert only when there is no such row. An offering the supplier has
stopped listing simply isn't touched — it keeps `is_active = true` and its older
`source_id`. That is the staleness signal: "when did we last see this row" is
answered by its `source_id`, not by a flag.

### The newest source wins

**The drop you are holding beats whatever an older file put there.** Every field
it states replaces the stored value — price, quantity, size, dimensions,
availability text — and you never keep an older number because it looks more
plausible, rounder, or closer to the rest of the list. A supplier who has
repriced is not a parse error. If a change looks wrong, **write it and flag it**;
don't quietly preserve stale data, which leaves the database disagreeing with the
supplier's own current list and no record of why.

Three qualifications, and they are the whole of the rule:

- **Silence is not a value.** "Trumps" applies to what the new source *states*,
  never to what it omits. A drop that doesn't mention a field leaves it alone —
  a price column absent from this week's sheet does not blank last week's price,
  and a partial list is not an instruction to erase everything outside it. Only
  an explicit statement ("call for pricing", a struck-through price, "0
  available") overwrites a value with an empty or zero one, and that is a
  statement, not a silence.
- **The email body outranks the file attached to it**, because the body is the
  later thing written. When they disagree — "prices in the attached go up 10% on
  Monday", "ignore the second tab", "the 15 G are gone" — the body is the current
  word and the attachment is the document it is amending. Record what the body
  said in the row's dated `notes` so the override is visible, and flag it if the
  amendment is broad enough that you had to interpret it.
- **Unless explicitly specified otherwise**, which means one of exactly three
  things — none of them your own judgement:
  1. **The brief or Chris says so** — "keep the existing prices", "this is a
     back-catalogue file, don't touch current stock".
  2. **The source says so** — a file the supplier labels superseded, archived or
     future-dated ("effective 1 Sept" is not effective today).
  3. **You are knowingly ingesting an older file than the one already on the
     row** — a backfill, or a re-send of something already processed. Ingestion
     order is not recency: `inventory_sources.created_at` records when *we*
     ingested a file, so replaying a January sheet in August gives it the newest
     `created_at` and it would clobber current data on a naive "latest wins".
     **When the file you hold is older than the row's current source, do not
     overwrite the fields that conflict.** Report them under *Flags needing
     Chris* with both values, and say which source each came from.

  In all three cases the exception is *stated somewhere you can quote*. If you
  cannot quote it, the new drop wins.

**1. Pull the nearest existing rows, then decide — never match on a key.**

An exact key (`name_key` + `size`) looks decisive and isn't. Suppliers respell,
re-punctuate, add a cultivar, move a plant between containers, and switch between
the botanical and common name between drops. Every one of those makes an existing
offering look brand new to a key, and the ingest silently duplicates it. So the
procedure is: **retrieve the closest candidates, look at them, and decide.**

```bash
skills/agent/availability-ingestion/scripts/match-candidates \
  --supplier <supplier_id> --entries /tmp/<thread>-parsed.json
```

Feed it your parsed offerings as a JSON array — the **three name parts** from §2
(`common_name`, `botanical_name`, `cultivar`), plus `size`, `unit_price`,
`quantity`, `height`, `width`, `caliper` when you have them, so the output puts
your entry and its candidates side by side. For a multi-location drop run it
**once per `supplier_id`** in the §0 mapping, with only that location's
entries. `--help` documents the rest; the defaults are the ones to use.

For each entry it returns up to five of that supplier's **active** rows plus the
single best **retired** one, ranked by trigram similarity on the plant identity
with a size-agreement bonus, showing only the columns that distinguish one
offering from another — `id`, `name`, `cultivar`, `size`/`size_std`,
`unit_price`, `quantity`, `height`/`width`/`caliper`, `is_active`, and `dupes`
(how many identical rows collapsed into that line). Notes are deliberately not
fetched: they are long and they never tell two offerings apart.

**The `SUGGEST` line is a sort aid, not a decision.** It buckets by score alone
and knows nothing about the plant. You decide, per entry:

| What you see | Do |
|---|---|
| One clear match — same plant, same container, price/quantity moved as a new drop would | **Update it** (step 2) |
| Best candidates are all a *different* plant, a different container, or nothing came back | **Insert** — but only after the `search_inventory` check below comes back empty too (step 3) |
| The only good match is `INACTIVE` | **Reactivate and update it** — the supplier dropped this plant and brought it back; never insert a second copy |
| Two or more candidates are equally plausible **and materially different** (different price or printed name) | **Touch none of them.** Report the plant, size and candidate ids under *Flags needing Chris* |
| Several candidates are the *same* offering — same printed name and price, differing only by `dupes` or a stale quantity | **Update the top one, leave the rest**, and list them under *Duplicates found* |

Two things that decide most of the judgement calls:

- **A high score is not identity.** `Abies concolor [Blue Select]` and
  `Abies concolor [Candicans]` are different plants that score close together;
  sibling cultivars are the classic trap. When both your entry and the candidate
  name a cultivar and they disagree, the line is marked **`CULTIVAR MISMATCH`**
  and is excluded from the suggestion — but the mark only fires when *both* sides
  name one. Read the name, don't read the number.
- **No candidates does not mean new — ask `search_inventory` before every
  insert.** `match-candidates` ranks by trigram similarity on the identity key,
  so it comes back empty when the supplier prints the botanical name where they
  used to print the common one (or the reverse), or renames the plant outright.
  The RPC is typo tolerant, matches partially at both ends, and expands the
  query through `plant_aliases`, so it finds what similarity misses. **No entry
  is inserted until it has been searched.** The RPC takes **no supplier filter**
  — search first, then scope to this location in the outer query:

  ```sql
  SELECT id, name, cultivar_variety_trade_name, size, size_std, unit_price,
         quantity, is_active, relevance
  FROM search_inventory('<the entry as the source prints it>')
  WHERE supplier_id = ANY(ARRAY[<this location's supplier_id>])
  ORDER BY relevance DESC LIMIT 10;
  ```

  Run it once per name form the entry gives you — the common name **and** the
  botanical name, since either may be what the row was written under. A hit that
  is the same plant in the same container is an **update** (step 2), however low
  `match-candidates` scored it; feed the id back into the table above. Results
  are ranked, not filtered, so read `relevance` and the returned name parts
  before concluding: a weak tail of unrelated rows is normal, and a species
  returned for a cultivar search is not the selection you parsed. The
  `plant-and-supplier-search` skill covers reading a result set.

**Expect the duplicate row of that table on established suppliers.** As of
2026-08-14, 5,714 `(supplier_id, name_key, size, height, width, caliper)` groups
across 77 suppliers cover more than one active row — about 13,500 rows, roughly
two-thirds of them same-price duplicates left behind by the old
replace-and-retire model. That is a cleanup backlog, not a parse failure, and no
ingest resolves it: update one, report the rest.

**2. Update the matched row** with this drop's values: `source_id` = the new
source id **for that row's location**, `unit_price`, `quantity`, `size`,
`size_std`, `height`/`width`/`caliper` and their `*_std`, `image_url` if the
drop has one, and `is_active = true`. `image_url` is a **link, not a copy** —
the address of a photo on the supplier's own page, written as-is. It is where a
captured URL lands (§6); a photo we were *given* as a file goes to
`plant_photos` instead, and the two never describe the same image. Notes follow
§2's split:

- **`notes` is replaced** with this drop's supplier text, dated. The row now
  describes the current offering, and the previous drop's file is still in
  storage as evidence. If this drop says nothing about the row, leave `notes` as
  it is rather than blanking it.
- **`internal_notes` is appended to**, never clobbered — your earlier caveats
  about this row are still true.

`updated_at` is maintained by trigger; don't write it.

**3. Insert a genuinely new offering** — one whose `search_inventory` check in
step 1 returned nothing for this supplier — with the normalized fields from §2,
stamping `supplier_id` and `source_id`. `id` defaults to `gen_random_uuid()`.
Write `common_name` / `botanical_name` / `cultivar_variety_trade_name`;
**never write `name` or any `*_key` column** — the trigger derives all of them,
and a value you put there is overwritten. Never match plant names with `=` on
raw text (compare `name_key` / `common_name_key` / `botanical_name_key`, test
`cultivar_keys` with `&&` or `= any`, or wrap the text in
`normalize_plant_key()`).

**4. Insert only approved active alias pairs into `plant_aliases`** as defined
in §2, each with its `source_id` and the `source_line` that attests it. A BEFORE INSERT trigger silently drops duplicates, self-pairs, empty
keys and mirrored pairs, so blind-insert without conflict handling; new valid
pairs use `is_active = true` (default).

**Do not run a retirement pass.** No `UPDATE inventory SET is_active = false` and
no `UPDATE inventory_sources SET is_active = false` as part of an ingest.
Retiring an offering is a deliberate, separately approved act — if a supplier
tells you an item is discontinued, record that in `notes` and raise it under
*Flags needing Chris* rather than flipping the flag mid-ingest.

**A brand-new supplier's first ingest** finds nothing to match, so it is all
inserts.

**Multi-location: run steps 1–4 once per `supplier_id`** in the §0 mapping,
each with its own source id. The parsed values are the same; the `supplier_id`,
the `source_id` and the row each one matches are not — a location is refreshed
only by its own rows, and a location this drop didn't cover keeps everything it
had. Record the per-location counts separately in your report; one total hides a
location that silently got nothing.

## 5. Post-ingestion QA — required before commit

Treat extraction and writing as untrusted until the drop passes source-to-database QA. Run these checks **before committing the transaction whenever possible**; if a material check fails, roll back and report the exception instead of publishing partially verified data. Because §4 updates rows in place, a bad parse now overwrites good data rather than sitting alongside it — QA matters more under this model, not less.

- **Re-open the original source with the approved primary converter** and compare it to the staged/database output — not only to an intermediate CSV made by the same extraction logic.
- **Reconcile counts:** source offering count versus rows **updated + inserted**, totals by page/section, priced/unpriced rows, quantities, photos, and distinct source ids. The two numbers should account for every source offering between them. Explain every exclusion, deduplication, split combined size, and ambiguous multi-match you skipped; a matching grand total alone is insufficient.
- **Sanity-check the update/insert split.** A repeat drop from an established supplier should be mostly updates with a few inserts. **Mostly inserts means you took `match-candidates` at face value on entries you should have looked at** — a supplier who respelled or re-sized their list produces exactly that shape — and you have just duplicated the catalogue. Stop and investigate before committing: re-run `match-candidates` on a handful of the inserted entries, read the candidates you passed over, and re-run the §4 step 1 `search_inventory` check scoped to this supplier — an insert that search would have matched is a duplicate you just created.
- **Check source coverage:** review representative rows from every page/section and **100% of risky rows** — wrapped/multi-line names or descriptions, blank prices, continuation lines, repeated names/sizes, SALE/COMING SOON/LIMITED/READY statuses, dimensions, calipers, quantities, footnotes, and page breaks.
- **Verify row boundaries:** each raw description/status/spec belongs to the correct plant row and no neighboring cell was crossed, truncated, or silently dropped. Until a dedicated raw-description column exists, preserve the supplier's full verbatim row description in dated `inventory.notes`, then derive `height`, `width`, `caliper`, `quantity`, and availability status separately without replacing the raw evidence.
- **Check the note split:** nothing you concluded ended up in `notes`, no supplier text ended up in `internal_notes`, and no row's `internal_notes` was clobbered by this drop. Also check that nothing you appended to `internal_notes` merely restates the row — a missing price or quantity, when it was last updated or ingested, the size, the dimensions, the name. Delete those before committing rather than publishing them.
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
  NULL; its derived `name` reads the way §2 says. Expect zero rows from each of
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
  preserved in `common_name` under §2's uncertainty fallback is correct and
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
- **Check the row → location mapping from §0.** Every row this drop touched now
  carries one of the new source ids, so group by supplier and compare against
  what §0 said should happen:
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
- **If you onboarded anything**, `supplier-onboarding` §5 has the checks for the
  supplier and contact rows — run them there, not here.
- **Compare against what was there before:** inspect price/quantity/spec changes on the rows you updated, plants that are new to this supplier, and duplicate inflation. Spot-check several important searches afterwards to confirm exact identities rank correctly without sibling-cultivar leakage.
- **Check that the newest source actually won** (§4). Every field this drop
  stated is now the stored value, and every field it didn't mention is
  untouched — a row whose price this sheet listed but which still carries the
  previous figure means an update was skipped, and a field this sheet was silent
  about that is now null means silence was treated as a value. Both are worse
  than a parse miss, because neither shows up in a count. If you *withheld* an
  overwrite under one of §4's three exceptions, that is not a QA failure — but it
  must be quotable and it must be in the report.
- **Manual/current-receipt QA:** when applicable, verify each new source note
  identifies the manual channel/identifier and inbound handoff timestamp, and
  every affected row preserves the printed date/currentness caveat with
  confirmation required in the correct notes column. An old or non-ISO printed
  year alone must not have triggered the historical gate.
- **Record QA evidence in the report contract:** converter used, source counts versus updated/inserted counts, pages/sections checked, risky-row count and result, ambiguous multi-matches skipped, search spot-checks, and whether the transaction committed or rolled back. Do not report an ingest as Catalogued without this QA summary.

## 6. Catalogue any plant photos in the drop

A drop that carries photographs of plants carries two things, not one. The sheet
becomes `inventory`; the photographs become `plant_photos`. **Do the inventory
first** — §0 has to have resolved the supplier before a photo can be attributed
to one, and QA has to have passed before you spend anything else on the drop.

**Follow the `plant-photo-catalogue` skill for the write itself** — hash,
dedupe on `sha256`, upload to the private bucket at an id-built path, insert.
Don't restate it and don't improvise it; that skill owns every `plant_photos`
row. What follows is only what *this* context adds.

### What the ingest knows that a bare photo doesn't

- **The supplier.** Use the location §0 resolved — but only when the drop mapped
  to **exactly one**. A file that fanned out to a company's five farms tells you
  the company, not which farm the photo was taken at, so leave `supplier_id`
  null unless the photo's own context names one. A null supplier is a working
  catalogue photo; a wrong one is worse than none.
- **The provenance.** `source` gets the channel and identifier the file came
  through — `Chris, Telegram main message 682, <ts>` or `<sender>, Gmail
  MessageId <id>, <ts>`. Whoever reads the photo later needs to find its origin
  without your transcript. It is always a *handover*, never a page address: a
  photo that only exists at a URL never gets a row at all (below).

### What the drop is *not* evidence for

**The sheet beside a photo says nothing about the photo.** This is the rule that
matters most here, because everything in the drop looks related:

- **Identity** comes from the photo's own evidence only — a label legible in the
  frame, the filename, or the email/message text naming what was sent. A photo
  attached to a 400-row availability sheet is not "about" those 400 rows, and it
  is not about the row that happens to sit nearest it in the file.
- **Size is stated or null.** It does **not** inherit the sheet's size column,
  and it is never read off how big the plant looks. If the body says "here's the
  30 G windmill palm", that is stated. If it says nothing, `size` and `size_std`
  are null.
- **No inventory link.** There is no link between a photo and an `inventory`
  row, by design — photos outlive the rows beside them. Don't invent one in
  `notes` either; write what the source said, not which row you think it matches.
- A photo is a **reference record, never an availability claim.** Cataloguing a
  supplier's photo does not mean they have it in stock, and nothing you write in
  §6 may read as though it does.

### Attached files only — a URL stays a URL

**We hold bytes only for photos someone handed us.** That is the line, and it is
about what we take a copy of, not about what we know:

| The photo arrived as | Do |
|---|---|
| an **attachment or file** — an email attachment, a Telegram photo, a file Chris gave you, anything already on disk from the brief | **Catalogue it.** Follow `plant-photo-catalogue`: hash, dedupe, upload, insert |
| a **URL** — an image on a supplier's availability page, a link in an email body, a photo on their site | **Capture the URL. Never download it.** No bucket object, no `plant_photos` row |

A photo on a supplier's website is theirs, sitting on their server, already
addressable. Copying it into our bucket takes a licence nobody has stated and
leaves us maintaining a duplicate that goes stale the day they replace it. The
link is the better record and costs nothing.

**Where a captured URL goes:**

- **On the plant it belongs to** — `inventory.image_url`, written in §4 with the
  rest of that row's values, when the page shows a photo for an offering you are
  ingesting. One URL per row; if the page shows several, take the one that
  depicts the offering.
- **Otherwise, in your report.** A gallery page, a general photo page, an image
  that maps to no row you wrote — the URL goes under *Photos* and nowhere else.
  Don't invent a `plant_photos` row without a file, and don't park a URL in
  `notes` to be found later.

**Never fetch an image in order to catalogue it.** Opening a page to read the
availability is normal; downloading its photographs so they can be uploaded to
our bucket is the thing this rule forbids. And **don't crawl** — you are reading
the page you were given, not surveying the site.

### Before you move on

```sql
SELECT id, name, size, size_std, supplier_id, tags, source
FROM plant_photos WHERE sha256 = ANY(ARRAY[<hashes from this drop>]);
```

Every image in the drop is accounted for by exactly one of four outcomes —
catalogued, skipped as a duplicate of an existing `sha256`, skipped as
not-a-plant, or **captured as a URL and not downloaded**. The report says which,
and the last one is the only outcome with nothing to show for it in this query,
which is why it has to be written down.

## Recording availability status

`inventory.notes` carries the supplier's per-row qualifiers and their
**last-known availability** — always with a date, e.g. `Available as of
2026-07-01. Lead time 2 wks.` §4 replaces it with the current drop's text, so
the date on it is the date of the drop it came from; a row nobody refreshed keeps
its older dated status, which is the point. Stock counts go in `quantity`, and
your own reading of the row goes in `internal_notes`.

If the supplier says an item is **out or discontinued**, record that in `notes`
and raise it under *Flags needing Chris*. **Don't flip `is_active = false`
yourself** — retiring an offering is a deliberate act outside an ingest (§4).

## Timestamps

ISO 8601, America/Chicago. "Now" is the timestamp the main agent gives you.
`updated_at` is maintained by trigger on UPDATE.

## Report contract — what you return to the main agent

This is the **canonical definition** of the report; the
`availability-drop-intake` skill (§4) says what the main agent does with each
part. Return a **compact structured report**, not a transcript — the main agent
uses it for the thread summary, the daily note, and anything Chris needs to see,
and it cannot read your transcript. Include:

- **Onboarding** (when any was performed): the block `supplier-onboarding`
  returns, folded in here so the main agent reads one report — the new
  `supplier_id` and its `head_branch_id`, enrichment and newsletter, contacts and
  links. Say what sent you there: a sender that matched nothing, or a farm the
  file named that had no row.
- **Locations**: which location(s) this drop was written to and how the mapping
  was decided — the name the source gave per row/section, the one name it gave
  for the whole file, or "no location named → all N of the company's". Say which
  of the company's locations you did **not** write to, and which tabs or
  sections you skipped as non-locations (§0).
- **Result**, **per location** when the drop covered several, never as one total:
  supplier_id, source ids + `file_path`s created, **rows updated**, **rows
  inserted**, rows reactivated, ambiguous multi-matches skipped, alias pairs
  added. Nothing was retired — if you believe something should be, it goes under
  *Flags needing Chris* instead. For a manual/current-receipt intake, also state
  the handoff timestamp, printed date(s), and that all availability/pricing is
  confirmation-required; for an explicit historical/backfill, state the gate
  decision/record/revalidation instead.
- **Photos** (when the drop carried any): every image accounted for, in the two
  halves §6 splits them into.
  - **Attached files**, one of: catalogued (with the `plant_photos` ids, plant,
    supplier attribution or "unattributed", and whether size was stated or left
    null), skipped as an exact `sha256` duplicate of a photo already catalogued,
    or skipped as not a plant (logo, signature, letterhead).
  - **URLs captured**, which were **not** downloaded: the ones written to an
    `inventory.image_url` (say which rows), and any that mapped to no row —
    their URLs listed here, since this report is their only record.
- **Overrides withheld**: any field where you did *not* let this drop win, under
  one of §4's three exceptions. Give both values, both sources, and the sentence
  you are relying on. An empty list is the normal case and worth saying so.
- **Duplicates found**: keys where several active rows carried the same price and
  printed name (§4 step 1). Give the plant, size and row ids, and say which one
  you updated. These are a cleanup backlog, not something to fix mid-ingest.
- **Follow-up questions**: anything you need from the main agent to finish
  (missing/ambiguous inputs, credentials, a decision). If you stopped early
  because of one, say exactly where you stopped and what remains.
- **Flags needing Chris**: missing prices, unclear sizes/specs, plants that
  didn't map, suspected duplicates/typos in the source.
- **Errors/issues faced** and how you resolved them.
- **Learnings**: supplier quirks or parsing tricks not yet in the supplier's
  `notes.md`; anything incorrect/redundant found in SCHEMA.md, this skill, or
  other docs; **suggested skill/script/database changes** (you never change this
  skill — they go to the daily summary for Chris's/Bhoumik's approval).
- **Suggested status label**: `Catalogued` / `Failed` / `Not Availability` /
  `Escalated` — the four sub-labels defined in `availability-drop-intake` §5,
  which is where the main agent applies them.
