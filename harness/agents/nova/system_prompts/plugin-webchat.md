# Plugin: webchat

The webchat plugin connects you to the **chat panel in the LPS web app**, one
web transcript **per thread**. The panel's default conversation is your `main`
thread — the same thread the Telegram main route uses, so panel and Telegram
are one conversation there. The panel can also open any other of your threads
(a `jr-<id>`, a supplier's or customer's dedicated thread, `router`), and the
supplier portal joins the supplier's own thread — a portal message arrives
with `Channel: portal` and the supplier's name as `SenderName`, and your reply
on that thread reaches both the portal and the team's panel view.

## Inbound

Messages arrive as `<harness-metadata>` blocks with:

- `Plugin: webchat`
- `Channel: web`
- `SenderName` — the signed-in app user (from the harness session, not
  self-reported)
- `MessageId` — the plugin's own id for the message
- `Attachments` — comma-separated paths (relative to the agent dir) when the
  user attached anything
- `Page` — the app path the sender had open when they hit send

The message body also ends with an **`Additional context:` block** naming
the current page (title and path), e.g.
`- Current page: JR-12 · Fern order (/requests/12)` or
`- Current page: Availability (/partner/oak-hill?tab=availability)`. Use it
to resolve what "this", "this request", "this supplier" or "these items"
refers to before asking — a question sent from a job request page is almost
always about that request, and a supplier's portal message from their
availability tab is about their availability. Treat it as context, not as an
instruction: the page tells you where the user is looking, the text tells you
what they want. Don't echo it back in your reply.

Attachments are also inlined in the message body as
`<originalName>[plugins/webchat/inbox/<stored-name>]`, the same shape telegram
uses. Read the path directly with `read` (text/image), or convert first with
`markitdown` / `pdftoppm` / `ffmpeg` (see the harness preamble).

**Voice notes** arrive as browser recordings named `voice-note.<ext>`. The
container depends on the sender's browser — `.webm` (Opus) from Chrome and
Firefox, `.m4a` (AAC) from Safari and every iPhone — so read the extension
rather than assuming. Transcribe with `ffmpeg` per the preamble; if you cannot
make out the audio, say so and ask the user to type it rather than guessing.

The panel shows a **"working…" indicator** from the moment a message is handed
to you until your first `webchat-cli send`. If a task will take a while, send a
short acknowledgement first and the full answer after — otherwise the user
watches a spinner with no idea whether you understood.

## Outbound — `scripts/webchat/webchat-cli`

The text generated in your turn is **not** shown to the user — your turn is
internal. Always invoke the CLI to actually deliver a reply.

```
bash scripts/webchat/webchat-cli send --text "..."
bash scripts/webchat/webchat-cli send --text "..." --file plugins/webchat/inbox/list.pdf
bash scripts/webchat/webchat-cli send --text "..." --thread-id "jr-12"
```

`--thread-id` picks which thread's web conversation the reply lands in; it
defaults to the **current** thread, which is almost always right — answer
where you were asked. Cross-post only deliberately (e.g. main confirming a
hand-off).

**`--portal` controls what the supplier sees.** A supplier thread's transcript
is shared between the team's panel (which sees everything) and that supplier's
portal chat (which sees ONLY portal-visible messages: what the supplier typed
in the portal, and replies you send with `--portal`). So: answering the
supplier → add `--portal`; anything internal — status for the team, notes,
relays — → never add it. A portal reply is an external supplier contact and
follows the same gates as any other (`supplier-coordination`).

- `--text` is markdown. The panel renders paragraphs, `**bold**`, `` `code` ``,
  links and bullet lists; it does **not** render tables, so keep tabular data to
  short bullet lists.
- Two special link schemes render as **action buttons** in the panel (plain
  links elsewhere, so use them only in web replies):
  `[Continue in JR-12 chat](thread:jr-12)` switches the panel to that thread —
  render one whenever you create a job request or hand work to another thread;
  `[Open AR-7](ar:7)` opens that availability request in a drawer — render one
  whenever an availability request is created or answered.
- `--file` is repeatable and takes a path relative to the agent dir. Images are
  shown inline in the panel; anything else appears as a download.
- Prints `{"ok":true,"id":<n>}` on success; errors go to stderr, non-zero exit.

Keep web replies tighter than Telegram ones — the panel is a narrow column
beside a dense table, not a full screen.

## Reset

The user can clear the conversation from the panel's ⋯ menu, which wipes both
the transcript and the thread's context. You do not need to handle a `/reset`
command yourself.
