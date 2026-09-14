# plant-and-supplier-search — changelog

## 2.5.0

2026-09-11 — Research all requested sizes and choose the smallest with supported
pricing, not the cheapest or assumed in-stock option, per Chris. Return larger
requested-size prices for shared notes; preserve gaps and unrequested-size gates.

## 2.4.0

2026-09-11 — Add Chris-authorized likely-name-equivalence pricing procedure,
evidence checks and concise sourcing mapping. Explicitly permit his Agave
parryi truncata / Artichoke Parry’s Agave / Agave Parryi pricing example without
claiming botanical identity or availability. Preserve genuine-substitution gates.

## 2.3.0

2026-09-11 — Implement Chris-authorized APS job-row evidence and gap-alternative
research: 1–2 closest supported options, no invented candidates or unauthorized
supplier expansion. Route mandatory APS row notes to the job owner and require
action-specific confirmation before alternative quotes/ARs; standalone and
research-only supplier lookups remain chat-only.

## 2.2.0

2026-09-11 — Include explicit supplier selections and other plant-sourcing
decisions in the note-eligibility rule. Research alone remains chat-only.

## 2.1.0

2026-09-11 — Answer supplier lookups in Chris's original chat first, including
existing-job searches. Research alone creates no sourcing notes or outreach;
apply the job skill's sent-request, required-action or explicit-note rule.

## 2.0.0

2026-09-10 — Focus on pricing evidence and exact matches; APS is default and broader sourcing requires instruction. Remove duplicated job/approval policy.

## 1.2.1

2026-08-29, Bhoumik-approved correction before migration 0081 is applied.
Quoted literal matching is identity-only: composed/common/botanical/cultivar
name can qualify, while size-only and notes-only hits cannot. This keeps the
availability-request price seeder from accepting an unrelated row merely
because its public notes repeat the requested phrase.

## 1.2.0

2026-08-29, with migration 0081. Adds quoted literal plant search: one
outer pair of straight double quotes selects a case-insensitive, escaped literal
substring over identity fields, size, and public notes, bypassing aliases,
normalization, token/spelling variation, and fuzzy matching. Clarifies that this
contract belongs only to `search_inventory`; broad discovery remains the
default and is unchanged.

## 1.1.4

2026-08-24 (harness 0.10.1). Description rephrased to the tightened spec —
"what's included" is a brief sketch rather than an exhaustive contents list,
and partial applicability moved under "use when". No procedural change.

## 1.1.3

2026-08-19, alongside `job-requests` 1.14.0. **A search answers price, not
availability** — every row is a line off a published price list and its
`quantity` is what that sheet claimed on ingest day, so a hit is reported as a
listing and never as availability. The description drops "availability
question" for "sourcing question" for the same reason.

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
