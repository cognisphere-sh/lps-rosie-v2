# SOP: Supplier onboarding & availability ingestion

Standard operating procedure for onboarding a supplier and ingesting one
availability drop (price list, availability sheet, website catalog, or photo)
into Supabase. This SOP is executed by a **sub-agent**; the main agent hands
you the inputs and expects the output contract at the bottom. Follow it
end-to-end — you do the onboarding (when needed), the parsing, **and** the
database writes.

**Do not edit this SOP.** If you find something wrong, missing, or
inefficient in it, put the suggested change in the *Learnings* part of your
output — SOP changes require Chris's or Bhoumik's approval.

## Inputs you receive from the main agent

- The supplier: either an existing `supplier_id` + name, or (for a new
  supplier) whatever is known — name, email, sender, address fragments.
- Source material: attachment paths, a website URL, an image path, and/or the email body text.
- Path to `knowledge/SCHEMA.md` — **read it before writing any query.**
- Any contact with the supplier during onboarding or ingestion (requesting a
  list, chasing a reply, confirming a price) gets an appended, timestamped entry
  in `suppliers.communication_notes` — channel, what, why, thread id. Durable
  facts about the supplier go in `suppliers.notes`; the two are not
  interchangeable (see SCHEMA.md).
- Path to this SOP.
- The parent ThreadId (for your notes/temp naming) and the current timestamp.

Also read `workspace/suppliers/[<supplierId>]:<Name>/notes.md` if it exists —
it records this supplier's known quirks and parsing tricks. Apply them.

**If any input is missing or ambiguous** — you can't tell which supplier the
drop belongs to, a credential/password is needed, the source is unreadable —
**ask the main agent**: put your question(s) in your output (see the output
contract) and stop at a safe point. You will be re-invoked with answers in
the same session. Ask early rather than guessing.

## 0. Onboarding (only when the supplier is new)

- Never guess a duplicate into existence: search `suppliers` first (match on
  `email`, then `name ILIKE`). If you still can't tell whether this is a new
  supplier, ask the main agent and stop.
- INSERT the `suppliers` row with whatever you have (`name` is required; add
  `email`/`poc_name`/`poc_email`/`poc_phone`/`phone`/address parts when
  present). Set `category` to one of `Wholesaler`/`Grower`/`Nursery` **only
  if you actually know it — otherwise leave it null; never guess.** Capture
  the returned `id`.
- **Enrich via the browser** (`scripts/agent/agent-browser`): google the
  supplier; find their **website** (store as a bare domain, e.g.
  `acostafarms.com` — the UI prepends `https://`), full **address / city /
  state / zip**, **phone**, and **latitude / longitude** (read coords off
  their Google Maps listing or geocode the address). UPDATE the row with what
  you confirm — never invent values you couldn't verify.
- **Subscribe to their availability newsletter.** While on their website,
  look for an availability / price-list newsletter signup (footer form,
  "join our mailing list", Mailchimp/Constant Contact embed). If found,
  subscribe with Daisy's email **`chris.r@localplantsupply.com`** and record
  in your output that you subscribed (the main agent tells Chris). If signup
  needs approval or human steps, note that instead.
- Do the same enrichment/newsletter check for an **existing** supplier whose
  row is missing website/address/coords — don't re-subscribe if their notes
  say it's already done.

## 1. Acquire and convert the source

- Attachments: `scripts/agent/markitdown <file>` for PDF/xlsx/docx; `pdftoppm -png` + `read` for scanned PDFs/images.
- If the email **body** contains a URL that may hold the availability (link to a price list / catalog / sheet), open it with `markitdown` or `scripts/agent/agent-browser` — don't treat a bare link as unparseable. If the URL is a downloadable file, download it and check its contents before deciding it's irrelevant.
- Intermediate files (converted markdown, page images, parse chunks) go to `/tmp` — they are not records.

## 2. Parse and normalize

One logical row per **plant × size offering**. Normalize every line:

- **Size** (`inventory.size`): gallons `XX G` (space before the G) — `#15`/`15gal`/`15G` → `15 G` (`#` means gallons). Inches `XX"` — `24 inch` → `24"`. Feet `XX'` — `6ft` → `6'`. Compounds keep units: `3' cal`, `24" box`. Plant name excludes size — size is its own column.
- **Name** (`inventory.name`): one column carries the whole identity, written as
  **`Name [scientific name, variant, cultivar]`**.
  - `Name` is the plant name **as the source prints it**, in full — including any
    cultivar, selection, form, or trade name that is part of that printed name.
    Don't invent a name the source doesn't give, and don't strip anything it does.
  - Append the bracket when the source also gives a **scientific/botanical name**
    and/or a **variant / cultivar / trade name**, in that order: both →
    `Forest Pansy Redbud [Cercis canadensis, Forest Pansy]`; scientific name only →
    `Eastern Redbud [Cercis canadensis]`; variant only →
    `Forest Pansy Redbud [Forest Pansy]`. Neither → no bracket at all.
  - There is **no `variety` column** — the variant lives in the bracket. Size is
    still its own column and never goes in the name.
  - Put the **common name first** whenever the source prints one, even if it also
    prints the botanical name: `Redbud, Forest Pansy [Cercis canadensis, Forest
    Pansy]`, not `Cercis canadensis [Forest Pansy]`. The name is the only place a
    printed common name is kept, so dropping it loses it permanently — it cannot
    be recovered later without reparsing the source.
- **Aliases** (`plant_other_names`): an alias exists for exactly one reason — so a
  search finds the row when the user types **another name the same plant is known
  by**. Insert `(inventory.name, other_name)` pairs, where `other_name` is a
  genuine common name, the botanical/scientific name, an accepted synonym, an
  abbreviation, or a spelling variant.
  **Quality bar — an alias is a liability, not a freebie.** Search follows this
  graph *and* hops between siblings: if hub `H` has aliases `A` and `B`, someone
  searching `A` gets rows named `B`. One bad pair pollutes a whole neighbourhood,
  which is why a 2026-07-31 audit had to retire most of the directory. **When in
  doubt, insert nothing** — a missing alias costs one search; a wrong one
  corrupts many. Before inserting, every pair must pass all of these:

  - **Same plant, not a relative.** Both sides must name the *same* plant. Never
    a species ↔ one of its cultivars, never sibling cultivars, and never two
    different species — `Cercis canadensis` ↔ `Cercis mexicana` is wrong, they
    are different plants. Genuine renames are fine (`Sedum spectabile` ↔
    `Hylotelephium spectabile`).
  - **No cultivar, selection, variant, trade name or patent code in
    `other_name`** — not `'Forest Pansy'`, `Merlot Redbud`, `PP21929`,
    `Kaleidoscope™`. Those identify one selection. They are already searchable
    inside `inventory.name`, so the alias adds nothing and costs cross-matches.
  - **Nothing generic.** A label that fits many plants — `Oak`, `Grass`, `Maple`,
    `Redbud`, `Perennial`, `Native`, `Shade Tree` — is a category, not a name.
    Text search already finds a name containing "Maple"; an alias only wires
    unrelated plants together. Rule of thumb: if it would fit more than a couple
    of distinct plants in the catalogue, don't insert it.
  - **A name, not data.** Never a size, grade, container or form code (`15 G`,
    `B&B`, `M/S`, `STD`, `Clump`), a price, a quantity, a SKU, a zone or shipping
    note, or a truncated fragment of a longer name.
  - **Not redundant.** Skip it if it differs from `inventory.name` only by
    punctuation, casing, spacing, or a size/form suffix — those already match.

  New pairs are `is_active = true` (the default). Inactive pairs are historical
  and power neither search nor display; **never reactivate one** to "restore" a
  name, and never re-add a pair a cleanup retired.
- **Price**: `unit_price` is required; use the lower bound if the source gives a range. **Do not ignore zero-priced rows** — if the source lists an item at `0` (or with no price printed), still ingest the row with `unit_price = 0` and flag it for Chris (see output contract), don't drop it. Stock counts go in `quantity`.
- `height`/`width`/`caliper` as printed. The source's own grouping (e.g. `Shade Trees`) is **not** stored — there is no `category` column on `inventory`.
- To check "does the system already know this plant?", call the `search_inventory` RPC — typo-tolerant, follows the alias graph.

## 3. Stash the source and create provenance

- File drop → upload: `scripts/agent/supabase/upload --bucket lps --path suppliers/<slug>/rate-cards/<file> --file <local>` (`<slug>` = kebab-cased supplier name, e.g. `austin-plant-supply`). Website → use the page URL.
- One `inventory_sources` row per file/URL in the drop; capture each `id`:
  ```sql
  INSERT INTO inventory_sources (supplier_id, file_path, notes)
  VALUES (<supplier_id>, '<object key or URL>', '<where/how sourced>') RETURNING id;
  ```
- `file_path` is the bucket **object key** (e.g. `suppliers/<slug>/rate-cards/<file>`, no scheme — the app signs it on demand) or a full `http(s)://` URL. Never store a signed URL.

## 4. Write to `inventory` as a new version

Each ingestion *supersedes* the supplier's current availability — never edit rows in place:

- **Insert one `inventory` row per offering**, stamping `supplier_id` and `source_id`, with the normalized fields from §2. `id` defaults to `gen_random_uuid()`; **never write `name_key`** — it's a generated column, and never match plant names with `=` on raw text (join on `name_key` / `normalize_plant_key()`).
- **Insert only approved active alias pairs into `plant_other_names`** as defined in §2: scientific names and true synonyms/spelling variants, never cultivar/selection/trade-name aliases. A BEFORE INSERT trigger silently drops duplicates and self-pairs, so blind-insert without conflict handling; new valid pairs use `is_active = true` (default).
- **Carry forward `notes`** (availability status + seller notes) from the matching old active row — match on `(supplier_id, name_key, size)`. Don't lose prior status.
- **Then retire the old version** (soft delete — `DELETE` is blocked anyway):
  ```sql
  UPDATE inventory SET is_active = false
  WHERE supplier_id = <id> AND is_active
    AND (source_id IS NULL OR source_id <> ALL(ARRAY[<new source ids>]::uuid[]));
  UPDATE inventory_sources SET is_active = false
  WHERE supplier_id = <id> AND is_active AND id <> ALL(ARRAY[<new source ids>]::uuid[]);
  ```
- A brand-new supplier's first ingest is just plain inserts (nothing to carry or retire).
- **Verify** before finishing: active row count for the supplier matches what you inserted; no stray active rows from the old version.

## Recording availability status

`inventory.notes` is the free field for per-row qualifiers and **last-known
availability** — always with a date, e.g. `Available as of 2026-07-01. Lead
time 2 wks.` Append, don't replace, so a stale status stays obvious by its
date. If the supplier says an item is out or discontinued, record that in
`notes` and/or flip the row `is_active = false`. Stock counts go in `quantity`.

## Timestamps

ISO 8601, America/Chicago. "Now" is the timestamp the main agent gives you.
`updated_at` is maintained by trigger on UPDATE.

## Output contract — what you return to the main agent

Return a **compact structured report** (not a transcript). The main agent
uses it verbatim for the report to Chris, the thread summary, and the daily
note, so include:

- **Onboarding** (when performed): new `supplier_id`, fields set via browser
  research, newsletter subscribed (or why not).
- **Result**: supplier_id, source ids + `file_path`s created, rows inserted,
  rows deactivated, alias pairs added.
- **Follow-up questions**: anything you need from the main agent to finish
  (missing/ambiguous inputs, credentials, a decision). If you stopped early
  because of one, say exactly where you stopped and what remains.
- **Flags needing Chris**: missing prices, unclear sizes/specs, plants that
  didn't map, suspected duplicates/typos in the source.
- **Errors/issues faced** and how you resolved them.
- **Learnings**: supplier quirks or parsing tricks not yet in the supplier's
  `notes.md`; anything incorrect/redundant found in SCHEMA.md, this SOP, or
  other docs; **suggested SOP/script/database changes** (you never apply SOP
  changes — they go to the daily summary for Chris's/Bhoumik's approval).
- **Suggested status label**: `Catalogued` / `Failed` / `Not Availability` / `Escalated`.
