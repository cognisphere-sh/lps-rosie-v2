# Finish — label, panel, notes, report

## 1. Label the email

```sh
scripts/gws/email label <MessageId> --thread --add Daisy --add 'Daisy/<Status>' --create
```

Exactly one status. When the status changes, `--remove` the old one.

| Status | When |
|---|---|
| `Daisy/Catalogued` | Something went into the database: rows, or plant photos from an email with no list. Also an unchanged-source skip. |
| `Daisy/Failed` | Couldn't process it (parse error, blocked). |
| `Daisy/Not Availability` | No list and no plant photos. |
| `Daisy/Escalated` | Needs a human decision. |

## 2. Close it on the supplier panel

One or two sentences with numbers, posted to the supplier thread's panel
(`webchat-cli send`, no `--portal`; format in `supplier-communications` →
transcript). Examples:

```
Ingested 142 plants across 2 locations: 118 updated, 24 new, 6 aliases added.
Same list as Sep 8; nothing changed.
```

## 3. Record it

- Thread `notes.md`: only open items (parked rows, questions waiting). Not a
  log.
- Daily note, one line:
  `skills/agent/supplier-communications/scripts/daily-note --thread <ThreadId> --text '<result>'`.
- Success receipt: [source](source.md) → "Has it changed", step 4.
- Retire this farm's older sources that no inventory row points at (the new
  source with rows supersedes them). Skip any source a pending schedule names:

  ```sql
  UPDATE inventory_sources s SET is_active = false,
    notes = concat_ws(E'\n', notes, $q$<date>: retired — no rows; superseded by <new source id>$q$)
  WHERE s.supplier_id = <farm id> AND s.is_active AND s.created_at < <new source created_at>
    AND NOT EXISTS (SELECT 1 FROM inventory i WHERE i.source_id = s.id)
    AND s.id <> ALL(ARRAY[<source ids named in active schedules>]::uuid[])
  RETURNING s.id;
  ```
- Durable supplier quirks (format, parsing tricks) → `suppliers.notes`
  (`supplier-onboarding`), once.
- Don't read or rewrite `workspace/index.md`. Add a pointer only for a file
  someone will need later:
  `skills/agent/supplier-communications/scripts/index-add <path> '<summary>'`.

## 4. The report

Send it only when someone asked for this ingest (a parent thread, main or a
coordinator). A task thread sends exactly **one** report, at the end, with
`--silent` (the parent reads it on its next wake; it doesn't need to act). A
blocker is not a report: see `1-agent.md`.

Write it short. Leave out anything that didn't happen; don't repeat standing
rules ("not confirmed stock", "no retirements", "no aliases").

```
<Supplier> <list date>: <N> plants across <L> locations — <u> updated, <i> new, <r> reactivated, <p> parked.
Per location: <id name: u/i> …  Sources: <uuid> …  Label: Daisy/<Status>.
Flags for Chris: <parked rows with candidate ids; out/discontinued items; odd prices; older-file conflicts with both values>
Other: <duplicates found (ids, which updated) | photos (catalogued ids / duplicates / not plants / URLs) | new supplier or contacts | skipped tabs | quirks saved to suppliers.notes>
```

Add these only when they apply: onboarding details (new ids, head branch,
category and evidence, newsletter result), manual-receipt caveat (handoff
time, printed date, confirmation needed), historical skip evidence, and any
suggested rule/script change.
