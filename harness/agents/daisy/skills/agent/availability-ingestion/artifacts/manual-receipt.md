## Manual current-receipt intake

When Chris or Bhoumik manually hands over an image, attachment, or website and
the brief classifies it `manual/current-receipt`, ingest it as received now —
**not** as a historical backfill merely because it displays `2023`, another old
date, or a non-ISO year. No exact-farm historical date check is required unless
the brief explicitly calls the source historical/backfill.

- Use the inbound handoff timestamp from the brief as the source's
  received/retrieved timestamp. `inventory_sources.created_at` remains the
  immutable database ingest time; it is not an effective date. In each new
  `inventory_sources.notes`, record the manual channel/identifier, the handoff
  timestamp, and every printed source date verbatim.
- Preserve the printed historical date and the currentness caveat rather than
  laundering it into a current claim — both are **your** conclusions about the
  source, so they belong in `internal_notes`, never in `notes`: append a dated
  `internal_notes` statement
  that the source was manually received at the handoff time, quote the printed
  date, and says **currentness/availability and pricing require confirmation**.
  This is a meaningful currentness caveat, not a duplicate of `created_at`.
- Treat current receipt as the source's operational precedence date under [writes](writes.md),
  while retaining that confirmation requirement. Do not withhold values merely
  because the printed year is old; an exception still requires an explicit
  historical/backfill or other quotable [writes](writes.md) instruction.
- Include the classification, handoff timestamp, printed date(s), and
  confirmation-required caveat in the report and QA it before commit.
