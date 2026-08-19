# plant-and-supplier-search — changelog

## 1.1.2

2026-08-18. **Description rewritten short** — coverage in a clause or two, then
when to use it, keeping what makes rosie's copy hers (Austin-Plant-Supply
scoping, the read-only framing). No change to the procedure.

## 1.1.1

2026-08-18. Findings go into a job-request item's `sourcing_notes` — the column
`internal_notes` was renamed to by migration 0061.

## 1.1.0

2026-08-18. Austin Plant Supply (`suppliers.id = 1`) is now the default source
for job-request sourcing (`job-requests` §5), so §1 gains the scoped look-up:
filter `search_inventory`'s result to supplier 1, read the whole size range
that comes back — the closest thing they carry is what gets recommended when
they don't have the ask — and widen past them only on the ladder's terms.

Corrected in the same pass, because the new example rests on it: the RPC takes
only `search` and `fuzzy_ratio`. It has no `supplier_ids` parameter; scoping
and sorting are the caller's, applied as SQL over the result.

## 1.0.0

2026-08-17. Adapted from daisy's `plant-and-supplier-search` v1.6.0 for the
rosie agent: same RPCs, ranking model and answering guidance, plus the
read-only framing — these are daisy's tables; findings go into job-request
`internal_notes` and data problems are reported to daisy rather than fixed.
Track daisy's copy for search-behaviour changes (they ship with migrations) and
fold them in here on approval.
