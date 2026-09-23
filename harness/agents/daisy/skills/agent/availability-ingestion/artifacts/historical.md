## Historical backfill: exact-farm later-date check

**Applies only when the brief explicitly says historical/backfill (the
email/backlog path).** It is a simple read-only skip check, not a gate: do not
run `historical-backfill-gate`, collect company-wide authority evidence, batch
parsed offerings, or revalidate before commit. An old/non-ISO date printed on a
Chris/Bhoumik manual handoff does not itself make it historical; use *Manual
current-receipt intake* instead.

1. Resolve the actual farm(s) from [locations](locations.md) to active numeric `supplier_id`s. A
company/head id, sender, or sister location is **not** a farm proxy. If a target
farm is unresolved/ambiguous, or the incoming availability effective/received
instant cannot be identified as an ISO timestamp, stop safely and report the
blocker; do not guess a date or farm.
2. For each resolved farm, identify the incoming source's effective date when it
states one; otherwise use its received timestamp supplied in the brief. Record
which was used and the source evidence. Then cheaply check that **same numeric
supplier id** for a later availability/list source date. `inventory_sources`
`created_at` is the durable received/ingested timestamp to query where it
represents the source receipt; use a separately quoted effective/list date when
one is recorded in source evidence. Never fan this check out through
`head_branch_id`.

```sql
SELECT id, supplier_id, created_at, file_path, notes
FROM inventory_sources
WHERE supplier_id = <exact_farm_id>
  AND is_active
  AND created_at > '<incoming ISO timestamp>'::timestamptz
ORDER BY created_at DESC;
```

3. If **any** later availability/list source date is found for that exact farm,
`SKIP` that farm's incoming offerings: make no source, inventory, alias, photo,
contact, onboarding, or upload write for that farm. Preserve concise durable
evidence in the task report/notes: incoming date and basis, farm id, later source
id/date/path, and `Skipped — later availability already exists for this farm`.
A later source for Purtis's company (one farm) skips Purtis; a later Everde source
for one farm skips only that farm, not Mill Creek, Escondido, or any other sister.
4. If no later source date exists for the exact farm, ingest that farm normally
under the acquisition-through-photo steps in this skill and normal source matching/QA. A mixed multi-farm drop may therefore
skip some farms and ingest the others. No provenance-only workaround is needed
for a skipped farm. Never retire inventory or sources as part of either outcome.

The retired `scripts/historical-backfill-gate` remains on disk only for old
records; it is not an operational path for new work.

**Regression examples.** Purtis supplier 24 is one farm: a later Purtis list
skips an older Purtis list. Everde is farm-by-farm: a later Mill Creek (1231)
source skips only Mill Creek, never Escondido (1395) or another sister farm
without a later date. A partial or earlier source never skips the incoming list;
only a strictly later availability/list date at the same numeric farm does.
