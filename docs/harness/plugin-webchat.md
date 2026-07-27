# Plugin: webchat

**A browser chat channel for an agent.** User-space plugin at
`harness/plugins/webchat/`; enabled on [`daisy`](agent-daisy.md).

The web app's chat panel (`app/components/workspace/chat.tsx`) posts here
through a thin app-side proxy; the agent answers with the seeded
`scripts/webchat/webchat-cli`. Messages land on the thread named in config —
`main` for daisy, **the same thread telegram routes to** — so the panel and
Telegram are one conversation, not two.

## Config

| Key | Default | Meaning |
|---|---|---|
| `threadId` | `main` | Thread web messages are delivered to (`threadIdOverride`). |
| `maxUploadMb` | `25` | Per-file upload cap; a bigger body gets HTTP 413. |
| `pendingTimeoutSec` | `900` | How long the "working…" indicator may stay up without a reply before the panel drops it. |
| `historyLimit` | `200` | Messages kept in memory and returned to the browser. |

No secrets.

## Endpoints — `/webhook/<agent>/webchat/api/*`

| Method + path | Caller | Purpose |
|---|---|---|
| `POST api/upload` | browser | Raw body + `x-file-name` → stores in `inbox/`, returns `{name, label, size, mime}`. |
| `POST api/send` | browser | `{text, attachments[]}` → records the message and wakes the agent. |
| `GET api/messages?since=<id>` | browser | `{messages, pending, cursor}`. Polled every 2s while the panel is open. |
| `GET api/file?name=<stored>` | browser | The bytes of one attachment (inbox or outbox). |
| `POST api/reset` | browser | Wipes the thread's context **and** the transcript. |
| `POST api/reply` | the agent | `{text, attachments[]}` → the reply, and clears `pending`. |

### Auth — two callers, two mechanisms

The webhook router does **not** authenticate; each plugin does its own. This
one has two kinds of caller, so it has two checks:

- **Browser routes** require a real harness session: the plugin forwards the
  request's cookie to the harness's own `/api/auth/me` and refuses unless a user
  comes back. Presence of `pi_sid` is not enough — it is a signed stateless
  token, so it must actually be resolved. Without this, anyone who can reach the
  port could chat as the operator and write files into the agent's inbox.
- **`api/reply`** requires `COGNISPHERE_WEBHOOK_SECRET`, which only in-harness
  processes have (the harness injects it into every agent's env).

Both directions reject attachment paths that escape their directory —
`api/file` only serves names it finds in the transcript, and `api/reply`
refuses a path outside the agent dir.

`api/file` takes its `Content-Length` from `stat` on the file, **not** from the
transcript's `size` — that field is client-declared on uploads, and a length
that disagrees with the body truncates or hangs the response. It also sends
`Accept-Ranges: bytes`, without which the voice player cannot seek.

### The CLI does not hardcode a port

`webchat-cli` builds its URL from **`$PI_WEBHOOK_BASE`**
(`<server>/webhook/<agent>`, exported by the runner), not a literal port. This
harness serves on **3142**, not the library default, so a hardcoded fallback
would have failed here — and would fail again the next time the port moved.
`HARNESS_BASE_URL` overrides the origin; with neither set the CLI exits with an
error rather than silently posting into the void.

## Where messages live

Three places, each with a different job — the plugin adds **no new database**:

| What | Where |
|---|---|
| The transcript the panel renders | `agents/<id>/plugins/webchat/state/transcript.jsonl` (append-only, one object per message) |
| Uploaded files | `agents/<id>/plugins/webchat/inbox/` |
| Files the agent sends back | `agents/<id>/plugins/webchat/state/outbox/` |
| The event that wakes the agent | `agents/<id>/sessions/.events.db` — the harness's own queue |
| What the model sees | `agents/<id>/sessions/<threadId>/<sessionId>.jsonl` — pi's session, shared with Telegram |

The transcript is read into memory once at start; every append writes both, and
the browser polls memory rather than the file. It is deliberately separate from
the pi session jsonl, which holds tool calls and reasoning and is not a chat log.

## The "working…" indicator

`pending` goes true when a user message is handed to the agent and false on the
agent's first `webchat-cli send`. It is plugin-side state, not a harness query —
the harness exposes no per-thread busy flag.

Two consequences worth knowing:

- A **harness restart clears it**, because it is in-memory. That is the right
  failure direction: a restarted harness is not mid-turn.
- A reply that goes out over **Telegram instead of the panel** does not clear it
  (same thread, different channel). `pendingTimeoutSec` is the backstop, so the
  panel recovers on its own rather than spinning forever.

## Inbound event shape

`Plugin: webchat` · `Channel: web` · `ThreadId: <config.threadId>` plus:

| Field | Meaning |
|---|---|
| `SenderName` | The signed-in app user, taken from the harness session — not self-reported. |
| `MessageId` | The plugin's own id for the message. |
| `Attachments` | Agent-dir-relative paths, present only when files were attached. |

Attachments are also inlined in the body as
`<originalName>[plugins/webchat/inbox/<stored-name>]`, the same shape telegram
uses, so the agent can `read` them without reconstructing a path.

## Verifying a change

The plugin has no build step. To exercise it without touching the deployment,
run a throwaway harness dir containing only `harness.json`, `plugins/webchat/`
and one agent with `plugins/webchat/` enabled, then check the log for
`plugin loaded` with `"scope":"user"` and `agent started` listing `webchat`.
`webchat-cli --self-check` verifies the CLI's payload offline.
