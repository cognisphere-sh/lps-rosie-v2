# Locations — which farm does each row belong to?

A company with several sites is several `suppliers` rows (one per location)
linked by `head_branch_id`; a single-site supplier points at itself. One file
can cover several farms, so **each offering** gets its own `supplier_id`.
Decide this before parsing. `scripts/ingest-context` lists the company's
active locations.

## Rules, most specific first

| The source says | Rows go to |
|---|---|
| A location per row or column ("Farm", "Ship from", "Grown at") | The location on that row. |
| A location per tab, page or section | That section's location. Tabs with no plants (`Terms`, `Legend`, `Price Key`, hidden or empty) are not locations; list the skipped tabs in the report. |
| One location for the whole file | That location only. |
| **No location anywhere** in the whole source and body | **Every active location** of the company gets its own copy of every offering (Everde with 5 locations → 5 copies, each with its own source row). |

A supplier-specific instruction in `suppliers.notes` wins over this table
(Chris 2026-09-16, confirmed 2026-09-29: "treat Cherrylake like one
supplier" → one location only).

- Survey every page before assigning any: a farm named on page 6 means the
  file is not "no location". Never report both "all locations" and specific
  farms for the same offering.
- A name that matches no row is usually a spelling (`Ft Pierce`, `Bunnell
  Farm`, `Loc 3`, a farm code). Match on city and state, and check the
  company's locations page, before deciding it is new.
- Truly new site → create it with `supplier-onboarding` (same
  `head_branch_id`) and come back with its id. Could be either → ask; don't
  create it.
- Never pick a location from the sender's address or the file name.
- Unclear mapping (unknown name, two possible matches, some rows labelled and
  some not) → park those rows and escalate. Don't fall back to "all
  locations"; that is a different claim.
- Sites the database doesn't have, or two rows that look like one company →
  report under *Flags for Chris*; don't link them yourself.
- New people, phones or a rep who left → `supplier-onboarding` (contacts).

Report counts per location. One total hides a location that got nothing.
