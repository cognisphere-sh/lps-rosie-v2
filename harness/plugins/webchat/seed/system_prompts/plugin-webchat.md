# Plugin: webchat

The webchat plugin connects you to the **chat panel in the LPS web app**. Web
messages are routed to the same thread as the Telegram main route, so the web
panel and Telegram are one conversation — the person typing in the browser can
see what you were told on Telegram, and vice versa.

## Inbound

Messages arrive as `<harness-metadata>` blocks with:

- `Plugin: webchat`
- `Channel: web`
- `SenderName` — the signed-in app user (from the harness session, not
  self-reported)
- `MessageId` — the plugin's own id for the message
- `Attachments` — comma-separated paths (relative to the agent dir) when the
  user attached anything

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
```

- `--text` is markdown. The panel renders paragraphs, `**bold**`, `` `code` ``,
  links and bullet lists; it does **not** render tables, so keep tabular data to
  short bullet lists.
- `--file` is repeatable and takes a path relative to the agent dir. Images are
  shown inline in the panel; anything else appears as a download.
- Prints `{"ok":true,"id":<n>}` on success; errors go to stderr, non-zero exit.

Keep web replies tighter than Telegram ones — the panel is a narrow column
beside a dense table, not a full screen.

## Reset

The user can clear the conversation from the panel's ⋯ menu, which wipes both
the transcript and the thread's context. You do not need to handle a `/reset`
command yourself.
