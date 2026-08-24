# Plugin: webchat

**A browser chat channel for an agent.** User-space plugin at
`harness/plugins/webchat/`; enabled on [`daisy`](agent-daisy.md),
[`nova`](agent-nova.md) and [`rosie`](agent-rosie.md).

The web app's chat panel (`app/components/workspace/chat.tsx`) posts here
through a thin app-side proxy; the agent answers with the seeded
`scripts/webchat/webchat-cli`. Since 2026-08-23 the plugin is
**multi-thread**: every endpoint takes an optional thread id and keeps **one
transcript per thread**. The default (`threadId` config, table below) is the
thread telegram routes to, so the panel's default conversation and Telegram
stay one conversation; the panel's thread picker opens any other thread
(`jr-<id>`, `supplier-<slug>`, `customer-<slug>`, `router`), and the supplier
portal joins the supplier's own thread through the app-secret endpoints.
Delivery uses `threadIdOverride` throughout.

## Config

| Key | Default | Meaning |
|---|---|---|
| `threadId` | `main` | Thread web messages are delivered to (`threadIdOverride`). |
| `maxUploadMb` | `25` | Per-file upload cap; a bigger body gets HTTP 413. |
| `pendingTimeoutSec` | `900` | How long an unanswered web message may keep the "working…" indicator up before the panel drops it. Does not bound the queue half of the indicator. |
| `historyLimit` | `200` | Messages kept in memory and returned to the browser, per thread. |

One **optional** secret: `WEBCHAT_APP_SECRET` — enables the four server-to-server
portal endpoints below. Wired for rosie by `scripts/app/secrets.sh` (same
pattern as the artifacts and supplier-events secrets); without it they answer
404. Daisy and nova don't carry it.

## Endpoints — `/webhook/<agent>/webchat/api/*`

| Method + path | Caller | Purpose |
|---|---|---|
| `POST api/upload` | browser | Raw body + `x-file-name` → stores in `inbox/`, returns `{name, label, size, mime}`. |
| `POST api/send` | browser | `{text, attachments[], threadId?}` → records the message on that thread and wakes the agent there. |
| `GET api/messages?since=<id>&thread=<id>` | browser | `{messages, hasMore, pending, cursor}` — everything newer than `<id>` on that thread. Polled every 2s while the panel is open. |
| `GET api/messages?before=<id>` | browser | The page of history *older* than `<id>`, for the panel's "Load earlier messages". |
| &nbsp;&nbsp;`&limit=<n>` | browser | Keeps only the newest `n` of that window; `hasMore` says whether older ones remain. The 2s poll omits it — a delta must never be truncated. |
| `GET api/threads` | browser | `{threads:[{threadId,lastId,lastAt,lastRole,lastSender?,lastText}]}` — every thread with a transcript, newest first (`lastSender` only on portal messages). The panel's picker merges this with the app's `/api/chat-directory`; the app's unread tracking (`lib/chat-notifications.tsx`) compares `lastId` against per-browser read state. |
| `GET api/file?name=<stored>` | browser | The bytes of one attachment (any thread, inbox or outbox). |
| `POST api/reset` | browser | `{threadId?}` — wipes that thread's context **and** its transcript. |
| `POST api/reply` | the agent | `{text, attachments[], threadId?, portal?}` → the reply, defaulting to the config thread (the CLI defaults `threadId` to `$PI_THREAD_ID`); clears that thread's half of `pending`. |
| `POST api/app-upload?thread=<id>` | app server | Raw body + `x-file-name` + `X-App-Secret` → stages an allowlisted file (25MB by default) under a fixed-length opaque name and returns metadata plus an HMAC ticket bound to that exact thread/file. |
| `POST api/app-send` | app server | `{threadId, text?, attachments?, senderName}` + `X-App-Secret` → a supplier-portal message: verifies every staged attachment ticket and disk size, records it portal-visible, and delivers it with `Channel: portal`. Attachment-only messages are valid. |
| `GET api/app-messages?thread=<id>` | app server | `X-App-Secret` → the **portal-visible half** of that thread only: portal-sent messages and `--portal` replies. The team's internal panel traffic never crosses this endpoint. |
| `GET api/app-file?thread=<id>&name=<stored>` | app server | `X-App-Secret` → an inbox/outbox attachment only when that exact name occurs on a portal-visible row in that exact thread. |

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
- **All four `api/app-*` routes** require `WEBCHAT_APP_SECRET`
  (`X-App-Secret`) — presented by the app's *server* routes for the supplier
  portal, whose users are not harness users (portal auth is a deliberately
  deferred step, so this inherits the portal's public-by-URL posture). Portal
  uploads accept only raster images, common text/office documents and common
  audio containers; HTML/SVG and path-like names are refused or sanitized.
  Unreferenced portal uploads expire after one hour and are removed on startup
  or the next upload/send; the pending pool is capped at 20 files/100MB, and a
  single message at 10 files/50MB.

Both directions reject attachment paths that escape their directory —
`api/file` only serves names it finds in the transcript, and `api/reply`
refuses a path outside the agent dir. Portal uploads add an HMAC ticket binding
thread/name/label/MIME/size; `api/app-send` verifies it and the real disk size,
and `api/app-file` requires an exact portal-visible transcript reference. Thus
an upload staged for one supplier cannot be attached or served through another.
Opaque stored ids are validated without the 80-character display-label
truncation, so long supplier thread ids and filenames remain retrievable.

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
| The transcripts the panel renders | `agents/<id>/plugins/webchat/state/threads/<threadId>.jsonl` (append-only, one file per thread; the pre-multi-thread `transcript.jsonl` is migrated to the default thread's file on first start) |
| Uploaded files | `agents/<id>/plugins/webchat/inbox/` |
| Files the agent sends back | `agents/<id>/plugins/webchat/state/outbox/` |
| The event that wakes the agent | `agents/<id>/sessions/.events.db` — the harness's own queue |
| What the model sees | `agents/<id>/sessions/<threadId>/<sessionId>.jsonl` — pi's session, shared with Telegram |

The transcript is read into memory once at start; every append writes both, and
the browser polls memory rather than the file. `historyLimit` therefore also
bounds how far "Load earlier messages" can walk back — paging reads the same
in-memory window, not the file. It is deliberately separate from
the pi session jsonl, which holds tool calls and reasoning and is not a chat log.

## The "working…" indicator

`pending` is the OR of two things, because the agent works for more callers than
the panel:

1. **This panel is owed a reply** — plugin-side state: true when a user message
   is handed to the agent, false on the agent's first `webchat-cli send`.
2. **The agent has an event in flight** — any row at `status=in_flight` in its
   queue, whatever put it there: a Telegram message, a cron tick, another
   agent's ping. Read per poll from the harness's own
   `GET /api/agents/<id>/events?status=in_flight&limit=1`, with the browser's
   session cookie forwarded (the same cookie the request already authenticated
   with). An unreachable or unauthorized harness answers "not working" rather
   than failing the poll.

So the sidebar reads *Working…* whenever the agent is actually busy, not only
when the busyness started in the panel.

Three consequences worth knowing:

- A **harness restart clears (1)**, because it is in-memory. That is the right
  failure direction: a restarted harness is not mid-turn. (2) needs no clearing
  — it is a live query.
- A reply that goes out over **Telegram instead of the panel** does not clear
  (1) (same thread, different channel). `pendingTimeoutSec` is the backstop, so
  the panel recovers on its own rather than spinning forever.
- A **queued-but-not-yet-dispatched** event does not count as working. Only
  `in_flight` does — queued means nobody is chewing on it yet.

## Inbound event shape

`Plugin: webchat` · `Channel: web` (panel) or `Channel: portal` (supplier
portal) · `ThreadId: <the message's thread>` plus:

| Field | Meaning |
|---|---|
| `SenderName` | The signed-in app user (harness session — not self-reported), or `<Supplier name> (portal)` for portal messages. |
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
