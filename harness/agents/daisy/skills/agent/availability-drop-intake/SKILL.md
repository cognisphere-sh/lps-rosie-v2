---
name: availability-drop-intake
description: Coordinate one availability drop from arrival to closed loop, without doing the ingest or writing any row yourself. Covers identifying which company a drop came from (contacts join for an address, search_suppliers for a name) and passing every matched row plus the head_branch_id along without enumerating the company's locations, the dispatch contract for the task-thread brief that runs the availability-ingestion skill (which reaches supplier-onboarding itself when a supplier or farm has no row), answering that thread's follow-up questions, digesting its report into the thread summary / daily note / supplier notes, deciding what reaches Chris now versus in the daily summary, and applying the Daisy Gmail status labels. Use when a supplier availability email arrives, when Chris asks you to ingest availability from a website, image or attachment, or when a task thread reports an ingest back. (v2.2.1)
metadata:
  author: lps
  version: "2.2.1"
---

# Availability drop intake

Run this loop for every availability drop, without being asked step by step.

**Where the boundary is.** This skill is coordination only. You identify the
supplier, brief a task thread, digest what comes back, and label the email. **You
never write to `suppliers`, `contacts`, `supplier_contacts`, `inventory`,
`inventory_sources` or `plant_aliases` from here** — every one of those writes,
plus all parsing, normalization and location mapping, belongs to the task thread:
the **`availability-ingestion`** skill writes the inventory side, and reaches
**`supplier-onboarding`** itself for the supplier side when the drop turns out to
need a supplier or a farm that has no row. You dispatch one thread against
`availability-ingestion`; it decides whether onboarding is needed. If you are
about to write a row, you are in the wrong skill; if the task thread is about to
message Chris, it is in the wrong one.

Do not send a per-ingestion update to Chris/Bhoumik for routine successful work —
it goes in the next daily summary. Message immediately only for a blocker, needed
input/approval, failure/data risk, or a genuinely noteworthy result.

## 1. Identify the supplier

**The question here is which company the drop came from — not which of its
locations.** That second question is the ingestion skill's (§2 says why), so one
matched row is enough to answer this one.

**From an email address**, join through `contacts`: no way of contacting a
supplier lives on `suppliers` itself, and a contact can cover several locations,
so the address reaches the supplier through `supplier_contacts`. The join is
exact, which is what you want for an address, and it returns the
`head_branch_id` the brief has to carry:

```sql
SELECT s.id, s.name, s.head_branch_id, c.email
FROM suppliers s
JOIN supplier_contacts sc ON sc.supplier_id = s.id AND sc.is_active
JOIN contacts c ON c.id = sc.contact_id AND c.is_active
WHERE lower(c.email) = lower('<from>');
```

If that finds nothing, widen to the sender's **domain**
(`c.email ILIKE '%@<domain>'`) — a supplier often mails from a person's address
that isn't on file yet, and their colleague's is.

**From a name Chris gives you**, use **`search_suppliers`** rather than a
hand-written `ILIKE` — it is typo tolerant and matches partially, which a `LIKE`
is not (the `plant-and-supplier-search` skill covers reading its result set).
Two things it won't do: an email matches through its contacts branch but
**scores 0**, so it ranks below every name match and is no substitute for the
join above; and it does **not return `head_branch_id`**, so read that off
`suppliers` for the row you settle on.

**Several rows back for one company is normal, not a duplicate** — a
multi-location nursery is one `suppliers` row per site sharing a
`head_branch_id`. **Pass every row you matched, with the `head_branch_id`.**
Never pick one yourself, never merge them, and never tell the task thread the
drop is "for" a location the file didn't name.

**Don't enumerate the company's other locations here.** The ingestion skill
derives them from the head branch as its first step (§0), and its query returns
the city and state that resolving a farm name against a tab label depends on —
which a lookup by sender address never carries. Passing a half-list invites it to
treat that as the company.

If you can't confidently determine the supplier at all, **ask Chris** before
dispatching — don't guess a duplicate into existence.

## 2. Dispatch a task thread — the brief contract

Spawn a task thread (see **Task threads** in the base prompt). This list is the
**canonical dispatch contract**; the ingestion skill's *Your inputs* section
points back at it rather than restating it. The brief carries:

- the declaration that it is a task thread and this thread is the parent,
- **the supplier**: every `supplier_id` + name your lookup matched, and the
  `head_branch_id`. **Not the company's other locations** — the ingestion skill
  fans out from the head branch itself (§0), so a list assembled here is at best
  a duplicate of that query and at worst a shorter one it mistakes for the whole
  company. If nothing matched, say so and give everything you know about the
  sender (name, address, domain, signature); the thread onboards from there,
- **all source material**: attachment paths, website URL, image paths, and the
  relevant email body text — including anything in the body that names a farm,
  branch or ship-from location, because that is what the mapping turns on. An
  `email_received` notification is only a **preview** (header, first two lines,
  attachment *names* — the files are not downloaded), so for an email drop read
  the message first with `bash scripts/gws/email read <MessageId>
  --attachments`: that gives you the full body and writes the attachments to
  `plugins/gws/inbox/<MessageId>/`. Pass those paths, the full body text, and
  the `MessageId` itself, so the thread can re-read the mail if it needs to,
- **the skill to follow, by name and never with a version number** — "Follow
  the `availability-ingestion` skill". Name that one only: it follows
  `supplier-onboarding` itself if the drop needs a supplier or a farm created,
  so the brief never has to decide whether onboarding is in scope. The task
  thread resolves the name against its own `<available_skills>`, which is rebuilt
  at spawn and so is always current; a version copied into a brief is wrong the
  moment the skill is bumped,
- the path to `knowledge/files/SCHEMA.md` and to the supplier's
  `workspace/suppliers/[<id>]:<Name>/notes.md` if present, to read first,
- the ThreadId and the current timestamp.

Don't restate the skill's steps in the brief. The task thread is you and has the
same skills installed; naming the skill is what keeps both threads on the same
procedure.

## 3. Answer follow-up questions

If the report asks for missing info or a decision — which location a row belongs
to, a credential, a judgment call — answer by messaging the **same task thread
id**. Ask Chris first when it is his call. The thread keeps its full history;
don't repeat the brief or restart it.

## 4. Digest the report

The report's shape is the **report contract at the end of the
`availability-ingestion` skill** — read it there; it folds in the *Onboarding*
block from `supplier-onboarding` when the thread had to create a supplier or a
farm, so you still get one report. What you do with each part:

- **Result / Locations** — read them against each other before you file them.
  You are not re-running the thread's QA: its §5 is the gate, and it ran before
  the transaction committed. **You are the backstop for a §5 that didn't fire**,
  and what you catch is already written, so the response is to raise it now, not
  to file it and move on.

  Two things the report shows on its face. Under the update-in-place model a
  repeat drop from an established supplier is **mostly updates with a few
  inserts**; nearly all inserts means the ingest failed to match existing rows
  and has duplicated that supplier's catalogue. And the locations it says it
  wrote to should be the ones it says the source named — a report that maps to
  every location of the company while quoting a per-tab source, or to one
  location while quoting none, contradicts itself. Either is a data risk:
  message Chris now rather than waiting for the daily summary.
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
