# database-access — changelog

## 2.10.1 — 2026-10-21

- Migration 0152: data-model.md notes that `select_candidate` unhides a hidden candidate it selects.

## 2.10.0 — 2026-10-21

- Migration 0151: `orders.additional_details` is jsonb (a `{"field", "value"}` list). set-note validates the file as that list, guards with a JSON comparison and refuses `--append-file` for it.

## 2.9.0 — 2026-10-21

- Migration 0150: data-model.md lists `orders.change_log`; set-note writes it.

## 2.8.0 — 2026-10-21

- Migration 0149: data-model.md — orders have `additional_details` (renamed from `note_for_supplier`) and no customer note, pickup/delivery or date; set-note writes `orders.additional_details` and `order_items.note_for_supplier`; job-snapshot no longer reads the dropped order method/date.

## 2.7.1 — 2026-10-19

- data-model.md: `rosie_thread_id` is a party's shared conversation; `thread_messages.job_request_id` tags a message's job (migration 0147).

## 2.7.0 — 2026-10-16

- Migration 0146: data-model.md describes one job per order, one row per candidate and `note_from_supplier`; job-snapshot reads order rows through `orders.job_request_id` (item = the row's candidate's job line) and shows each row's quantity and supplier reply.

## 2.6.1 — 2026-10-16

- Migration 0144: editing a job line's `name` or `size` never changes a candidate, not even an unasked default (its price is for its own plant and size). data-model.md says to update and reprice the default explicitly when it should match the new ask.
- Migration 0145: `update_job_line` refuses `size` and `name`. A line's are edited on `job_request_items`, a candidate's on the candidate; data-model.md no longer lists them as `update_job_line` keys.

## 2.6.0 — 2026-10-15

- Migration 0143: `job_lines.unit_price` and `total` read the candidate's price as stored (NULL = not priced, 0 = $0); the default is created unpriced. job-snapshot shows a $0 candidate as `$0.00` with its status (No price only for NULL); data-model.md says so.

## 2.5.3 — 2026-10-15

- Migration 0139: `candidates.demanded_quantity` is dropped and job-less ARs are gone; every candidate has a job line and every AR a job. ar-snapshot's `qty` is the line's demand only.

## 2.5.2 — 2026-10-15

- Migration 0137: `job_lines.candidate_status` (the selected candidate's status as stored) replaces the derived `status`, which 0138 drops. job-snapshot reads it (same output: NULL → pending, can_order → need_to_order); data-model.md says a candidate reads Diff Sz/Sub only when its status is `diff_size_sub`.

## 2.5.1 — 2026-10-15

- Migration 0136: demand lives on the job line; candidates on a line carry none (only a job-less AR's keep theirs). A line Qty change re-checks Available / Partial Qty. ar-snapshot's `qty` reads the line's demand.

## 2.5.0 — 2026-10-14

- Migration 0134: a line status other than Partial Qty, Unavailable or Pending set through `update_job_line` without a quantity fills it with the demand.
- Migration 0130 (Bhoumik 2026-10-13/14): job-snapshot reads `job_lines` (default/selected, requested size, effective customer note) and shows each candidate's sub, sub for and note override; ar-snapshot shows each row's sub (typed) and sub for; set-note writes a line's `note_for_customer` to its selected candidate's override (`--clear` = follow the supplier); data-model covers defaults, the view, `update_job_line`, explicit reopen and the `diff_size_sub` rename. Migration 0132: back to pending clears the quantity; submission also hides the supplier's unasked alternatives on the AR's lines. Migration 0133: `update_job_line` also takes `size` / `name` (the size and name the line shows); a generated or size-prefixed description follows, also on an unasked default.

## 2.4.4 — 2026-10-05

- data-model.md: setting a selected substitute's line to Available or Partial Qty makes it the original; the supplier's previous original reads Diff Sz/Sub (0129).

## 2.4.3 — 2026-10-05

- data-model.md: `hide_from_lps` options appear in the supplier's Diff Sz/Sub dialog (renamed from Unavailable/Sub, 2026-10-05).

## 2.4.2 — 2026-10-05

- data-model.md: one AR per job **and supplier** (0128 insert guard).

## 2.4.1

- AR snapshots no longer read the removed header `is_active` flag (0127). ARs are retained permanently; Draft controls supplier visibility.

## 2.4.0 — 2026-09-30

- `candidates.hide_from_lps` (0124) in the data model; `job-snapshot` marks such candidates `(hidden sub option)`. Substitutes are not listed as their own AR rows in the app.

## 2.3.0 — 2026-09-30

- Migration 0123 (Bhoumik 2026-09-30): a substitute is applied when the supplier saves: the asked candidate becomes Unavailable (`offered_candidate_id` set) and the substitute its own Available row on the AR; a typed substitute is created as a raw-named candidate that Rosie enriches after submission (name/size split, description, customer note, price if missing).

## 2.2.1 — 2026-09-30

- Migration 0122 (Bhoumik 2026-09-30): a status never changes a candidate's price; Unavailable (and a substitute answer) sets only the quantity to 0.

## 2.2.0 — 2026-09-30

- Migration 0121: candidate offer columns, `partial_qty`, computed job line status and `link_candidate_offer` in the data model.

## 2.1.0 — 2026-09-29

Migration 0119 (candidates): `job-snapshot` lists each line's candidates (supplier short name, derived status Pending / AR sent / answer, price 0 shown as "price not found", customer/ask/reply notes) and the selected candidate; `ar-snapshot` reads lines from `candidates` with their job line and selection; `set-note` writes `candidates.note_for_supplier`/`note_for_customer` instead of `availability_request_items`. data-model.md describes candidates, `select_candidate`/`delete_candidate` and the submit re-apply; supplier facts no longer go in `note_internal`. One AR per job: `ar-snapshot` reads the job from `availability_requests.job_request_id` (`availability_request_jobs` dropped).
Migration 0120: snapshots show each candidate's `description` and original flag, and AR `draft` status; data-model.md lists `description`, `is_original` and the draft → new AR flow.
Derived candidate status in `job-snapshot`: No price (unanswered, price 0/NULL) → Pending (priced; no AR or only an unsent draft) → AR sent → the answer.
data-model.md: `note_internal` holds the customer's requirements; `note_for_customer` is only customer information.

## 2.0.1 — 2026-09-29

`scripts/schema` suggests close topic names for an unknown one (`sources` →
`inventory_sources`). Shared byte-for-byte with Daisy's copy; no procedure
change.

## 2.0.0 — 2026-09-28

- Rewrite. New helpers: `job-snapshot`, `ar-snapshot`, `set-note` (guarded note writes from files), shared `_db.py`, offline tests. Data-model map added (from the removed `1.1-supabase.md` prompt and job-requests writes). SQL rules: no `DO` (use WHERE NOT EXISTS), typed NULLs, common wrong columns.

## 1.2.0

- Merge customer requirements/outcomes into `note_for_customer` and supplier instructions/responses into `note_for_supplier` across headers and items. Preserve current sourcing constraints, exclude spacing and unrelated non-sourcing content, and use the new schema/RPC contract.

## 1.1.0 — 2026-09-24

- Use file/stdin SQL for literal currency and text; require current schema topics and bounded column/transcript reads to avoid shell failures and stale-column retries.

## 1.0.0

- Add targeted table/RPC schema selection and move database command reference out of always-loaded prompts.
