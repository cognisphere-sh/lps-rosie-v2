## Your inputs

A drop arrives as a **forward from the router thread** — MessageId,
Gmail thread id, sender, subject, attachment names, and the supplier rows it
matched — as a **raw `email_received`** when a gws routing rule sends this
supplier's mail straight here ([supplier-email-routing: routes](../../supplier-email-routing/artifacts/routes.md); same processing,
no forward block), or as a handoff from `main` (file paths, a URL, an image). **Read
the source yourself**: for an email, `scripts/gws/email read <MessageId>
--attachments` gives the full body and writes the attachments to
`plugins/gws/inbox/<MessageId>/`. The body text is part of the source — it can
amend the attachment, name a farm, or identify a photo. The default
classification is a **current drop**. **A Chris/Bhoumik manual handoff
(image, attachment, or web source) classified `manual/current-receipt` is not a
historical backfill merely because its material prints an old or non-ISO date.**
Use the handoff timestamp as received/retrieved time and follow [manual receipt](manual-receipt.md). Only an explicit `historical/backfill`
classification invokes the [historical exact-farm check](historical.md). Two things to read before you write
anything:

- **`database-access`** — read the relevant schema before queries.
- **The supplier's `suppliers.notes`** — their known quirks and parsing
  tricks live there. Apply them. (A legacy
  `workspace/suppliers/[<supplierId>]:<Name>/notes.md` may also exist for an
  established supplier — read it too, promote anything durable to
  `suppliers.notes`, write nothing new there.)

Any contact with the supplier during the ingest is recorded per the
`supplier-communications` skill — quoted in full to this thread's web panel,
not written into `notes.md`.

**When the drop arrived as an email, post its arrival block to this thread's
web panel before you start parsing** — subject as a Gmail link, sender, first
line, attachment names. A drop is a **broadcast**, so the block is header-only
and its body is never quoted (`supplier-communications` → transcript). It is internal: no `--portal`.

## Judgment calls and escalation

Resolve conflicts and confusion yourself wherever a defensible reading exists:
pick the best-supported interpretation, write it, and record the reasoning in
the row's `internal_notes` or the thread's notes. Routine gaps — a missing
price, an unclear size, a plant that fits no obvious section — are never
questions: record what the source says and keep going; they surface in the
daily note. Humans are for **critical blockers only** — the supplier or
location can't be determined at all, two readings would write materially
different data with nothing to choose between them, a credential is needed.
Those go to your `main` thread by agent message with full context; park the
affected part at a safe point and keep processing what isn't blocked.
