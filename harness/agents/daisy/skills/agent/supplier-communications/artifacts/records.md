# Where each thing is kept

| What | Where |
|---|---|
| What was said to or by a supplier | The supplier panel ([transcript](transcript.md)) |
| Durable facts about a supplier: list format, parsing tricks, ordering limits, Chris's instructions for them | `suppliers.notes` (edit in place). Never people's names, emails or phones. |
| People | `contacts` + `supplier_contacts` (`supplier-onboarding`) |
| Open items on a thread: waiting answers, parked rows, commitments | That thread's `notes.md`. Current state, not a log; delete done items. |
| What you did today | One daily-note line (below) |
| Durable facts about the business or people | `knowledge/memory.md` (grep it; don't read it whole) |
| How to do something | The skill for that task (`create-skill`) |
| Progress, minor observations | Nowhere |

`suppliers.communication_notes` and `workspace/suppliers/` are read-only
archives.

## Helpers

```sh
skills/agent/supplier-communications/scripts/daily-note --thread <ThreadId> --text '<one line with numbers>'
skills/agent/supplier-communications/scripts/index-add <workspace-relative path> '<summary>'
```

- `daily-note` adds to today's `workspace/daily_notes/YYYY-MM-DD.md`
  (one paragraph per thread per day), locked for parallel threads. Don't read
  or hand-edit the daily note.
- `index-add` adds or replaces one line in `workspace/index.md` without
  reading it. Use it only for files someone will look for later, not for
  every task's notes. Never read `workspace/index.md` whole; `grep` it.
- A task thread creates its own `notes.md` before anything else, so a
  resumed or interrupted task can pick up.
