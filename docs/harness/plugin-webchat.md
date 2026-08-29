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

**Since 2026-08-26 the transcripts live in Supabase** — `threads` and
`thread_messages` (migration 0078, [`docs/supabase-schema.md`](../supabase-schema.md))
— not in per-agent JSONL files. The plugin is the only writer and keeps a
write-through in-memory copy (the newest `historyLimit` per thread, loaded at
start), so every endpoint below still answers from memory with the same
contract; the database is what survives a restart, what the entity tables'
`*_thread_ref` columns point at, and what the app subscribes to (Supabase
Realtime → SSE) instead of polling on a timer.

## Config

| Key | Default | Meaning |
|---|---|---|
| `threadId` | `main` | Thread web messages are delivered to (`threadIdOverride`). |
| `maxUploadMb` | `25` | Per-file upload cap; a bigger body gets HTTP 413. |
| `pendingTimeoutSec` | `900` | How long an unanswered web message may keep the "working…" indicator up before the panel drops it. Does not bound the queue half of the indicator. |
| `historyLimit` | `200` | Messages kept in memory and returned to the browser, per thread. |

Secrets — all wired by `scripts/app/secrets.sh`:

| Key | Required | Meaning |
|---|---|---|
| `WEBCHAT_SUPABASE_URL` / `WEBCHAT_SUPABASE_SECRET_KEY` | yes | The project credentials, in the plugin's own bucket for every agent that carries it (rosie, daisy, nova). Prefixed because secret keys must be unique across an agent's buckets and rosie's and daisy's agent-level bucket already holds `SUPABASE_URL` / `SUPABASE_SECRET_KEY`. The plugin refuses to start without them |
| `WEBCHAT_APP_SECRET` | no | Enables the four server-to-server portal endpoints below (same pattern as the artifacts and supplier-events secrets); without it they answer 404. Rosie only |

## Endpoints — `/webhook/<agent>/webchat/api/*`

| Method + path | Caller | Purpose |
|---|---|---|
| `POST api/upload` | browser | Raw body + `x-file-name` → stores in `inbox/`, returns `{name, label, size, mime}`. |
| `POST api/send` | browser | `{text, attachments[], threadId?}` → records the message on that thread and wakes the agent there. |
| `GET api/messages?since=<id>&thread=<id>` | browser | `{messages, hasMore, pending, cursor, readId}` — everything newer than `<id>` on that thread. Polled every 2s while the panel is open. |
| `GET api/messages?before=<id>` | browser | The page of history *older* than `<id>`, for the panel's "Load earlier messages". |
| &nbsp;&nbsp;`&limit=<n>` | browser | Keeps only the newest `n` of that window; `hasMore` says whether older ones remain. The 2s poll omits it — a delta must never be truncated. |
| &nbsp;&nbsp;`&read=1` | browser | Marks the whole thread read on the `web` side (see [Read state](#read-state)). The open panel's poll sends it; nothing else does. |
| `GET api/threads` | browser | `{threads:[{threadId,lastId,lastAt,lastRole,lastSender?,lastText,readId}]}` — every thread with a transcript, newest first (`lastSender` only on portal messages). The panel's picker merges this with the app's `/api/chat-directory`; the app's unread tracking (`lib/chat-notifications.tsx`) just compares `lastId > readId`. |
| `POST api/read` | browser | `{threadId?, lastId?}` → moves the `web` cursor without opening the thread. The bell's "Mark all read" is the only caller; `lastId` defaults to the thread's newest. |
| `GET api/file?name=<stored>` | browser | The bytes of one attachment (any thread, inbox or outbox). |
| `POST api/reset` | browser | `{threadId?}` — wipes that thread's context **and** its transcript. |
| `POST api/reply` | the agent | `{text, attachments[], threadId?, portal?}` → the reply, defaulting to the config thread (the CLI defaults `threadId` to `$PI_THREAD_ID`); clears that thread's half of `pending`. |
| `POST api/app-upload?thread=<id>` | app server | Raw body + `x-file-name` + `X-App-Secret` → stages an allowlisted file (25MB by default) under a fixed-length opaque name and returns metadata plus an HMAC ticket bound to that exact thread/file. |
| `POST api/app-send` | app server | `{threadId, text?, attachments?, senderName}` + `X-App-Secret` → a supplier-portal message: verifies every staged attachment ticket and disk size, records it portal-visible, and delivers it with `Channel: portal`. Attachment-only messages are valid. |
| `GET api/app-messages?thread=<id>` | app server | `X-App-Secret` → the **portal-visible half** of that thread only: portal-sent messages and `--portal` replies. The team's internal panel traffic never crosses this endpoint. Carries `readId` (the `portal` cursor); `&read=1` marks it, and only the portal's open chat panel sends that. |
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

| What | Where |
|---|---|
| The transcripts the panel renders | `thread_messages`, one row per message under its `threads` row — `seq` is the message id the panel sees. The plugin holds the newest `historyLimit` per thread in memory and serves every read from there |
| Who has read what | `threads.web_read_id` / `portal_read_id`, see [Read state](#read-state) |
| The "working…" half the plugin owns | `threads.pending_since` |
| Uploaded files | `agents/<id>/plugins/webchat/inbox/` — the `files` JSON on the row names them; the bytes never leave the box |
| Files the agent sends back | `agents/<id>/plugins/webchat/state/outbox/` |
| The event that wakes the agent | `agents/<id>/sessions/.events.db` — the harness's own queue |
| What the model sees | `agents/<id>/sessions/<threadId>/<sessionId>.jsonl` — pi's session, shared with Telegram |

Every message is inserted before it is acknowledged (a failed insert fails the
send); cursor and pending writes are fire-and-forget behind the in-memory
copy. On start the plugin loads its agent's threads that have a transcript
(`last_seq IS NOT NULL`) and clears their `pending_since` — a restarted
harness is not mid-turn. A thread whose row exists only because an entity
trigger minted it becomes known to the plugin on its first message
(`link_thread()`, which is also what `api/send` on a brand-new id calls).
`historyLimit` still bounds how far "Load earlier messages" can walk back —
paging reads the in-memory window. The transcript is deliberately separate
from the pi session jsonl, which holds tool calls and reasoning and is not a
chat log.

The pre-2026-08-26 files (`state/threads/*.jsonl`, `state/read.json`) were
imported once (CHANGELOG, 2026-08-26) and are left on disk as the backup; the
plugin no longer reads or writes them.

**A job request's thread follows the job** (migrations 0079/0080): deleting
the job deletes its `threads` row and transcript — the app then calls
`api/reset` on `jr-<id>` so the plugin forgets its copy and the harness
conversation is wiped — and closing the job (`closed_won` / `closed_lost` /
`archived`) sets `threads.closed_at`, which hides the thread from the app's
picker and bell without touching the transcript or this plugin.

## Read state

Since 2026-08-24 "read" is **plugin state, not browser state** — a phone and a
laptop looking at the same thread agree, which per-browser `localStorage` could
never do. It lives on the `threads` row (`web_read_id`, `portal_read_id`;
`state/read.json` until 2026-08-26), mirrored in memory.

Two cursors per thread, each the newest message id that side has seen, because
one thread has two audiences with opposite views of it: a supplier's message is
unread for the **team**, an agent's reply is unread for the **supplier**.

| Cursor | Moved by |
|---|---|
| `web` | `GET api/messages…&read=1` (the team's panel, open on the thread) · `POST api/send` (your own message) · `POST api/read` |
| `portal` | `GET api/app-messages…&read=1` (the portal's open chat) · `POST api/app-send` |

**`read=1` is opt-in for a reason.** Marking on any `GET` would break the
portal: its notification bell polls `api/app-messages?since=0&limit=1`
precisely *while the chat is closed*, so an implicit mark would clear the alert
before the supplier ever saw it. Panels that are open ask for the mark; pollers
that are peeking don't. Marking covers the whole thread (`cursor`), not the
page fetched — an open panel has seen the thread, not just its delta.

Two edges worth knowing:

- **`api/reset`** deletes the thread's messages and zeroes its cursors and
  preview (the `threads` row itself stays — the entity FKs point at it) —
  ids restart at 1, and a stale cursor would hide the new conversation.

An agent's `api/reply` moves **neither** cursor: that is the message the dots
exist to announce.

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
