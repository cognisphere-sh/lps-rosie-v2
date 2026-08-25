---
name: message-routing
description: Run the router thread — identify which thread an unmapped message belongs to (a job request's jr-<id>, a supplier's rosie_thread_id, a customer's rosie_thread_id) and forward a pointer there, minting and recording thread ids that don't exist yet. Covers identification from the message's own identifiers, the forward shape, and the escalation split (needs a human → main; noise → daily note only). Use on every message that lands on the router thread — every inbound email the catch-all sends here, main's hand-overs, and a supplier-events fallback. (v1.1.0)
metadata:
  author: lps
  version: "1.1.0"
---

# Message routing

Anything without a known target lands on the **`router`** thread: **every
inbound email** no `--from` rule already claimed (the `router-all` catch-all
in `plugins/gws/state/routes.json`), main's hand-overs, and a
`supplier-events` notification when the supplier row has no
`rosie_thread_id`. This thread is a **dispatcher, nothing else**: identify the
owning thread, forward a pointer, stop. No sourcing, no replies, no writes
beyond a missing thread id.

**Never answer an email here.** Routing is not correspondence — the owning
thread reads the mail itself and decides what to say, under its own gates.

## 1. Identify the owning thread

**Identify from the cheap signals first — sender, subject, attachment names —
and read the body only when those fail.** Routing does not need the contents;
the owning thread reads them.

```
bash scripts/gws/email read <MessageId>      # only when sender+subject don't place it
```

Read `knowledge/files/SCHEMA.md` before querying. In order of cheapness:

- **A job request reference** (`JR-<id>`, an `availability_requests` /
  `job_request_items` id you can join up from) → `jr-<id>`.
- **A supplier** (name, id, portal reference) →
  `SELECT rosie_thread_id FROM suppliers WHERE …` — locations share their
  head branch's value.
- **A customer** (name, email, phone) →
  `SELECT rosie_thread_id FROM customers WHERE …`.

**A NULL thread id is yours to mint**: `supplier-<slug>` / `customer-<slug>`
of the name (lowercase, non-alphanumeric runs collapsed to `-`; `-<id>`
appended when a *different* row already holds the candidate). Write it to the
column before forwarding, so the next message routes without you.

## 2. Forward

One agent message per item, to the owning thread — identifiers and context,
never your parse of the content. Name the skill the thread should follow
(`job-requests`, `supplier-coordination`, `customer-coordination`); escape
`$` as `\$`. The receiving thread can correct a mis-route by forwarding
onward — that costs one message.

An **email** forward carries the identifiers that let the thread fetch it:

```bash
bash scripts/agent-msg/send --to-agent "$PI_AGENT_ID" \
  --thread-id "<owning thread id>" \
  --subject "email: <who> — <email subject>" \
  --message "Inbound email for you to handle. Follow \`<skill>\`.
MessageId: <MessageId>
GmailThreadId: <Channel>
From: <sender>
Received: <ReceivedAt>
Subject: <subject>
Attachments (names only, not read): <names or none>
Matched: <supplier/customer/jr row(s)>
Read it yourself: bash scripts/gws/email read <MessageId> --attachments"
```

## 2b. Promote a stable sender to its own rule

Once a sender has routed to the same thread twice, give it a `--from` rule so
it stops coming through here (`route-email` skill):

```
bash scripts/gws/routes add --name route-<slug> --thread-id <thread> --from <address>
```

**First match wins and `routes add` appends**, so the `router-all` catch-all
must stay last — re-add it after every rule you add:

```
bash scripts/gws/routes remove --name router-all
bash scripts/gws/routes add --name router-all --thread-id router --from .
```

## 2c. Supplier lifecycle is daisy's, not ours

**The split is the subject, not the party.** Route here only what is about an
**order or a job request**. Anything about a supplier's **lifecycle** is
daisy's even when we are mid-order with that supplier:

- an availability drop, price list, availability sheet or nursery newsletter;
- onboarding, an account or portal registration, credit or tax paperwork;
- how availability reaches us changing — a new channel, a new format, a new
  contact for it;
- a correction to the supplier's own record.

Don't route those to a supplier thread here — hand them to daisy:

```bash
bash scripts/agent-msg/send --to-agent daisy --thread-id router \
  --subject "email: availability drop for you" --message "…same identifier block…"
```

She cannot read this mailbox, so say plainly that the mail is in rosie's inbox
(`chris@localplantsupply.com`) and pass the `MessageId`; if she cannot reach
it, forward the mail to `chris.r@localplantsupply.com` with `gws gmail
+forward` and tell her that is where it went.

## 3. Nothing to route to

- **Needs a human** — you can't identify the owner, or it needs a decision:
  forward to `main` with what you tried.
- **Noise** — nothing actionable, no supplier/customer/job in it: stop; a
  daily-note line only when it was genuinely ambiguous.

Keep `workspace/threads/router/notes.md` to open oddities only. Routine
forwards are a one-line daily-note entry, not a log.
