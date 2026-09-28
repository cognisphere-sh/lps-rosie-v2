## Recording availability status

**Staleness is answered by the row's `source_id`** — its source's
`created_at` says when we last saw the row — never by a date written into
`notes`. So `notes` carries no "available as of" line; what it does carry is
the supplier's own per-row qualifier a sourcing person needs ("limited", "sold
out until fall", "lead time 2 wks"), and [writes](writes.md) replaces that with each new drop's
text. Stock counts go in `quantity`, and your own reading of the row goes in
`internal_notes`.

If the supplier says an item is **out or discontinued**, record that in `notes`
and raise it under *Flags needing Chris*. **Don't flip `is_active = false`
yourself** — retiring an offering is a deliberate act outside an ingest ([writes](writes.md)).

## 7. Label the email

After processing an email drop, apply one **sub-label under `Daisy`** for the
status, plus the primary `Daisy` label when the email reached this thread
directly via a gws routing rule (a router forward already carries it —
re-adding it is harmless):

| Sub-label | When |
| --- | --- |
| `Daisy/Catalogued` | ingested successfully — **or the email carried no availability but did carry plant photos that were catalogued.** Something went into the database either way |
| `Daisy/Failed` | couldn't process — parse error, blocked |
| `Daisy/Not Availability` | wasn't an availability/price-list drop and had no plant photos either |
| `Daisy/Escalated` | needs human review — unsure, or fits none of the above |

Gmail nests labels by the `/` separator. Known label IDs are in
`artifacts/gmail-labels.md` (relative to this skill dir); look them up live if
that file is stale, and create any missing label first:

```
gws gmail users labels list --params '{"userId":"me"}'
gws gmail users threads modify --params '{"userId":"me","id":"<gmailThreadId>"}' \
  --json '{"addLabelIds":["<DaisyLabelId>","<StatusLabelId>"]}'
```

## Timestamps

ISO 8601, America/Chicago. "Now" is the latest inbound message's Timestamp.
`updated_at` is maintained by trigger on UPDATE.

## Record the outcome

When the ingest finishes, write a **compact structured record**: the outcome
and row counts into this thread's `notes.md` under `## Context`, the reasoning
under `## Decisions`, and a brief entry in the daily note — that is what the
9 AM summary reads, and routine successful ingests are messaged to no one.
**Post the web summary too** — one or two sentences with the row counts, to
this thread's panel (`supplier-communications` → transcript, without `--portal`). It closes the block this drop opened; the structured record below
stays in `notes.md`, not the panel.
When a coordinator thread or `main` asked for this ingest by agent message,
send the same record back to the requesting thread. It covers:

- **Onboarding** (when any was performed): the block `supplier-onboarding`
  returns, folded in here so there is one record — the new
  `supplier_id` and its `head_branch_id`, enrichment and newsletter, contacts and
  links. Say what sent you there: a sender that matched nothing, or a farm the
  file named that had no row.
- **Locations**: which location(s) this drop was written to and how the mapping
  was decided — the name the source gave per row/section, the one name it gave
  for the whole file, or "no location named → all N of the company's". Say which
  of the company's locations you did **not** write to, and which tabs or
  sections you skipped as non-locations ([locations](locations.md)).
- **Pagewise QA** (paginated sources): pages reviewed, per-page logical offering
  counts and exclusions/splits/continuations, matched versus inserted versus
  parked decisions, and the reconciled whole-document and per-location totals.
  State what was missing/uncertain rather than presenting a partial ingest as
  complete; ensure location coverage claims agree with the source's full scope.
- **Result**, **per location** when the drop covered several, never as one total:
  supplier_id, source ids + `file_path`s created, **rows updated**, **rows
  inserted**, rows reactivated, ambiguous multi-matches skipped, alias pairs
  added. Nothing was retired — if you believe something should be, it goes under
  *Flags needing Chris* instead. For a manual/current-receipt intake, also state
  the handoff timestamp, printed date(s), and that all availability/pricing is
  confirmation-required; for an explicit historical/backfill, state the incoming
  date/basis, exact farm id, later-source evidence and per-farm `SKIP` or
  normal-ingest result instead.
- **Photos** (when the drop carried any): every image accounted for, in the two
  halves [photos](photos.md) splits them into.
  - **Attached files**, one of: catalogued (with the `plant_photos` ids, plant,
    supplier attribution or "unattributed", and whether size was stated or left
    null), skipped as an exact `sha256` duplicate of a photo already catalogued,
    or skipped as not a plant (logo, signature, letterhead).
  - **URLs captured**, which were **not** downloaded: the ones written to an
    `inventory.image_url` (say which rows), and any that mapped to no row —
    their URLs listed here, since this report is their only record.
- **Overrides withheld**: any field where you did *not* let this drop win, under
  one of [source-precedence exceptions](precedence.md). Give both values, both sources, and the sentence
  you are relying on. An empty list is the normal case and worth saying so.
- **Duplicates found**: keys where several active rows carried the same price and
  printed name ([candidate matching](writes.md)). Give the plant, size and row ids, and say which one
  you updated. These are a cleanup backlog, not something to fix mid-ingest.
- **Escalations**: anything you sent to `main` (or the requesting thread) to finish
  (missing/ambiguous inputs, credentials, a decision). If you stopped early
  because of one, say exactly where you stopped and what remains.
- **Flags needing Chris**: missing prices, unclear sizes/specs, plants that
  didn't map, suspected duplicates/typos in the source.
- **Errors/issues faced** and how you resolved them.
- **Learnings**: supplier quirks or parsing tricks not yet in
  `suppliers.notes` — write them there (the supplier-side update per
  `supplier-onboarding`) or flag them here; anything incorrect/redundant found
  in SCHEMA.md, this skill, or other docs; **suggested skill/script/database
  changes** (you never change this skill — they go to the daily summary for
  Chris's/Bhoumik's approval).
- **Status label applied** (email drops): which `Daisy/…` sub-label you
  applied under the email-label procedure above.
