# Harness documentation

Documentation for **this deployment's** harness data dir (`harness/`): its
agents and user-space plugins. Owned by whoever changes the code — the
developer agent (`nova`) or a human — and updated **after every change** under
`harness/` (see `CLAUDE.md` §7). How the harness platform itself works is
documented in [`../base-harness/`](../base-harness/README.md).

Layout: one file per agent (`agent-<id>.md`) and one per user-space plugin
(`plugin-<id>.md`). The local [Google Workspace fork](plugin-gws.md) documents
collision-safe attachment downloads, canonical CLI invocation and reseeding.

## This deployment

- `harness.json` — version **0.11.1**, timezone **America/Chicago**.
- This is the **LPS · Rosie** deployment — Local/Austin Plant Supply, a
  wholesale plant nursery. Four agents split the work: supplier side,
  customer side, and dev — plus one, `lily`, whose scope is the whole:
  Chris's feedback, the picture of the business, and what to improve.

## Agents

[Prompt maintenance](prompt-maintenance.md) documents the compact Rosie/Daisy/Lily
instructions, task references, helper scripts and offline checks. Agent pages
link separately to setup and historical migration material.

| Agent | Role | Model | Thread strategy | Reachable via |
|---|---|---|---|---|
| [`daisy`](agent-daisy.md) | Supplier management & availability ingestion into Supabase | `openai-codex` / `gpt-5.6-terra` | `plugin_channel` | Telegram main thread + Gmail + the app's chat panel |
| [`rosie`](agent-rosie.md) | Customer-success agent — owns customers & job requests in Supabase | `openai-codex` / `gpt-6-sol` | `plugin_channel` | The app's chat panel and Telegram, both on the `main` thread (see her doc) |
| [`nova`](agent-nova.md) | Developer agent — owns and modifies this deployment's code | `openai-codex` / `gpt-5.6-sol` | `single` | Telegram (dev) + the app's chat panel |
| [`lily`](agent-lily.md) | Project manager — records Chris's continuous feedback, keeps the picture of the business, turns what repeats into workflow and app changes | `openai-codex` / `gpt-5.6-terra` | `single` | **Telegram only** |

Comparison:

| | daisy | rosie | nova | lily |
|---|---|---|---|---|
| `devAgent` | — | — | **true** | — |
| `maxConcurrentSlots` | 10 | 10 | — | 5 |
| `secretsSchema` | Supabase (4 keys) | Supabase (4 keys, same values) | — | — |
| Plugins | admin, artifacts, gws, scheduler, telegram, **webchat** (+ core: agent-messaging) | admin, artifacts, **gws** (`chris@localplantsupply.com` — configured, polling off until sign-in), scheduler, supplier-events, telegram, **webchat** (+ core: agent-messaging) | admin, artifacts, scheduler, telegram, **webchat** (+ core: agent-messaging) | admin, scheduler, telegram (+ core: agent-messaging) — **no webchat, no gws, no artifacts** |
| Knowledge dir | `files/`: SCHEMA (symlink), suppliers, brand, credentials, plans, templates, plant-reference-photos; `memory.md` | `files/`: SCHEMA (symlink), templates; `memory.md` | `memory.md` only | `files/`: `feedback.md` (the log), `business/` (the picture), `requirements/` (the backlog); `memory.md` |
| Migrations | 0001–0055 (the deployment's record; 0055's tables are rosie-owned) | — (recorded in daisy's dir) | — | — |
| Skills | Task menus in [Daisy](agent-daisy.md), plus database-access/create-skill | Task menus in [Rosie](agent-rosie.md), plus database-access/create-skill | cognisphere-upgrade, create-plugin, create-skill | feedback-loop, create-skill |

The web app (`app/`) reads Supabase directly for its tables; it uses the
harness for the operator login and for the **chat panel**, which talks to
daisy, nova and rosie through the [`webchat`](plugin-webchat.md) plugin. See
[`../app/README.md`](../app/README.md).

### Database schema is shared, not per-agent

[`docs/supabase-schema.md`](../supabase-schema.md) is the single source of truth
for the Supabase schema, for agents and the app alike.
Daisy and Rosie’s `knowledge/files/SCHEMA.md` files are **symlinks** to it;
edits through either path update the shared reference. Applied database
migrations are recorded in `harness/agents/daisy/migrations/NOTE.md`.

Give any new agent that needs database access the same symlink — never a copy:

```sh
ln -s ../../../../../docs/supabase-schema.md harness/agents/<agent>/knowledge/files/SCHEMA.md
```

(Reference docs moved from `knowledge/` to `knowledge/files/` in harness
0.8.18, which is why the relative path climbs one extra level.)

### Shared across all agents

The common runtime resources are shared:

- **Extensions** (`extensions/`): `bash-guard.ts` prepends `set -u` to every
  agent `bash` command so an unset `$var` inside quotes fails loudly (opt out
  per-command with `set +u`); `harness-bridge.ts` reports each user-message
  session entry id back to the harness in real time so the parent can link a
  queued event to its place in the session JSONL; `context-meta.ts` (seeded in
  harness 0.8.6, rewritten in 0.8.15) emits one indexed `Checkpoint` /
  `CheckpointTokens` message before **every** LLM call, after that call's inputs
  are in place, and injects live `Model`/`ContextUsage` telemetry into each call;
  `skill-update-notice.ts` (new in 0.8.15, semantics revised in 0.8.16) records
  the frontmatter version of every `SKILL.md` the agent reads and injects a
  one-time `SystemMessage` notice when that file's version later differs —
  upgrades and reverts alike.
- **`scripts/agent/` toolset**: `agent-browser` (browser CLI), `ddgs` (web
  metasearch), `markitdown` (file/URL → markdown), `session-reader` (paginated
  session-transcript reader). (The `subagent` wrapper and `sub-agent-prompt.md`
  were removed in harness 0.8.0 — delegation now runs through task threads via
  the core agent-messaging plugin.)
- **Bootstrap** (`bootstrap/bootstrap.sh` + `requirements.txt`): provisions the
  Python `.venv` (`ddgs`, `markitdown`) and npm globals on every start; since
  harness 0.11.1 it also pins the global `pi` to `PI_VERSION` (0.84.4),
  installing that exact version on any mismatch.
- **System prompts**: preserve harness-provided `0-*` base prompts unchanged.
  Deployment-owned `1-*` files hold identity, boundaries and routing; plugin
  prompts are reseeded on start. Rosie, Daisy and Lily's simplification is
  limited to deployment prompts and agent skills; see
  [prompt maintenance](prompt-maintenance.md). Nova is unchanged.
- **Skill references** name the skill without copying its version; the current
  version comes from the spawn-time catalogue. Each skill's own frontmatter
  and changelog remain authoritative.

## Plugins

Two user-space plugins live in `harness/plugins/`:

| Plugin | Purpose | Enabled on |
|---|---|---|
| [`webchat`](plugin-webchat.md) | Browser chat channel for the web app — inbox at `/webhook/<agent>/webchat/api/*`, replies via `scripts/webchat/webchat-cli` | daisy, nova, rosie |
| [`supplier-events`](plugin-supplier-events.md) | App→rosie webhook: a supplier saved an availability request in their portal — lands on the supplier's `rosie_thread_id` thread | rosie |

No catalog plugins are forked. Every other plugin an agent uses is a bundled
core/catalog plugin enabled by an empty `agents/<id>/plugins/<plugin>/` dir;
per-agent config and prompt notes are documented in each agent's file.

> Note: a plugin dir materializes on disk only once the plugin writes state, so
> the authoritative list of enabled plugins per agent is its
> `system_prompts/plugin-*.md` set, not the current contents of `plugins/`.

### AR supplier response note (migration 0095)

`availability_requests.note_for_supplier` stores shared request-wide sourcing requirements and supplier replies,
separate from LPS instructions and line notes. The new trusted submission RPCs
validate supplier ownership or the public token and use the existing row-lock
closure guard. The note and submitted status commit in one transaction. The
normal submission event directs Rosie to the saved AR, including this note.
Migration `0095_availability_supplier_note.sql` was applied and verified live
on 2026-09-15 at 13:20 UTC alongside order migration 0094. App deployment is separate.

### Job deletion cascade (migration 0097)

`0097_job_delete_dependents.sql` replaces orphan-AR retention on job deletion
with an atomic cascade for exclusively associated ARs and orders. Shared
records are retained. The canonical Rosie thread is deleted and its permanent
marker prevents recreation, while webchat retries harness-context cleanup.
Migration 0097 was applied on 2026-09-15 at 14:23 UTC before app/plugin
deployment. It does not retroactively delete already orphaned historical records.

### Deployment verification — 2026-09-15

The app and harness restarted at 14:26 UTC after migration 0097. Both services
and all four agents are running; webchat is running for Daisy, Nova and Rosie.
The local and public app login endpoints return HTTP 200. The Daisy and Rosie
Google Workspace plugins still require Google sign-in through Settings; their
credential-file secrets were absent before this deployment.

Rosie’s merged note contract (migration 0115): job headers/items retain
`note_for_customer` plus private `note_internal`; AR headers/items retain one
`note_for_supplier`; order headers/items retain one note per audience. Skills
preserve requirements alongside supported responses, exclude spacing and other
non-sourcing details, and distinguish actual supplier responses from seeded ask
text. The quote script renders merged multiline notes as concise inline text.
