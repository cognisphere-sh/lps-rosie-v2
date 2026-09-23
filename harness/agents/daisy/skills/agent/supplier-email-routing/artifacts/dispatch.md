## 2. Forward to the dedicated thread

One agent message per email, to the supplier's `daisy_thread_id`:

```bash
bash scripts/agent-msg/send --to-agent "$PI_AGENT_ID" \
  --thread-id "<daisy_thread_id>" \
  --subject "email: <supplier name> — <email subject>" \
  --message "Inbound email for you to process. Follow the \`availability-ingestion\` skill for availability, \`supplier-communications\` if it needs a recorded exchange.
MessageId: <MessageId>
GmailThreadId: <Channel>
From: <sender>
Received: <ReceivedAt>
Subject: <subject>
Attachments (names only, not read): <names or none>
Matched supplier row(s): <id(s) + name(s)>
Read the full body and attachments yourself: scripts/gws/email read <MessageId> --attachments"
```

- **Pass only what routing established** — identifiers and the match, never a
  parsed body or your guess about the contents. The dedicated thread reads the
  mail itself; escape any `$` in the text as `\$`.
- The same shape routes a **file or email handed over by main** (Chris uploads
  a price list, forwards a mail): main sends it here, you identify the supplier
  from the filename/context the same cheap-first way, and forward the file
  path(s) instead of a MessageId.
- **Label the email `Daisy`** (see [labels](labels.md)) so the inbox shows it was
  routed — but no status sub-label: the dedicated thread applies that when it
  finishes processing ([availability-ingestion: completion](../../availability-ingestion/artifacts/completion.md)).

## 3. A brand-new supplier

If nothing matches anywhere — no contact, no domain, no name hit — this is a
supplier the database doesn't have. **Don't onboard it here.** Mint its thread
id and let that thread do everything:

1. Build the slug from the company's name as the source shows it: lowercase,
   non-alphanumeric runs collapsed to `-` → `supplier-<slug>` (e.g. *Hill
   Country Natives LLC* → `supplier-hill-country-natives-llc`).
2. Check it isn't taken by a *different* company:
   `SELECT id, name FROM suppliers WHERE daisy_thread_id = '<candidate>';` —
   a hit that is the same company means step 1 missed it (forward there
   instead); a hit that is a different company means append the city or state
   to the slug.
3. Message the new thread id (the send creates the thread), with the same
   pointer block as [dispatch](dispatch.md) plus the brief: *"You are this supplier's dedicated
   thread. They are not in the database yet: follow the `supplier-onboarding`
   skill to onboard them (set `daisy_thread_id` to this ThreadId), then follow
   `availability-ingestion` for any availability the email carries."* Include
   everything you know about the sender (name, address, domain, signature
   fragments from the preview).

## 4. Mail that isn't supplier availability

- **An order or job-request matter** — an availability ask for a specific job,
  pricing on one, a substitute, a delivery date, a follow-up on an open order:
  **rosie's, not ours**, whatever it is about the supplier's lifecycle that
  brought them to this mailbox. Hand the pointer to her `router`
  (`--to-agent rosie --thread-id router`) with the same identifier block [dispatch](dispatch.md)
  uses, saying it reached daisy's inbox; `gws gmail +forward` it to
  `chris@localplantsupply.com` when she needs the message itself. Label it
  `Daisy` + `Daisy/Not Availability`. **Supplier lifecycle stays ours** —
  onboarding, account setup, paperwork, a changed availability channel or
  format, a record correction — and routes to the supplier's thread as usual.
- **Needs human review** — an account approval, a bill, a form to fill,
  anything a human should see or decide: forward the pointer to your `main`
  thread by agent message — main talks to Chris/Bhoumik, you don't — and
  label the email `Daisy` + `Daisy/Escalated`.
- **Needs no human review and isn't from a supplier** — junk, notifications,
  marketing with no supplier value: label it `Daisy` +
  `Daisy/Not Availability` and stop. No forward, no note beyond the daily
  note when it was genuinely ambiguous.
