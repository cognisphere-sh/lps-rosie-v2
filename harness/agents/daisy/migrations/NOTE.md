## 0153 — favourite suppliers (2026-10-28)

Bhoumik: "on /suppliers page add a heart button to add suppliers to
favourite. Always show favourite suppliers on top. Even in plant search."
Adds `suppliers.is_favorite boolean NOT NULL DEFAULT false`, set on the
company's head-branch row (one team-wide flag; there is one admin login).
No RPC changes: the app orders by it (`listSuppliers` groups, then puts
favourite companies first; plant search reads favourite farms' matches, then
the rest). Applied via the Supabase MCP (`apply_migration`, file text
verbatim) on 2026-10-28; the column is live (1,402 suppliers, none favourite)
and `listSuppliers` / `searchPlantGroups` ran clean against it.

## 0152 — a line's status is written as given; selecting a hidden candidate unhides it (2026-10-21)

JR-111 line 1270 (Chris): setting Diff Sz/Sub on the default candidate failed
("Diff Sz/Sub needs a substitute"), and selecting hidden candidate 1583 got a
500 ("Candidate is hidden"). Bhoumik: "Updating job line's status updates
candidate status." "Hidden candidate can be selected, that unhides them."
`update_job_line` now stores `diff_size_sub` on an original with no
substitute (an original answered Unavailable with a live offer still stays
Unavailable, so the offer is not released); `select_candidate` clears
`hide_from_lps` on the candidate it selects. Rehearsed with
`tests/0152_line_status_as_given_select_unhides.assert.sql` (rolled back) on
2026-10-21: passed; the rehearsed md5(prosrc) match the file
(`update_job_line` cb67311340fed37e23ccff82f2165577, `select_candidate`
f1448f6fb06dc9e13f6b52347938f4ca). Live before: cf32d28d0d376d3945be97b2233dd127
(0145) and 5183a216b0b4c54ea5264761d85f7683 (0130). Applied via the Supabase
MCP (`apply_migration`, file text verbatim) on 2026-10-21; live md5s match
the file and the asserts re-run live (rolled back): passed.

## 0151 — an order's additional details are JSON (2026-10-21)

Bhoumik: "let additional details be json instead of markdown." Makes
`orders.additional_details` jsonb: an ordered list of `{"field", "value"}`
checked by `is_order_details` (constraint `orders_additional_details_check`).
Markdown `| Field | value |` pairs became items (header rows dropped); other
text became one `Notes` item (old values in `orders_pre_0151`).
`create_order` takes `p_additional_details jsonb`; `update_partner_order`
takes the list. Rehearsed in two rolled-back halves on 2026-10-21 (the
conversion with its checks; the RPCs with `tests/0151_order_details_json.assert.sql`'s
calls) because execute_sql would not run `DROP FUNCTION`.

## 0150 — an order's change log is its own column (2026-10-21)

Bhoumik: "Move changelog as a seperate field." Adds `orders.change_log`
(markdown bullets of material changes), moves each order's existing
"**Change log**" section out of `additional_details` (old values in
`orders_pre_0150`) and lets `update_partner_order` write `change_log`.
Rehearsed with `tests/0150_order_change_log.assert.sql` (rolled back) on
2026-10-21.

## 0149 — orders take pickup/delivery and the date from their job; additional details (2026-10-21)

Bhoumik: "drop: fulfillment_date ... fulfillment_method and fulfillment_date
should come from job. Note for supplier is a markdown it should include all
details supplier need to deliver the order", "rename note_for_supplier to
additional_details", "Drop Note for customer from orders [item and order
table]". Drops `orders.fulfillment_date`, `orders.fulfillment_method`,
`orders.note_for_customer` and `order_items.note_for_customer` (values in
`orders_pre_0149`, `order_items_pre_0149`), renames
`orders.note_for_supplier` → `additional_details`, and replaces
`create_order` (no method or customer note), `update_partner_order`
(`status`, `additional_details`, `note_from_supplier`; no date needed) and
`confirm_order` (no fulfillment date); the old definitions are in
`functions_pre_0149`. Rehearsed with `tests/0149_order_additional_details.assert.sql`
(rolled back) on 2026-10-21.

## 0148 — a reserved job's chat is tagged once its row is written (2026-10-20)

New job request reserves the id and opens `jr-<id>` before Rosie writes the
row, so 0147's FK rejected every message there (JR-127, 2026-10-20, four 500s
in the app). The webchat plugin now stores those messages untagged; this
AFTER INSERT trigger on `job_requests` tags them by `origin_thread_id` when the
row lands. Rehearsed with `tests/0148_reserved_job_chat_tags.assert.sql`
(rolled back) on 2026-10-20: passed. **Not applied yet**: apply the file text
verbatim, then re-run the asserts (rolled back).

## 0147 — chat messages carry who sent them and which job they belong to (2026-10-19)

Bhoumik: "A single thread per job. It handles communication with suppliers,
Chris [webchat] and customer ... For supplier view: It should be only a single
thread. Just that all message to have a job tag Name and hyperlink." Adds
`thread_messages.sender_kind` (`lps`/`agent`/`supplier`/`customer`, check
constraint, NULL tolerated for rows a pre-0147 plugin writes),
`origin_thread_id` and `job_request_id` (FK to `job_requests`, `ON DELETE SET
NULL`, so a deleted job's messages stay in a supplier's conversation
untagged) plus `thread_messages_job_request_idx`. Backfill: kind from
`role`/`portal`, origin = the row's own thread, job for `jr-<id>` threads
whose job exists. Rehearsed with `tests/0147_job_chat_tags.assert.sql`
(rolled back): passed — 2,284 agent, 725 lps, 23 supplier rows; 1,144 tagged.
Applied 2026-10-19 at 07:37 UTC via the Supabase MCP (file text verbatim), before
the harness/app restart with the matching plugin (the plugin writes the new
columns; the running build ignores them). Asserts re-run live (rolled back):
passed — 2,283 agent, 725 lps, 23 supplier rows, none unclassified.

## 0146 — one order per job and supplier; an order row copies one selected candidate (2026-10-16)

Bhoumik: "One order maps to one job only. So an order just converts selected
candidate to order row. 1-1 mapping between candidate and order item row." He
chose one open order per job and supplier (more lines go onto it), ticked lines
(all by default), the AR linked in the order header, and supplier row status
plus their own note; `p_customer_confirmed` and the per-supplier advisory lock
removed. Adds `orders.job_request_id` (NOT NULL, CASCADE; backfilled from the
allocations: all 4 live orders covered exactly one job),
`orders_one_open_per_job_supplier`, `note_from_supplier` on orders and rows,
`order_items_candidate_id_key`; drops `order_item_job_request_items` (56 rows
backed up in `order_item_job_request_items_pre_0146`), `create_direct_order`
and the old `create_order` / `update_partner_order_item` signatures; rewrites
`update_partner_order`, `close_order` and
`close_orphaned_availability_on_job_delete`. The six previous definitions are
saved in `functions_pre_0146` for rollback. Rehearsed with
`tests/0146_order_per_job_supplier.assert.sql` (rolled back): passed. Applied
via the Supabase MCP (file text verbatim) at 10:35 UTC, immediately followed by
`server.sh restart` (app build and harness restart, both up 10:35:43; all agents
running, Rosie's `gws` still failing on its missing credentials file as before).
Live `create_order` `md5(prosrc)` `2965d2538041b10723d94bac69a41987` matches
the file; asserts re-run live (rolled back): passed. 4 orders / 56 rows kept.

## 0145 — update_job_line no longer edits size or name (2026-10-16)

Bhoumik, after 0144: "price belongs to candidate. The user will see the
selected candidate. And remove it." 0133's `size` / `name` keys wrote the
selected candidate (and on an original the line too) while it kept its price.
`update_job_line` now refuses them with "Size and name are not line values: …";
status, price, avail and customer note behave as before. No app or Rosie
script sent them (the app stopped on 2026-10-15). The live body before apply
(0134's with 0139's in-place demand edit, `md5(prosrc)`
`1937ae09cd4bed97d8fa367cd52af95c`) is saved as
`tests/0145_rollback_update_job_line.sql`; re-creating it in a rolled-back
transaction reproduced that md5. Rehearsed with
`tests/0145_update_job_line_drops_size_name.assert.sql` (rolled back):
passed. Applied via the Supabase MCP (file text verbatim); live `md5(prosrc)`
`cf32d28d0d376d3945be97b2233dd127` matches the file; asserts re-run live
(rolled back): passed. No data changed.

## 0144 — editing a line's name or size leaves its candidates alone (2026-10-16)

Bhoumik: "Do not update candidate on manual edit, as candidate also hold
price info. So it may refer to incorrect price." `sync_job_line_default`
copied a line's new name and size (and a generated description) onto its
unasked default, which kept its price and `mapped_inventory_id`. A control
run on live (rolled back) showed a $185 "30 G Live Oak" default becoming
"45 G Quercus virginiana" at $185. The function now keeps only 0136's demand
rules (an unasked Available default tracks demand; a demand change re-checks
Available ↔ Partial Qty). `update_job_line`'s explicit `size` / `name` keys
are unchanged; the app stopped sending them on 2026-10-15. Before apply the
live body was 0136's byte for byte (`md5(prosrc)`
`9d93ee1f4199ef61f34dce95000d18d2`, the rollback body). Rehearsed with
`tests/0144_line_edits_leave_candidates.assert.sql` (rolled back): passed.
Applied via the Supabase MCP (file text verbatim); live `md5(prosrc)`
`8010e23369783ed4590dfbc36c0f720f`; asserts re-run live (rolled back):
passed. No data changed.

## 0143 — a candidate's $0 is a price; NULL is "not priced" (2026-10-15)

Bhoumik: "allow 0 price. a 0$ price is not null" (a price typed as 0 on
JR-123 read back blank). Candidate `unit_price` 0 meant "price not found":
`create_job_line_default` created the default at 0, `job_lines` read
`NULLIF(unit_price, 0)` and `create_order` refused 0. Now the default is
created NULL, `job_lines` reads price and total as stored, `create_order`
refuses only NULL and `order_items_unit_price_check` is `>= 0` (was `> 0`), so
a $0 line orders at $0 (`create_direct_order` already refused only NULL).
Backfill: the 117 candidates priced 0 (none a known deliberate $0; JR-121's
$0 Shrub Live Oak had since been repriced) became NULL, `updated_at` kept,
ids in `candidates_zero_price_pre_0143`. Before apply the live `create_order`
was 0140's byte for byte (`md5(prosrc)` `5dd0c070ac71e1ba4b93ba27028c4e60`)
and `create_job_line_default` 0136's second body
(`eff9dee104a1d9bc7bc63dc0cdc262b0`). Rehearsed with
`tests/0143_zero_price_is_a_price.assert.sql` (rolled back): passed. Applied
via the Supabase MCP (file body verbatim); live md5s match the file
(`create_order` `08d8888ee75c9f6b1150206fde797fe5`, `create_job_line_default`
`286b1ade1a7049ad712d4a2ace88cebb`); `job_lines` 746 rows, no candidate priced
0; asserts re-run live (rolled back): passed.

## 0142 — alias expansion forgives typos and partial names (2026-10-15)

Written 2026-10-15 (Bhoumik: aliases typo tolerant, partial matches too).
Moves `search_inventory`'s query parse into `search_query_groups(search)`,
unchanged for sizes and exact aliases, and adds close (every word typed or a
typo) and partial (part of a longer alias name, whole plant name only, at most
three pairs) alias matches, plus `plant_word_distance`. Scoring, quoted mode,
signature, projection and grants unchanged. Measured on live in `pg_temp`:
`japanse maple` returns what `japanese maple` does (1,686 maple rows, was 388
plus 1,262 other maples and Acers); `whale tongue` finds all 6 APS Agave
ovatifolia rows (was 1; the aliases themselves are spelt "Whale Toungue" and
"Whale's Tongue"); `muhly grass 1 g` drops 483 unrelated grasses; `texas sage
3g` and `live oak 24 inch box` unchanged. Of 120 correctly spelt inventory
names, 10 gained an alias, each the same plant or genus (e.g. `chinquapin oak` →
chinkapin oak, `hesperaloe parvifolia` → H. parviflora). The parse adds about
40 ms per search. Rehearsed (rolled back) with
`tests/0142_alias_typo_partial_match.assert.sql`: passed. Applied via the
Supabase MCP at the user's request, after checking the live `search_inventory`
was still 0118's (`md5(prosrc)` `d81c3b309a46572600e7d6d239873be6`, the
rollback body); the asserts were re-run live and passed. The applied bodies
drop some of the file's blank and comment lines, so their live md5s
(`search_inventory` `61c5e8316c853e06ea64ab96cfabcdad`, `search_query_groups`
`13b88783deeed3c57f4972ae30faac9a`) differ from the file's; with comments and
whitespace removed both match the file. `plant_word_distance` matches byte for
byte.

## 0141 — a job delete takes its orders too (2026-10-15)

Bhoumik: deleting a job deletes its lines, candidates, orders and ARs.
`close_orphaned_availability_on_job_delete` now also deletes this job's lines
on an order shared with another job (an order line also placed for another
job's line stays) and deletes such an order once empty; the counts include
them. Orders only this job uses were already deleted (0097). Rehearsed with
`tests/0141_job_delete_cascades_orders.assert.sql` (rolled back), applied via
the Supabase MCP, asserts re-run live (rolled back): passed. No data changed
(no live order is shared by two jobs).

## 0139 — every AR has a job; candidates.demanded_quantity dropped (2026-10-15)

(Bhoumik: drop the job-less ARs and the column; delete orphan lines too;
deletes take their dependants.) Applied via the Supabase MCP after the app that
no longer selects `candidates.demanded_quantity` (`AR_ITEM_COLUMNS` in
`availability-queries.ts`) was live (restart 13:19 UTC), in two recorded parts
because the whole file kept failing with "Invalid or expired requestState":
`0139a_drop_candidate_demand_functions` (the AR delete guard, the job-delete
trigger and the four in-place function edits; safe on either schema) then
`0139b_drop_candidate_demand` (backups, deletes, NOT NULL, the cascading FK,
the column drop). Verified after: 19 ARs / 300 candidates backed up and gone,
no job-less AR, column dropped, `candidates_guard` back, `job_lines` 746 rows. Deletes the 19 job-less ARs with their 292
candidates and the 8 candidates of deleted lines (AR-18, AR-77), backed up in
`availability_requests_pre_0139` / `candidates_pre_0139`; nothing referenced
them. Makes `availability_requests.job_request_id` and
`candidates.job_request_item_id` NOT NULL; a deleted line now takes all its
candidates (FK ON DELETE CASCADE) and a deleted job its ARs
(`close_orphaned_availability_on_job_delete`, via `lps.ar_delete` in
`prevent_availability_request_delete`). Replaces `candidate_status_quantity`,
`update_job_line`, `answer_availability_request` and `apply_candidate_offer`
by editing their live definitions in place (each edit must match exactly once,
so concurrent changes elsewhere in them survive), and drops the column, its
checks and `candidates_demand_on_job_line`, recreating `candidates_guard`
without it. `create_order` is not touched (0140 already dropped its
candidate-demand check); `job_lines` reads the line's demand since 0138, so its
step is a no-op now. Rehearsed live in rolled-back transactions with
`tests/0139_drop_candidate_demand.assert.sql` (passed: 19 ARs and 300
candidates deleted, Qty/answer/substitute/order checks, line and job deletes).
Larger `execute_sql` calls kept failing with "Invalid or expired requestState"
(probably the MCP's confirmation for destructive SQL expiring), so the last
whole-file rehearsal did not run.

## 0140 — an answer-backed order line takes its candidate's status (2026-10-15)

Written on top of 0139's `create_order` (the only difference: the order line's
status is the candidate's, `can_order` → need_to_order, no longer Diff Sz/Sub
for an answered non-original). Applied via the Supabase MCP **before** 0139, at
the user's request: it already drops 0139's `source.demanded_quantity` check,
which is safe on either schema (a candidate on a job line has no demand of its
own since 0136, and the allocation's line-demand check remains). Rehearsed
first with `tests/0140_create_order_candidate_status.assert.sql` (rolled back),
which passed. Grants unchanged (service_role). **0139 must not put the old
status CASE back:** drop its `create_order` block, or give it 0140's status
line. Existing order lines keep their status.

## 0138 — drop job_lines.status (2026-10-15)

Applied via the Supabase MCP once the app reading `candidate_status` was live
(restart 06:56 UTC); the asserts were re-run (rolled back) after the apply and
passed. Rehearsed beforehand in a rolled-back transaction (after
0137's view and `create_direct_order`) with
`tests/0138_drop_job_line_status.assert.sql` — passed, with the old view
renamed rather than dropped because the MCP's `execute_sql` refuses a
`DROP VIEW` without a confirmation it could not get. Recreates `job_lines` without `status` (and without the
substitute join only `status` used) and restores its grants, `security_invoker`
and comments. `demand` reads the line's `demanded_quantity` only (the same value
on every line since 0136), so 0138 and 0139 (which drops
`candidates.demanded_quantity`) apply in either order. No data change.

## 0137 — a job line's status is its selected candidate's (2026-10-15)

Applied via the Supabase MCP after a rolled-back live rehearsal with
`tests/0137_job_line_candidate_status.assert.sql`. Expand step, safe for the
app running at the time: `job_lines` gains `candidate_status`
(`candidates.status` as stored) and keeps the derived `status` until 0138;
`create_direct_order` takes the order line's status from it (NULL → pending,
`can_order` → need_to_order). Backfill (`updated_at` kept, LPS override for
closed AR-50): candidates 668, 669, 672, 947, 955, 1297, 1317, 1339, 1347,
1461, 1512 — selected, answered Available, at a size other than the line's
requested one — `available` → `diff_size_sub`; candidate 1288 (line 1170,
1 of 2) → `partial_qty`. The other 14 lines the old view read as Diff Sz/Sub
(same size, no size, or a different plant at the same size, e.g. lines 1342,
1254, 1117, 1118) read Available.

## 0136 — demand belongs to the job line (2026-10-15)

Applied via the Supabase MCP after a rolled-back live rehearsal with
`tests/0136_demand_on_job_line.assert.sql`, once the app that reads AR
quantities from the job line (`line:` embed in `availability-queries.ts`,
`orderCandidates`) was live; the asserts were re-run (rolled back) after the
apply and passed. Backfill: `demanded_quantity` NULL on every candidate with a
job line (685; 15 active ones differed from their line, e.g. JR-55 line 418's 42 vs
35, JR-59 line 450's 30 vs 13 — the line's value wins). Job-less candidates
(299 active) keep theirs. `updated_at` was kept. Adds
`candidates_demand_on_job_line`; replaces `create_job_line_default`,
`sync_job_line_default` (also re-checks Available / Partial Qty on a Qty
change), `add_candidates_to_availability_request` and `apply_candidate_offer`.

## 0135 — order lines link to their candidate (2026-10-15)

Applied via the Supabase MCP after a rolled-back live rehearsal with
`tests/0135_order_items_candidate.assert.sql`. Adds
`order_items.candidate_id` (nullable, `ON DELETE SET NULL`, indexed) and
replaces `create_order` (links the answered candidate) and
`create_direct_order` (links the job line's selected candidate, and names the
line after it: `job_lines.candidate_name` instead of `quote_name`).
Backfill: all 56 live order lines (4 orders) linked, each to its job line's
current selected candidate with size and price matching. The 14 lines of order
8 had a twin candidate on a second AR to the same supplier (AR-35 / AR-36); the
selected (AR-35) one won. Two of them (65 "Agave parryi", 66
"Wintergem") carry names edited after ordering and matched on size and price.
`updated_at` was kept (trigger disabled for the backfill).

## 0134 — a status set from the job table fills Avail with the demand (2026-10-14)

Applied via the Supabase MCP after a rolled-back live rehearsal with
`tests/0134_line_status_sets_demand.assert.sql`. Replaces `update_job_line`
only: a `status` sent without `available_quantity` that ends Available, Can
Order, Arriving Soon or Diff Sz/Sub sets the quantity to the demand.
Unavailable = 0, Partial Qty keeps, Pending = NULL (0132). Supplier answers
unchanged. No data backfill.

## 0113 — partner order line price (applied 2026-10-14)

Written 2026-09 but never applied, so the partner portal's order-line price
editor failed with a missing function. Applied via the Supabase MCP after a
rolled-back live rehearsal on an open order line (price and generated total,
two-decimal rule, wrong supplier refused, price cleared to NULL). Adds
`update_partner_order_item_price` only (service_role); no data changed.

## 0133 — job line size and name edit what the line shows (2026-10-14)

Applied via the Supabase MCP after rolled-back live rehearsals with
`tests/0133_job_line_size_name.assert.sql`, before deploying the app change
that sends `size` / `name` to `update_job_line`. No data backfill. Replaces
`update_job_line` (new `size` and `name` keys: an original writes the line's
ask and the candidate, a substitute only the candidate; a substitute's name
edit rebuilds its description) and `sync_job_line_default` (an unasked
default's generated or size-prefixed description follows). Stale generated
descriptions from before, such as candidate 1556's, are not repaired.

## 0132 — follow-ups from the first live answers (2026-10-14)

Applied via the Supabase MCP after a rolled-back live rehearsal with
`tests/0132_answer_followups.assert.sql`. Three rules:
- Back to pending clears the available quantity (`candidate_status_quantity`).
  Backfill: candidate 1503 (line 1246, JR-108), whose 3 came from 0130's
  backfill.
- Submission hides the supplier's other alternatives on the AR's lines, asked
  or never asked (`hide_submitted_alternatives`). Backfill: AR-83 (JR-114),
  the only AR submitted since 0130: 1973 (Gaura) and 1974 (4" Stemodia)
  hidden.
- A new supplier reply clears the candidate's customer-note override
  (`candidates_reset_customer_note`). Backfill: 1980 (JR-114 15 G Sotol)
  dropped Rosie's intake note "15 G instead of 5 G".

`tests/0130_…assert.sql` predates the wider hiding: run after 0132 it would
see 99313 (an unasked alternative) hidden.

## 0130 — job lines read their selected candidate (2026-10-14)

Applied via the Supabase MCP (`apply_migration`) at about 06:48 UTC after a
rolled-back live rehearsal with
`tests/0130_job_lines_from_selected_candidate.assert.sql`; the backfill counts
matched the rehearsal. The app and harness had been restarted on the new
build at 06:46:12, about two minutes too early; until the apply, job pages and
Rosie's job scripts could not read `job_lines`. No writes landed in that window
(the 0129-pair check, which expects exactly 27, passed at apply).

Backfill on live data:
- 26 of 27 0129 promotions reverted (52 `is_original` flips). Line 1182 keeps
  candidate 1321 as it was, for review.
- 42 requested sizes restored from selection-made changelog rows; lines 1052,
  1129, 1178, 1206 and 1254 keep LPS's own size or no size; 1228, 1253 and
  1254 need a human.
- 541 lines default to an existing APS original, 165 defaults created; 445
  lines changed selection (440 now select their default, 10 switched to their
  offered substitute).
- 1381's stale offer of 1382 cleared (1382 now its own answered row on AR-74).
- 92 copied customer notes follow the supplier reply again; 28 offered
  substitutes became `diff_size_sub`; all 47 `diff_size_qty_sub` rows
  renamed. No AR status changed.

Backups: `job_request_items_pre_0130` (kept after 0131) and
`candidates_pre_0130` (drop once 0130 is verified). Verified after apply: 706
lines, 706 `job_lines` rows, no invalid defaults or selections; app and all
four agents running (Rosie's `gws` still fails on its missing credentials
file, as before); Rosie's `job-snapshot 103` and `ar-snapshot 74` read the
new model. 0131 (drop the deprecated line columns) is not applied.

Applied via the Supabase MCP after a rolled-back live rehearsal with
`tests/0129_line_override_promotes_substitute.assert.sql`. Replaces
`sync_job_item_to_candidate` only: when LPS sets a line to Available or
Partial Qty while its selected candidate is not the original, that candidate
becomes `is_original` and the same supplier's previous original on the line
becomes Unavailable (quantity 0, price kept) offering it, so it reads Diff
Sz/Sub. Existing lines are not re-applied; JR-98's Top soil line takes effect
the next time its status is set.

## 0128 — one AR per job and supplier (2026-10-05)

Applied via the Supabase MCP after a rolled-back live rehearsal with
`tests/0128_one_ar_per_job_supplier.assert.sql`. New BEFORE INSERT trigger
`availability_requests_one_per_job_supplier` (`guard_one_ar_per_job_supplier`)
locks the job and refuses a second AR for the same job and supplier, whatever
its status; later asks go onto the existing AR via
`add_candidates_to_availability_request`. Index
`availability_requests_job_supplier_idx`. Existing rows untouched: JR-55's
AR-35/AR-36 (both submitted) predate the rule and are retained. Verified after
apply: trigger and index present, 37 AR headers unchanged.

## 0127 — AR publication and permanent retention (2026-10-02)

Applied with operator psql after rollback-only rehearsals of
`tests/0127_ar_publish_and_retention.assert.sql`. Removed the AR header
`is_active` deletion flag; DELETE/TRUNCATE guards prevent AR removal. All 37
AR headers and 569 associated candidates passed the retention audit. The ten
previously inactive ARs became private Drafts with revoked links; active AR
statuses and public-link settings were preserved. No existing active AR was
published or withdrawn during deployment.

LPS content changes reset published requests to New; Draft edits stay private.
Supplier answer and note submission behavior remains Processing/Completed.
The service-only `edit_availability_request` supports admin preparation in
Draft with the existing answer/substitute validation. Job deletion closes
and retains AR history. The app adds Draft badges and Publish controls,
withdrawal through Draft, and removes all AR Delete actions and the API
handler. App validation: 479 tests, typecheck and production build passed.
Rosie's database-access skill 2.4.1 reads the new schema and its live AR-64
snapshot succeeds. Live admin Draft reads return 200 and supplier reads 404;
the withdrawn API DELETE method returns 405. Both services and all four agents
are running after restart. Rosie's existing Google Workspace plugin remains
failed because `GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE` is missing; the AR
release does not change that integration.

# Migrations applied by Daisy

## 0126 — job line ↔ selected candidate sync (2026-10-01)

Applied via the Supabase MCP after a rolled-back live rehearsal with
`tests/0126_job_line_candidate_sync.assert.sql`. New trigger
`job_request_items_candidate_sync` (`sync_job_item_to_candidate`) writes a
selected line's status, avail, price, size, demand and customer note to the
candidate, then re-applies it; it replaces 0119's note-only
`job_request_items_candidate_note`. `apply_candidate_to_job_item` is now
plpgsql and derives Partial Qty from avail < demand and Diff Sz/Sub only for an
Available/Partial substitute. `guard_candidate_write` lets these LPS edits
through on a closed AR. Existing lines were not re-applied (18 open lines
differ from their candidate). Verified after apply: trigger present, old one
gone, function not executable by anon.

## 0125 — unselect and blank Avail (2026-10-01)

Applied via the Supabase MCP after a rolled-back live rehearsal with
`tests/0125_unselect_and_blank_avail.assert.sql`. `apply_candidate_to_job_item`
leaves the line's Avail blank for an unanswered candidate (`least()` ignored the
NULL and copied the demand); new `unselect_candidate` (service_role only)
clears a line's selection on an open job. Backfill cleared Avail on 53 open
lines (6 jobs) whose selected candidate is unanswered and whose Avail equalled
the demand. Verified after apply: none left, `unselect_candidate` not
executable by anon.

## 0124 — hidden substitute options (2026-09-30)

Applied via the Supabase MCP after rolled-back live rehearsals with
`tests/0124_candidates_hide_from_lps.assert.sql`. Adds
`candidates.hide_from_lps` (default false): substitute options Rosie adds for
the supplier's Unavailable/Sub dialog, off the LPS sourcing page;
`apply_candidate_offer` clears it when a supplier picks one. In
`answer_availability_request` a replaced or cleared tag also leaves the AR
(the app no longer lists substitutes as their own AR rows). Verified after
apply: 0 hidden candidates, 596 active, both functions patched and not
executable by anon. AR-58's existing substitutes (855 typed Sotol, 826 3 G
Opuntia) stay linked to the AR; the app now hides them as rows.

## 0123 — substitute rows on save (2026-09-30)

Applied via the Supabase MCP after a rolled-back live rehearsal with
`tests/0123_substitute_rows_on_save.assert.sql`. A substitute is applied when
the supplier saves: the asked candidate is stored `unavailable` (quantity 0,
price kept) with `offered_candidate_id`, and the substitute becomes its own
Available (or Partial Qty) row on the AR; a typed substitute creates a
raw-named candidate for Rosie to enrich. Replacing a substitute resets a tag or
retires a typed row; submission no longer applies offers. Verified after
apply: new `answer_availability_request`, `apply_submitted_candidates`,
`link_candidate_offer`, `apply_candidate_to_job_item` in place, not executable
by anon; 534 active candidates. The 5 substitute answers saved under 0121
(AR-55, whose job was deleted) keep their 0121 shape (`diff_size_qty_sub`,
price 0); their substitutes are already Available.

## 0122 — status changes keep the price (2026-09-30)

Applied via the Supabase MCP after a rolled-back live rehearsal with
`tests/0122_status_keeps_price.assert.sql`. `answer_availability_request` no
longer zeroes `unit_price` on Unavailable or a substitute answer; only an
explicit `unit_price` changes it. Superseded the same day by 0123's version of
the function, which keeps this rule. Prices zeroed earlier are not restored.

## 0121 — candidate offers and Partial Qty (2026-09-30)

Applied via the Supabase MCP after rolled-back live rehearsals of the full
migration plus `tests/0121_candidate_offers_and_partial_qty.assert.sql` (a
Supabase branch was tried first but can't replay this project's history).
Adds `partial_qty` to candidate, job line and order line statuses; the
candidate offer columns (`offered_candidate_id`, `offer_description`,
`offer_unit_price`, `offer_quantity`); `apply_candidate_offer` and
`link_candidate_offer` (service_role only); computed job line status; Diff
Sz/Sub requires a substitute and `size` is no longer an answer key;
`create_order` refuses an asked candidate that offered a substitute. Shipped
with the matching app change. Verified after apply: 4 offer columns, all three
status checks include `partial_qty`, `create_order` patched, new functions not
executable by anon, 503 active candidates and the 41 older Diff answers
unchanged, no offers yet, AR statuses unchanged (8 submitted, 1 processing,
15 closed).

## 0120 — candidate descriptions and draft ARs (2026-09-29)

Applied via the Supabase MCP after disposable PostgreSQL tests
(`tests/0120_candidate_description_and_draft_ars.*`) and a rolled-back live
rehearsal. Adds `candidates.description` and `is_original`, the `draft` AR
status and `send_availability_request`; new ARs start as drafts and suppliers
see them only after Send. Verified after apply: all 429 candidates described
(size + name), 414 marked original (every asked candidate, plus the first
unasked one on lines never asked; every candidate line has one), no existing AR
changed status (10 submitted, 15 closed, 2 processing, 2 new), status check
includes `draft`, send RPC is service_role only, progress trigger fires on
insert or status change.

## 0119 — job line candidates (2026-09-29)

Applied via the Supabase MCP after disposable PostgreSQL tests
(`tests/0119_job_line_candidates.*`) and two rolled-back live rehearsals.
`availability_request_items` → `candidates` (own `supplier_id`,
`job_request_item_id`, `note_from_supplier`, `note_for_customer`,
`answered_at`; `availability_request_id` nullable; price may be 0);
`availability_request_item_jobs` and `availability_request_jobs` dropped for
`candidates.job_request_item_id` and `availability_requests.job_request_id`
(one AR per job); `selected_availability_request_item_id` →
`selected_candidate_id`. Verified after apply: 388 candidates, 0 without a
supplier, 239 linked to job lines, 98 answered notes moved to
`note_from_supplier`, 17 selections kept, 17 of 29 ARs linked to a job (12
belong to deleted jobs), no function references the old names, grants
service_role only, `candidates` in the realtime publication.

## 0118 — search_inventory precision (2026-09-29)

Applied via the Supabase MCP after testing the body as a session-temporary
function against live data. Before/after on the audit's queries: `salvia
greggii 1 g` 46,761 rows / 3.3 s → 102 / 0.12 s; `yaupon holly 3g` 46,768 /
3.2 s → 168 / 0.2 s; quoted searches ~340 ms → 2–4 ms with identical row sets.
Slowest measured unquoted query afterwards: `red oak 15 g`, 0.46 s. Self-recall
on 50 sampled rows, searched by their own names within their own supplier's
top 10, matched the old function exactly (common 47/50, common + size 50/50,
botanical 27/31; every miss a tie among 14–48 same-name rows). Live body md5
equals the file's; grants unchanged. Adds one 5.8 MB GIN index.

## 0117 — supplier short name (2026-09-29)

Applied via the Supabase MCP. Adds nullable `suppliers.short_name` and sets
Austin Plant Supply (id 1) → `APS`, Local Plant Supply (id 1415) → `LPS`.
Additive only.

## 0116 — job line selected supplier response (2026-09-28)

Applied via the Supabase MCP. Adds nullable
`job_request_items.selected_availability_request_item_id` (FK → AR items,
ON DELETE SET NULL) backing the Job line table's supplier capsules. Additive
only; no existing rows change.


## 0115 — merged audience notes (2026-09-24)

Applied at 15:19:09 UTC after a rolled-back live rehearsal and disposable
PostgreSQL lifecycle tests. PostgreSQL enforces a 250 ms lock wait, 2 second
statement limit and 3 second total transaction limit. The apply verified exact
merged text across 750 job/AR/order rows, all 258 associations, all 1,789 audit
entries, other row data, function/table permissions and trigger states.

Customer origin/destination notes merge into `note_for_customer`; supplier
origin/destination notes merge into `note_for_supplier`, across headers/items.
Distinct nonblank text is retained, exact duplicates collapse, obsolete origin
columns are dropped. `note_internal` stays private on job headers/items. Order
creation now takes one customer-note parameter. Supplier answer RPCs advance
processing explicitly; LPS shared-note-only edits do not.

The reviewed `artifacts/0115_jr77_sourcing_notes_cleanup.sql` then removed
non-sourcing plan/category/spacing text from JR-77's header and 26 items, with
exact-value guards and normal change history. Named substitute requests and
frogfruit flat-unit sourcing requirements remain. A private local recovery
snapshot was saved before apply at `/tmp/merged-notes-before-apply.jsonl`.

> Historical migration record. For the current schema, read
> `knowledge/files/SCHEMA.md` (the shared `docs/supabase-schema.md`).

Applied to Supabase project `xyeyiqchadfszewztnrf` (lps-rosie) via the Supabase MCP.

> Gap: `0028` and `0029` are applied but were never recorded here.

## `0114_public_orders.sql`

Applied 2026-09-23 14:40:01 UTC via psql after a successful rolled-back live
rehearsal. Adds the nullable unique order public token and the guard that clears
it on closure/deactivation and rejects publication without an active supplier.

Both rehearsal and commit verified that all four existing orders retained their
original data, remained private, and kept unchanged table grants. Temporary-row
checks passed for publishing, uniqueness, revocation, fresh-token replacement,
closure, deactivation, and rejection of a missing supplier. A separate connection
verified the committed column, unique constraint, enabled trigger, and behavior.
PostgREST schema reload was notified at commit. This operation did not deploy or
restart the app.

## `0112_drop_order_item_availability_anchor.sql`

Applied 2026-09-23 13:44:00 UTC via psql after a rolled-back live rehearsal.
Removes `order_items.availability_request_item_id` and its dependent index/FK.
Order reads derive related ARs through shared job items and supplier scope.
Creation can still select an AR response transiently, but stores no source
pointer. Supplier limits count active allocations for that supplier/job scope,
including direct orders; all suppliers consume remaining customer demand.
Same-supplier creation is serialized, and job deletion uses the junctions.

Requires `0111_directional_notes.sql`; a preflight guard rejects older schemas.
Both live transactions verified unchanged retained data for 5,202 rows across
12 tables, including all 49 order items and 49 order allocations, plus unchanged
unrelated functions and execution privileges. All populated legacy pointers
were already represented by the junctions. The committed column is absent and
related AR queries succeed.

Disposable PostgreSQL 18 checks pass for two applications, preserved data and
privileges, both creation paths, shared/per-job quantities, cross-supplier
scope, atomic failure, Can Order and shared/exclusive job deletion. The 21
order tests, order-sharing test, typecheck, isolated production build and
instruction validation pass. The partner-order UI test process was terminated
by resource limits. Automatic approval review rejected authenticated API smoke
testing because it would mint a test admin session from the app signing secret;
no such session was used.

The app deployed at 13:34:18 UTC already includes these order-query changes;
its bundled source matches the current implementation. App and harness services
remain active. Rosie uses job-requests 5.27.0 and supplier-coordination 3.24.0.

## `0111_directional_notes.sql`

Applied 2026-09-23 13:34:18 UTC after a rolled-back rehearsal. Renames existing job/AR/order fields to singular author and
recipient names. Orders gain the missing customer fields; order lines gain
separate supplier instructions and a customer-facing field, with no customer-origin field. Existing AR-backed line
notes retain supplier authorship and direct-quote notes retain the customer
audience. Historical text, timestamps and changelog are preserved. No old note
columns or aliases remain on these six tables. Seven note-dependent functions
are updated; order creation retains service-only access under renamed inputs.

Disposable PostgreSQL coverage checks preservation, audit keys, privileges,
public/supplier AR answers, header submission, blank clearing, both order
creation paths and combined line note snapshots.

The committed transaction verified unchanged text and other retained fields for
645 job/AR/order rows, 244 allocations/associations, historical audit records,
function permissions and unrelated functions. Order items have
`note_from_supplier`, `note_for_supplier` and `note_for_customer`, with no
`note_from_customer` or generic `notes` column.

Production build/type checking, 121 affected app tests, nine quote tests,
instruction validation and disposable PostgreSQL checks passed. Live job, AR,
order and supplier API reads returned HTTP 200; supplier order payloads omit
customer-facing notes, and old job-note write keys are rejected. App and
harness services are active; all agents and supplier-events are running.
Rosie's unrelated gws plugin lacks GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE;
pre-deployment logs confirm the same error at 13:19 UTC. Its connection needs
configuration. This does not affect the running supplier-events plugin or the
verified notes paths.

## `0110_job_item_demanded_quantity.sql`

Applied 2026-09-23 11:36:11 UTC via psql in one transaction after a rolled-back
rehearsal. Renames `job_request_items.quantity` to `demanded_quantity` and its
positive-value constraint. PostgreSQL preserves the stored values and generated
`total`; the three order functions now read the renamed field for remaining
demand and job closure. Availability/order allocation and order-line `quantity`
columns keep their existing contracts. Historical changelog JSON is preserved;
new demand edits are logged under `demanded_quantity`.

Rehearsal and apply verified unchanged contents for 2,479 rows across 11
business tables, unchanged unrelated functions and unchanged function privileges.
Disposable PostgreSQL checks covered null/fractional demand, generated totals,
audit keys, both order creation paths, shared demand limits and Won/Lost closure.
Targeted app and quote tests, typecheck, production build and instruction checks
passed. Deployed the compatible app; live job detail/list, order candidates and
availability reads returned HTTP 200, and obsolete/invalid demand edits were
rejected before database writes. Rosie uses job-requests 5.23.1,
supplier-coordination 3.21.1 and quote-generation 3.2.0. Migration 0104 remains
unapplied.

## `0109_ar_soft_delete.sql`

Applied 2026-09-23 at 11:18 UTC via psql in one transaction after a rolled-back
rehearsal. AR deletion now sets `is_active=false` while preserving status,
submission date and public token. Deleted ARs are excluded from app and supplier
access. Removes Hidden, `status_before_close` and `was_public_before_close`;
job reopening leaves ARs closed until explicitly reopened. Whole-job deletion
retires exclusive AR headers and retains their line snapshots; shared ARs and
the durable deleted-job chat cleanup workflow remain supported.

There were no live Hidden requests to convert. Rehearsal and apply verified
unchanged retained data for 2,479 rows across 11 business tables, unchanged
unrelated functions and unchanged execution privileges. Disposable PostgreSQL
checks passed for all four statuses, retained private/public state, blocked
supplier access and writes, explicit reopening, shared jobs and job deletion.

Deployed the matching app with admin Delete actions after the database change.
Targeted AR API, query, UI and prompt checks, typecheck, production build and
instruction validation passed. Three existing desktop job deletion tests still
expect a Delete button in components that no longer render it; they fail before
reaching the updated confirmation text. Rosie's supplier-coordination skill is
3.21.0 and job-requests is 5.23.0. Migration 0104 remains unapplied.

Live admin detail/list, supplier detail/items and order reads returned HTTP 200;
schema and notification-context reads passed, and the new DELETE route rejected
an invalid ID before any write. App and harness services are active.

## `0108_drop_availability_job_anchor.sql`

Applied 2026-09-23 at 10:45 UTC via psql in one transaction after a rolled-back
rehearsal. Removes `availability_requests.job_request_id` and its legacy sync
trigger/function. Every header relationship now uses `availability_request_jobs`.
All 14 populated legacy pointers were already linked, so no live backfill was
needed. Migration backfills suppress new-delivery progress events.

Creation establishes every validated job link atomically before inserting lines;
closure/reopening and whole-job deletion use the junction. Retains `is_active`,
all five statuses, prior-stage restoration and fresh-token reopening. Both
rehearsal and apply verified unchanged data for 2,479 rows across 11 business
tables, unchanged unrelated functions and unchanged execution privileges.

Disposable PostgreSQL checks passed for legacy-only/shared/header-only links,
job closure/reopening, private/public/hidden/inactive requests, failed creation,
line/whole-job deletion, note ownership, order limits and pending migration 0104
applied after column removal. Updated 0104's unapplied backfill to use only the
junction; 0104 remains unapplied on the live database.

Deployed the compatible app before the database change. Four affected app test
files, typecheck, production build and instruction validation passed. Live admin
detail/list, supplier detail/items and order reads returned HTTP 200; read-only
notification-context checks also passed against the new schema. Rosie's
supplier-coordination skill is 3.20.0 and job-requests is 5.22.0.

## `0106_drop_availability_item_job_anchor.sql` and `0107_availability_item_demand_and_notes.sql`

Applied 2026-09-23 at 10:18 UTC via psql in one transaction after a rolled-back
rehearsal. Removes the redundant availability-line job-item hint,
renames the supplier-facing requested total to `demanded_quantity`, and renames
the supplier's line response note to `supplier_notes`. `lps_notes` remains the
additional LPS/Chris instructions shown below the plant name. Per-job allocation
quantities and header job associations retain their current names and behavior.

Updates creation, quantity synchronization, supplier answer processing, order
snapshots and job deletion. Disposable PostgreSQL checks cover relationship
preservation, shared/last-line deletion, null demand, supplier/LPS note ownership,
public answers, hidden requests and order limits. Both the live rehearsal and
the committed transaction verified unchanged contents for 2,479 rows across
11 business tables. All 181 legacy item pointers were already represented
among the 254 availability lines, so no backfill was needed.

Deployed the matching app after ten affected test files, typecheck, production
build and agent-instruction validation passed. Authenticated live admin,
supplier request, supplier item and order reads returned HTTP 200; verified
the renamed fields, preserved notes and admin-only item allocations. Header
reads tolerate the optional display names while migration 0104 remains pending.
Rosie's supplier-coordination skill is 3.19.0 and job-requests is 5.21.0.

## `0105_remove_unused_app_objects.sql`

Applied 2026-09-23 via psql in one transaction after a rolled-back rehearsal.
Removed four unused public tables (`availability_queries`, `chat_sessions`,
`custom_commands`, `users`), the `rate_charts` view, three unused functions
(`execute_readonly_query`, `normalize_identity_token_key`,
`advance_job_on_partner_request`), and both archive schemas
(`backup_20260814`, `backup_20260826`, ten tables total).

Current app/agent references and database dependencies were checked before
removal. Every DROP used RESTRICT. The transaction verified unchanged row
counts for all 22 retained public tables and `auth.users`, and unchanged
bodies/grants for 228 retained public functions, including extension functions.
No local data exports were created, following the user's final instruction.
PostgREST schema reload was notified. Live API checks passed for all 22 table
reads, three search RPC calls and all 26 remaining RPC endpoints; removed
endpoints were absent. The shared reference was checked against 269 columns
and 87 constraints. Typecheck and production build passed. The app test run
passed 53 of 61 files; eight unrelated UI test files failed without app code
changes. Migration 0104 remains unapplied.

## `0103_direct_order_input_alias.sql`

Applied 2026-09-21 at 15:59:34 UTC via psql in one transaction. Repairs the
runtime SQLSTATE 42702 in `create_direct_order`: its job-lock query now reads
`input_line.line` from `jsonb_array_elements(p_items) AS input_line(line)`,
avoiding collision with the PL/pgSQL variable `line`. Updated 0100's source
with the same fix for fresh applications; existing deployments use 0103.

The original ambiguity was reproduced before repair. Both the rolled-back
rehearsal and deployment transaction called the repaired function as
`service_role` against JR 56's seven approved active lines. Verified seven
order lines totaling $1,957, seven allocations, no AR backing, a New delivery
order with null supplier fulfillment date, and the job moving to Committed.
A repeated call was rejected by the remaining-demand guard. All test business
writes were rolled back to a savepoint; fingerprints across twelve tables
matched before commit. Sequence values consumed by the probes were not reset.
Exact function body and restricted execution grants were verified, and the API
exposed the RPC after schema reload. The earlier 0100 checks covered only early
validation failures and did not exercise the job-lock query.

Notified Rosie in `jr-56` via the authenticated webchat endpoint as Codex
(message 9, HTTP 200), preserving Chris's existing authorization for seven
lines including $130 Delivery, the app-set September 22 EDD, and 404 Inwood Rd,
78746. Requested a scoped retry after checking existing allocations, without
an AR workaround. This deployment itself retained no test order.

## `0100_direct_quote_orders.sql`–`0102_job_and_order_line_delete.sql`

Applied 2026-09-21 at 15:51:10 UTC via psql in one transaction to the configured
LPS project. Live inspection found `create_direct_order`, `delete_job_request_item`
and `delete_order_item` missing; `update_partner_order_item` already existed.
Applied 0100 and 0102 and reapplied the idempotent 0101 repair.

A rolled-back rehearsal and the committed transaction verified exact function
bodies, invoker security, fixed search paths, service-role-only execution, and
direct-order rejection of missing customer confirmation or empty items.
Transaction-local fingerprints verified all rows in twelve job, availability,
order and chat tables were unchanged. PostgREST schema reload was notified at
commit; a subsequent live OpenAPI read exposed all four RPCs.
The order logic/API tests passed; the partner order UI test process was killed
by SIGKILL before completion, so that suite is not reported as passing.

No order was created or agent message sent by this deployment. JR 56 had zero
order allocations, status `availability`, and EDD 2026-09-22 at preflight; the
reported customer acceptance instead referred to September 23. The migration
preserved those records and did not reconcile that discrepancy.

## `0099_hidden_availability_requests.sql`

Applied 2026-09-15 via psql in one transaction to the configured LPS project.
Adds Hidden AR status, revokes public links, blocks item writes and supplier
submission under the request lock, and preserves hiding across job closure.
The transaction verified all five previous function definitions against the
reviewed baseline and confirmed every existing AR and AR item row was unchanged.
Disposable PostgreSQL regression checks passed for hidden submissions, notes,
public links, item edits/inserts, job closure/reopening, explicit restoration,
and restricted RPC permissions. App typecheck, production build and targeted
availability tests passed.

## `0098_order_confirmation_optional_method.sql`

Applied 2026-09-15 at 14:28:40 UTC via psql in one transaction to the configured
LPS Supabase project. Supplier confirmation requires a fulfillment date while
pickup/delivery remains optional and managed by Chris.
Replaces `update_partner_order` without changing data, lifecycle transitions,
supplier scope, active/closed-order guards, note validation, locks, or RPC grants.
The API restricts method updates to admin; the service-role RPC accepts a valid
method or an explicit null and preserves the existing method when omitted.

Disposable PostgreSQL 18.6 tests passed using the production 0092–0096 fixture
chain. Checked date-only confirmation and Ready with no method, preservation and
clearing of existing methods, missing-date errors and rollback, scope/closure
guards, service-role-only permissions, and repeat application with saved dates
and notes. The migration preserved all rows in ten related business tables.
The live transaction verified the existing function matched the reviewed version,
all order fields were preserved, and the new function and service-role-only
permissions matched the migration. PostgREST schema reload was notified at commit.

## `0097_job_delete_dependents.sql`

Applied 2026-09-15 at 14:23:32 UTC via psql in one transaction to the configured
LPS Supabase project. Job deletion now removes exclusive orders and ARs along
with the canonical Rosie transcript; records shared with other jobs survive.
Permanent thread markers prevent recreation and queue harness-session cleanup.

Transaction-local fingerprints verified that all existing rows in the twelve
job, availability, order and chat tables were unchanged. PostgREST schema reload
was notified at commit. No historical orphan records were deleted.

App and harness deployed through `scripts/server.sh restart` at 14:26 UTC.
Both services, all four agents, and all webchat plugins started successfully;
local and public login pages returned HTTP 200. Daisy and Rosie gws plugins
remain unavailable because their Google OAuth credentials are not configured.

## `0096_order_supplier_confirmation_note.sql`

Applied 2026-09-15 at 13:36:08 UTC via psql in one transaction to the configured
LPS Supabase project. Adds nullable `orders.supplier_notes`, separate from Chris's
instructions, and saves it atomically through the scoped lifecycle RPC with the
supplier's fulfillment date and confirmation status. Customer EDD stays on jobs
and availability requests; fulfillment date belongs only to orders.

The transaction checked that the existing order retained every previous field
exactly, including its status, dates and update timestamp. Verified nullable text
storage and service-role-only RPC grants. Read-only REST verified the new schema.
Disposable PostgreSQL tests covered confirmation, rollback, note clearing,
access, closed orders and repeat application, including saved note preservation.
App deployment remains separate.

## `0094_partner_order_lifecycle.sql` and `0095_availability_supplier_note.sql`

Applied 2026-09-15 at 13:20:42 UTC via psql in one transaction to the configured
LPS Supabase project. The existing Committed order moved to New; future orders
default to New. Partner confirmation requires pickup/delivery method and fulfillment date,
then orders advance from Processing to Order Ready. Added nullable request-wide
supplier notes and guarded supplier/public submission routines.

Transaction-local fingerprints verified preservation of the one order's other
fields (apart from its update timestamp), 13 order lines, 13 order allocations,
13 jobs, 153 job lines, 732 job audit entries, 15 availability requests,
154 availability lines, 10 request/job links and 97 availability line/job links.
No supplier notes were fabricated. Verified the order CHECK/default, all five
changed/new RPCs' service-role-only grants, and unchanged job stages. PostgREST
schema reload was notified at commit; live read-only REST schema checks passed.
Both migrations passed disposable PostgreSQL tests before application; 0094
also passed repeat-application checks. App deployment/restart was not part of this step.

## `0093_remove_job_confirmed_status.sql`

Applied 2026-09-15 at 09:44 UTC via psql in one transaction to the configured
LPS Supabase project. Removes Confirmed only from Job Request statuses;
supplier confirmation leaves jobs Committed. Orders retain Confirmed and their
confirmation dates. Existing `supplier_confirmed` events remain accepted without
changing the job stage. No live jobs required conversion.

Verified all 13 jobs, 156 job lines, 13 availability requests, 121 availability
lines, 10 request/job links, 101 line/job links and 689 job audit entries retained
their exact row fingerprints. All three Order tables remain empty and unchanged.
The job CHECK excludes Confirmed; the Orders CHECK, `confirm_order`, `close_order`
and service-role-only RPC permissions are unchanged. PostgREST schema reload was
notified in the transaction. Disposable PostgreSQL tests apply 0093 twice and
cover conversion/audit history, preserved Confirmed Orders, supplier confirmation,
combined jobs, split orders and partial/final closure. App deployment and a
production harness restart were not part of this step.

## `0092_job_orders_workflow.sql`

Applied 2026-09-14 at 11:35 UTC via psql in one transaction to the configured
LPS Supabase project. Adds the Orders tables, job install/fulfillment fields,
order confirmation/fulfillment dates, and many-to-many availability and order
allocations. Quote is the new job default; customer commitment and supplier
confirmation are separate stages. No current jobs required the historical
Active-to-Quote or Confirmed-to-Committed conversion.

Verified all 13 jobs, 151 job lines, 12 availability requests and 101 availability
lines were preserved; source-record fingerprints and job states matched before
and after. Backfilled 12 request/job links and 100 line/job links with no missing
or changed source allocations. New order tables are empty. Verified all five new
tables' RLS, service-role access and Realtime membership; all five workflow RPCs
remain executable only by service_role, and all eight new triggers are enabled.
PostgREST schema reload completed and read-only API checks returned HTTP 200 for
the new tables and date fields. App deployment/restart was not part of this step.

## `0091_job_realtime.sql`

Applied 2026-09-11 via psql in one transaction. Adds `job_requests`,
`job_request_items`, `availability_requests`, `availability_request_items`,
`customers` and `suppliers` to the existing `supabase_realtime` publication.
The app's server-only relay sends data-free job invalidations to internal
sessions. No business records, RLS policies, replica identities or triggers
change. Verified all six live publication members and their unchanged RLS and
replica identity settings. Disposable PostgreSQL tests apply the migration
twice and assert membership, idempotence, existing data and access rules.

## `0090_customer_type.sql`

Applied 2026-09-11 via psql in one transaction. Adds nullable `customers.type`
with no default and a CHECK allowing exactly `Homeowner/Retail` or
`Landscape Professional`. All nine existing customers remain NULL. Verified
the live column, constraint and null counts; refreshed the PostgREST schema
cache. Disposable PostgreSQL tests cover both values, omitted/cleared type,
invalid insert/update rejection and preservation of existing customer data.

## `0089_job_order_statuses.sql`

Applied 2026-09-11 via psql in one transaction. The selectable Job Request
stages are Active (`sourcing`), Quote (`quoted`), Availability (`availability`),
Confirmed, Won (`closed_won`) and Lost (`closed_lost`). Restores Availability
in the CHECK and updates the 0088 workflow function: pricing/quote work
advances Active to Quote, delivered availability advances Active/Quote to
Availability, and explicit customer confirmation advances any of those stages
to Confirmed. Repeated events never regress Availability/Confirmed or reopen
terminal/inactive jobs. No existing records were rewritten; all 11 jobs kept
their stored statuses. Verified the live CHECK, function and service-role-only
execution grants. Disposable database tests cover transitions and AR closure/reopening.

## `0084_job_status_simplification.sql`

Applied 2026-09-10 via psql in one transaction. The selectable lifecycle is
New (`sourcing`), In Progress (`quoted`), Confirmed, Closed Won and Closed Lost.
The migration consolidates `availability` into `quoted` through the existing
audit trigger and removes `availability` from the CHECK. No live rows needed
conversion; all 11 jobs and 133 plant rows retained their prior stored status
distributions. Archived stays readable legacy history. Supplier requests
remain open through the three working stages and close on terminal status or
deactivation. Verified the CHECK and closure function after applying.

## `0083_request_status_lists.sql`

Applied 2026-09-10 via psql in one transaction. Extends the Job Request CHECK
with `availability` and `confirmed`, and job plant CHECK with `need_to_order`
and `arriving_soon`. Existing stored values, defaults, notes and history stay
unchanged; archived is retained for legacy records. Labels/order are shared
by the app's pickers, filters, summaries and print views. Availability Pending
persists NULL and retains quantity, price and notes. Updated
`close_ar_on_job_status_change` to close/revoke only for terminal or inactive
jobs, allowing supplier work throughout the four working sales stages.
Verified both constraints and the closure function after applying; all 11 job
and 133 plant rows retained their prior status distribution. Regression SQL
covers the working/terminal transitions, Pending, defaults and legacy records.

## `0082_public_availability_requests.sql`

Applied 2026-09-10 via psql in one transaction to the configured LPS Supabase
project. Adds the nullable unique `availability_requests.public_token`, the
`guard_ar_public_link` and `close_ar_on_job_status_change` triggers, and the
service-role-only `answer_public_availability` function. Verified the UUID
column, both enabled triggers, all three functions, and execution permissions
(anon/authenticated denied, service_role allowed). All nine existing requests
remained private. No historical job-status backfill was performed.

## `0080_threads_closed_at.sql`

Applied 2026-08-26 (Bhoumik), after 0079. `threads.closed_at` plus the
`job_requests_close_thread` trigger: a job going `closed_won` / `closed_lost`
/ `archived` (or inactive) closes its thread; coming back reopens it. The
transcript stays; the app hides closed threads from the picker and the bell.
Backfilled from the jobs already closed.

## `0079_job_request_delete_drops_thread.sql`

Applied 2026-08-26 (Bhoumik), minutes after 0078. AFTER DELETE on
`job_requests` deletes the job's `threads` row, and the transcript cascades.
Supplier and customer threads are never deleted this way.

## `0078_threads_and_thread_messages.sql`

Applied 2026-08-26 (Bhoumik). The web-chat store: `threads` (one per (agent,
thread id) — read cursors, working indicator, newest-message preview) and
`thread_messages` (the transcript, `seq` per thread). Derived `*_thread_ref`
FKs on `suppliers` (rosie + daisy), `customers` and `job_requests`,
maintained by `link_thread()` triggers off the existing text `*_thread_id`
columns (job requests: `jr-<id>` on insert). `log_job_request_changes()`
re-created to exclude the derived column. Backfill linked every minted id
(2,677 thread rows) with `updated_at` and changelog triggers disabled; RLS on,
no policies; both tables added to the `supabase_realtime` publication. The
existing JSONL transcripts were then imported by a one-shot script (22
threads, ~640 messages, cursors preserved) — no migration file, see
CHANGELOG.

## `0077_ar_item_mapped_inventory.sql`

Applied 2026-08-26 (Bhoumik), the same day as 0075/0076. Adds
`availability_request_items.mapped_inventory_id` — a nullable
`uuid → inventory.id`, ON DELETE SET NULL, with a partial index over the
non-null rows. **The mapping existed already; only as prose.** The jr thread
named the inventory row its look-up found at that supplier, the supplier thread
seeded `unit_price` off it, and the row itself was never written down — so a
seeded price could not be traced to what it was seeded from. **No backfill**:
the mapping was never stored, and the existing lines' prose lives in thread
transcripts rather than anywhere a query could reach; every existing row is
NULL, which is also what an unmapped line means going forward. Nothing renders
it yet — deliberately outside `AR_ITEM_COLUMNS` and the portal PATCH whitelist.

## `0076_ar_item_status_diff_size_qty_sub.sql`

Applied 2026-08-26 (Bhoumik), immediately after 0075. Renames the supplier's
`substitute` answer to **`diff_size_qty_sub`** — the value, not only its label.
The answer was never only "a different plant": it is what a supplier reaches
for when what they have differs from the ask in size, quantity *or* identity,
and `substitute` named a third of that. 1 of 13 answered lines carried the old
value. The CHECK is dropped, the row rewritten and the CHECK re-added in one
statement, so nothing is ever outside it.

## `0075_availability_status_vocabulary.sql`

Applied 2026-08-26 (Bhoumik), for the supplier portal's restructure. Three
things:

- `availability_requests.status` gains **`processing`** — the supplier has
  started answering but has not submitted. The portal's four tabs are
  All / New / Processing / Submitted, and the app moves a request to
  `processing` on any line write that comes *from the portal* (an admin
  entering answers on the supplier's behalf does not).
- `availability_request_items.status` gains **`arriving_soon`** (when, in
  `notes`).
- `availability_request_items` gets an AFTER INSERT trigger,
  `availability_request_items_reopen`, which puts its request back to `new`
  when the request was `processing` or `submitted`. **Adding a line to a
  request the supplier already worked on is a new question**, and it must land
  in their New tab whoever added it — the app or one of rosie's scripts —
  which is why this is a trigger and not app code. `closed` is deliberately
  left alone: closing is a terminal admin act, and re-opening one should be
  just as deliberate. `submitted_at` is untouched, so the portal's button
  still reads **Re-Submit** on a request that has been answered before.

## `0074_rename_is_onboarded_to_is_lps_partner.sql`

Applied 2026-08-25 (Bhoumik). Renames `suppliers.is_onboarded` →
`suppliers.is_lps_partner` and re-comments it, so the column carries the name
every prompt, skill and screen already used out loud — **LPS Partner**. The old
name also collided with daisy's sense of *onboarding* a supplier into the
database, which is a different thing entirely and happens to suppliers who
never become partners. Nothing but app code referenced the column (no view,
policy, index, constraint or other function), and 1 of 1,396 rows is TRUE.

The same step drops and recreates `search_suppliers` so its fixed return type
projects `is_lps_partner`. That is what lets Supplier Search filter on the flag
in SQL over the whole match set; the page previously read it in a second
`suppliers` query, which is enough to draw the LPS tag on a row but not to
filter one out. Body otherwise unchanged; EXECUTE re-granted after the drop.

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

## `0081_quoted_literal_substring_plant_search.sql`

Applied 2026-08-29. The authorized query wrapper ran the unchanged functional
transaction (`BEGIN`, timeout, `CREATE OR REPLACE FUNCTION`, `COMMIT`); its guard
blocked only the ancillary function comment and PostgREST schema-cache notify.
The signature was unchanged, so the function was immediately callable.
Replaces only the quoted branch of the existing two-argument
`search_inventory` RPC. A fully double-quoted query now uses one escaped `ILIKE
'%…%'` pattern over composed/common/botanical/cultivar identity only; size and
notes cannot qualify. It is case-insensitive but otherwise literal: no
normalization, alias expansion, token partials, spelling variation, or fuzzy matching; SQL wildcard
and escape characters are escaped. All hits have relevance 1 and use recency,
then name, as tie-breakers. Empty quoted input returns nothing; one-sided quotes
retain broad discovery. The unquoted 0057 body is unchanged. The 0057
`normalize_identity_token_key` helper remains present but is no longer called.
No table data, helper, index, signature, or return type changes.

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
