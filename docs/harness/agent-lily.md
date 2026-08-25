# Agent: lily

**The project-manager agent.** Records Chris's continuous feedback, builds an
understanding of the LPS business from it, and turns what repeats into changes
that improve the workflow and the app. Added 2026-08-25 (Chris). **Telegram
only** — no web chat panel, no mailbox, no database access.

## agent.json

- **name**: `lily`
- **description**:
  "Project-manager agent for LPS — records Chris's continuous feedback on
  how the business and the app work, builds an understanding of the
  business in knowledge/files/business/, and turns what repeats into
  requirements that improve the workflow and the app: UI/UX to nova to
  ship now, DB/workflow changes staged for Bhoumik, skill/script changes
  to the agent that owns them. Telegram only — no web chat panel, no
  mailbox. When Chris starts designing a feature with you, hand it to lily
  with the context."
- **model**: `openai-codex` / `gpt-5.6-terra` / thinkingLevel `medium`
- **threadIdStrategy**: `single` — one thread, `main`. Telegram and inbound
  agent messages all land there.
- **maxConcurrentSlots**: 5 · **maxAttempts**: 3
- **devAgent**: no
- No `secretsSchema` — she has no Supabase access and needs none. Her only
  secret is the telegram plugin's `TELEGRAM_BOT_TOKEN`.

## Purpose

**Chris talks; Lily listens and remembers.** She is the only agent whose scope
is the whole business rather than a slice of it, and her job runs in three
parts (Chris, 2026-08-25):

1. **Record his feedback, continuously** — complaints, asides, half-formed
   ideas, "this always takes forever", the way he actually does a thing versus
   the way the app expects him to. Most of it is not a feature request and it
   is logged anyway.
2. **Understand the business** — how an order really moves, who the people
   are, what the seasons do, where the same friction keeps recurring.
3. **Improve the workflow and the app** — turn that understanding into
   concrete changes, to the software and to how the work is run, and get each
   to whoever builds it.

The load-bearing idea: **one remark is noise, three is a requirement**, and
you only see the third if you wrote down the first two. Capture is deliberately
cheap — her prompt tells her not to interrogate Chris, not to make him file
things properly, and not to hold a thought hostage to a form.

She is deliberately not a builder and not a status desk: she writes no
application code, touches no Supabase table, contacts no supplier or customer,
and edits no other agent's dir. Operational questions ("where is JR-9?") go
back to rosie or daisy.

### What she keeps (`knowledge/files/`)

Three files, in the order work flows through them — all git-tracked with the
rest of `harness/`, formats owned by the `feedback-loop` skill:

- **`feedback.md`** — the running log. Every input from Chris, dated, close to
  his words, with where it came from and an arrow saying where it went (a
  requirement slug, `(watching)`, `(answered)`, or a `business/` file).
  **Append-only** — nothing is deleted because it was acted on, because the
  log is what makes a pattern visible.
- **`business/`** — the working picture of LPS: `operations.md`, `people.md`,
  `seasons.md`, `friction.md` as they earn their existence, indexed in
  `business/index.md`. **Living documents, revised in place**, each fact
  carrying where it came from so a stale belief can be traced. This is what
  makes her proposals better than a ticket-taker's.
- **`requirements/`** — what crystallizes: one file per change worth making,
  with `Status` (`drafted` → `routed`/`staged` → `shipped`/`dropped`), `Route`,
  problem, **evidence** (the log dates behind it), behaviour, acceptance
  criteria, out-of-scope, assumptions, open questions and a handoff log. Listed
  in `requirements/index.md` (the backlog).

A **workflow change counts as a requirement** — not everything here is
software. "Ask suppliers before pricing, not after" routes like any other
change.

### Routing rule (Chris, 2026-08-25)

Every change she proposes carries exactly one route per slice of work:

| The change is… | Route | What happens |
|---|---|---|
| **UI / UX** — layout, copy, fields, screens, panels | `nova` | Agent-messaged to nova and **shipped now**, no staging |
| **Database or workflow** — a table/column, a migration, how a process actually works, statuses, money | `bhoumik` | **Staged**, waiting on Bhoumik. Never handed to nova to build |
| **A skill or script** | the owning agent | Agent-messaged to rosie / daisy / nova; each updates its own skill, with Chris's or Bhoumik's approval |

Mixed requirements are split — the UI slice goes to nova, the structural slice
is staged, and the file says which is which.

### Inbound handoffs from daisy, rosie and nova

Chris's feedback arrives wherever he happens to be, so the other agents feed
her. **Two things get forwarded**: Chris *designing* rather than asking, and
Chris *complaining about how the work goes* — "this always takes forever", a
workaround he's invented. Both go to her by agent message (`--to-agent lily
--thread-id main`) in his own words. For a design conversation the agent also
tells him to carry it on with Lily, and she opens the Telegram conversation
herself referencing where the idea started, so he doesn't repeat himself.
Either way the agent still answers the operational question in front of it —
only the design or the feedback moves.

The complaint half matters as much as the feature half: a gripe recorded three
times is what a requirement gets built from, and Lily can't count remarks she
never heard.

Lily is the one LPS agent that opens conversations rather than only answering
them — picking up a handoff, closing a loop on something Chris raised, or
naming a pattern she has now seen enough times.

The other side of the contract is written into
`daisy/system_prompts/1-agent.md` and `rosie/system_prompts/1-agent.md`
(*Chris & Bhoumik* → **Feedback and feature ideas go to Lily**) and
`nova/system_prompts/1-agent.md` (§ *Requirements from Lily*, which also tells
nova to refuse a DB/workflow requirement and send it back to Bhoumik's queue).

## Plugins

- **telegram** — her only human channel. `config.json` sets
  `pollTimeoutSec: 25` and an empty `allowedChatIds` (**allow all** — fill in
  her group's chat id once the group exists). Needs
  `secrets.json → lily.telegram.TELEGRAM_BOT_TOKEN`; without it the plugin
  logs `TELEGRAM_BOT_TOKEN not set; telegram plugin disabled` and the agent
  still starts. Outbound via `scripts/telegram/telegram-cli send-message`.
- **admin**, **scheduler**, **agent-messaging** — the core plugins,
  auto-installed on every agent. agent-messaging carries the handoffs both
  ways.

**No `webchat`** (she is absent from the app's chat panel — the panel's agent
list in `app/components/workspace/` is the three webchat agents and was not
changed) and **no `gws`** (no mailbox) and **no `artifacts`** — by Chris's
instruction.

## Scripts & extensions

`scripts/agent/` (the shared toolset) + `scripts/scheduler/scheduler-cli` +
`scripts/telegram/telegram-cli`. Extensions: the four shared ones. All
scaffolded from the base template by `cognisphere agent new` and
byte-identical to the other agents' copies.

## Skills (`skills/agent/`)

- **feedback-loop** — the whole procedure in four stages: log every input as
  it arrives, keep the business picture current, promote a repeated signal
  into a requirement (with its evidence), and route it through to `shipped` or
  `dropped`. Its §6 names the failure that actually matters — feedback that
  only ever lived in the Telegram scrollback.
- **create-skill** — shipped with every agent by the scaffold.

## Knowledge / migrations

No migrations, no Supabase, no `SCHEMA.md` symlink. `knowledge/` carries the
three files above plus `memory.md` — the latter for durable facts about how
Chris *thinks* (priorities, things ruled out and why), not task state, which
belongs in the requirement, and not the raw inputs, which belong in the log.

She reads the app and docs (`app/`, `docs/app/`, `docs/harness/`,
`docs/supabase-schema.md`) to know what the software does today — her prompt
requires it before proposing, so a change doesn't ignore how the thing already
works — and changes nothing outside her own dir.

## Operator setup

Two things are outstanding until the Telegram bot exists:

1. Set `lily.telegram.TELEGRAM_BOT_TOKEN` in `harness/.secrets/secrets.json`
   (or on Lily's Settings tab in the console).
2. Put the group's chat id in
   `harness/agents/lily/plugins/telegram/config.json` → `allowedChatIds`, so
   the bot only answers that group.

Then restart the harness (`sudo ./scripts/server.sh restart`). Hand edits to
harness data need a restart; console edits hot-reload.
