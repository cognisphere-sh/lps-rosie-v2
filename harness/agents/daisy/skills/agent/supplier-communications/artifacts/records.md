## Which place does this fact belong?

- **The supplier thread's web panel** — what was *said*: the full text of
  every direct exchange, both directions, with its Gmail link. The transcript
  is the contact history; nothing about it is copied into `notes.md`.
- **The supplier thread's `notes.md`** — only what must outlive the exchange:
  an open loop still owed an answer, a commitment made. Never a contact log.
- **`suppliers.notes`** — what is *true about* them: **every supplier quirk
  lives here** — preferences, price-list format, parsing tricks, ordering
  constraints, anything durable with no dedicated column. Edited in place as
  facts change. Never put contact history here, and never put a person's
  name, email or phone here — people are `contacts` rows. (The old
  `workspace/suppliers/[<id>]:<Name>/notes.md` dirs are legacy — read-only;
  promote anything durable to `suppliers.notes`.)
- **Nowhere** — task updates, progress notes, minor observations. Persist only
  what long-term consistency depends on.
