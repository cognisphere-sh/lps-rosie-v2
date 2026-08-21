# supplier-onboarding — changelog

## 1.2.0

2026-08-20 — Chris-approved category guidance now classifies a supplier location
by evidenced primary operating model and customer reach. It defines `Grower`,
`Nursery`, `Wholesaler`, and evidence-only `Other`; requires multiple consistent
facts; forbids name/single-clue inference; preserves null for uncertainty and
one-row-per-location/head-branch behavior. The onboarding report and QA now
carry the category rationale.

## 1.1.2

2026-08-18. **Description rewritten short** — coverage in a clause or two, then
when to use it, instead of a column-by-column restatement of the procedure.
No change to the procedure.

## 1.1.1

2026-08-16 — §3's gallery bullet restated under the rule in
`availability-ingestion` 1.2.0: not just "don't catalogue one" but **never
download one**. An image on a supplier's page stays there and what we keep is
the link. The report block already carried the URL and is unchanged.

## 1.1.0

2026-08-16, with `availability-ingestion` 1.1.0 — §3's browser pass now says
what to do about the photographs on a supplier's site: **note the gallery's URL
in the report, don't catalogue it.** Cataloguing is `plant-photo-catalogue`'s
write and harvesting a gallery is scheduled work with Chris's say-so, so
onboarding stays the skill that parses no plant row. The Enrichment block in the
report carries the URL, which is how such a pass gets scheduled at all. A photo
on the *availability page* of a drop being ingested is a different case and
stays where it happens, in `availability-ingestion` §6.

## 1.0.0

Split out of `supplier-onboarding-and-ingestion`, which combined two procedures
that ran at different times, for different reasons, against different tables.
This skill keeps the supplier-side half — `suppliers`, `contacts` and
`supplier_contacts`; the inventory-side half is now the
**`availability-ingestion`** skill. No rule about onboarding, enrichment or
contact linking changed in the move.

- **What came here**: old §0.2 (confirming a supplier is genuinely new before
  inserting, the `suppliers` row, `head_branch_id` for a new location of a known
  company, browser enrichment, availability newsletter signup, the
  `availability_source_type` / `hosted_availability_url` /
  `availability_update_days` columns) and old §0.3 (`contacts` rows, the
  `supplier_contacts` link per location a person actually covers, `is_primary`,
  retiring versus deleting), plus the contact-link QA check from old §5 and the
  *Onboarding* part of the report contract.
- **Location resolution is shared, and the halves are split by act.** The
  "resolve a farm name against the company's sister locations before concluding
  it is new" rule appears here as §1, because it is the guard on an INSERT.
  `availability-ingestion` §0 keeps the mapping question — which parsed row goes
  to which location — and calls this skill only when a location genuinely has no
  row.
- **The two skills call each other.** `availability-ingestion` §0 follows this
  skill when a drop's sender matches no supplier, or names a farm with no row,
  and comes back with the id. In the other direction, *When you are here* points
  there when a supplier onboarded here arrived with availability to ingest —
  no plant row is parsed in this skill.
- **Reporting depends on how you were reached.** Dispatched from
  `availability-ingestion`, the report is its *Onboarding* block, folded into one
  report for the main agent. Dispatched directly, it is a standalone report with
  its own follow-ups, flags and learnings.

Prior history — the approval record for rules still in force here, including the
2026-08-05 cleanup that lifted 29 people out of `suppliers.notes` and migration
0036's contact de-duplication — is kept in
`availability-ingestion/CHANGELOG.md` under *Prior history*.
