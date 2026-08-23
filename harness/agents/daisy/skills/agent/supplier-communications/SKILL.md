---
name: supplier-communications
description: Everything about talking to a supplier and recording it. Covers the standing authorization rule (never email one unbidden; raising an availability request needs Chris's go-ahead too — the availability-requests skill), the approved light-touch initial-outreach template for a Texas wholesale nursery, the one-thread-per-supplier convention (`supplier-<id>` — availability requests included, no per-request sub-threads), composing and sending as Chris, routing replies, the supplier_messages transcript, app-chat instructions, and where supplier facts belong. Use when asked to reply to, chase or initially contact a supplier, whenever you or they make contact, and when deciding where a supplier fact goes. (v2.3.0)
metadata:
  author: lps
  version: "2.3.0"
---

# Supplier communications

Two halves: **replying to a supplier** (only when told to — email; the portal
channel is the `availability-requests` skill), and **keeping the transcript**
(always).

## Authorization

Never respond to a supplier's availability email, and never ask a supplier a
follow-up question, unless Chris or Bhoumik explicitly instructs you to. Silently
read and ingest availability by default. A missing price, unclear size, or
incomplete availability is **not** permission to email the supplier — surface it
to Chris/Bhoumik instead. (The **portal** follows the same rule: raising an
availability request needs Chris's go-ahead — confirm with him first unless he
asked for it or created it himself in the app. Replying within an already-open
request's portal thread is answering, not outreach, and needs no per-message
approval — the `availability-requests` skill has the details.)

## Approved light-touch initial outreach — Texas wholesale nursery only

Chris approved this reusable **initial relationship-outreach** template on
2026-08-21. It is **not an availability-list demand**. Use it only for a
**Texas wholesale nursery**, and only after Chris or Bhoumik explicitly
authorizes contacting that particular supplier; template approval does not
replace the standing no-unbidden-email rule. Keep the approved wording except
for `[Name]`, and use the artifact
[`artifacts/texas-wholesale-nursery-initial-outreach.txt`](artifacts/texas-wholesale-nursery-initial-outreach.txt):

```text
Hi [Name],

We’d love to keep you in mind for upcoming projects. What’s the best way to learn about your availability or send plant requests to your team, and is there anything we should know about your delivery areas, minimums, or materials you specialize in?

Thank you,
Chris
```

Follow the composing/sending and transcript steps below for any authorized use.

## One thread per supplier

**Each supplier's conversation is one thread: `supplier-<supplierId>`.** That
is where the app's chat-view instructions and the portal's availability events
arrive (the `supplier-events` plugin), where rosie sends supplier-specific
asks, and where your own work on that supplier belongs — availability requests
included; there are no per-request sub-threads. Older email-subject threads
still exist as history; new work goes to the supplier thread.

When a request lands somewhere else (`main`, an old email thread), redirect it
rather than working it there:

```bash
bash scripts/agent-msg/send --to-agent daisy --thread-id "supplier-<supplierId>" \
  --from-agent daisy --from-thread-id <ThreadId> \
  --subject "reply request from Chris" \
  --message "<exactly what Chris wants said / conveyed>"
```

The supplier thread composes and sends the reply, then reports what it sent
back via agent-messaging so Chris can be told.

## Composing and sending (on the supplier's thread)

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
6. Insert the transcript rows (below) in the same task.
7. Report what was sent back to `main` so Chris can be told.

Sending as Chris rather than Daisy is Chris's instruction (2026-07-14); the
250px logo width is his correction of 2026-07-25.

### Routing the supplier's reply back to this thread

To make their answer land on the supplier's thread instead of opening a new
harness thread,
add a `gws` routing rule pointing at the **supplier's thread** — keyed on the
Gmail thread id, never on the sender alone:

```bash
tid="$(gws gmail +reply … | jq -r .threadId)"   # or the Channel of the mail you answered
scripts/gws/routes add --name <supplier>-<topic> --thread-id "supplier-<supplierId>" \
  --gmail-thread-id "$tid"
scripts/gws/routes remove --name <supplier>-<topic>   # once the exchange is done
```

A sender-wide rule (`--from` with no Gmail thread id) silently swallows every
future mail from that supplier — including their next availability drop — into
this one thread. Sender + exact subject is a fallback only when no Gmail thread
id exists yet. Remove the rule when the exchange closes; a rule left behind keeps
misrouting.

## The transcript — `supplier_messages`

**Every exchange with a supplier is rows in `supplier_messages`, inserted in
the same task it happens.** One row per message, both directions; the app
renders the table as the supplier's chat view, and it replaced
`suppliers.communication_notes` on 2026-08-19 (migration 0063) — that column
is a frozen archive now. **Never write it again.**

```sql
INSERT INTO supplier_messages
  (supplier_id, job_request_id, availability_request_id, sender, sender_name, channel, body)
VALUES
  ($supplierId, $jobOrNull, $arOrNull, 'broker',   'Daisy',            'email', $whatYouSent),
  ($supplierId, $jobOrNull, $arOrNull, 'supplier', $contactNameOrNull, 'email', $whatTheyReplied);
```

- **`sender`** is the side — `broker` (us: you, Chris, another agent) or
  `supplier`. **`sender_name`** is who on that side: `Daisy`, `Chris`, or the
  supplier contact's name when known (never guessed; null otherwise).
- **`channel`** is where it actually happened: `email` or `text` for a
  supplier-facing exchange, `app` for the portal thread, and **`internal`**
  for what the supplier never sees — an instruction from the app's chat view
  (the app inserts those itself), rosie's mirrored ask, or your own note on
  the thread. After acting on something, leave a short `internal` note
  (`sender 'broker'`, `sender_name 'Daisy'`) summarizing what you did — that
  is the chat view's "agent note" bubble.
- **`body` is the substance of the message** (the ask, the answer), not the
  whole MIME artifact. Keep the thread identifier retrievable: for email, put
  `gmailThreadId=<id>` on the internal note (or the message body's last line)
  so the conversation can be found again.
- Link `job_request_id` when the exchange is about one job. Leave
  `availability_request_id` NULL on new rows — the conversation is one thread
  per supplier, never per request (older rows keep their linkage as history).
- **Append-only.** Never edit or delete a row; a correction is a new message.

**A routine availability drop is still not a contact event.** A supplier's
price list / availability email gets ingested and labelled — it does **not**
get transcript rows. Record the correspondence around it (a reply you sent, a
question they asked), never the drop itself.

## Which place does this fact belong?

- **`supplier_messages`** — what was *said* (both directions), one row per
  message, append-only. (`suppliers.communication_notes` is its frozen
  pre-2026-08-19 archive — read-only, never written.)
- **`suppliers.notes`** — what is *true about* them: quirks, preferences,
  price-list format, ordering constraints, anything durable with no dedicated
  column. Edited in place as facts change. Never put contact history here, and
  never put a person's name, email or phone here — people are `contacts` rows.
- **`workspace/suppliers/[<id>]:<Name>/notes.md`** — your own working memory:
  parsing tricks, half-formed hunches, ingest history. When a hunch hardens into
  a fact the rest of the business should see, promote it to `suppliers.notes`.
