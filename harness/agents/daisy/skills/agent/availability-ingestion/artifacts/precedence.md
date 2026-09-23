## 4. Write to `inventory` — update what exists, insert what doesn't

An ingest **refreshes** a supplier's availability; it does not replace it.
**Nothing is retired.** For each parsed offering, find the row it already has and
update it; insert only when there is no such row. An offering the supplier has
stopped listing simply isn't touched — it keeps `is_active = true` and its older
`source_id`. That is the staleness signal: "when did we last see this row" is
answered by its `source_id`, not by a flag.

### The newest source wins

**The drop you are holding beats whatever an older file put there.** Every field
it states replaces the stored value — price, quantity, size, dimensions,
availability text — and you never keep an older number because it looks more
plausible, rounder, or closer to the rest of the list. A supplier who has
repriced is not a parse error. If a change looks wrong, **write it and flag it**;
don't quietly preserve stale data, which leaves the database disagreeing with the
supplier's own current list and no record of why.

Three qualifications, and they are the whole of the rule:

- **Silence is not a value.** "Trumps" applies to what the new source *states*,
  never to what it omits. A drop that doesn't mention a field leaves it alone —
  a price column absent from this week's sheet does not blank last week's price,
  and a partial list is not an instruction to erase everything outside it. Only
  an explicit statement ("call for pricing", a struck-through price, "0
  available") overwrites a value with an empty or zero one, and that is a
  statement, not a silence.
- **The email body outranks the file attached to it**, because the body is the
  later thing written. When they disagree — "prices in the attached go up 10% on
  Monday", "ignore the second tab", "the 15 G are gone" — the body is the current
  word and the attachment is the document it is amending. Record what the body
  said in the row's dated `notes` so the override is visible, and flag it if the
  amendment is broad enough that you had to interpret it.
- **Unless explicitly specified otherwise**, which means one of exactly three
  things — none of them your own judgement:
  1. **The brief or Chris says so** — "keep the existing prices", "this is a
     back-catalogue file, don't touch current stock".
  2. **The source says so** — a file the supplier labels superseded, archived or
     future-dated ("effective 1 Sept" is not effective today).
  3. **You are knowingly ingesting an older file than the one already on the
     row** — a backfill, or a re-send of something already processed. Ingestion
     order is not recency: `inventory_sources.created_at` records when *we*
     ingested a file, so replaying a January sheet in August gives it the newest
     `created_at` and it would clobber current data on a naive "latest wins".
     **When the file you hold is older than the row's current source, do not
     overwrite the fields that conflict.** Report them under *Flags needing
     Chris* with both values, and say which source each came from.

  In all three cases the exception is *stated somewhere you can quote*. If you
  cannot quote it, the new drop wins.
