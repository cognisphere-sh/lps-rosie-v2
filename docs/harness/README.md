# Harness documentation

Documentation for **this deployment's** harness data dir (`harness/`): its
agents and user-space plugins. Owned by whoever changes the code — the
developer agent (`dory`) or a human — and updated **after every change** under
`harness/` (see `CLAUDE.md` §7). How the harness platform itself works is
documented in [`../base-harness/`](../base-harness/README.md).

Layout: one file per agent (`agent-<id>.md`) and one per user-space plugin
(`plugin-<id>.md`).

## This deployment

- `harness.json` — version **0.5.1**, timezone **America/Chicago**.
- This is the **LPS · Rosie** deployment — Local/Austin Plant Supply, a
  wholesale plant nursery. Three agents run the supply/customer/dev split.

## Agents

| Agent | Role | Model | Thread strategy | Reachable via |
|---|---|---|---|---|
| [`rosie`](agent-rosie.md) | Customer success coordinator for Austin Plant Supply — one instance per customer | `openai-codex` / `gpt-5.5` | `single` | admin chat |
| [`daisy`](agent-daisy.md) | Supplier management & availability ingestion into Supabase | `openai-codex` / `gpt-5.6-terra` | `plugin_channel` | Telegram admin thread + Gmail |
| [`dory`](agent-dory.md) | Developer agent — owns and modifies this deployment's code | `openai-codex` / `gpt-5.6-terra` | `single` | Telegram (dev) |

Comparison:

| | rosie | daisy | dory |
|---|---|---|---|
| `devAgent` | — | — | **true** |
| `maxConcurrentSlots` | 5 | 5 | — |
| `secretsSchema` | — | Supabase (4 keys) | — |
| Plugins | admin, scheduler | admin, agent-messaging, gws, scheduler, telegram | admin, scheduler, telegram |
| Knowledge dir | — (shared workspace) | SCHEMA, suppliers, gmail-labels, SOP | — |
| Migrations | — | 0001 (applied) | — |
| Skills | — | — | cognisphere-upgrade, create-plugin |

The web app (`app/`) targets **`rosie` only**.

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

No catalog plugins are forked into `harness/plugins/` in this deployment
(`.gitkeep` only). Every plugin an agent uses is a bundled core/catalog plugin
enabled by an empty `agents/<id>/plugins/<plugin>/` dir; per-agent config and
prompt notes are documented in each agent's file.

> Note: a plugin dir materializes on disk only once the plugin writes state, so
> the authoritative list of enabled plugins per agent is its
> `system_prompts/plugin-*.md` set, not the current contents of `plugins/`.
