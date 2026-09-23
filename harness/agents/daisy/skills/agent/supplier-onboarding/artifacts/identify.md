## Read before you write

- **`database-access`** — read the relevant schema before queries, particularly
  `head_branch_id` and `supplier_contacts` sections.
- **The supplier's `suppliers.notes`** — known quirks for an existing
  supplier live there. Apply them. (A legacy
  `workspace/suppliers/[<supplierId>]:<Name>/notes.md` may also exist — read
  it too, promote anything durable to `suppliers.notes`, write nothing new
  there.)

**If an input is missing or ambiguous, make the best defensible call and
record the reasoning** — a wrong-but-recorded enrichment field is cheap to
fix. The exception is anything that would corrupt identity data: you can't
tell whether a farm is a new location or an existing row, or two rows look
like one company. Those are **critical blockers** — message `main` with the
evidence and stop that part at a safe point; keep going on what is clear.

**Two rules that hold for every write below.** Any contact with the supplier
during onboarding is recorded per the `supplier-communications` skill — quoted
in full to this thread's web panel, not written into `notes.md`. And **people
go in `contacts`, never on the supplier row and never in prose**: one row per
person plus a `supplier_contacts` link per location they cover ([contacts](contacts.md)), and
`contacts.notes`
describes the *person*. Never write a name, email or phone into `suppliers.notes`
— a 2026-08-05 cleanup had to lift 29 of them back out. A **generic inbox**
(`sales@`, `orders@`, `avail@`) is a contact row like any other, but it is the
company's switchboard, not a person: leave its `name` null and mark it
`title_department = 'Main line'`.

## 1. Confirm the supplier is genuinely new

**Don't re-run the whole search — be the second pair of eyes.** Whoever sent you
here already looked: the router thread identifying the sender
([supplier-email-routing: identify](../../supplier-email-routing/artifacts/identify.md)), or [availability-ingestion: locations](../../availability-ingestion/artifacts/locations.md) resolving a
location. One call to `search_suppliers`
with the name and the sender's domain is enough (the `plant-and-supplier-search`
skill covers reading a result set).

A hit means **stop and report it** rather than creating a duplicate — and
remember that **several hits for one company are usually its locations, not
duplicates**. A company that grows or sells at several sites is several
`suppliers` rows, one per location, tied together by `suppliers.head_branch_id`,
which points at the company's head branch; a head branch, and every single-site
supplier, points at **itself**.

**A location that looks absent is usually a spelling, not a new farm.** Before
concluding a site is missing, resolve its name against the company's existing
locations — match on **city and state**, not just the supplier row's name, and
read the company's own locations page if it still resolves to nothing:

```sql
SELECT s.id, s.name, s.city, s.state
FROM suppliers s
WHERE s.head_branch_id = (SELECT head_branch_id FROM suppliers WHERE id = <known_supplier_id>)
  AND s.is_active
ORDER BY s.id;
```

A name reading `Ft Pierce`, `Bunnell Farm`, `Loc 3` or a bare farm code is
routinely a row that already exists. **Onboarding a duplicate location splits
that farm's catalogue across two `supplier_id`s permanently, and no later ingest
can tell the halves apart.** If it could plausibly be either — a near-match on
name, a code you can't tie to a city — it is ambiguous: **ask, don't onboard.**

**Suspect an unrecorded company?** If a supplier's list, signature or website
shows sites the database doesn't have as rows, or shows that two existing rows
are one company, don't tie them together yourself — report it under *Flags
needing Chris* with the evidence. A wrong head branch multiplies wrong data by
the number of locations under it. Deciding which row is the head branch is
Chris's call, not something to settle mid-onboarding.
