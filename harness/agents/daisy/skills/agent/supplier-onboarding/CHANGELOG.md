# supplier-onboarding — changelog

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
