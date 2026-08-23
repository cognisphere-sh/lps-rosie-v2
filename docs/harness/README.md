# Harness documentation

Documentation for **this deployment's** harness data dir (`harness/`): its
agents and user-space plugins. Owned by whoever changes the code — the
developer agent (`nova`) or a human — and updated **after every change** under
`harness/` (see `CLAUDE.md` §7). How the harness platform itself works is
documented in [`../base-harness/`](../base-harness/README.md).

Layout: one file per agent (`agent-<id>.md`) and one per user-space plugin
(`plugin-<id>.md`).

## This deployment

- `harness.json` — version **0.9.2**, timezone **America/Chicago**.
- This is the **LPS · Rosie** deployment — Local/Austin Plant Supply, a
  wholesale plant nursery. Three agents split the work: supplier side,
  customer side, and dev.

## Agents

| Agent | Role | Model | Thread strategy | Reachable via |
|---|---|---|---|---|
| [`daisy`](agent-daisy.md) | Supplier management & availability ingestion into Supabase | `openai-codex` / `gpt-5.6-terra` | `plugin_channel` | Telegram main thread + Gmail + the app's chat panel |
| [`rosie`](agent-rosie.md) | Customer-success agent — owns customers & job requests in Supabase | `openai-codex` / `gpt-5.6-terra` | `plugin_channel` | The app's chat panel and Telegram, both on the `main` thread (see her doc) |
| [`nova`](agent-nova.md) | Developer agent — owns and modifies this deployment's code | `openai-codex` / `gpt-5.6-sol` | `single` | Telegram (dev) + the app's chat panel |

Comparison:

| | daisy | rosie | nova |
|---|---|---|---|
| `devAgent` | — | — | **true** |
| `maxConcurrentSlots` | 10 | 10 | — |
| `secretsSchema` | Supabase (4 keys) | Supabase (4 keys, same values) | — |
| Plugins | admin, artifacts, gws, scheduler, telegram, **webchat** (+ core: agent-messaging) | admin, artifacts, scheduler, telegram, **webchat** (+ core: agent-messaging); **gws pending** a mailbox | admin, artifacts, scheduler, telegram, **webchat** (+ core: agent-messaging) |
| Knowledge dir | `files/`: SCHEMA (symlink), suppliers, brand, credentials, plans, templates, plant-reference-photos; `memory.md` | `files/`: SCHEMA (symlink), templates; `memory.md` | `memory.md` only |
| Migrations | 0001–0055 (the deployment's record; 0055's tables are rosie-owned) | — (recorded in daisy's dir) | — |
| Skills | 7 LPS procedures + create-skill | job-requests, plant-and-supplier-search, quote-generation + create-skill | cognisphere-upgrade, create-plugin, create-skill |

The web app (`app/`) reads Supabase directly for its tables; it uses the
harness for the operator login and for the **chat panel**, which talks to
daisy, nova and rosie through the [`webchat`](plugin-webchat.md) plugin. See
[`../app/README.md`](../app/README.md).

### Database schema is shared, not per-agent

[`docs/supabase-schema.md`](../supabase-schema.md) is the single source of truth
for the Supabase schema, for agents and the app alike.
`harness/agents/daisy/knowledge/files/SCHEMA.md` is a **symlink** to it, so
daisy's cwd-relative `knowledge/files/SCHEMA.md` references resolve to the
shared file and edits through the symlink land there.

Give any new agent that needs database access the same symlink — never a copy:

```sh
ln -s ../../../../../docs/supabase-schema.md harness/agents/<agent>/knowledge/files/SCHEMA.md
```

(Reference docs moved from `knowledge/` to `knowledge/files/` in harness
0.8.18, which is why the relative path climbs one extra level.)

### Shared across all agents

These are byte-identical in every agent dir:

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
  Python `.venv` (`ddgs`, `markitdown`) and npm globals on every start.
- **Base system prompts**: `0-base_prompt.md` (identity, tools, workspace,
  skills, threads, task threads), `0.1-agent-directory.md` (roster), then the
  per-agent `1-*.md` persona. Since harness 0.8.12 the ownership split is a
  contract: `0-*` is harness-owned (replaced by the seed on every upgrade),
  `plugin-<id>.md` is plugin-owned (reseeded on every agent start), and `1-*.md`
  is deployment-owned — identity, persona and behaviour only, no procedures.
  Step-by-step procedures live in `skills/agent/<slug>/` instead.

  **One local edit to `0-base_prompt.md`**, identical in daisy, nova and rosie
  (2026-08-15; rosie's copy taken from daisy's at creation): the **Task
  threads** bullet that names the skill to follow now
  forbids quoting a version number in the brief, where the seed asked for "skill
  name and its current version". The receiving thread's `<available_skills>` is
  rebuilt at spawn, so it resolves the name to the current version by itself,
  and a version copied into a brief is wrong the moment the skill is bumped. As
  a `0-*` edit this diverges from the seed — the `cognisphere-upgrade` skill's
  local-edit pass (step 4a/4c) must carry it across upgrades or the seed wording
  comes back.

## Plugins

One user-space plugin lives in `harness/plugins/`:

| Plugin | Purpose | Enabled on |
|---|---|---|
| [`webchat`](plugin-webchat.md) | Browser chat channel for the web app — inbox at `/webhook/<agent>/webchat/api/*`, replies via `scripts/webchat/webchat-cli` | daisy, nova, rosie |

(`supplier-events` — the app→daisy webhook for portal activity — was dropped
2026-08-23 in the agent restructure; it returns, re-targeted, when rosie takes
over request management.)

No catalog plugins are forked. Every other plugin an agent uses is a bundled
core/catalog plugin enabled by an empty `agents/<id>/plugins/<plugin>/` dir;
per-agent config and prompt notes are documented in each agent's file.

> Note: a plugin dir materializes on disk only once the plugin writes state, so
> the authoritative list of enabled plugins per agent is its
> `system_prompts/plugin-*.md` set, not the current contents of `plugins/`.
