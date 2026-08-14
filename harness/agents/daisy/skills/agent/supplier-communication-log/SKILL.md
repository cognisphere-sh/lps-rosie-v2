---
name: supplier-communication-log
description: Record every contact with a supplier in suppliers.communication_notes, inbound and outbound alike. Covers the entry format (timestamp line, channel, identifier, what and why), the append-only read-modify-write SQL, and the split between communication_notes (what was said to them, only grows) and notes (what is true about them, edited in place) and the supplier's workspace notes.md. Use whenever you email, message or call a supplier, whenever one contacts you, and when deciding where a supplier fact belongs. (v1.0.0)
metadata:
  author: lps
  version: "1.0.0"
---

# Logging supplier contact

**Whenever you contact a supplier — or they contact you — append an entry to
`suppliers.communication_notes` for that supplier, in the same task.** Not at the
end of the day, not only when something notable happened: every time. This column
is the answer to "have we chased them about this yet, and when?", and it is only
worth reading if it is complete.

## Entry format

A timestamp line plus a short prose summary:

```
[YYYY-MM-DD HH:MM America/Chicago] <channel> · <identifier>
<What you sent or received, and why. Outcome or what you're waiting on.>
```

- **channel** — `email`, `telegram`, `phone`, `web form`.
- **identifier** — whatever lets someone find the conversation again:
  `gmailThreadId=<Channel>` for email (the raw Gmail thread id), the harness
  `ThreadId`, or the number called.
- **why** — the reason you reached out, not just the fact that you did. "Asked
  for the July list" is weak; "asked for the July list — theirs is 3 weeks old
  and the 15G Live Oak price looked stale" is the useful version.

## Append, never overwrite

It is plain text, so this is a read-modify-write:

```sql
UPDATE suppliers
SET communication_notes = coalesce(communication_notes || E'\n\n', '') || $entry
WHERE id = $supplierId;
```

Never rewrite past entries.

## Which place does this fact belong?

- **`suppliers.communication_notes`** — what was *said to* them. Append-only.
- **`suppliers.notes`** — what is *true about* them: quirks, preferences,
  price-list format, ordering constraints, anything durable with no dedicated
  column. Edited in place as facts change. Never put contact history here, and
  never put a person's name, email or phone here — people are `contacts` rows.
- **`workspace/suppliers/[<id>]:<Name>/notes.md`** — your own working memory:
  parsing tricks, half-formed hunches, ingest history. When a hunch hardens into
  a fact the rest of the business should see, promote it to `suppliers.notes`.
