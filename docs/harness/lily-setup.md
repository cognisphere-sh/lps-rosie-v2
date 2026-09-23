# Lily configuration and integrations

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
- **model**: `openai-codex` / `gpt-6-astra` / thinkingLevel `xhigh`
- **threadIdStrategy**: `single` — one thread, `main`. Telegram and inbound
  agent messages all land there.
- **maxConcurrentSlots**: 5 · **maxAttempts**: 3
- **devAgent**: no
- No `secretsSchema` — she has no Supabase access and needs none. Her only
  secret is the telegram plugin's `TELEGRAM_BOT_TOKEN`.

## Plugins

- **telegram** — her only human channel. Bot `lps_lily_bot`, group
  `-1004474937526`, which `config.json` pins as her single `allowedChatIds`
  entry (`pollTimeoutSec: 25`). `state/routes.json` maps that chat to thread
  **`main`**, the same rule daisy, rosie and nova each carry for their own
  group — **without it telegram messages land on `default`**, not `main`,
  which is where her first few did before the rule was added. Rules are
  re-read on every poll batch, so adding one takes effect without a restart.
  Secret `lily.telegram.TELEGRAM_BOT_TOKEN`; without it the plugin logs
  `TELEGRAM_BOT_TOKEN not set; telegram plugin disabled` and the agent still
  starts. Outbound via `scripts/telegram/telegram-cli send-message`.
- **admin**, **scheduler**, **agent-messaging** — the core plugins,
  auto-installed on every agent. agent-messaging carries the handoffs both
  ways.

**No `webchat`** and **no `gws`** (no mailbox) and **no `artifacts`** — by
Chris's instruction. Having no webchat is why the app carries her as
`reachOn: 'Telegram'` in `app/lib/agents.ts`: she is listed on **Know your
Agents** and gets her own **settings tab** (model, schedules, run state — all
harness config), while the chat rail and selector show her disabled as "On
Telegram" and `/api/chat/lily/*` answers 404. See
[`../app/README.md`](../app/README.md) § *Agent chat*.

## Operator setup

Done, 2026-08-25: bot token set, group `-1004474937526` pinned in
`allowedChatIds`, and the `main` route added with

```sh
bash scripts/telegram/routes add --name main --thread-id main --chat '-1004474937526'
```

Note the ordering trap this deployment hit: the token was pasted before the
route existed, so the group's first messages opened a `sessions/default/`
thread. `threadIdStrategy: single` does **not** yield `main` on its own — the
route is what does, which is why all four agents carry one.

Hand edits to harness data need a restart (`sudo ./scripts/server.sh restart`);
console edits and telegram routes hot-reload.
