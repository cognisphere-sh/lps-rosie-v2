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
- **model**: `openai-codex` / `gpt-6.1-sol` / thinkingLevel `high`
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
defers harness restarts to the operator (it lives inside the harness). Code
work follows `1-agent.md` § *Shipping a change*, which overrides the base
prompt's *Delegate aggressively* guidance. One builder task thread (no nested
threads) edits on `main`, runs typecheck plus the relevant test files, and
deploys with `restart app`. A human's "deploy" counts as authorization, and the
target is same-day. Heavy steps run one at a time because the host has ~8 GB RAM
and 4 GB swap. Only humans add new gates or approval stages. UI changes also go
through `visual-ui-release-qa`, Chris's gate: preview screenshots at
320/390/480/1440 are reviewed by one fresh task thread, and a FAIL blocks the
restart. Non-UI changes skip it. It maintains
`docs/harness/` and `docs/app/`, and reads (never edits) `docs/base-harness/`.
Reachable on **Telegram** (`/reset` wipes its context)
and the **web app's chat panel** ([`webchat`](plugin-webchat.md)); both target
the `main` thread — webchat pins it in config, telegram via a `main` chat
route (daisy's pattern; until that route exists in
`plugins/telegram/state/routes.json`, telegram messages fall through to the
`single` strategy's `main` thread). Nova's prompt identifies Telegram group
`-1004330045748` as its shared communication channel with Bhoumik Shah and
Chris, and reminds it that group messages are visible to everyone there. Other
agents are instructed to pass code-change requests to Nova rather than modify
the platform themselves.

### Requirements from lily (2026-08-25)

Lily, the [project-manager agent](agent-lily.md), routes **UI/UX
requirements** to nova as approved-to-build work — acceptance criteria in the
message, ship it and report back to her thread. Two things nova must not do:
build a **database or workflow** requirement (those are staged for Bhoumik —
send it back to that queue), and keep Chris's *feature design* or his
*complaints about how the work goes* to himself (point him at Lily and send her
the context — the complaint is what her log exists for). `1-agent.md`
§ *Requirements from Lily*.

## Plugins

Enabled (per `system_prompts/plugin-*.md`; dirs materialize on first state write):

- **admin** — admin chat channel; the human admin reads Nova's visible text.
- **telegram** — Telegram bot (long-poll, server-side); inbound as
  `<harness-metadata>` blocks, media downloaded to `plugins/telegram/inbox/`,
  outbound via `scripts/telegram/telegram-cli`. Ships the plugin-owned
  `route-chats` skill.
- **artifacts** — publishes self-contained HTML pages on the app's domain.
  Config `{"appBaseUrl": "https://lps.cognisphere.sh/a/nova"}` — the `/a/nova`
  prefix is what keeps its links distinct from Daisy's, since the plugin appends
  `/<public|private>/artifacts/<slug>` itself. Secret `ARTIFACTS_APP_SECRET`,
  shared with Daisy and the app (written by `scripts/app/secrets.sh`). Ships the
  plugin-owned `publish-artifact` skill and `scripts/artifacts/artifact`. See
  [`../app/README.md`](../app/README.md) § *Agent artifacts*.
- **scheduler** — cron timers; `schedule_fire` events; `state/schedules.json`
  empty. Managed via `scripts/scheduler/scheduler-cli`.
- **agent-messaging** — core plugin since harness 0.8.0 (auto-installed on
  every agent); other agents route code-change requests to nova through it,
  and task threads are spawned with it.
- **webchat** — the web app's chat panel ([user-space
  plugin](plugin-webchat.md)); `config.json` sets `threadId: "main"` (plus
  explicit defaults for the other keys) so panel messages share the `main`
  thread with telegram's main route. Replies via
  `scripts/webchat/webchat-cli`. Secrets `WEBCHAT_SUPABASE_URL` /
  `WEBCHAT_SUPABASE_SECRET_KEY` (2026-08-26) — her only Supabase access;
  transcripts live in `threads` / `thread_messages`, migration 0078.

## Scripts & extensions

`scripts/agent/` (shared toolset) + `scripts/scheduler/scheduler-cli` +
`scripts/telegram/telegram-cli` + `scripts/webchat/webchat-cli`. Extensions:
the four shared ones.

## Skills (`skills/agent/`)

- **cognisphere-upgrade** — drives the two-phase harness version
  upgrade (bump the dependency, migrate the data dir per the CHANGELOG).
- **create-plugin** — scaffolds a new user-space plugin in
  `harness/plugins/<id>/` and enables it on an agent; ships a `template/`
  (minimal `hello` interval plugin).
- **create-skill** — authors or updates a versioned agent skill, and
  migrates a procedure out of a prompt file or `knowledge/` into one.
- **visual-ui-release-qa** — Chris's pre-deploy visual gate for UI changes.
  The builder previews the committed primary checkout on `127.0.0.1:3100`
  using the app's existing dev command, with no worktree, dependency install
  or separate production build. Existing login/capture helpers retain each
  affected state at 320/390/480/1440; finite browser-only synthetic responses
  must deny unexpected business writes. One fresh task thread reviews the
  PNGs against the reference and records PASS/FAIL under `files/visual-qa/`.
  A FAIL blocks `restart app`. The owned preview dev server and browser stop
  before deployment; the historical worktree preview helper is not used.
- **app-video-tutorials** — creates or updates the app's narrated video
  tutorials (the partner onboarding series on `/partner-onboarding`) in the
  house style, using `video/partner-onboarding/`. Footage comes only from a
  local demo copy with made-up data, never production. Covers scripting,
  demo checkpoints, Kokoro narration, Playwright recording and its known
  traps, Remotion rendering and publishing. Ships a style guide, script and
  recorder templates, beat and contact-sheet checkers and the read-only schema
  catalog queries. Heavy steps run one at a time on the host.

The cognisphere-authored skills are mirrored at the app-home `.claude/skills/`
so coding agents run
inside the home (e.g. Claude Code) can use them too.

## Knowledge / migrations

No migrations. `knowledge/` carries only the harness 0.8.18 scaffold —
`index.md` with an empty `files/`, and `memory.md` holding one section
(`telegram-contacts`: the `-1004330045748` group is Nova's channel to Bhoumik
and Chris), migrated from the old `workspace/memory/`.
