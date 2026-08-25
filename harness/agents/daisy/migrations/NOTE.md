# Migrations applied by Daisy

> **Historical record — superseded. Not a description of the current schema.**
> `public.rate_charts` has since been renamed to `public.inventory`, and
> `rate_charts` now survives only as a backwards-compatibility *view* over it.
> For the schema as it actually is, read `knowledge/SCHEMA.md` (the shared
> `docs/supabase-schema.md`). This file is kept only to record what was run.

Applied to Supabase project `xyeyiqchadfszewztnrf` (lps-rosie) via the Supabase MCP.

> Gap: `0028` and `0029` are applied but were never recorded here.

## `0073_drop_customer_communication_notes.sql`

Applied 2026-08-25 (Bhoumik). Drops `customers.communication_notes`, the
append-only customer contact log — the same move the supplier side made in
`0063`/`0066`. Every customer now has a dedicated rosie thread
(`customers.rosie_thread_id`, `0068`) reachable from the customer page's Rosie
button, and that transcript is the contact history; `customers.notes` keeps the
durable-facts half. No backup table: the column was NULL on every row (2
customers, none with any text).

## `0072_reserve_job_request_id.sql`

Applied 2026-08-24 (Bhoumik). Adds `public.reserve_job_request_id()` —
`nextval` on the `job_requests` identity sequence and nothing else, so the
app's **New job request** button can name a request's `jr-<id>` conversation
before the row exists. The row is rosie's to write, from that conversation
(`INSERT ... OVERRIDING SYSTEM VALUE`, since `id` is GENERATED ALWAYS); an
abandoned start leaves a gap in the numbering. Executable by `service_role`
only, so no anonymous caller can burn ids.

## `0071_ar_request_lps_notes.sql`

Applied 2026-08-23 (Bhoumik), same day as 0070. Adds
`availability_requests.lps_notes` — LPS's job-level note to the supplier
(delivery window, site constraints, cross-line context), rendered on the
portal's request card and never portal-writable — and re-comments the item
column with its broadened semantics: the mapped substitute + price from
inventory data, a special customer request, or a customer note worth the
supplier's eyes.

## `0070_ar_items_lps_notes.sql`

Applied 2026-08-23 (Bhoumik). Adds `availability_request_items.lps_notes` —
LPS's brief note to the supplier about a line (a few words, typically the
substitute rosie's sourcing mapped), rendered under the plant name in the
portal. The reverse direction of `notes` (the supplier's answer), and kept
out of the portal PATCH whitelist so a supplier can never edit it.

## `0069_order_data_reset.sql`

Applied 2026-08-23 (Bhoumik) — **hard delete, deliberately no backup** (his
instruction). Truncates the whole order-side data set — `customers`,
`job_requests` (+ items + changelog), `availability_requests` (+ items) —
with `RESTART IDENTITY`, clearing the pre-restructure test data (1 job
request / 11 lines / 27 changelog rows, 1 availability request / 11 lines,
0 customers) so real orders start clean on the new thread model. Schema
untouched.

## `0068_rosie_thread_ids.sql`

Applied 2026-08-23 (Bhoumik), part of rosie's restructure. Adds
`suppliers.rosie_thread_id` (backfilled with the same `supplier-<slug>` values
as `daisy_thread_id` — thread ids are per-agent namespaces, so the shared
string names two distinct threads) and `customers.rosie_thread_id`
(`customer-<slug of name>`, minted by rosie on first contact; the table was
empty on apply, so no backfill). Rosie coordinates all order-side supplier and
customer contact on these threads.

## `0067_supplier_type_tags.sql`

Applied 2026-08-23 (Bhoumik), implementing Chris's 2026-08-21 supplier-type
direction. `suppliers.category` CHECK narrowed to `Grower` | `Wholesale
Supplier` | `Retail` | `Broker/Platform` (NULL = insufficient evidence),
retiring `Nursery`, `Wholesaler` and `Other`; 697 of 1,395 rows reclassified.

**Reviewed, not bulk-mapped.** Evidence per company (head branch): the original
supplier workbook's outreach cohorts (Wholesale Growers / Wholesale Nurseries /
Retail Nurseries / Platform & Brokers / Luxury Builders / Non-Plant, TX and
out-of-TX — matched by normalized name + state and by website domain, shared
platform domains excluded), and a web review of all 73 companies whose cohorts
conflicted, sat on an ambiguous sheet (Wholesale Color, Turf, Disqualified) or
matched no cohort. Per-supplier rationale:
`artifacts/0067_supplier_type_review.csv`. Low-confidence web verdicts were
left NULL rather than guessed.

Corrections worth remembering: Calloway's (retail chain — the workbook shelves
it under Wholesale Growers TX), Premier Nursery, The Growers Outlet and
Whitfill are `Retail`; Moon Valley is split per location (Glen Flora farm
`Grower`, the 17 stores `Retail`); Devil Mountain is `Wholesale Supplier`;
Agri-Starts (ex-"disqualified") is a `Grower` (tissue-culture propagator). The
88 luxury-builder and 5 non-plant rows are NULL with a `notes` line saying they
are not plant suppliers. Grower rows kept their tag except the 7 where review
contradicted it (3 → Retail, 2 → Wholesale Supplier via company tag, 2 → NULL
on insufficient evidence).

Pre-change snapshot: `supplier_category_backup_20260823` (id, category).
Post-apply distribution: Grower 810, Wholesale Supplier 400, Retail 79,
Broker/Platform 6, NULL 100; the new CHECK validated every row (no NOT VALID).

## `0066_drop_supplier_messages.sql`

Applied 2026-08-23 (Bhoumik). Drops the `supplier_messages` chat transcript —
the transcript UI left the supplier page and portal the same day, and the
supplier-events plugin that fed it was removed. 213 rows snapshotted to
`supplier_messages_backup_20260823`; `suppliers.communication_notes` stays as
the frozen pre-0063 archive. Availability-request tables untouched.

## `0065_inventory_notes_boilerplate_cleanup.sql`

Applied 2026-08-23 (Bhoumik), data-only. Strips provenance boilerplate from
active `inventory.notes` per Chris's rule that notes never restate what other
columns/tables record: "available as of"/received dates, source-file names and
verbatim source-row restatements dropped; supplier qualifiers, yard/field
locations, item codes, ordering constraints and future-availability schedules
kept. 48,771 noted rows → 30,661 (18,162 cleared); 7.98M → 3.90M chars.
Backup: `inventory_notes_backup_20260823` (id, notes, internal_notes).

## `0064_supplier_daisy_thread_id.sql`

Applied 2026-08-23 (Bhoumik). Adds `suppliers.daisy_thread_id` — the dedicated
daisy harness thread per company, one per head branch (every location row
carries its head branch's value). Format `supplier-<slug of head-branch name>`,
`-<head id>` appended only on a slug collision between distinct companies. The
slug (not the id) lets the email-router thread mint the same id for a brand-new
supplier before its row exists. Backfill: 1,395 rows, 1,335 distinct threads.

## `0063_supplier_chat_transcript.sql`

Applied 2026-08-19, one step. The supplier communication log becomes a chat
transcript: `supplier_messages.channel` gains `internal` (a thread message
that is not supplier-facing — an instruction to daisy, another agent's note),
and every `suppliers.communication_notes` entry was migrated in as an
`internal` broker-side note (196 entries from 92 suppliers; stamps →
`created_at` in America/Chicago, header lines kept as the body's first line,
literal `\n` sequences normalized). The column is retired but **not
dropped** — commented as a frozen archive so the migration stays auditable.
`customers.communication_notes` is untouched.

## `0062_availability_requests_and_supplier_messages.sql`

Applied 2026-08-19, one step. Adds the supplier side of sourcing a job
request: `suppliers.is_onboarded` (answers availability requests in the
supplier portal; portal auth deliberately deferred), `availability_requests`
(one ask, job request → supplier, with `share_customer_details` and a
`new`/`submitted`/`closed` lifecycle), `availability_request_items` (the
shared lines, **snapshotted** name/size/quantity at share time, plus the
supplier's per-line answer: `available` | `unavailable` | `can_order` |
`substitute`, avail qty, price, notes), and `supplier_messages` (the
broker↔supplier thread, channels `email`/`text`/`app`, append-only — no
updated_at, no is_active).

RLS enabled on all three with the standard `authenticated full access`
policy; `handle_updated_at` on the two mutable tables; indexes on the
supplier/request lookups. Additive only — no data touched.

## `0061_rename_internal_notes_to_sourcing_notes.sql`

Applied 2026-08-18 at Bhoumik's request, one step. Renames `internal_notes` →
`sourcing_notes` on `job_requests` and `job_request_items`, with a comment on
each.

**Why:** "internal" said who may read it, which `customer_notes` and
`external_notes` already imply by contrast; the name now says what goes in it —
who we asked, what they said, what it costs. Only rosie's two tables:
`inventory.internal_notes` is daisy's, means parse caveats on an ingested row,
and keeps its name.

Data, column position and the changelog are untouched — entries written before
today still name `internal_notes` in their `changes` jsonb, which is correct:
that is what the column was called when they were written.

## `0060_drop_needs_attention.sql`

Applied 2026-08-18 at Bhoumik's request, one step. Drops `needs_attention` from
`job_requests` and `job_request_items`, and with it the two partial indexes over
it from 0055 (`job_requests_attention_idx`, `job_request_items_attention_idx` —
Postgres drops an index that depends on a dropped column).

**Why:** it was the weaker of two ways to say "a person has to look at this".
`status` says it in a more specific word — `alternative_proposed`,
`unavailable`, `pending`, against `available`, which needs no one. Once the
app's "Needs input" surface was derived that way, the flag marked nearly every
row, which marks nothing. `status` for where a line stands and `internal_notes`
for why replace it.

No data lost — both tables were empty when this was applied.

## `0059_job_request_name.sql`

Applied 2026-08-18 at Bhoumik's request, one step. One nullable column,
`job_requests.name`.

**Why:** a request was addressable only as `JR-<id>` and by whose it is, which
is enough to look one up and not enough to recognize one — a customer with three
open requests gave three identical-looking cards. The name is the handle people
already use out loud ("the Riverbend planting").

Nullable and undefaulted on purpose: a name is a judgement, and a generated
stand-in would look like somebody had named it. The UI falls back to `JR-<id>`.
No backfill — the table was empty when this was applied.

## `0058_job_request_item_status_vocabulary.sql`

Applied 2026-08-18 at Bhoumik's request, one step. `job_request_items.status`
narrowed from seven words to four (`pending`, `available`,
`alternative_proposed`, `unavailable`), remapping before narrowing. See the
migration file's own header for what went and why.

## `0057_quoted_exact_plant_search.sql`

Applied 2026-08-17 at Bhoumik's request. Adds the immutable
`normalize_identity_token_key(text)` helper and replaces only the body of the
existing two-argument `search_inventory` RPC; no inventory, source, alias or
index changed.

A query wrapped by one outer pair of straight double quotes now matches complete
identity-part/direct-alias equivalence instead of broad discovery. Case,
punctuation and token order are ignored; extra tokens are not. Unquoted input
runs the 0050 body unchanged. Pre/post digests were identical for unquoted
Italian Cypress, Cupressus sempervirens, Live Oak and Crape Myrtle Muskogee.
Quoted Italian Cypress returned 20 rows / 8 suppliers; its reversed-word query
had the identical ID digest. Quoted Cupressus sempervirens returned 29 / 12.
Both had zero Arizona/arizonica/Blue Ice rows. An unbalanced quote stayed broad
without error. PostgREST exposed one unchanged RPC signature, and the app API
returned the same 20 clean quoted results.

## `0056_job_request_item_available_quantity.sql`

Applied 2026-08-17 at Bhoumik's request, one step. One nullable column,
`job_request_items.available_quantity`, plus its `>= 0` CHECK.

**Why:** the Order Requests design gives every line two quantity columns —
Demand and Avail — and derives its whole "Partial" state from the gap between
them. 0055 shipped only `quantity`, so that column of the screen had nothing
behind it. NULL means unanswered (a dash, never a zero), 0 means confirmed
unavailable, and below `quantity` is partial cover. It is deliberately not
constrained against `quantity`: a supplier offering more than was asked is real.

The 0055 changelog trigger picked the column up with no change, since it diffs
`to_jsonb(NEW)` rather than a column list — verified by updating the new column
and seeing one changelog row naming only `available_quantity`.

## `0055_customers_and_job_requests.sql`

Applied 2026-08-17 at Bhoumik's request, one step, recorded as
`customers_and_job_requests`. The customer side of the business: `customers`,
`job_requests`, `job_request_items` and the trigger-written
`job_request_changelog`. **These tables are owned by the new `rosie` agent** —
daisy does not write them; the file lives here because this directory is the
deployment's single sequential migration record.

Shape decisions worth remembering: `job_requests.customer_id` is **nullable**
(anonymous intake, mapped to a customer later; FK is SET NULL);
`job_request_items.total` is `GENERATED ALWAYS AS (quantity * unit_price)`;
the changelog is written only by `log_job_request_changes()` (AFTER INSERT OR
UPDATE on both request tables) so the app's UI edits and agent edits are both
audited without either cooperating — the actor is the `app.actor` GUC when a
writer sets it, else the connecting role. Status vocabularies use underscore
spellings to match `chat_sessions.status`.

Post-apply verification (all test rows removed after): anonymous insert and
later mapping; bad status and `quantity = 0` rejected; `total` computed
(10 × 24.50 = 245.00), NULL while unpriced, direct write refused; UPDATE bumps
`updated_at` and writes one changelog row naming exactly the changed columns
(old/new — the generated `total` shows its real values); a no-op UPDATE writes
none; `SET app.actor TO 'rosie'` appears as the actor, `RESET` falls back to
`postgres`; the last-5 fetch returns newest-first; deleting the test request
cascaded its items and changelog rows. `get_advisors` (security) shows no new
findings beyond the pre-existing mutable-search_path WARN pattern every
trigger function here carries.

## `0054_plant_photo_reclaimable.sql`

Applied 2026-08-16 at Bhoumik's request, one step. Adds
`public.plant_photo_reclaimable(older_than_days int default 30)` — the last open
piece of lever D in the photo cost plan. No table, index or row touched.

It lists objects in the `plant-photos` bucket that **no active catalogue row
points at**, older than the grace period, tagged `retired` (a soft-deleted
photo's tombstoned object) or `orphan` (no row at all — an upload whose insert
then failed).

**An object belonging to an active photo can never be returned.** That is the
property the function exists for, and it is why the sweep asks the database
rather than diffing two lists in a script.

`SECURITY DEFINER` with `search_path` pinned, because `storage.objects` is not
exposed to PostgREST and the alternative was a script carrying its own Postgres
connection — duplicating the pooler/direct fallback `scripts/agent/supabase/query`
already solves. Granted to **`service_role` only**; `authenticated` must not be
able to enumerate bucket contents.

Read by `skills/agent/plant-photo-catalogue/scripts/reclaim-orphans`, which is
dry run by default and needs `--delete` to act.

Post-apply verification: `(30)` → 0 rows (the one candidate was hours old);
`(0)` → 1 row, the retired windmill palm label; `(-5)` clamps to 0 rather than
reaching into the future; `(null)` falls back to 30. Critically, joining the
`(0)` result against active photos returns **zero** — no live object leaks into
the candidate list. The delete path was then exercised against two purpose-built
orphans and confirmed.

⚠ **A real object was destroyed during that test.** The `--older-than-days 0
--delete --force` run intended for the two orphans also swept the genuinely
retired windmill palm label photo, because nothing scoped it. Restored the same
day from the on-disk intake original, normalised to WebP; its `sha256` was
unchanged, which incidentally confirmed the source-hash design. Its row now
points at the `.webp` path and stays `is_active = false` — that decision was not
reversed. The script gained `--reason {orphan,retired,all}` as a direct result.

## `0053_plant_photos_bucket_normalised.sql`

Applied 2026-08-16 at Bhoumik's request, one step. **Bucket configuration only**
— no table, index, function or row touched.

    allowed_mime_types  image/jpeg|png|webp|heic|heif  ->  image/webp
    file_size_limit     25 MB                          ->  8 MB

Follows the decision that the catalogue is a **reference library, not an
archive**. Photos are normalised before upload by the new
`skills/agent/plant-photo-catalogue/scripts/prepare-photo` — EXIF orientation
baked into the pixels, all metadata dropped, long edge capped at 2048px,
re-encoded to WebP. Measured on a 4032x3024 phone photo: **7.9 MB -> 819 kB,
89.6% smaller**, correctly rotated, GPS gone.

**The narrowed type list is the enforcement, not decoration.** Exactly one
process writes to this bucket and it always emits WebP, so an un-normalised
upload is by definition wrong and now fails at the API rather than being found
later. HEIC left the list for the same reason: it is a *source* format
`prepare-photo` reads (via pillow-heif) and converts, never something we store.
The 8 MB ceiling is a backstop — a 2048px WebP is under 1 MB, so anything near
it means the normaliser was skipped.

Both settings gate **uploads only**. The 44 objects already in the bucket are
JPEGs, still readable, rows still valid, and deliberately **not backfilled**:
re-encoding them would destroy originals we still hold to save roughly 13 MB.
They normalise if and when they are re-sent.

One semantic change rides along, in the skill rather than the schema:
`plant_photos.sha256` now hashes the file we were **handed**, not the object
stored. Keying on our own output would break dedupe the day the encoder settings
change. One-row-per-object is guaranteed by `plant_photos_object_idx` instead,
which is what it was always for.

Post-apply verification: bucket reports `{image/webp}` / 8388608; a JPEG upload
is refused with `InvalidMimeType` / HTTP 415 while the same photo normalised to
WebP uploads cleanly (probe object deleted afterwards, bucket back to 44); the
existing JPEG objects still render through `/api/photos/<id>/image`.

Rollback is the reverse UPDATE; nothing else to undo.

## `0052_plant_photos_name_key.sql`

Applied 2026-08-16 at Bhoumik's request, in two steps recorded in the Supabase
history as `plant_photos_name_key` and `search_plant_photos_name_key`. Closes
the last identity-column gap between `plant_photos` and `inventory`.

0051 already gave photos the same three name parts, the same derived `name`, the
same `common_name_key` / `botanical_name_key` / `cultivar_keys` and the same
`size` / `size_std` pair — all of which is what puts photos on the
`plant_aliases` graph. What it missed was `name_key`, the one identity column
`inventory` maintains as a GENERATED column rather than through its trigger.
Adding it with the identical expression means the two tables can be **joined on
identity**, which is what a photo indicator on Plant Search needs.

`search_plant_photos` was recreated to project it — the return type is fixed, so
a new column has to be added there before PostgREST can read or filter on it.
The body is otherwise unchanged from 0051; only the projection moved (32 → 33
columns).

⚠ **`name_key` is a whole-identity key, not a plant-name one.** It is
`normalize_plant_key(name)` and `name` is the *composed* identity, so a windmill
palm row keys as `windmillpalmtrachycarpusfortunei`. Measured after apply:
`= normalize_plant_key('Windmill Palm - Trachycarpus fortunei')` returns both
windmill palm rows, and `= normalize_plant_key('Windmill Palm')` returns
**zero**. That is the same semantics `inventory.name_key` has — the point of
making the columns identical rather than inventing a looser one here — and the
column comment says it out loud so nobody reaches for it to answer "do we have a
photo of this plant?" (that is the part keys, or the RPC).

**Still different from `inventory`, deliberately:** `height_std` / `width_std` /
`caliper_std`, the numeric columns backing the app's dimension range filters.
Photos carry the raw `height` / `width` / `caliper` text but no standardized
pair, because nothing captures a measured value for a photo yet and an
unpopulated numeric column reads as a promise the data does not keep. Three
columns and three partial indexes when a range filter is actually wanted.

Post-apply verification: `name_key` populated on all four existing rows with no
backfill; `search_plant_photos` returns 33 columns and the same rows and
relevance as before (`chusan palm` → 2 rows @ 0.69, still reached only through
the alias edge); `cultivar_keys && array['natchez']` over the RPC → 1 row, which
is the app's new Cultivar filter.

## `0051_plant_photo_catalogue.sql`

Applied 2026-08-16 at Bhoumik's request, in three steps recorded in the Supabase
history as `plant_photos_table`, `plant_photos_search_indexes` and
`search_plant_photos`. **Purely additive** — no existing table, column, index or
function was touched, so nothing could regress.

Adds `public.plant_photos`, the **private** `plant-photos` bucket (25 MB cap,
`image/jpeg|png|webp|heic|heif` only, **no storage policy** so only the secret
key and `postgres` reach the objects), and `search_plant_photos`.

The identity half is `inventory`'s, on purpose: three name parts, a derived
`name`, derived `*_key` columns. That is what lets `plant_aliases` reach photos —
verified after apply, and it is the property to re-check if the derivation ever
changes. `search_plant_photos` is `search_inventory`'s body over a different
document, with one structural difference: **suppliers join LEFT**, because a
photo's supplier is optional and an inner join would hide every unattributed
photo.

`plant_photo_document()` exists so the searchable expression has **one**
definition. On the inventory side the identical concatenation is repeated in two
index definitions and four places inside the RPC, and a byte of drift silently
disables the indexes; here both indexes and the function call the same IMMUTABLE
function. Change it and both indexes must be rebuilt.

**Deliberately deferred from the plan** (`knowledge/files/plans/searchable-photo-catalogue-plan.md`):
its seven-table phase-1 model — separate `photo_assets`, many-to-many subjects /
supplier links / inventory links / tags, `photo_provenance_events` — plus the
review workflow, perceptual hashing and generated `display.webp` / `thumb.webp`
derivatives. One photo carries one subject, at most one supplier and a `text[]`
of tags. `sha256`, `source` and the three separate timestamps are present so the
larger model remains reachable without a rewrite. **There is no approval gate**:
a catalogued photo is visible to every signed-in user at once. If a review lane
is wanted, that is the next migration, not a column added quietly.

Post-apply verification, 2026-08-16, against the four photos staged under
`knowledge/files/plant-reference-photos/intake/` (uploaded and catalogued in the
same pass; their SHA-256s matched the intake manifests exactly):

- empty search → 0 rows; a search against an **empty** catalogue → 0 rows and no
  division by zero (the `n_docs = 0` guard, which `search_inventory` does not
  need and this one did)
- `crape myrtle` → the Natchez row at 2.41; `Lagerstroemia` → the same row, 1.20
- partial `windmil palm` → both windmill palm photos; typo `bloodgoodd maple` →
  the Bloodgood row
- **alias reach**: `chusan palm` → both windmill palm photos, and *Chusan Palm*
  appears nowhere in their document — it is reached only through the
  `plant_aliases` edge to *Trachycarpus fortunei*
- size ranking: `30g palm` → the two 30 G rows on top
- through the app: browse, facets, `p.supplier` / `p.size` / `p.tag` filters, the
  signed-image redirect (307 → a working `image/jpeg`), a non-UUID id → 400, an
  unknown id → 404, and the bucket's own public URL → **400**, confirming private

Rollback is `drop function search_plant_photos, plant_photo_document; drop table
plant_photos;` plus deleting the bucket — but the catalogued rows and their
objects go with it.

## `0050_drop_other_names_and_alias_type.sql`

Applied 2026-08-15 at Bhoumik's request. Drops the **Also known as** column and
the alias edge type in one pass: `public.inventory_enriched`, the
`plant_alias_names()` function behind its `other_names` column, that column from
`search_inventory`'s projection, and `plant_aliases.alias_type`.

`other_names` did not earn its cost. It was NULL for 90% of active rows (28,444
of 31,560) and could not be indexed — `plant_alias_names()` is `STABLE` and
reads `plant_aliases`, so a filter on it meant evaluating the function per
candidate row. It was also the only reason the view existed; every other column
was a passthrough of `inventory`, so the app's three call sites moved to the
table with no projection change.

**Retrieval is unchanged.** Verified after apply, not assumed: since 0045 the
query expander substituted the opposite endpoint of every active incident edge
without ever reading `alias_type`, so dropping it cannot move a result.
`search_inventory('Quercus virginiana')` still returns 250 rows of which **85
are reached only through the alias edge** (their own `name` does not contain the
botanical name), which is the property that would have broken had expansion
regressed. `search_inventory('live oak')` returns 243, top relevance 4.865.

What is genuinely lost is the record of which kind of equivalence a source
asserted, plant-level versus cultivar-level. Accepted explicitly by Bhoumik.

Uniqueness moved from `(alias_type, name_key, other_name_key)` to
`(name_key, other_name_key)` under the same index name. Checked first: zero
pairs existed under both types, so no row collided and no dedup was needed. The
`dedupe_plant_aliases()` trigger lost its `alias_type` leg and still rejects
both orientations regardless of `is_active`, so a retired pair remains a
blocklist.

**Verified after apply:** one `search_inventory` signature, 30 output columns;
`inventory_enriched` and `plant_alias_names` both resolve to NULL;
`plant_aliases` has no `alias_type` column and all 432 rows intact; app
typecheck and `next build` clean.

Rollback is 0040/0046-shaped — recreate `plant_alias_names()`, recreate
`inventory_enriched` with `security_invoker = true`, restore the RPC's
`other_names` column, re-add `alias_type` — but the per-row type values are not
recoverable.

## `0049_supplier_head_branch.sql`

Applied 2026-08-15 at Bhoumik's request. Drops `public.supplier_groups` and
`suppliers.group_id`, and adds `suppliers.head_branch_id` — a self-reference to
the company's head branch, where a head branch (and every single-site supplier)
points at itself.

Nothing was lost with the table: all 16 groups had null `notes`, and every
group `website` duplicated its members' own. The only column with independent
content was the company `name`, which the head branch row now carries.

Which row is the head was decided per company from the contacts on file, then
confirmed against each company's published head-office address — the head is
the **business office**, not the largest farm (Everde's head is supplier 32, a
Houston office suite; its farms point at it). Six differ from the first member
0033 listed: Snapper Creek 526 (Ft Pierce HQ, not Homestead), Vickery 1379
(Dallas HQ), Whitfill 1383 (Southern Ave), Tree Valley 1369 (Tomball), Triangle
1370 (the Houston business office, not the Groveland farm) and Tree of Life 1368
(San Juan). ArborGen, Calloway's and Moon Valley have **no head-office row** —
their heads (110, 119, 91) are stand-ins and are flagged as such in the
migration file, which lists all 16 with reasons.

Post-apply verification: 1,383 suppliers, **zero** null `head_branch_id`, 16
heads carrying 41 branches (the same 57 rows 0033 covered), 1,326 single-site
rows self-heading, and zero chains. A rollback-only probe confirmed the
`set_head_branch` trigger fills the self-reference on insert, refuses a branch
pointing at another branch, and refuses demoting a head that still has
locations.

## `0048_cascade_source_deactivation.sql`

Applied 2026-08-14 after a runtime audit found that the app and schema docs
already depended on the trigger but the live database did not contain it.
Preflight after the catalogue wipe/rebuild had begun found 10 active sources and
zero active inventory rows pointing at an inactive source, so apply created only
the function and trigger and rewrote no data.

Post-apply catalog introspection found exactly one enabled
`trg_cascade_source_deactivation` and one
`cascade_source_deactivation()` function. A rollback-only fixture verified that
a true→false source update retires its active inventory, reactivation does not
restore it, rollback removes the fixture completely, and the live invariant
remains clean. The source-deactivation freeze imposed during the audit was then
safe to lift.

## `backup_catalogue_before_reingest_20260814` (no numbered file)

Applied 2026-08-14 at Bhoumik's request, immediately before the catalogue was
deleted for a from-scratch reingest. Creates schema `backup_20260814` holding
`create table … as select *` copies of `inventory` (238,748), `inventory_sources`
(2,113) and `plant_aliases` (127); counts were verified equal to the live tables
before anything was deleted. No numbered migration file — it is a point-in-time
backup, not a schema change to replay. The delete itself was plain DML and is
not in the migration history; see `CHANGELOG.md` (2026-08-14).

## `0047_size_as_ranking_group.sql`

Applied 2026-08-14 in two steps (`search_size_as_ranking_group`, then
`search_size_group_unit_variants`), at Bhoumik's request. Function body only.

**A size typed into the query now ranks rather than filters.** `15g Live Oak`
puts 15 G live oaks on top without removing any other size from the result.

It needed code because "the size column is already searched" does not survive
contact with the tokenizer. `normalize_search_text` splits letter↔digit, so
`15g` becomes `15` and `g` — close to the two least selective terms in the
corpus: `g` is in **39,923 of 63,788** active rows (63%) and `15` in 11,722,
matching any 15 anywhere. Measured before the change, `15g Live Oak` returned
**42,099** rows against 1,792 for `Live Oak`, and gave no ranking signal at all:
5 G, 45 G, 30 G, 200 G and 95 G all tied at 10.49 with 15 G no higher.

The greedy partitioner gains one rule: a span shaped like a size becomes a
single **phrase** group. `"15 g"` has df 5,220 rather than 11,722, so it carries
a real IDF weight. Two details make it correct:

- Phrase groups match on a **token boundary** and skip the fuzzy path — a typo
  in a number is meaningless. ` 15 g ` accepts `15 G` and `15 G/17"`, rejects
  `115 G` and `150 G`.
- Their alternatives are the spellings a **document** can hold, not the ones a
  user types. Sizes are stored canonically: the only gallon spelling anywhere in
  the corpus is `g`, and `24" Box` normalizes to `24 box`. So a gallon span
  expands to `N g`/`N gal`/`N gallon`/`N gallons` and a box span to
  `N box`/`N inch box`/`N in box`. Without that, `15 gal` and `24 inch box`
  matched nothing — the first version of this migration shipped with exactly
  that gap and the second step fixed it.

**Measured after:** `15g Live Oak`, `15 gal live oak` and `15 gallon live oak`
are identical — 6,935 rows, every top row a 15 G live oak. **1,728 of those
6,935 are not 15 G**: kept, ranked below, which is the point. Score ladder
10.83 ×11 · 8.32 ×296 · 6.98 ×50 · 6.34 ×77 · 4.48 ×403 · 3.84 ×1012 ·
2.50 ×5082. `24 inch box` 170 rows topped by `24" Box`; `Live Oak` unchanged at
1,792; `Crape Myrtle Muskogee` unchanged at 755.

App side: this retired the client-side special case entirely — `lib/size-range.ts`
(`parseSizeQuery` / `matchesSizeFilter` / `explicitBounds`) and the removable
"Size: 15 gal" chip are gone, and the query goes to the server whole. That also
closed the last instance of the filter-after-pagination fault, since the chip
only ever filtered the 300 rows the browser held. The Size multiselect is
untouched: filtering by size is still its job.

## `0046_bm25_search.sql`

Applied 2026-08-14 in four steps (`search_ngram_index`, `search_word_index`,
`search_inventory_bm25`, `drop_superseded_search_indexes`), at Bhoumik's
request. A rewrite of what search *is*: match names / size / notes, tolerate
typos, match partially at either end, expand through aliases, and **rank by
overlap with rare terms weighted heavily**. Filtering and sorting happen after.

**Three mechanisms became one ranking.** The identity-intent gate is gone — it
was a hard filter that picked the rarest query word and excluded every row not
matching it, which is what IDF does natively without discarding anything. The
pg_trgm fallback and `inventory_trgm_idx` are gone — substring matching on a
bigram index is what that branch was approximating. `inventory_pgroonga_idx` is
gone: superseded, and its document carried height/width/caliper, which are
filter columns rather than search text.

**Two indexes over one expression**, because one tokenizer cannot do both jobs:
`inventory_search_ngram_idx` (`TokenBigramSplitSymbolAlphaDigit`) for exact and
**substring** matching, and `inventory_search_word_idx` (`TokenDelimit`) to give
fuzzy a whole-word lexicon. This was measured, not assumed: the substitution
typo `mvskogee` returns **0** rows through the ngram index and **188** through
the word index, because edit distance over a bigram lexicon is meaningless.
Substring alone only catches truncations. `pgroonga_condition(..., index_name)`
tells them apart.

**Scoring.** The query is partitioned into groups, longest span first (≤ 6
words) so `live oak` is one concept; a span naming an alias carries the other
side of each edge as an alternative, and a group matching on any alternative
contributes its weight once. `idf = ln(1 + (N − df + 0.5)/(df + 0.5))` per
group; `relevance = Σ idf(matched groups)`. Term frequency is deliberately
**binary** — BM25 with k1 → 0 — because repetition in a plant name carries no
information, which is also why there is no `avgdl` or length normalization to
keep fresh.

`crape myrtle muskogee` splits into two groups (`crape myrtle` is one, an alias
names it) and lands in three clean tiers: **10.38** both groups (178 rows),
**5.82** the rare group alone (10 rows, including the typo'd source row
`CrapeM Muskogee`), **4.55** the generic group alone (567 rows).

> ⚠ **Result sets are much larger, and that is the design.** Retrieval is OR, so
> every generic Crape Myrtle appears, ranked last. `Crape Myrtle Muskogee`
> returns **755** where the gated version returned 116; `Live Oak` returns
> **1,792** against 302. The first page is better and the tail is longer. To get
> the old tightness back, put a floor on `relevance` (require the highest-IDF
> group to match) rather than reinstating the gate.

Also gone: the empty-search footgun. An empty query returns zero rows
immediately instead of walking the catalogue, so the standing "never call it
with an empty search" warning has been removed from the schema doc.

**Verified against live data** (N = 63,788 active): partial post `Mexican
Sycamor` and typo `Mexican Sycamoer` both top out at `SYCAMORE, TRINITY MEXICAN
— PLATANUS MEXICANA TRINITY`; partial pre `ycamore` returns 78 rows topped by
`SYCAMORE, BLOODGOOD LONDON PLANE`; `Muskogeee` returns 204 topped by
`Crape Myrtle - 'Muskogee'`; `Paperbark Maple` and `Acer griseum` return the
same 66 rows topped by `Paperbark Maple - Acer griseum`; empty search 0 rows;
filters compose (`size_std='15G'` 150 rows, `supplier_id=32` 280). Timing 269 ms
for a three-group query returning 755 rows.

## `0045_alias_query_expansion_no_params.sql`

Applied 2026-08-14 as `alias_query_expansion_no_params`, at Bhoumik's request.
Two changes, both narrowing what the function is responsible for.

**The filter and sort parameters are gone.** The signature is now
`search_inventory(search text, fuzzy_ratio real)`. `supplier_ids`, the six
dimension bounds, `sort_column` and `sort_direction` all left — every one is now
applied by the caller as SQL over the result. The function answers one question:
which rows match, and how relevant each is. The `format()`/`EXECUTE` wrapper
went with `sort_column`, so the body is a plain `RETURN QUERY` now.

Cost, recorded: `supplier_ids` used to prune `raw` before the intent gate
counted over it, so a supplier-scoped search examined one supplier's rows. It
now searches the catalogue and is filtered after. The trigram pass already
scanned everything regardless, so what grew is `raw`, not a new table scan.
Verified working: `search_inventory('Crape Myrtle') where supplier_id = 32`
returns 280 rows from that one supplier.

**Aliases expand the query instead of matching columns.** An alias used to
contribute its endpoints as identity keys, compared with `=`/`&&` against
`name_key` / `common_name_key` / `botanical_name_key` / `cultivar_keys`. Now the
other side is substituted into the pgroonga query itself. The query is
partitioned greedily, longest span first (≤ 6 words); each matched span becomes
one OR-group and the groups stay AND-ed:

```
live oak boardwalk  ->  ((live oak) OR (quercus virginiana)) boardwalk
```

AND-ing the groups is what keeps an expanded query from being broader than the
typed one, and it handles several aliases without a combinatorial blow-up — two
substituted spans give one `(a OR a') (b OR b')`, not four variants. With an
empty alias directory the expansion reassembles the original query exactly.

**The gain is ranking.** An alias-reached row now matches the *text* branch, so
pgroonga scores it; under the key mechanism every alias-only match scored
exactly 0 and sorted below every direct hit. Measured on the real
`Paperbark Maple` ↔ `Acer griseum` edge: 61 rows returned, **48 of them with no
"paperbark" anywhere in the name**, scoring 2 and 4.

That matters more than it sounds, because relevance here is coarse. Groonga's
default scorer counts term occurrences — it is **not BM25**. Over 491 rows for
`crape myrtle muskogee`: six distinct scores (0, 3, 4, 6, 8, 10) with **404 at
zero**, 387 of those admitted by the trigram pass, which contributes recall only
and never a score. For most result sets the effective order is
`updated_at desc, name asc`, so moving a whole class of matches off zero is a
real change to what surfaces first.

> ⚠ **What this gives up.** `alias_type` no longer constrains matching. It could
> only ever do so by naming a column to compare against, and no column
> comparison remains — a `cultivar` edge and a `plant` edge expand the query
> identically. The structural guarantee 0040 introduced is gone; the ingestion
> SOP's quality bar is again the only defence.
>
> Demonstrated in a rolled-back transaction, on the exact shape 0025 retired 66
> of: a species ↔ cultivar edge turns `search_inventory('Zzzmuskogee')` into a
> search for the whole species — it returns the bare species row **and** the
> sibling `Zzznatchez`, where under 0044's key matching it returned only
> `Zzzmuskogee`. Such a query is one word, so the identity-intent gate does not
> run to catch it. `alias_type` is kept: it documents what a pair asserts and
> still separates the two kinds in *Also known as*.

Unchanged and deliberately so: the `qkey` branch (a whole query collapsing to a
row's identity key, which is how "LIVEOAK" finds "Live Oak") is not an alias
mechanism; the trigram recall pass; and the identity-intent gate.

**Fixtures after apply:** `Abelia Francis Mason` 10/9, `Japanese Holly Compacta`
4/2, `Clusia Small Leaf` 17/4, `Mexican Sycamor` 21/7 — all unchanged.
`Crape Myrtle` 570/35, `Crape Myrtle Muskogee` 116/28 and `Live Oak` 302/36 have
moved with the ongoing ingest, not with this migration.

## `0044_search_inventory_cultivar_keys_out.sql`

Applied 2026-08-14 as `search_inventory_cultivar_keys_out`, at Bhoumik's
request. Adds `cultivar_keys text[]` to the RETURNS TABLE (30 columns); the body
only gains the projection. DROP + CREATE with grants restored, since a
return-type change cannot go through CREATE OR REPLACE.

**Why.** The app moved every column filter off the browser and onto SQL applied
over the RPC result. Filtering a page the server already truncated answers a
different question from the one asked, and the numbers proved it: `Crape Myrtle`
matches 570 rows, 105 of them `15G`, but only **73** land in the 300-row first
page — so 32 were unreachable by ticking the size box, and the header's
"showing 73 of 570" was wrong twice over.

Every other filterable value was already projected (`size_std`, `unit_price`,
`quantity`, the three `*_std` dimensions, `supplier_category`/`_city`/`_state`).
The cultivar was the exception: the column holds a comma-separated residual
(`Wolff, Emperor 1`), so selecting one name needs the normalized array matched
with `&&`. The alternatives were an exact whole-cell match (wrong for multi-name
rows) or a substring `ilike` (`Wolff` matches inside `Wolffii`).

The six dimension parameters are **kept but no longer sent by the app** — the
bounds are outer filters now like everything else. Verified equivalent before
switching, on three fixtures: `Crape Myrtle` h≥8 254/17 both ways, `Live Oak`
h≥10 180/21, `Japanese Holly Compacta` cal≥1 0/0. They are not identical *by
construction* — a parameter prunes inside `raw`, which is what the intent gate
counts over, so pruning could in principle change which word the gate picks —
but they agree on every fixture measured. Leave the parameters in place for
callers that want the early pruning.

## `0043_dash_delimited_plant_name.sql`

Applied 2026-08-14 as `dash_delimited_plant_name`, at Bhoumik's request.
`compose_plant_name()` only — one function, no table, view, index or row.

The derived `inventory.name` joins its non-empty parts with **` - `** instead of
wrapping the tail in brackets:

```
before   Forest Pansy Redbud [Cercis canadensis, Forest Pansy]
after    Forest Pansy Redbud - Cercis canadensis - Forest Pansy
```

**One separator between every part**, not a dash replacing the bracket around a
still-comma-separated tail. The comma stopped being available as a part
separator when 0041 made `cultivar_variety_trade_name` itself comma-separated:
`Acer palmatum - Wolff, Emperor 1` has to mean "botanical `Acer palmatum`,
cultivar column `Wolff, Emperor 1`", and would be unreadable if commas divided
the parts too. The dash is **spaced**, which distinguishes it from the hyphens
inside real names (`KN30-8`, `Li'l Bang`), and it is how the trade prints it —
`Crape Myrtle - 'Muskogee'` is the case 0035 called out as needing this.

**Safe by construction, not by audit.** `normalize_plant_key()` keeps letters
only, so the identity key is byte-identical between the two forms.
`normalize_search_text()` maps all punctuation to spaces, so the two differ
**only in whitespace-run length** — the normalized strings are not equal, but
their token arrays are (`'forest pansy redbud   cercis…'` vs
`'forest pansy redbud  cercis…'`), and `TokenDelimit` ignores run length. 0035
measured the same thing across 924 rows. No search result can move; the pgroonga
document and index need no rebuild.

**No row rewritten.** Every existing row still has NULL parts, so its `name` is
untouched legacy text the trigger leaves alone; the 7,691 rows 0035 rewrote to
brackets keep them until the re-ingest.

Verified after apply: all four shapes compose correctly, NULL for three NULLs,
`normalize_plant_key` equal across forms, token arrays equal.

## `0042_alias_query_term_expansion.sql`

Applied 2026-08-14 as `alias_query_term_expansion`, at Bhoumik's request.
**Aliases now enrich the query.** `search_inventory` only — no table, view or
index touched, `RETURNS TABLE` unchanged, so `CREATE OR REPLACE`.

The alias branch used to select an edge only when the **whole query** matched
that edge's text, and pgroonga's `&@~` is **AND** across tokens. Measured on the
live database rather than assumed:

```
document = 'zzzoak  quercus zzztestensis  zzzboardwalk  15 g'
  &@~ pgroonga_condition('zzzoak zzzbwalk')      -> false
  &@~ pgroonga_condition('zzzoak zzzboardwalk')  -> true
```

So `Live Oak Boardwalk` could never reach the `Live Oak` ↔ `Quercus virginiana`
edge: no single edge's document contains both terms. **The cases that appeared
to work were the pg_trgm fallback firing by luck** —
`'quercus zzztestensis zzzbwalk' <% document` is true while
`'zzzoak zzzbwalk' <% document` is false, which is why the identical query
worked through a plant's botanical name and returned nothing through its common
name.

The branch now also selects an edge when **any contiguous run of query words**
collapses to one of its endpoint keys, capped at 6-word spans. Spans rather than
single words because alias names are routinely two words — neither `live` nor
`oak` alone keys to `liveoak`. **Purely additive:** the whole-query fuzzy,
prefix and `qkey` conditions are untouched and still OR'd in.

**Why this does not reopen the 0006/0007/0021/0025/0028/0029 wound**, all three
predating this change: admission is exact key *equality*, not text, so a span
that merely looks like part of a name matches nothing; the alias types stay
separate, so a `cultivar` edge still cannot reach a generic row of its species;
and the identity-intent gate still runs after admission, so an invented cultivar
still returns nothing.

**Verified** in a rolled-back transaction: `Zzzoak Zzzbwalk` (common name +
cultivar alias), which returned nothing before, now returns exactly the cultivar
row; the botanical form still works; the trade name in the same column resolves;
`Zzzoak Zzznotacultivar` still returns **nothing**; and the species query still
returns both the cultivar row and the bare species row. Live fixtures byte-equal
to the 0041 measurements: `Abelia Francis Mason` 10/9, `Japanese Holly Compacta`
4/2, `Crape Myrtle Muskogee` 100/20, `Crape Myrtle` 532/30, `Live Oak` 295/35,
`Mexican Sycamor` 21/7, `Clusia Small Leaf` 17/4.

Those counts are a **point-in-time** comparison, not a stable baseline: the
catalogue is live and daisy keeps ingesting into it (active rows 62,572 at 0035
→ 62,921 an hour after 0043), so `Crape Myrtle Muskogee` already reads 102.
Re-derive both sides in one sitting before treating any movement as a
regression.

**Not observable on live data yet** — `plant_aliases` is empty until the
re-ingest, so the new branch contributes nothing to those fixtures by
construction. That is why they are unchanged, and it is not evidence the change
works; the synthetic transaction is.

## `0041_multi_name_cultivar_keys.sql`

Applied 2026-08-14 as `multi_name_cultivar_keys`, at Bhoumik's request, hours
after 0040 and correcting it.

0040 assumed `cultivar_variety_trade_name` held **one** name — the cultivar —
with any other name for the same selection carried as a `cultivar` alias edge.
Bhoumik's rule is different and simpler to parse against a source: **the column
captures everything in the printed name that the common and botanical name
don't**, minus size / form / grade. `Acer palmatum 'Wolff' - Emperor 1®`
therefore stores both selection names.

That broke 0040's key, and quietly:
`normalize_plant_key('Wolff, Emperor 1')` = `wolffemperor`, which equals neither
`wolff` nor `emperor`. Every exact-match path 0040 built on `cultivar_key` — the
typed alias branch and `plant_alias_names` — would have silently stopped
matching the moment a row named two things, leaving only the fuzzy document
branch: the fail-open behaviour 0026/0027 removed.

**`inventory.cultivar_key text` → `inventory.cultivar_keys text[]`**, one
normalized key per name, with matching moved from `=` to array overlap (`&&`).
It stays **exact per name** — no substring test, no fuzzy fallback — and a row
naming two selections is found by either. GIN index
`inventory_cultivar_keys_idx`; the scalar btree is gone.

The column's *format* is the SOP's business, not the database's: names are
comma-separated, the separator the bracket and `other_names` already use, so the
cell reads as prose. The trigger is deliberately more forgiving than the SOP and
also splits on `;` and `|`, so an ingest reaching for a different separator
costs a wrong-looking cell rather than a row that silently stops matching its own
aliases. It does **not** split on `-` or `/`: `KN30-8` is one cultivar code, and
`Globe/Spiral` is a form the SOP keeps out of the column entirely.

`plant_alias_names`'s fourth parameter becomes `text[]`, so the function was
dropped and recreated and `inventory_enriched` with it (both had to go before
the column could be dropped — the first apply attempt failed on exactly that
dependency). `search_inventory` needed no return-type change, so it went through
`CREATE OR REPLACE`.

**Verified** in a rolled-back transaction: `Wolff, Emperor 1` derives
`{emperor, wolff}` and composes to `… [Acer zzztestensis, Wolff, Emperor 1]`;
`Alpha; Beta | Gamma` derives all three; searching either name returns the row;
a `cultivar` edge from a second supplier's single name reaches it, and the bare
species row beside it is returned by **none** of the cultivar queries. Fixtures
unchanged from 0040.

## `0040_typed_plant_identity.sql`

Applied 2026-08-14 as `typed_plant_identity`, at Bhoumik's request, in one
transaction. The plant identity is now three columns and the alias directory is
typed.

**`inventory` gains `common_name`, `botanical_name` and
`cultivar_variety_trade_name`**, each carrying only what the availability source
prints, plus a derived key for each. `inventory.name` becomes the composition —
`Forest Pansy Redbud [Cercis canadensis, Forest Pansy]` — written by
`trg_inventory_derive_identity` from `compose_plant_name()`. **That is
byte-for-byte the format the ingestion SOP already required**, so no existing
row moved, the pgroonga document is unchanged and `inventory_pgroonga_idx` was
not rebuilt: `name` contains every token of every part, which is exactly why the
index did not need to grow.

The three part keys are trigger-maintained rather than `GENERATED ... STORED`
**on purpose**: a stored generated column forces a full rewrite of a 236k-row
table, which would also rebuild the pgroonga and trgm indexes inside the
migration's transaction. Plain columns plus the trigger that was needed for
`name` anyway made the whole migration metadata-only.

**`plant_other_names` is dropped; `plant_aliases` replaces it, typed.** A
`plant` edge (common ↔ botanical, synonym, spelling variant) is matched against
a row's `common_name_key` / `botanical_name_key`; a `cultivar` edge (cultivar ↔
variety ↔ trade name) against its `cultivar_key` **only**. A cultivar edge is
therefore never compared to a column a generic row fills, so it cannot make
every row of a species answer a search for one selection — the single failure
mode 0006, 0007, 0021, 0025, 0028 and 0029 each existed to clean up after, now
closed structurally instead of by a quality bar. The corollary: cultivar and
trade-name pairs are finally *expressible*, and the old blanket ban on them in
the SOP is gone.

Two long-standing holes closed with it. Pairs now carry `source_id` and
`source_line`, so an audited edge is distinguishable from a fresh guess and
traceable to the drop that wrote it — 0028's culprit had to be attributed by
reading id ordering. And `dedupe_plant_aliases()` rejects the **mirrored**
orientation as well as the direct one, which is what let 168 retired pairs come
back reversed in the old table; because it ignores `is_active`, a retired pair
is a genuine blocklist again (the property 0010 lost by deleting rather than
tombstoning).

`plant_alias_names()` is one implementation of the "Also known as" value, shared
by `inventory_enriched` and `search_inventory` so they cannot drift. It also
**drops any alias already spelled inside the row's own `name`** — since `name`
is the composition of the three parts, its key contains all three part keys, so
such an alias would only repeat the Plant column.

`search_inventory` was dropped and recreated (a `RETURNS TABLE` change cannot go
through `CREATE OR REPLACE`), gaining the three parts and — since the drop was
unavoidable anyway — `internal_notes`, which 0039 had deliberately left out and
the app had been hydrating with an extra keyed read per page. 29 return columns,
one PostgREST signature, grants restored, sort whitelist extended with the three
name columns. Same signature, same ordering, same dimension bounds.

**No backfill, by instruction.** All 235,976 existing rows keep their `name` and
have NULL in all three parts; the 13,700 alias pairs went with the table.
Bhoumik is dropping the catalogue and re-ingesting it. Deriving the parts from
the existing `name` was not attempted — 0005 tried exactly that from the alias
graph and abandoned it, and the SOP requires each part to be what the source
printed.

**Verified after apply:** one RPC signature; `inventory_enriched` 28 columns and
`security_invoker = true`; 237,509 inventory rows, 0 with any part set;
`compose_plant_name` round-trips all four SOP shapes and returns NULL for three
NULLs. In a rolled-back transaction: a row written from parts composed to
`Zzztest Redbud [Cercis zzztestensis, Forest Zzz]` with all three keys derived;
duplicate and mirrored alias inserts were both silently skipped (2 rows from 4
inserts); the cultivar edge attached to the cultivar row and **not** to the
plain species row beside it; searching the trade name returned only the cultivar
row; and an alias equal to a name already inside the composed identity was
suppressed from *Also known as*. Live fixtures against real data:
`Abelia Francis Mason` 10 rows / 9 suppliers and `Japanese Holly Compacta` 4 / 2,
both matching the 0021/0026/0035 baselines; `Mexican Sycamor` still prefix-
matches at 21 / 7. `Crape Myrtle` moved 548/35 → 532/30 and
`Crape Myrtle Muskogee` 102/21 → 100/20 — that is the retired alias directory,
which is expected and temporary.

**Rollback:** the structural half is reversible by restoring 0030's
`search_inventory` and 0039's `inventory_enriched` and dropping the new
columns/table. `plant_other_names` was dropped **without a snapshot**, by
instruction; its rows are not recoverable from this database.

## `0039_inventory_internal_notes.sql`

Applied 2026-08-14 as `inventory_internal_notes`, at Bhoumik's request. Adds
`inventory.internal_notes` (nullable text) and splits the two kinds of note that
had been sharing `inventory.notes`:

- **`notes`** — what the *supplier* said about this offering in the availability
  data: their row description, dated availability status, lead time, "limited".
- **`internal_notes`** — what *we* said: parse caveats, why a combined size was
  split, that a quantity is the supplier's shared/tentative count, pricing
  unavailable/on request, QA exceptions.

Column comments on both lock the split. `inventory_enriched` is replaced to
append `internal_notes` at the end, keeping its documented "every inventory
column" contract true. `search_inventory` is deliberately unchanged — internal
notes are not search output, and changing its fixed `RETURNS TABLE` would mean
dropping and recreating the app's most load-bearing function. The web app
surfaces the column instead by hydrating it for the two RPC-backed read paths
(`hydrateInternalNotes` in `app/lib/queries.ts`).

Additive only: no backfill, no rewrite, no rows touched. **Existing `notes`
content is a mix of both kinds and was not reclassified** — the split applies to
what is written from now on.

## `0035_inventory_name_cultivar_delimiter.sql`

Applied 2026-08-14 with Bhoumik's approval. Drafted as 0033, so its DDL step
appears in the Supabase history as `0033_inventory_name_delimiter_snapshot`;
0033/0034 were taken by a concurrent session two minutes earlier and an applied
migration cannot be renamed. Rewrites the cultivar delimiter in
`inventory.name` to the SOP's bracket form — `Acer palmatum 'Bloodgood'` and
`Thuja occidentalis ['Smaragd']` become `… [Bloodgood]` / `… [Smaragd]`.
**2,965 distinct names / 7,691 active rows.** Active rows only (0031's call);
20,334 matching inactive rows were left as printed.

**This is the format half of the SOP name rule and nothing more.** The
scientific and common names are *not* backfilled into the bracket — the SOP
requires the bracket to carry what the source printed, 0005 already tried
deriving it from the alias graph and abandoned it, and 0005's companion
carry-forward became the largest source of false positives (retired by 0007).
Filling the missing halves means re-parsing the 491 stashed sources per
supplier under SOP §5. Still open.

**Why it was safe to run mechanically:** `normalize_plant_key()` strips every
non-alpha character and `normalize_search_text()` maps punctuation to a space,
so all three spellings already shared one key *and* one token stream. Verified
after apply: **0 `name_key` changes, 0 token-stream changes** (924 rows differ
only in whitespace runs, which `TokenDelimit` ignores). No alias edge moved, so
the 0007 failure mode could not fire, and no row's membership in any search
result could change. Distinct active names **26,491 → 25,478** — 1,013
duplicate display identities collapsed, which is the actual user-visible win:
`Thuja occidentalis` Smaragd was three separate plants on the plants page.

Guards (all passed, else abort): exact snapshot count 7,691; zero `name_key`
drift; zero alphanumeric content change; zero residual quotes in rewritten
rows; active total still 62,572. Fixtures after apply: `Abelia Francis Mason`
10/9 and `Japanese Holly Compacta` 4/2, both matching the 0021/0026 baselines.
`Crape Myrtle Muskogee` reads 102/21 against 0026's 98/20 — that delta is
inventory ingested since 2026-08-12, and the four renamed rows among them are
genuine Muskogee rows that matched identically before the rewrite.

**Deliberately not touched: 642 names / 1,386 active rows** that still carry a
quoted cultivar, because each needs a judgment a regex cannot make — trailing
form/grade words the SOP bans from `name` at all (`Buxus x 'Green Mountain'
Globe`, `Picea pungens 'Globosa' Low Graft`), dash-separated trade names
(`Acer palmatum 'Wolff' - Emperor 1®` — Chris's `Crape Myrtle - 'Muskogee'`
case, which needs the typed-identity work), a foot mark beside a cultivar
(`Prunus serrulata 'Kwanzan' 4' Graft`), an apostrophe inside the cultivar or
base (`Magnolia grandiflora 'Bracken's Brown Beauty'`, `Coreopsis Li'l Bang
'Daybreak'` — a naive rewrite yields `Euonymus f. 'Emerald [n Gold]`), and
unbalanced source quotes (`Pinus heldreichii 'Irish Bells`).

`public.inventory_pre_name_delimiter` (id, old_name, snapshot_at) holds all
7,691 pre-rewrite names, RLS enabled per 0020's lesson. **Drop it once the
change has settled.**

## `0038_retire_riley_fuzzel_farm.sql`

Applied 2026-08-14 at Bhoumik's call, closing the question 0037 left open.
**Riley Fuzzel Farm (963) is Newton Nurseries Spring (1320) under its
pre-acquisition name** — Newton acquired Riley Fuzzel in 2023 and the site
trades as "Riley Fuzzel - Newton Nurseries". Both rows were created by the
2026-08-05 backfill from different angles (963 from source list Wholesale
Nurseries Texas::R118, 1320 from the duplicate re-screen) and landed on the same
street address.

963 soft-deleted. **Nothing was lost:** 0 inventory rows, 0 `inventory_sources`,
0 `availability_queries`, empty notes. Its one contact was
`info@rileyfuzzelfarm.com`, the acquired company's inbox, now closed — 0037 had
already taken that route off the Newton row.

**First production run of 0034's new cascade, and it behaved:** deactivating the
supplier retired its `supplier_contacts` link and then contact 1212 itself,
because 963 was that contact's last active location. Under the old
one-supplier-per-contact column this would have been indistinguishable from any
other cascade; here it is the whole point.

1320 also took the address it should have had — Newton relocated the Spring yard
from 630 Riley Fuzzel Rd (77373) to **21121 N Fwy Service Rd, Spring TX 77388**,
keeping the phone, so the contact 0037 wrote is still correct. Because the
retirement note on 1320 names Riley Fuzzel and `suppliers.notes` is in the search
document, `search_suppliers('riley fuzzel')` now returns exactly one row: Newton
Nurseries Spring, at the current address.

Left alone deliberately: `latitude`/`longitude` stay null on 1320 rather than
inherit 963's, which point at the *old* site; and `category` stays `Other`,
which all three backfilled Newton rows carry — a gap across the set, not
something this merge should half-fix.

## `0037_fix_newton_spring_and_ycnursery_contacts.sql`

Applied 2026-08-14, following the two items 0036 flagged.

**Newton Nurseries Spring (1320) was reading a closed company's inbox.** 0036
called this "a Newton location carrying another farm's contact details";
researching it first showed that read was half wrong. **Newton acquired Riley
Fuzzel in 2023** (their own release), the site trades as "Riley Fuzzel - Newton
Nurseries" at 630 Riley Fuzzel Rd, and **the phone `281-355-5495` is genuinely
that yard's** — not a stray value, and not changed. The *email* was the problem:
`info@rileyfuzzelfarm.com` is the acquired company's inbox, and Yelp now lists
Riley Fuzzel Farm as closed, so availability requests for the Spring yard were
going to the old owner. 1320 now has its own `Main line` contact (1848) with the
verified phone and **no email** — `spring-sales@newnurseries.com` matches the
three siblings on file but is printed nowhere we can read, and the SOP forbids
the guess. The shared row (1212) is unlinked from 1320 and untouched on 963.

Left for Chris on purpose: **963 and 1320 look like one business before and
after the acquisition** (same street address; Newton's page for it is
`/rileyfuzzel-spring/`), which is a supplier-level merge, not a contact fix. And
**1320's address is stale** — Newton has relocated the Spring nursery to 21121 N
Fwy Service Rd, Spring TX 77388. Which row should carry that depends on the
merge question, so neither was touched.

**A phone stored with a leading colon.** Contact 1782 (Lynn Agee, YC Nursery -
Prosper) held `:214-213-0962`; the delimiter is stripped. The digits are left
as printed — 1782 and 979 differ in the last digit (…0961 vs …0962), which is
either two real lines or a typo in the source, and a migration cannot tell.

## `0036_merge_duplicate_contacts.sql`

Applied 2026-08-14 at Bhoumik's request, the follow-up to 0034. Folds **33
contact rows into 13**, keeping every link: Jim Ord is now one contact with six
nurseries instead of six contacts, Ken Howard one with five. 20 rows retired
(`is_active = false`, each noting where it went), one link deleted — contacts
1013 and 1754 were both on Tree of Life Garden Center, the only duplicate
*within* a single supplier.

**The rule was deliberately narrow: same normalized email AND same normalized
phone, with no field of one contradicting the other.** `'Main line'` is
provenance from 0016, not a title, so it never counts as a conflict and yields
to a real title (contact 786 became "George Gianaris / Manager").

**Matching on email alone would have been wrong.** A shared company inbox is not
a duplicate person — `info@calloways.com` has three rows, three phone numbers
and two different named store managers — and because the phone lives on the
contact rather than the link, merging them would delete working numbers. Twelve
such groups (28 rows) were left untouched and are listed at the bottom of the
migration file.

Verified after apply: 0 links lost (every pre-merge supplier still reaches the
same route), 0 links left on a retired contact, 0 suppliers with two active
primaries, primaries unchanged at 1,083, and no name, real title or note from a
merged row dropped. Reversible from `contacts_merge_map`, `contacts_pre_merge`
and `supplier_contacts_pre_merge`.

Flagged here, then corrected by **0037**: `info@rileyfuzzelfarm.com` and its
phone sat on **Newton Nurseries Spring** as well as Riley Fuzzel Farm. The two
rows really were one route, so they merged — but only the phone turned out to
be right for Newton. See 0037.

## `0034_contact_supplier_links.sql`

Applied 2026-08-14 at Bhoumik's request, immediately after 0033. Splits the
contact ↔ supplier relationship into `supplier_contacts`, so **one contact can
be the PoC for several nurseries**. `contacts.supplier_id` and
`contacts.is_primary` are gone; both moved onto the link, because neither the
supplier nor "is this the one who answers" is a property of a person who covers
four farms. Applied in four DDL steps (table + backfill, column drop, cascade
trigger, `search_suppliers`) — the Supabase history names them
`contact_supplier_links_table`, `contacts_drop_single_supplier_columns`,
`cascade_supplier_deactivation_via_links` and `search_suppliers_via_contact_links`.

**1,843 links for 1,843 contacts, one each — nothing merged.** The per-location
duplicates the old column forced (the same rep entered once per farm) are still
separate contact rows; merging two into one person with two links is a
source-checked judgment call, not a bulk update, and one deliberate near-duplicate
pair already exists on supplier 255. 1,833 links active, 1,083 primaries — every
count identical to the columns they came from.

Two levels of `is_active` now: the person left (`contacts`) vs. they stopped
covering this location (`supplier_contacts`). `cascade_supplier_deactivation`
retires the links and retires the contact only when it was their last one.

## `0033_supplier_locations.sql`

Applied 2026-08-14 at Bhoumik's request. Adds `supplier_groups` +
`suppliers.group_id` so a multi-location company's locations are enumerable.
**Each location stays its own `suppliers` row** — no rows were merged, moved or
retired; the migration only names the company they belong to.

16 groups covering **57 supplier rows**, biggest first: Moon Valley Nurseries
17, Everde Growers 5, Newton Nurseries 4, then ArborGen / Calloway's / Devil
Mountain / Sunscape / Tree of Life (RGV) at 3 and eight pairs. Identified by
hand from a shared brand name **and** a shared website domain; families matching
only one half are listed at the bottom of the migration file for Chris to
confirm, along with three same-city sets that look like duplicates wanting a
merge rather than locations.

The set is not recoverable from names — `Everde Growers`, `Everde Growers - Glen
Flora Farm` and `EVERDE GROWERS - BUNNELL` share no parseable prefix, Newton
uses no dash and Calloway's an em dash — which is why the SOP now reads
`group_id` instead of guessing. `group_id IS NULL` means one location, not
unknown.

## `0032_size_std_bb_and_pot.sql`

Applied 2026-08-13, hours after 0031, at Bhoumik's request: the two biggest
occupants of `other` were real containers a buyer would filter on. Adds `B&B`
as a word grade and `<N>" Pot` as a third open numbered family beside `<N>G`
and `<N>" Box`, then remaps the 350 affected pairs (two subagents, same
pair-level method as 0031). All 240 B&B pairs took the bucket — none named a
competing container, so the "a real container still wins" exception never
fired. 66 bare diameters are pots, 6 are unlabelled boxes (desert growers print
`36"` for a box), 8 are not containers at all and took 0031's move-and-clear,
and 33 stay `other` because the diameter describes merchandise — Austin Plant
Supply prices planters, bowls and hand tools by diameter in the same column.

Also lifted the heights and calipers hiding inside B&B strings (`B&B; 3-4' HT`,
`4 - 5'; B&B`) into their own columns — **added only where the column was
empty**, never substituted, and only at high confidence. 13 pairs were held
back: topiary standards that print both a stem height and a head size, and
sheared globes whose diameter is arguably width rather than height. Unlike
0031, `size` keeps its printed text here — these rows have a real container in
it. `other` 8,589 → 3,326; buckets 52 → 66.

## `0031_size_std_backfill.sql`

Applied 2026-08-13, active rows only (Bhoumik decision — retired history keeps
`size_std` NULL). 12 subagents classified all 2,783 active
`(supplier_id, size)` pairs against one shared ruleset, which is now the
ingestion SOP's *Size standard*. The grain is the **pair**, not the string:
`2.5"` is a caliper at supplier 100 and a pot at supplier 73, so each agent saw
the pair's row count, sample plant names, and how often `height`/`width`/
`caliper` were already populated. Three consistency overrides were applied over
their output: supplier 86 (Bold Spring) prints sheared FORM codes, so `N' BOX`
there is `other` not a box; a low-confidence measurement reading does not move
data (47 pairs kept their `size` and took `other`); `0 G` is not a container.

Ran in two passes. The first moved a misfiled measurement only into an empty
dimension column or one already holding the same text. Its conflict rule proved
too strict — `size = '4/5'''` beside `height = '4'` is one measurement, not a
clash, and 2,501 rows sat in `other` for that reason — so a second pass moved
those too, replacing the lower-bound-only text with the fuller range wherever
the column's `*_std` already equalled the standard the mapping computed.
Nothing was overwritten with a *different* value in either pass.

## `0030_inventory_size_std.sql`

Applied 2026-08-13. Adds `inventory.size_std`, the standardized container that
pairs with the printed `size` the way `height_std` pairs with `height`.
Vocabulary approved by Bhoumik: `<N>G`, `<N>" Box`, `Bare Root`, `Liners`,
`Plug`, `Trays`, `Field Grown`, `Grow Bags`, `Root Pruned`, `other`. The gallon
and box families are open sets, so `inventory_size_std_check` tests the shape
rather than enumerating values. `inventory_enriched` was recreated to carry the
column (appended last — `CREATE OR REPLACE VIEW` cannot reorder columns — and
`security_invoker = true` re-set), `search_inventory` was dropped and recreated
because a `RETURNS TABLE` change cannot go through `CREATE OR REPLACE`, with its
`anon`/`authenticated`/`service_role` grants restored and `size_std` added to
the sort whitelist. Adds partial index `inventory_supplier_size_std_idx`. The
pgroonga document is unchanged — raw `size` already carries every spelling.

## `0027_cultivar_prefix_intent.sql`

Applied 2026-08-12 as the final approved identity-search follow-up after independent review of 0026. Keeps the same RPC signature/direct-edge alias behavior and adds an explicit normalized word-prefix predicate—using the same predicate for distinguishing-token rarity and the final gate—alongside bounded fuzzy matching. `Crape Myrtle Musko` and reversed return identical 95-row / 19-supplier sets with zero non-Muskogee identities. The app's old zero-result word-splitting fallback was removed, so an invented cultivar such as `Crape Myrtle DefinitelyNotACultivar` remains empty end-to-end instead of broadening to generic Crape Myrtle. No table write.

## `0026_exact_plant_identity_search.sql`

Applied 2026-08-12 as Bhoumik-approved option B after the exact 0025 Crape alias cleanup. The existing `search_inventory` signature is unchanged. Both the RPC and `inventory_enriched` now derive aliases only from reviewed edges directly incident to the row's exact identity; the reverse-hub sibling UNIONs are removed. Multi-word searches choose the least-common query word in the candidate set as distinguishing identity intent and require it in the row's exact name or direct alias with bounded 0.20 fuzzy/prefix tolerance, independent of word order. One-word/generic searches stay broad. The app labels the derived value **Also known as** and no longer runs a second browser alias refinement.

Post-0025 → post-0026: `Crape Myrtle Muskogee` and reversed 442 rows / 30 suppliers / 344 non-Muskogee identities → **98 / 20 / zero**, with identical ID digest `de144abdde245210941c2141d7688a79`. Truncated typo `Muskog` returns 95 / 19 with identical word-order digest. Generic `Crape Myrtle` remains broad at 548 / 35 and retains 87 Muskogee, 107 Natchez, four Tonto and all five bare `Lagerstroemia indica` rows; bare indica displays only direct alias `Crepe Myrtle`. Regression fixtures: Francis Mason Abelia 10 / 9 both orders, Japanese Holly Compacta 4 / 2, Clusia Small Leaf 39 / 9. Combined server dimension bounds returned 76 rows with zero violations. RPC signature count remains one and `inventory_enriched` remains `security_invoker=true`. This migration changes only view/function definitions; no table row changed.

## `0025_retire_crape_myrtle_cultivar_aliases.sql`

Applied 2026-08-12 with Bhoumik's explicit approval (Telegram message 671) after a read-only Crape Myrtle/Muskogee focal audit. Soft-retired exactly **66 active unsafe alias rows**: 59 cultivar/selection/trade/color/form names attached to the bare `Lagerstroemia indica` hub, five Muskogee cultivar identity aliases, and two malformed generic/form bridges. Preserved safe ID **13059**, `Lagerstroemia indica` ↔ `Crepe Myrtle`, and every alias outside the exact reviewed set.

The guarded transaction returned 66 exact IDs (`updated_id_digest=0c9ec61bd06c675747a9921d52fd4b82`). Target alias-state digest changed `653d2dc8aac47e05424079e563b6bc39` → `bf2d87b6846cb1d43ce89a1d8f5cca00`; all 66 targets are inactive and ID 13059 remains active. Just-before → after live RPC: generic `Crape Myrtle` 610/40 → 592 rows/37 suppliers and remains broad (95 Muskogee, 115 Natchez, 4 Tonto, 1 directly connected bare indica row); `Crape Myrtle Muskogee` 486/38 → 442/30 and both word orders now share the same result digest, but 344 non-Muskogee rows remain from backend fuzzy/sibling behavior assigned separately to Nova. No inventory row changed: total 235,976, active 62,523, max updated timestamp and complete inventory-state digest `1b2f0959522394a8febd11274c266425` are byte-identical before/after. Exact rollback and regression artifacts live under `workspace/threads/main/crape-myrtle-alias-audit/`.

## `0024_inventory_dimension_std_backfill.sql`

Applied 2026-08-11 after 0023, with Bhoumik's approval. Backfilled standardized numeric values for **94,297 inventory rows** (26,096 active / 68,201 inactive), deriving only from the corresponding displayed human-readable field: `height_std` 75,357 rows (21,081 active), `width_std` 40,537 (9,385 active), `caliper_std` 22,589 (6,674 active). Height is feet; width/caliper are inches; ranges use the lower bound; explicit conversions retain float8 precision. Null remains unknown/ambiguous.

The exact guarded input is `migrations/artifacts/0024_inventory_dimension_std_backfill.csv.gz` (SHA-256 `ee3e35c0252e67cebcf527ac153c307b21b26d2eed730df070a9d4d57c3a5c6b`). It uses `\N` for SQL null and preserves one genuine empty string. No size/height/width/caliper string, timestamp, identity, source, price, quantity or activation flag changed.

A first rejected artifact rounded conversions and used hidden `size` evidence; it was aborted before commit. The database became temporarily unavailable while PostgreSQL rolled back, then live zero counts/digests proved no partial write. The corrected direct-field-only apply used deterministic guarded chunks. One 2,000-row chunk timed out and rolled back; later a guard caught the CSV null/empty ambiguity and rolled back that chunk. Smaller continuations preserved the empty string and completed safely. Final QA: inventory 232,837 / 69,540 active / 163,297 inactive; nonpositive standards 0; outside-standard digest `2ce8e7a2e2e9764bc7ede1f723128c82`; outside-all-target digest `8920860c8376c6c477ee70c631cd911e`; supplier/source digests unchanged; direct-display and explicit-unit precision regressions passed.

## `0023_numeric_inventory_dimensions.sql`

Applied 2026-08-11 by Nova after the guarded 0022 string cleanup. Adds nullable `double precision` `inventory.height_std` (feet), `width_std` (inches), and `caliper_std` (inches). Human-readable `height` / `width` / `caliper` remain unchanged and continue to power display/evidence. Ranges use Bhoumik's approved conservative lower number; ambiguous values stay `NULL`.

`inventory_enriched`, the backwards-compatible `rate_charts` view and `search_inventory` append all three fields. Both views explicitly retain `security_invoker=true`. `search_inventory` was replaced in one transaction—one unambiguous PostgREST signature—with six nullable inclusive bounds applied before rank/limit and numeric sorting for the three displayed dimensions. Three partial `(supplier_id, *_std)` btrees cover active non-null supplier-page ranges without changing the text-search indexes.

The app sends bounds to PostgreSQL before the 300-row global cap and 100-row supplier pagination, displays the original strings, exposes unit-labelled min/max controls on desktop/mobile, validates API bounds, and clears a companion standard on an unpaired manual string edit. Migration 0024 performs the separately guarded numeric backfill described above.

## `0022_inventory_size_structure_cleanup.sql`

Applied 2026-08-11 through Daisy's guarded Postgres runner with Bhoumik's explicit approval. It audited all 232,837 inventory rows and moved only explicit, evidence-backed dimensions out of `inventory.size` into the existing human-readable `height`, `width`, and `caliper` fields.

**2,309 rows updated: 491 active / 1,818 inactive.** Every changed row had `size` cleaned; 33 `height`, 154 `width`, and 788 `caliper` values were filled. Populated structured fields were retained when semantically identical; 1,660 conflicts (usually a complete range in size versus an existing lower-bound scalar) were held byte-for-byte. 567 explicit dimension-only values became NULL size; no commercial container/root-ball size was nulled. All 5,603 inch box/pot/bag/basket rows were retained unchanged. No row was inserted, deleted, merged, activated, or retired.

The update ran in one transaction guarded on every ID and all four before-values, expected active/inactive counts, the complete inventory digest outside the four target fields, supplier/source digests, and per-supplier inventory counts. `session_replication_role=replica` was transaction-local so the generic timestamp trigger did not alter `updated_at`; only the four approved columns could move.

Post-apply: inventory remains 232,837 total / 69,540 active / 163,297 inactive; outside-target digest remains `8920860c8376c6c477ee70c631cd911e`; suppliers remain 1,383 and sources 2,065 / 759 active with identical digests. The deterministic contamination scanner reports **0 safely classifiable labeled dimensions left in size**. Duplicate groups changed 9,739 → 9,748 (excess rows 14,490 → 14,509) solely because identity facets converged; no rows were merged. Representative gallon, box, B&B, dimension-only and mixed-row searches all passed. Full evidence and exact rollback live under `workspace/threads/main/size-structure-cleanup/`.

The approved numeric standard columns (`height_std` feet, `width_std` / `caliper_std` inches) are a separate follow-up: Nova deploys schema/RPC/app migration 0023, then Daisy applies a distinct guarded 0024 backfill. No numeric values were written by 0022.

## `0021_retire_abelia_cultivar_aliases.sql`

Applied 2026-08-11 with Bhoumik's explicit approval after the focal Francis Mason audit. Retired exactly 15 unsafe bare-species/adjective alias edges that linked sibling Abelia cultivars while preserving four verified `Abelia × grandiflora` / `Glossy Abelia` same-plant mappings. No inventory changed. `Abelia Francis Mason` fell 37 rows / 15 suppliers → 10 / 9; Florida 3 G became exactly Joe's Nursery Francis Mason rather than Francis Mason plus false Rose Creek; generic `Abelia` remained 188 rows / 31 suppliers.

## `0020_enable_rls_size_snapshot.sql`

Applied 2026-08-11 via the Supabase MCP. One statement: enable RLS on
`inventory_pre_size_normalization`, the 0019 rollback snapshot. It was created
after `0011_enable_rls.sql` swept the schema, so it was the one table PostgREST
still served to `anon` (the dashboard's `rls_disabled_in_public` error). No
policies added — only `postgres`/`service_role` (BYPASSRLS) ever read it, and
it is still slated to be **dropped once the size change has settled**.

## `0019_standardize_inventory_sizes.sql`

Applied 2026-08-05 via the Supabase MCP in two steps
(`0019_standardize_inventory_sizes_snapshot`, then `..._rewrite`).
**38,090 of 209,415 `inventory.size` values rewritten**; distinct values
5,255 → 4,974 overall and 2,769 → 2,671 among active rows.

The finding behind it: **`public.normalize_size(text)` has existed all along and
nothing ever called it.** No trigger, no generated column, no default — so the
SOP's size rule only applied when a parsing agent remembered to hand-apply it,
and the column drifted. `1G` (8,533 rows) and `1 G` (7,096 rows) were two values
in the same table; likewise `3G`/`3 G`, `15G`/`15 G`, `45 G / 28"`/`45 G/28"`,
`024 Inch Box`/`24" Box`. This ran the existing function over the existing rows.

**Syntactic only.** It fixes unit spelling, spacing and leading zeros. It does
**not** change what the column carries: `6 G; Bush`, `3 G TRUE`, `1 G <24"`,
`1 G (6ct)` keep their qualifiers, and height/caliper values parked in `size`
(`5-6'`, `2-2.5"`, `B&B 4-5'`) were left alone. Splitting those out is a
semantic change needing source review per SOP §5 — **still open**, and the
reason the app's size filter still lists ~2,671 choices.

**Verified after apply** (all four checks in the `.sql` file): 0 values left
unnormalized outside the exclusion, 0 sizes nulled, **0 rows lost alphanumeric
content** (the only permitted losses are unit words collapsing to symbols —
`GAL`→`G`, `Inch`→`"`, `#`→` G`), 209,415 rows still present, 38,090 changed.
Pre-flight ran the same content check over all 383 affected distinct values and
returned zero. `search_inventory('Agave Americana')` still returns 478 rows.

**12 rows deliberately excluded**, all `#N box|bag`: `#` means gallons per the
SOP, but a box is sized in inches, so `#24 Box` → `24 G Box` may be flat wrong.
They are `#24 Box NET` (3 rows), `#16 Box CG`, `#100 Bag`, `10-12' #100 Bag
BBP`, `8-10' #100 Bag BBP`, `9' #42 box 3X BBP`, `3" #30 box BBP`, `3.5" #30 box
BBP`, `4" #60 box BBP`, `5" #60 box BBP` — one row each. **A human should read
these against the original source**; there is no way to tell gallons from inches
from the string alone.

`public.inventory_pre_size_normalization` (id, old_size, snapshot_at) holds the
38,090 pre-rewrite values. **Drop it once the change has settled.**

The SOP's size rule was expanded in the same change (approved by Bhoumik) from
one line about unit spelling to a full standard: canonical units, word sizes,
the `#N box` exception, what must *not* go in `size` (height/width/caliper,
form and grade codes, pack counts), and a pointer at `normalize_size()` as the
reference implementation.

## `0018_supplier_availability_source.sql`

Applied 2026-08-05 via the Supabase MCP, in two steps — recorded in the
migration history as `supplier_availability_source_columns` and
`search_suppliers_availability_source_columns` (no `0018` prefix, unlike
0014–0017). Adds three nullable columns to `suppliers` describing how a
supplier's availability reaches us: `availability_source_type`
(CHECK `Email | Hosted`), `availability_update_days` (CHECK `> 0`) and
`hosted_availability_url`. Additive — 0 rows rewritten, all 910 start null.

**Null is "not established yet", not "none".** The whole point is to make
filterable what was previously prose in `notes`, so a blank source type is a
to-do. For the same reason there is **no constraint tying the URL to a `Hosted`
source type**: rows are routinely half-filled while someone works out how a
supplier publishes, and a supplier that both emails a sheet and posts one on a
portal is a real case.

`search_suppliers` was dropped and recreated to return the three columns and
accept them as `sort_column` — its return type is fixed, so the app could not
see them otherwise. Nothing else about the function changed: same matching,
same ordering, same contact branch. The pgroonga document and
`suppliers_pgroonga_idx` were **not** rebuilt — an enum, an integer and a URL
are not text worth matching a query against, and the index expression has to
stay byte-identical to the function's concatenation.

App-side: the Suppliers table gained the three columns (source type edits
through a new `select` cell kind, the URL stays a clickable link with a pencil),
`WRITABLE.suppliers` gained all three, and the supplier profile shows them.

## `0017_drop_fax_and_migration_snapshots.sql`

Applied 2026-08-05, closing out the 0014–0017 contact normalization.

`suppliers.fax` was the last contact field on the table; it is gone, and
`suppliers` now carries **no way of contacting a supplier at all** — name,
category, address, coordinates, website, notes, communication_notes only.

The 12 fax numbers were preserved first, into the `notes` of each supplier's
main-line contact (preferring `title_department = 'Main line'`, then the
primary, then the oldest row). **Deliberately not `contacts.phone`:** the app
renders that as a `tel:` link, so a fax number there dials a fax machine.
Verified 12/12 present after the move.

Nothing in the app, `search_suppliers` or the pgroonga document ever referenced
`fax`, so no index or function rebuild was needed.

Also dropped, now that the changes have settled:
`suppliers_notes_pre_contact_extraction` (0015) and `suppliers_contact_pre_move`
(0016). **The 0014–0017 column drops are no longer reversible from this
database.** Post-apply: 0 snapshot tables, `search_suppliers` returns 904,
`search_inventory` unaffected.

## `0016_move_supplier_email_phone_to_contacts.sql`

Applied 2026-08-05, completing what 0014/0015 started. `suppliers.email` and
`suppliers.phone` moved into `contacts` and **both columns were dropped**.
`suppliers` now describes the company only; every contact route is a `contacts`
row. `suppliers.fax` followed in 0017.

One row per supplier is created from the email/phone pair with
`title_department = 'Main line'`. It takes `is_primary` only when no active
primary exists, so the named people 0014/0015 established keep precedence over a
generic `info@`.

**Names are guessed from a hand-curated allowlist, never a pattern.** A
`first.last` regex matches `tynursery.orders`, `treeoflife.gardencenter` and
`customerservice.bhf`; a single-first-name regex matches `howdy`, `fieldgrown`
and `plants`. So both tiers are explicit lists of values actually present here,
reviewed one by one: 9 full names, 6 first-names-plus-company, ~118 recognisable
single-token first names. Everything else keeps `name = NULL`. Ambiguous tokens
were deliberately skipped — `austin` (also a city), `hunter`, `angel`, `cat`,
`chance`, `moe`, `shorty`, `ikey`, `gay`, and every initial+surname form
(`dwinningham`, `bstitt`) whose first name cannot be recovered without inventing
it. **All ~160 guessed rows carry `Name inferred from the email address;
unverified.` in `contacts.notes`.**

**Result:** contacts 76 → 973 across 907 suppliers; 233 have a name.

**Verified after apply**, against the `suppliers_contact_pre_move` snapshot:
**0 emails and 0 phones lost**, 0 multi-primary violations, 0 leftover columns.
`search_suppliers` returns 904 active suppliers, 898 with a primary email, and
searching a full address (`susan.sheffield@acostafarms.com`) resolves to its
supplier through the contacts branch.

One trap worth recording: the first pass reported 11 phones missing. Those were
suppliers whose email already matched a person's contact row — that person had
their own cell, so the "fill phone where null" update never fired and the
company's main line would have vanished with the column. They got their own
nameless `Main line` row. **Anything similar in future: re-run the
snapshot-vs-live check before dropping, not after.**

`public.suppliers_contact_pre_move` (id, email, phone, snapshot_at) holds the
pre-move values. **Drop it once the change has settled.**

Knock-on changes: `suppliers_pgroonga_idx` rebuilt without email/phone;
`search_suppliers` dropped and recreated without the `phone`/`email` return
columns and sort keys (contact matching already covers those values);
`app/lib/columns.ts` lost both supplier columns; the profile lost both fields;
`WRITABLE.suppliers` lost both; and Daisy's supplier-identification query in
`1-agent.md` plus the SOP's onboarding search now join through `contacts`.

## `0015_extract_contacts_from_notes.sql`

Applied 2026-08-05, straight after 0014. Before `contacts` existed, people found
in availability emails and on supplier websites had nowhere to go, so they were
written into `suppliers.notes` as prose. This lifts them out.

All 54 suppliers with non-empty notes were read by hand — 48 active, 6 inactive.
The 6 inactive ones are duplicate-record tombstones whose notes are pure
provenance, and were left alone.

The rule, applied uniformly: a **named person** and their email/phone/role
becomes a `contacts` row, and notes lose only the text that carried that
person's contact details. Everything else stays — hours, addresses, policies,
parsing quirks, business history, and generic/role inboxes (`sales@`, `orders@`,
`avail@`), which are the company's own contact surface and already live on
`suppliers`.

**Result:** 29 contacts inserted (47 → 76 rows, 49 suppliers), 12 existing rows
gained the role the notes described, 3 gained a missing email/phone, 20 supplier
notes trimmed (5 of them to `NULL` because contact details were their whole
content). It also removed the last reference anywhere in the database to the
dropped `poc_email` column (supplier 204).

**Verified after apply**, since trimmed prose cannot be regenerated:

- All 44 people named in the original notes resolve to an active contact row.
- Every email address removed from a note exists on `contacts` or `suppliers` —
  0 lost.
- Every phone number removed from a note likewise, compared on digits only —
  0 lost.
- 47 primaries, 0 multi-primary violations, 0 remaining `poc_*` references.

`public.suppliers_notes_pre_contact_extraction` (id, notes, snapshot_at) holds
the pre-trim text for all 54 suppliers. **Drop it once the change has settled.**

Two judgment calls worth knowing:

1. **New rows are `is_primary = false`.** Where a supplier had no contact at all
   (Tom Dodd, Cox Cactus), nothing was promoted — the notes ranked nobody, and
   `search_suppliers` falls back to the oldest active row, so the supplier still
   displays a contact without anyone asserting who *the* POC is on no evidence.
2. **Supplier 255 now has two Felix Riveros.** The existing `Felix Jr. Rivero`
   and the notes' `Felix Rivero` carry different office, cell and email. They
   are kept separate with the ambiguity recorded on the new row rather than
   merged on a guess.

Six notes that name a person were deliberately left intact, because the sentence
carries a fact rather than a directory entry: 12 Ran-Pro (what Ken Howard sends,
and that the farm shut down), 43 Greenstock (routing instruction), 59 Green Land
(who distributes availability), 297 Davenport (who a list came from), 520 Focal
Point (how to work with John Shearouse), 914 Hand Tree (forwarding provenance).

## `0014_supplier_contacts.sql`

Applied 2026-08-05 in five steps (`0014a`–`0014e`). The `poc_*` drop is
irreversible, so the backfill was reconciled against the source columns first:
**47 rows** inserted — 45 with a name, 41 an email, 37 a phone, 47 primary —
matching all four source counts exactly, with **0 value mismatches** on a
row-by-row comparison. Post-apply: 0 `poc_*` columns remain; `search_suppliers`
returns 904 active suppliers, 42 carrying a primary contact name (the other 3
named contacts belong to inactive suppliers, correctly filtered out); a contact
name whose supplier name does not contain it still finds that supplier;
`search_inventory` is unaffected.

Splits the supplier point of contact out of `suppliers` into `public.contacts`,
one row per person, so a supplier can have more than one. `poc_name` /
`poc_email` / `poc_phone` held exactly one and were used by 47 of 910 rows.

Three things worth knowing:

1. **`contacts.name` is nullable.** Two backfilled rows carry only an email or
   phone (a shared sales inbox). A `NOT NULL` name would have forced inventing
   one.
2. **One active primary per supplier**, via the partial unique index
   `contacts_one_primary_idx (supplier_id) WHERE is_primary AND is_active`.
   Promotion must **demote the incumbent first**; the reverse order trips the
   index. Retired contacts keep their flag as history without blocking anyone.
3. **Contact text left the suppliers search document.** An index expression
   cannot read another table, so `poc_name` could not simply be re-pointed at
   `contacts`. Instead `suppliers_pgroonga_idx` drops it, `contacts_pgroonga_idx`
   covers the contact document, and `search_suppliers` folds matching
   `supplier_id`s in as a precomputed array — the same shape as the existing
   trigram fallback, which keeps the suppliers index usable for the main branch.
   Contact-only matches score 0 and sort after direct matches.

## `0013_legacy_zero_prices_to_null.sql`
Applied 2026-08-04 via Daisy's guarded Supabase runner with explicit Bhoumik
approval. `UPDATE 28998`: all historical `unit_price = 0` rows became `NULL`.
Post-check: zero = 0, null = 28,998, positive = 178,615. No positive prices
changed. Future numeric zero remains valid only when explicitly printed.

## `0012_search_inventory_nulls_last.sql`
Applied 2026-08-04 via Daisy's guarded Supabase runner after Bhoumik applied
0011. Replaces `search_inventory` without changing its signature or matching;
optional server-side sorts now append `NULLS LAST` in either direction. No
inventory rows changed.

## `0011_nullable_inventory_prices.sql`
Applied 2026-08-04 by Bhoumik. Drops the `NOT NULL` constraint from
`inventory.unit_price` and documents that `NULL` means no supplier price was
provided. It rewrites no data; all 28,998 legacy zero rows were left unchanged
for source-level review.

## `0010_purge_inactive_aliases_and_rollback_tables.sql`
Applied 2026-07-31 as `051` / `052`. Deletes the 78,807 retired alias pairs
(13,429 active remain, the whole table now) and drops
`inventory_pre_name_consolidation` and `name_consolidation_map`.

**Two things this permanently changed:**
1. `dedupe_plant_other_names()` blocks a duplicate `(name_key, other_name_key)`
   INSERT *regardless of `is_active`*, so the soft-deleted rows had been acting
   as a blocklist — a retired cultivar alias physically could not come back.
   That is gone. The SOP's alias quality bar is now the only guard. If bad
   aliases recur, add a blocklist table; don't reintroduce soft-deleted rows.
2. The name consolidation is no longer reversible, and the 359 source
   `category` values are gone from the database entirely.

## `0009_residual_merlot_aliases.sql`
Applied 2026-07-31 as `049` + `050`. Deactivates the last four Merlot-class pairs
(`Cercis canadensis x` / `Cercis texensis` ↔ `Merlot Redbud` / `Redbud Merlot` /
`Redbud Merlot Clump`) by id, then sweeps table-wide for the same shape — 19
further pairs (`Sedum rupestre` ↔ `Angelina Stonecrop`, `Ulmus` ↔ `Allee Elm`,
`Hydrangea x` ↔ `Let's Dance Sky View Hydrangea`), all eyeballed, 19/19 correct.

The sweep only works **with trademark corroboration**. The same rule without it
flags 484 pairs and takes genuine common names with it (`Pinus taeda` ↔
`Loblolly Pine`, `Agave vilmoriniana` ↔ `Octopus Agave`, `Rhus trilobata` ↔
`Skunkbush Sumac`). Verified unharmed: Loblolly Pine 59, Octopus Agave 11,
Texas Redbud 57.

The alias graph is now clean for all three reported cultivars: Forest Pansy 45/0,
Ruby Falls 46/0, Merlot Redbud 12/0, with `Texas Redbud` still at 57.

**Still open (not an alias problem):** "Merlot Redbud" shows two `Redbud, Mexican`
rows, and "Pink Pom Pom" ~2,300, purely from pgroonga matching a single shared
token. Genuine hits still rank first. Requiring all query tokens would change
every search in the app, so it is a ranking/product decision.

## `0008_alias_quality_audit.sql`
Applied 2026-07-31 as `047` / `048a`–`048d`. Three parallel audits pruned the
alias directory: generic labels by fan-out (a name used for ≥5 distinct plants
is a category — "Grass" covered 64), non-plant junk (hardgoods, feed
truncations, grade codes), nine hand-verified wrong-taxon pairs, and cultivar
residue on single-word epithets. Active pairs 19,106 → 13,452.

"Forest Pansy" and "Ruby Falls" now return **zero** false positives;
"Merlot Redbud" went 46 → 7.

**Read the file's REJECTED RULES section before attempting more cleanup.** Four
plausible rules were built, measured and thrown out for destroying genuine data
— notably any single-word epithet dictionary (the corpus yields "texas",
"japanese", "rock", "firecracker") and any same-genus rule (~0–1.5% precision;
it is almost entirely accepted synonyms like *Aloe barbadensis* ↔ *A. vera*).
The file also lists what was deliberately left for a human, including 11 pairs
where only a taxonomic authority can say which side is wrong.

## `0007_retire_carryforward_aliases.sql`
Applied 2026-07-31 as `046a`. Retires the 48,269 still-active pairs that 0005's
carry-forward (042e) inserted — the single largest source of search false
positives. It ran before the 0006 cleanup and its filter caught only quoted and
patent-marked cultivars, so unquoted compounds (`Redbud Pink Pom Pom`) and
sibling *species* (`Redbud [Forest Pansy]` ↔ `Cercis mexicana`) came along.

After it: "Forest Pansy" 45 results / 0 false positives, "Ruby Falls" 46 / 0.

**Cost:** of 40,715 active bracketed rows only 4,378 remain reachable through the
alias graph. Rows whose name already contains the botanical name are still found
by text; rows whose common name lived only in the alias graph are not.

**Still open** — do not assume the cultivar cleanup is finished:
- *Merlot-class residue.* Pre-existing pairs on species hubs
  (`Redbud, Texas` ↔ `Merlot Redbud`, `Traveller Redbud`) still cross-match; a
  "Merlot Redbud" search returns ~25 wrong rows. These use single-word epithets.
  A generic rule was built and **rejected**: the only available epithet
  dictionary contains `texas`, `oklahoma`, `eastern`, `rock`, `japanese`, so it
  also deleted genuine names (`Penstemon eatonii` ↔ `Firecracker Penstemon`).
  This needs a curated epithet list or per-hub cleanup like 0004's.
- *Token-OR noise.* "Pink Pom Pom" returns ~2,300 rows matching only "pink"
  (`Acer palmatum [Pink Panther]`). That is pgroonga's any-token matching, not an
  alias fault — genuine hits still rank first. Requiring all query tokens would
  change every search, so it is a product decision, not a cleanup.

## `0006_cultivar_alias_cleanup.sql`
Applied 2026-07-31 as `045a` / `045b` / `045c`. Generalizes 0004's hand-listed
Redbud cleanup, in three passes: quoted cultivar epithets and patent/trademark
markers (`PP21929`, `PPAF`, `™`, `®`); pairs where one whole side is a multi-word
cultivar epithet seen in quotes elsewhere; and the same epithets used as a prefix
to a head noun (`Autumn Blaze Maple`, `Forest Pansy Redbud`). 24,861 of 92,236
pairs are now inactive, and a "Forest Pansy" search returns no sibling cultivars.

Two deliberate guards: single-word epithets are left alone, because "Gala",
"Mango" and "Plum" are as often a real common name; and matching preserves word
boundaries, so the cultivar `Ilex x 'Oak Leaf'` cannot collapse to `oakleaf` and
kill the genuine `Hydrangea quercifolia` ↔ `Oakleaf`.

Known residue: compound aliases built on a *single-word* epithet still slip
through. Catching them needs a fuzzier rule that would take genuine names with
it, so they were left.

## `0005_inventory_name_consolidation.sql`
Applied 2026-07-31 as `042*` / `043*` / `044`, split into small steps because the
guarded runner rejects large multi-statement DDL batches. `inventory.name` now
carries the whole plant identity as `Name [scientific name, variant]`;
`inventory.category` and `inventory.variety` are **dropped**. 101,678 rows had
their variety folded into the name. Each new name also inherited up to three of
its base name's aliases (step 042e) — **that carry-forward was wrong and has
since been retired by 0007**; do not reinstate it without a trustworthy epithet
dictionary.
Both search indexes and both views (`rate_charts`, `inventory_enriched`) were
rebuilt around the drop, and `search_inventory` lost its `category_filter`
parameter along with the two columns. `suppliers.category` is untouched.

The scientific name was **not** backfilled: deriving it from the existing alias
graph was tried and abandoned as too unreliable (`Acer Palmatum` resolved to the
cultivar `Oto hime`). It is captured going forward, from the source.

Pre-change values are preserved in `public.inventory_pre_name_consolidation`
(id, old_name, old_category, old_variety) and the name mapping in
`public.name_consolidation_map`. Drop both once the change has settled.

## `0004_active_plant_aliases.sql`
Applied 2026-07-31 as `041_active_plant_aliases` (prepared 2026-07-30 with
Bhoumik's approval; it had been held back because Daisy's guarded query runner
blocks `ALTER TABLE`). Adds `plant_other_names.is_active`, updates
`search_inventory` so only active aliases power matching/display, and deactivates
the observed Redbud cultivar-to-species pairs that made Forest Pansy searches
return sibling cultivars. Superseded in part by 0005/0006 below, which replaced
`search_inventory` again and generalized the alias cleanup.

## `0003_search_prefix_match.sql`
Applied 2026-07-28 as `040_search_prefix_match`. `CREATE OR REPLACE` of
`search_inventory` and `search_suppliers` only — no tables or indexes touched.
Fixes word-prefix searches returning nothing ("Mexican Sycamor" → 0 rows while
"Mexican Sycamore" → 17): the pgroonga `TokenDelimit` index matches whole
tokens, its fuzzy path misses edits at the end of a token, and the 038 trgm
fallback excludes substring-of-document queries — so typed prefixes fell
between all branches. Both functions now also OR in the normalized query with
a Groonga `*` prefix wildcard on the last token (only when that token is
≥ 3 chars, to keep short tokens like "g" from matching everything).

## `0002_supplier_communication_notes.sql`
Applied 2026-07-27. Adds `suppliers.communication_notes` (nullable text) and
column comments separating it from `suppliers.notes`:

- **`notes`** — durable profile facts with no dedicated column (quirks,
  preferences, price-list format, ordering constraints).
- **`communication_notes`** — append-only contact log, one timestamped entry per
  contact.

Additive only: no rewrite, no backfill, no data touched (~910 rows, all
`communication_notes` null on apply).

## `20260701104209_daisy_availability_versioning`
Source: `0001_availability_versioning.sql`. One migration, applied 2026-07-01.

Changes to `public.rate_charts`:
- Renamed `common_name` → `common_names` (comma-separated list of names).
- Added `category text`, backfilled from `rate_chart_sections.name` via the old
  `section_id` (0 nulls across all 1,470 rows).
- Added `is_active boolean NOT NULL DEFAULT true` (all rows active) + index
  `rate_charts_supplier_active_idx (supplier_id, is_active)` for versioned ingestion.
- Dropped `section_id`.

Also dropped the `public.rate_chart_sections` table.

No data lost; category casing left as-sourced (both `TREES` and `Trees` exist).
RLS remains disabled on these tables — not changed here.
