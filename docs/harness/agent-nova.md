# Agent: nova

**The developer agent.** Owns and modifies this deployment's code. Reachable
on Telegram and in the web app's chat panel.

## agent.json

- **name**: `nova`
- **description**: "Developer agent: owns and modifies this deployment's
  platform code — agent prompts/scripts, forked plugins, the user-facing
  frontend app, deploy scripts — and keeps docs/harness + docs/app current.
  Send code, app and docs change requests here. Reachable on Telegram and in
  the web app's chat panel, which route to the same thread."
- **model**: `openai-codex` / `gpt-5.6-terra` / thinkingLevel `medium`
- **threadIdStrategy**: `single`
- **`devAgent`: true**
- No `maxConcurrentSlots`, `secretsSchema`, or `config` (minimal — the dev agent).

## Purpose

Nova is the developer/engineering agent for the whole deployment. Its job is
not conversation but **owning and modifying the app-home code**: `app/`
(frontend), `harness/` (agent prompts, scripts, workspace, user-space plugins),
`scripts/` (deploy + lifecycle), and `docs/`. It follows repo
`CLAUDE.md`/`AGENT.md` on every change, works in small surgical git diffs, and
**never modifies the installed base harness library**
(`node_modules/@cognisphere-sh/cognisphere-harness` — read-only).

It can ship `app/` changes itself (`sudo ./scripts/server.sh restart app`) but
defers harness restarts to the operator (it lives inside the harness). It
maintains `docs/harness/` and `docs/app/`, and reads (never edits)
`docs/base-harness/`. Reachable on **Telegram** (`/reset` wipes its context)
and the **web app's chat panel** ([`webchat`](plugin-webchat.md)); both target
the `main` thread — webchat pins it in config, telegram via a `main` chat
route (daisy's pattern; until that route exists in
`plugins/telegram/state/routes.json`, telegram messages fall through to the
`single` strategy's `default` thread). Other agents are
instructed to pass code-change requests to Nova rather than modify the
platform themselves.

## Plugins

Enabled (per `system_prompts/plugin-*.md`; dirs materialize on first state write):

- **admin** — admin chat channel; the human admin reads Nova's visible text.
- **telegram** — Telegram bot (long-poll, server-side); inbound as
  `<harness-metadata>` blocks, media downloaded to `plugins/telegram/inbox/`,
  outbound via `scripts/telegram/telegram-cli`.
- **scheduler** — cron timers; `schedule_fire` events; `state/schedules.json`
  empty. Managed via `scripts/scheduler/scheduler-cli`.
- **agent-messaging** — core plugin since harness 0.8.0 (auto-installed on
  every agent); other agents route code-change requests to nova through it,
  and task threads are spawned with it.
- **webchat** — the web app's chat panel ([user-space
  plugin](plugin-webchat.md)); `config.json` sets `threadId: "main"` (plus
  explicit defaults for the other keys) so panel messages share the `main`
  thread with telegram's main route. Replies via
  `scripts/webchat/webchat-cli`.

## Scripts & extensions

`scripts/agent/` (shared toolset) + `scripts/scheduler/scheduler-cli` +
`scripts/telegram/telegram-cli` + `scripts/webchat/webchat-cli`. Extensions:
the three shared ones.

## Skills (`skills/agent/`)

- **cognisphere-upgrade** (v1.0.0) — drives the two-phase harness version
  upgrade (bump the dependency, migrate the data dir per the CHANGELOG).
- **create-plugin** (v1.1.0) — scaffolds a new user-space plugin in
  `harness/plugins/<id>/` and enables it on an agent; ships a `template/`
  (minimal `hello` interval plugin).

These skills are mirrored at the app-home `.claude/skills/` so coding agents run
inside the home (e.g. Claude Code) can use them too.

## Knowledge / migrations

None.
