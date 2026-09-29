# Is it really new?

The router or the ingest already searched; be the second check, not a
repeat. One `search_suppliers` call with the name and the sender's domain.

- A hit → stop and use it. Several hits for one company are usually its
  locations: one `suppliers` row per site, tied by `head_branch_id` (a head
  branch and a single-site supplier point at themselves).
- Name differences like `LLC` vs `Inc`, `&` vs `and`, punctuation → the same
  company. (Bhoumik, 2026-08-05.)
- A location that "isn't there" is usually a spelling (`Ft Pierce`, `Bunnell
  Farm`, `Loc 3`, a farm code). Compare city and state with the company's
  locations (`availability-ingestion/scripts/ingest-context --supplier <id>`)
  and read their locations page. A duplicate location splits a farm's stock
  across two ids for good.
- Could be either → ask Chris; don't create it.
- Sites the database lacks, or two rows that look like one company → report
  under *Flags for Chris* with the evidence. Which row is the head branch is
  Chris's call.

Read the schema for `suppliers`, `contacts`, `supplier_contacts` through
`database-access`, and the supplier's `suppliers.notes` (plus any legacy
`workspace/suppliers/[<id>]:<Name>/notes.md`, read-only: move anything durable
into `suppliers.notes`).
