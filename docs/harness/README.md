# Harness documentation

Documentation for **this deployment's** harness data dir (`harness/`): its
agents and user-space plugins. Owned by whoever changes the code — the
developer agent (`dory`) or a human — and updated **after every change** under
`harness/` (see `CLAUDE.md` §7). How the harness platform itself works is
documented in [`../base-harness/`](../base-harness/README.md).

Layout: one file per agent (`agent-<id>.md`) and one per user-space plugin
(`plugin-<id>.md`).

## This deployment

- `harness.json` — version **0.7.1**, timezone **America/Chicago**.
- This is the **LPS · Rosie** deployment — Local/Austin Plant Supply, a
  wholesale plant nursery. Two agents run the supply and dev split.

> The `rosie` customer-success agent has been **removed** and will be rebuilt
> from scratch; the deployment keeps the name (systemd units `rosie-harness` /
> `rosie-app`, package `cognisphere-harness-rosie`) because that is deploy
> identity, not the agent.

## Agents

| Agent | Role | Model | Thread strategy | Reachable via |
|---|---|---|---|---|
| [`daisy`](agent-daisy.md) | Supplier management & availability ingestion into Supabase | `openai-codex` / `gpt-5.6-terra` | `plugin_channel` | Telegram main thread + Gmail + the app's chat panel |
| [`dory`](agent-dory.md) | Developer agent — owns and modifies this deployment's code | `openai-codex` / `gpt-5.6-terra` | `single` | Telegram (dev) |

Comparison:

| | daisy | dory |
|---|---|---|
| `devAgent` | — | **true** |
| `maxConcurrentSlots` | 5 | — |
| `secretsSchema` | Supabase (4 keys) | — |
| Plugins | admin, agent-messaging, gws, scheduler, telegram, **webchat** | admin, scheduler, telegram |
| Knowledge dir | SCHEMA (symlink), suppliers, gmail-labels, SOP | — |
| Migrations | 0001 (applied, superseded) | — |
| Skills | — | cognisphere-upgrade, create-plugin |

The web app (`app/`) reads Supabase directly for its tables; it uses the
harness for the operator login and for the **chat panel**, which talks to
daisy through the [`webchat`](plugin-webchat.md) plugin. See
[`../app/README.md`](../app/README.md).

### Database schema is shared, not per-agent

[`docs/supabase-schema.md`](../supabase-schema.md) is the single source of truth
for the Supabase schema, for agents and the app alike.
`harness/agents/daisy/knowledge/SCHEMA.md` is a **symlink** to it, so daisy's
existing cwd-relative `knowledge/SCHEMA.md` references keep working and edits
through the symlink land in the shared file.

Give any new agent that needs database access the same symlink — never a copy:

```sh
ln -s ../../../../docs/supabase-schema.md harness/agents/<agent>/knowledge/SCHEMA.md
```

### Shared across all agents

These are byte-identical in every agent dir:

- **Extensions** (`extensions/`): `bash-guard.ts` prepends `set -u` to every
  agent `bash` command so an unset `$var` inside quotes fails loudly (opt out
  per-command with `set +u`); `harness-bridge.ts` reports each user-message
  session entry id back to the harness in real time so the parent can link a
  queued event to its place in the session JSONL.
- **`scripts/agent/` toolset**: `agent-browser` (browser CLI), `ddgs` (web
  metasearch), `markitdown` (file/URL → markdown), `session-reader` (paginated
  session-transcript reader), `subagent` (`pi -p` wrapper pinning the configured
  subagent model), `sub-agent-prompt.md` (brief injected into every sub-agent).
- **Bootstrap** (`bootstrap/bootstrap.sh` + `requirements.txt`): provisions the
  Python `.venv` (`ddgs`, `markitdown`) and npm globals on every start.
- **Base system prompts**: `0-base_prompt.md`, `0.1-main-agent.md`,
  `0.3-agent-directory.md`, then the per-agent `1-*.md` persona.

## Plugins

One user-space plugin lives in `harness/plugins/`:

| Plugin | Purpose | Enabled on |
|---|---|---|
| [`webchat`](plugin-webchat.md) | Browser chat channel for the web app — inbox at `/webhook/<agent>/webchat/api/*`, replies via `scripts/webchat/webchat-cli` | daisy |

No catalog plugins are forked. Every other plugin an agent uses is a bundled
core/catalog plugin enabled by an empty `agents/<id>/plugins/<plugin>/` dir;
per-agent config and prompt notes are documented in each agent's file.

> Note: a plugin dir materializes on disk only once the plugin writes state, so
> the authoritative list of enabled plugins per agent is its
> `system_prompts/plugin-*.md` set, not the current contents of `plugins/`.
