---
name: supplier-communications
description: Everything about talking to a supplier and recording it. Covers the standing authorization rule (never contact one unbidden), the main-thread redirect, composing and sending as Chris on the email's own thread, routing the reply back with a thread-scoped rule, logging the contact in `suppliers.communication_notes`, and which of the three note homes a supplier fact belongs in. Use when asked to reply to, chase or question a supplier, whenever you or they make contact, and when deciding where a supplier fact goes. (v1.1.1)
metadata:
  author: lps
  version: "1.1.1"
---

# Supplier communications

Two halves: **replying to a supplier** (only when told to), and **logging the
contact** (always).

## Authorization

Never respond to a supplier's availability email, and never ask a supplier a
follow-up question, unless Chris or Bhoumik explicitly instructs you to. Silently
read and ingest availability by default. A missing price, unclear size, or
incomplete availability is **not** permission to email the supplier — surface it
to Chris/Bhoumik instead.

## When Chris asks on the main thread

Don't send the reply from `main` — the email's own thread has the full context.
Look up that email's ThreadId (`workspace/index.md` maps `Subject[ThreadId]`;
`workspace/threads/<ThreadId>/` has the summary) and redirect the request there:

```bash
bash scripts/agent-msg/send --to-agent daisy --thread-id <emailThreadId> \
  --from-agent daisy --from-thread-id main \
  --subject "reply request from Chris" \
  --message "<exactly what Chris wants said / conveyed>"
```

That thread composes and sends the reply, then reports what it sent back to
`main` via agent-messaging so Chris can be told.

## Composing and sending (on the email's own thread)

1. **Reread the most recent messages in the Gmail thread** so the reply fits the
   latest sender and conversation state.
2. **Draft first, send second.** Prepare the draft and get Chris's or Bhoumik's
   review and approval **before sending any email**.
3. Send **as Chris** (not Daisy), with Chris's approved signature. When including
   the approved transparent LPS logo, render it **250px wide** so it roughly
   matches the width of "Chris Runyon".
4. Keep it plain-text and short.
5. **Reply in the same Gmail thread** — never start a new thread for an existing
   topic.
6. Log the contact (below) in the same task.
7. Report what was sent back to `main` so Chris can be told.

Sending as Chris rather than Daisy is Chris's instruction (2026-07-14); the
250px logo width is his correction of 2026-07-25.

### Routing the supplier's reply back to this thread

If you want their answer to land here instead of opening a new harness thread,
add a `gws` routing rule — **keyed on the Gmail thread id, never on the sender
alone**:

```bash
tid="$(gws gmail +reply … | jq -r .threadId)"   # or the Channel of the mail you answered
scripts/gws/routes add --name <supplier>-<topic> --thread-id "<ThreadId>" \
  --gmail-thread-id "$tid"
scripts/gws/routes remove --name <supplier>-<topic>   # once the exchange is done
```

A sender-wide rule (`--from` with no Gmail thread id) silently swallows every
future mail from that supplier — including their next availability drop — into
this one thread. Sender + exact subject is a fallback only when no Gmail thread
id exists yet. Remove the rule when the exchange closes; a rule left behind keeps
misrouting.

## Logging the contact

**Whenever you contact a supplier — or one contacts you with actual
correspondence — append an entry to `suppliers.communication_notes` for that
supplier, in the same task.** Not at the end of the day, not only when something
notable happened. This column is the answer to "have we chased them about this
yet, and when?", and it is only worth reading if it is complete.

**A routine availability drop is not a contact event.** A supplier's price
list / availability email, or a drop Chris hands you from a website, image or
attachment, gets ingested and labelled — it does **not** get an entry in
`communication_notes`. Log the correspondence around it (a reply you sent, a
question they asked, a call), never the drop itself.

### Entry format

A timestamp line plus a short prose summary:

```
[YYYY-MM-DD HH:MM America/Chicago] <channel> · <identifier>
<What you sent or received, and why. Outcome or what you're waiting on.>
```

- **channel** — `email`, `telegram`, `phone`, `web form`.
- **identifier** — whatever lets someone find the conversation again:
  `gmailThreadId=<Channel>` for email (the raw Gmail thread id), the harness
  `ThreadId`, or the number called.
- **why** — the reason you reached out, not just the fact that you did. "Asked
  for the July list" is weak; "asked for the July list — theirs is 3 weeks old
  and the 15G Live Oak price looked stale" is the useful version.

### Append, never overwrite

It is plain text, so this is a read-modify-write:

```sql
UPDATE suppliers
SET communication_notes = coalesce(communication_notes || E'\n\n', '') || $entry
WHERE id = $supplierId;
```

Never rewrite past entries.

## Which place does this fact belong?

- **`suppliers.communication_notes`** — what was *said to* them. Append-only.
- **`suppliers.notes`** — what is *true about* them: quirks, preferences,
  price-list format, ordering constraints, anything durable with no dedicated
  column. Edited in place as facts change. Never put contact history here, and
  never put a person's name, email or phone here — people are `contacts` rows.
- **`workspace/suppliers/[<id>]:<Name>/notes.md`** — your own working memory:
  parsing tricks, half-formed hunches, ingest history. When a hunch hardens into
  a fact the rest of the business should see, promote it to `suppliers.notes`.
