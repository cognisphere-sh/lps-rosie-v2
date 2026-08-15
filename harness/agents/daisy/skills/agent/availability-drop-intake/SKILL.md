---
name: availability-drop-intake
description: Coordinate one availability drop from arrival to closed loop, without doing the ingest or writing any row yourself. Covers identifying which supplier a drop came from (sender address, domain or name) and passing the whole multi-location company along, the dispatch contract for the task-thread brief that runs the supplier-onboarding-and-ingestion skill, answering that thread's follow-up questions, digesting its report into the thread summary / daily note / supplier notes, deciding what reaches Chris now versus in the daily summary, and applying the Daisy Gmail status labels. Use when a supplier availability email arrives, when Chris asks you to ingest availability from a website, image or attachment, or when a task thread reports an ingest back. (v2.0.3)
metadata:
  author: lps
  version: "2.0.3"
---

# Availability drop intake

Run this loop for every availability drop, without being asked step by step.

**Where the boundary is.** This skill is coordination only. You identify the
supplier, brief a task thread, digest what comes back, and label the email. **You
never write to `suppliers`, `contacts`, `inventory`, `inventory_sources` or
`plant_aliases` from here** — every one of those writes, plus all parsing,
normalization and location mapping, belongs to the
`supplier-onboarding-and-ingestion` skill, which the task thread runs. If you are
about to write a row, you are in the wrong skill; if the task thread is about to
message Chris, it is in the wrong one.

Do not send a per-ingestion update to Chris/Bhoumik for routine successful work —
it goes in the next daily summary. Message immediately only for a blocker, needed
input/approval, failure/data risk, or a genuinely noteworthy result.

## 1. Identify the supplier

From the email `From`/domain, or the name Chris gives you. Email addresses live
in `contacts`, linked to suppliers through `supplier_contacts` (a contact can
cover several locations) — join through both:

```sql
SELECT s.id, s.name, s.head_branch_id, c.email
FROM suppliers s
JOIN supplier_contacts sc ON sc.supplier_id = s.id AND sc.is_active
JOIN contacts c ON c.id = sc.contact_id AND c.is_active
WHERE lower(c.email) = lower('<from>') OR s.name ILIKE '<name>';
```

If that finds nothing, widen to the sender's **domain**
(`c.email ILIKE '%@<domain>'`) — a supplier often mails from a person's address
that isn't on file yet, and their colleague's is.

**Several rows back for one company is normal, not a duplicate.** A
multi-location nursery is one `suppliers` row per site sharing a
`head_branch_id` — Everde has five, Moon Valley seventeen — and a single file
from them routinely carries availability for more than one of those sites.
**Pass every match and the `head_branch_id` through in the brief.** Which rows in the file belong to which
location is the ingestion skill's call (its §0.1), not yours: never pick one
yourself, never merge them, and never tell the task thread the drop is "for" a
location the file didn't name.

If you can't confidently determine the supplier at all, **ask Chris** before
dispatching — don't guess a duplicate into existence.

## 2. Dispatch a task thread — the brief contract

Spawn a task thread (see **Task threads** in the base prompt). This list is the
**canonical dispatch contract**; the ingestion skill's *Your inputs* section
points back at it rather than restating it. The brief carries:

- the declaration that it is a task thread and this thread is the parent,
- **the supplier**: existing `supplier_id` + name, **every other active location
  of the same company with their ids**, and the `head_branch_id`; or, if nothing
  matched,
  everything you know about the sender (name, address, domain, signature) and the
  fact that it looks new,
- **all source material**: attachment paths, website URL, image paths, and the
  relevant email body text — including anything in the body that names a farm,
  branch or ship-from location, because that is what the mapping turns on,
- **the skill to follow, by name and current version** from `<available_skills>`
  — e.g. "Follow the `supplier-onboarding-and-ingestion` skill (v2.0.0)" — plus
  the path to `knowledge/files/SCHEMA.md` and to the supplier's
  `workspace/suppliers/[<id>]:<Name>/notes.md` if present, to read first,
- the ThreadId and the current timestamp.

Don't restate the skill's steps in the brief. The task thread is you and has the
same skills installed; naming the skill and its version is what keeps both
threads on the same procedure.

## 3. Answer follow-up questions

If the report asks for missing info or a decision — which location a row belongs
to, a credential, a judgment call — answer by messaging the **same task thread
id**. Ask Chris first when it is his call. The thread keeps its full history;
don't repeat the brief or restart it.

## 4. Digest the report

The report's shape is the **report contract at the end of the
`supplier-onboarding-and-ingestion` skill** — read it there. What you do with
each part:

- **Result / Locations** — spot-check that it is sane before you file it. Under
  the update-in-place model a repeat drop should be **mostly updates with a few
  inserts**; a report that is nearly all inserts means the ingest failed to match
  existing rows and has duplicated the supplier's catalogue. Treat that as a data
  risk and raise it rather than filing it. Likewise check that the locations
  written match what the source actually named.
- **Follow-up questions** — §3.
- **Flags needing Chris** — batch them into the daily summary unless one blocks
  the ingest or risks data, in which case message now.
- **Errors, learnings, suggested skill changes** — into the daily note. Skill
  changes are never applied without Chris's or Bhoumik's approval.
- **Supplier quirks** — into `workspace/suppliers/[<id>]:<Name>/notes.md`.
- **Result summary and decisions** — into the thread's `notes.md`: the outcome
  and row counts under `## Context`, the reasoning under `## Decisions`.
- **Suggested status label** — §5.

Routine successful ingests wait for the daily Telegram summary.

## 5. Label the email

After processing an email drop, apply two Gmail labels to the thread via the
`gws` CLI: the primary label `Daisy` (every email you read gets this), plus one
**sub-label under `Daisy`** for the status:

| Sub-label | When |
| --- | --- |
| `Daisy/Catalogued` | ingested successfully |
| `Daisy/Failed` | couldn't process — parse error, blocked on Chris |
| `Daisy/Not Availability` | wasn't an availability/price-list drop |
| `Daisy/Escalated` | needs human review — unsure, or fits none of the above |

Gmail nests labels by the `/` separator. Known label IDs are in
`knowledge/files/gmail-labels.md`; look them up live if that file is stale, and create
any missing label first:

```
gws gmail users labels list --params '{"userId":"me"}'
gws gmail users threads modify --params '{"userId":"me","id":"<threadId>"}' \
  --json '{"addLabelIds":["<DaisyLabelId>","<StatusLabelId>"]}'
```
