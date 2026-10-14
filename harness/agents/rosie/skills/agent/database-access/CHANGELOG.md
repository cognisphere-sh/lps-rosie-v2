# database-access — changelog

## 2.5.0 — 2026-10-14

- Migration 0130 (Bhoumik 2026-10-13/14): job-snapshot reads `job_lines` (default/selected, requested size, effective customer note) and shows each candidate's sub, sub for and note override; ar-snapshot shows each row's sub (typed) and sub for; set-note writes a line's `note_for_customer` to its selected candidate's override (`--clear` = follow the supplier); data-model covers defaults, the view, `update_job_line`, explicit reopen and the `diff_size_sub` rename.

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
