---
name: feedback-loop
description: How Chris's feedback becomes an improvement to the workflow or the app. Covers logging every input to knowledge/files/feedback.md as it arrives, keeping the business picture in knowledge/files/business/, deciding when a repeated signal has earned a requirement, writing that requirement, and routing it (UI/UX to nova now, DB and workflow changes staged for Bhoumik, skills and scripts to the owning agent) through to shipped or dropped. Use whenever Chris says anything about how the business or the app works, when daisy, rosie or nova hands over a brainstorm, when reviewing the log for patterns, and when a requirement is ready to route or chase. (v1.0.0)
metadata:
  author: lps
  version: "1.0.0"
---

# Feedback loop

Chris talks; you listen, record, understand, and turn what you understand into
changes. Four stages, and the first one is the one that matters most — you
can't spot a pattern in remarks you didn't write down.

## 1. Capture — every time, immediately

**Everything Chris says about how the business or the software works goes in
the log**, whether or not it sounds like a request. A complaint, an aside, a
workaround he's invented, a step he skips, a number he re-checks by hand, "the
old way was faster" — all of it. So does a handoff from daisy, rosie or nova.

Append to `knowledge/files/feedback.md`, newest at the bottom:

```markdown
## YYYY-MM-DD

- **<3-6 word handle>** — <what he said, close to his words. Quote him where
  the phrasing carries something.> _(via telegram | rosie | daisy | nova)_
  → <requirement-slug> | (watching) | (answered) | (business/<file>)
```

The arrow is the only bookkeeping: where this input went. `(watching)` means
recorded and not yet acted on — the normal case, and not a failure.

Rules that keep the log worth having:

- **Log first, think second.** Never lose an input to "I'll write it up after."
- **Don't paraphrase into blandness.** "Chasing suppliers eats my mornings"
  is data; "user desires efficiency improvements" is not.
- **Append, never rewrite.** The log is the raw material. Understanding is
  drawn *from* it into `business/` and `requirements/`; nothing is deleted
  because it was acted on.
- **One remark is noise. Three is a requirement.** Recording the first two is
  the entire reason this file exists.

Then decide, in one beat, which this is:

- **An operational question** ("where is JR-9?", "did they send the list?") —
  not yours. Point him at rosie or daisy. Log it only if it reveals something
  about the workflow.
- **Something you can answer** — answer it, mark `(answered)`.
- **Everything else** — logged, `(watching)`, and you move on. Most inputs
  stop here, and that's correct.

## 2. Understand — keep the business picture current

`knowledge/files/business/` is what separates you from an inbox. **Living
documents, revised in place** (unlike the log, which is append-only) — one per
area you actually know something about, indexed in
`knowledge/files/business/index.md`. Typical shape:

- `operations.md` — how an order really moves, end to end, including the parts
  the software doesn't touch.
- `people.md` — who does what, who decides what, what each of them cares
  about.
- `seasons.md` — what changes through the year and what that does to the work.
- `friction.md` — where the same problem keeps recurring, with the log dates
  that evidence it. This is your candidate list for §3.

Update the picture whenever an input changes it — including when Chris
contradicts something you had written down. **Record where a fact came from**
(date, or the log handle), so a stale belief can be traced and corrected.

Read before you write: the app (`../../../app/`), `../../../docs/app/`,
`../../../docs/harness/` and `../../../docs/supabase-schema.md` tell you how
things currently work. Understanding the business means knowing both what
Chris does and what the software actually does today.

## 3. Propose — when a signal has earned a requirement

Promote something out of the log when it has earned it: the same friction
logged repeatedly, a single thing costing real time or money, or Chris asking
for it outright. **You raise this, he doesn't have to.**

Before writing, be able to answer these — from the log and `business/`, asking
Chris only what you genuinely can't settle:

1. **What problem?** What goes wrong, for whom, how often. If Chris opened
   with a solution, work back to the problem — it may not be the best fix.
2. **What does done look like?** The concrete change he'd see. This becomes
   the acceptance criteria; if you can't write it, it isn't ready.
3. **What's explicitly out?** The nearby thing you are not doing.
4. **How does it sit against what's already open?** Not a priority number —
   where it falls among the requirements already in flight.

Then write `knowledge/files/requirements/<slug>.md` — kebab-case slug naming
the change (`supplier-chase-reminders`, not `idea-3`):

```markdown
# <Title — what it does, in Chris's words>

- Status: drafted | routed | staged | shipped | dropped
- Route: nova | bhoumik | <agent-id> | undecided
- Raised: YYYY-MM-DD by Chris (via <telegram | rosie | daisy | nova>)
- Updated: YYYY-MM-DD

## Problem

What goes wrong today and for whom. Two or three sentences.

## Evidence

- The log entries this came from, with dates. What makes it worth doing now.

## What it should do

The behaviour, in plain language. No table names, no components, no queries.

## Acceptance criteria

- One line per checkable outcome. "Chris opens X and sees Y."

## Out of scope

- The nearby things this is explicitly not.

## Assumptions

- Decisions you made rather than asking. Each is Chris's to overturn.

## Open questions

- What's blocking and who owes the answer. Delete when answered.

## Handoff log

- YYYY-MM-DD — routed / staged / shipped / dropped, and what came back.
```

The file is **current state, not a log** — edit in place; the handoff log
carries the history. Update `knowledge/files/requirements/index.md` in the same
edit (slug, title, status, route) and point the source entries in
`feedback.md` at the slug.

**A workflow change is a valid requirement.** Not everything is software — "we
should ask suppliers before pricing, not after" is a change to how the work
runs, and it routes to Bhoumik or to the owning agent's skill just the same.

## 4. Route it

Chris's standing rule (2026-08-25). One route per slice of work:

| The change is… | Route | What you do |
|---|---|---|
| UI or UX — layout, copy, fields, screens, panels, what the app shows | **nova** | Agent-message nova to build it now. Status `routed`. |
| Database or workflow — a table/column, a migration, how a process actually works, statuses, money | **bhoumik** | Status `staged`. Tell Bhoumik it's waiting. **Never hand it to nova to build.** |
| A skill or a script belonging to an agent | **that agent** | Agent-message rosie / daisy / nova. They update their own, with Chris's or Bhoumik's approval. |

**When it mixes, split it** — the UI slice to nova, the structural slice
staged, and the file says which is which. **When you can't tell**, ask Bhoumik:
one question naming the two readings.

To nova (or another agent):

```bash
bash scripts/agent-msg/send --to-agent nova --thread-id main \
  --subject "Requirement: <title>" \
  --message "<the requirement in full — problem, behaviour, acceptance criteria, out of scope. Path: knowledge/files/requirements/<slug>.md on lily.>"
```

Send it **in the body**, not just a path — the receiving agent shouldn't have
to read another agent's dir to know what to build. Name the file too, so it
can check for updates.

To Bhoumik on Telegram: what it is, why Chris wants it, why it's staged rather
than shipping, what you need from him. Technical language is fine.

To Chris on Telegram: one line — going out to nova, or waiting on Bhoumik and
why. No jargon, no file paths.

## 5. Close the loop

- **`routed`** — the builder has it. On their report, set `shipped` and tell
  Chris what changed, in his terms. **Closing the loop is what earns the next
  piece of feedback** — an input that visibly went nowhere teaches him not to
  bother.
- **`staged`** — Bhoumik's. It waits. If staged items start blocking things
  Chris raises again, surface them once, as a list.
- **`dropped`** — Chris decided against it. Keep the file, set the status, and
  record *why*; the reason stops it being re-raised in three weeks.

Never close on your own judgment: `shipped` needs the builder's confirmation,
`dropped` needs Chris's.

## 6. Failure modes

- **Feedback that only lives in Telegram scrollback.** Compaction eats it and
  the pattern never forms. This is the failure that matters — log first.
- **Turning capture into an interview.** Chris is running a nursery. Record
  what he said and ask at most one sharpening question.
- **Handing a DB or workflow change to nova.** Staging exists so Bhoumik
  decides. If it's already sent, tell nova to hold and stage it properly.
- **Writing implementation instead of behaviour.** If the file names columns
  or components, cut it back to what the system should do.
- **A requirement with no acceptance criteria or no evidence.** It comes back
  as a question. Finish §3 first.
- **Agent-message failed** (`send failed …`). It did not arrive — read the
  error. `403` means that inbox doesn't accept you: don't retry, tell Chris.
  Never mark anything `routed` on a failed send.
