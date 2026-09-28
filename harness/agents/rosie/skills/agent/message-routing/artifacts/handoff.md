# Handing work to another thread

## When to hand off at all

Do the work yourself in the thread that owns it. Hand off only when:

- the owner is a different thread (a job matter arriving on main, a supplier
  matter arriving on a job thread), or
- the work is a big one-shot read (a long PDF, a large image list, broad web
  research) that would bloat this thread. Then use one task thread, give it
  the whole job, and let it finish and report once.

Don't open a task thread for a price lookup, a line edit, a note fix or a
"remember this". Don't keep a task thread alive as a go-between for an
ongoing chat; relay rounds cost more than the work. One writer per record
and per skill file at a time.

## Sending text safely

Write the message with the write tool to `/tmp/<thread>-<task>.txt`, then:

```sh
skills/agent/message-routing/scripts/send-text --via agent --to-agent rosie --thread-id <owner> --text-file /tmp/<thread>-<task>.txt
```

It passes the text as one literal argument (keeps `$`, quotes, backticks,
newlines), never retries, and grants no permission. For a web chat message
use `--via webchat --thread-id <thread>`; add `--portal` only for text meant
for the supplier. The webchat CLI has no edit command; send a short
correction instead.

## What a handoff carries

- The task and the original request (or where to read it), with constraints.
- The path: `quote_only` (quick quote), ordinary availability work (quote
  asked or skipped), committed intake, or accepted quote (`skip_availability:
  true`). These are handoff words, not database fields. A later acceptance
  replaces `quote_only` for that scope.
- For an AR: supported prices, remaining gaps, the original ask and Chris's
  exact publish approval.
- Commitment evidence: accepted lines, quantities, supplied prices and where
  they came from. A quote draft or supplier reply is never acceptance.
- Known ids: job, customer, supplier, AR, lines; inventory ids and price
  evidence.
- `OriginThreadId` / `OriginChannel`, unchanged. Approvals go back there.
- For a send: recipient, channel, full text, approval evidence. For supplier
  AR/order messages: the job name(s) and portal link(s); ids stay out of the
  visible text.
- For email: MessageId, Gmail thread id, sender, subject, time, attachment
  names, mailbox. The contact thread reads it with `scripts/gws/email read`.
- Point to workspace files instead of pasting long content.

## Context and notes

- Recall with `scripts/agent/session-reader <session> --no-thinking --search
  <term> --max-chars 1200`, then a small window (`--from-index N --n 6`). Don't
  read whole transcripts or changelogs. (`--n` counts records before the
  search filter.)
- A new task thread's notes file doesn't exist yet: create it, don't try to
  read it.
- Daily note: `skills/agent/message-routing/scripts/daily-note --thread
  <ThreadId> --text '...'` (keeps one paragraph per thread per day).
- Workspace index: `skills/agent/message-routing/scripts/index-add <path>
  '<summary>'`. Grep `workspace/index.md` for a thread; don't read it whole.
- A correction or "stop" replaces the earlier brief; report what was already
  written before doing more.
