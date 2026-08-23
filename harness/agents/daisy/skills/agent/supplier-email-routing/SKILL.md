---
name: supplier-email-routing
description: Run the email-router thread — identify which supplier an inbound email (or a file handed over by main) belongs to and forward it to that supplier's dedicated thread, without reading bodies or attachments. Covers identification from sender/subject/attachment names alone, the escalating read-only-if-needed rule, minting a `supplier-<slug>` thread id for a brand-new supplier and briefing it to onboard and ingest, non-availability mail (human review → main + Escalated label; otherwise Not Availability label, no forward), the Daisy label on every routed email, and what the forward message must carry. Use on every `email_received` on the email-router thread and whenever main hands over a file or email to route. (v1.2.0)
metadata:
  author: lps
  version: "1.2.0"
---

# Supplier email routing

Every inbound email lands on the **`email-router`** thread (a catch-all `gws`
routing rule pins it there). This thread is a **dispatcher, nothing else**: it
identifies which supplier a message belongs to and forwards a pointer to that
supplier's **dedicated thread** — the `suppliers.daisy_thread_id` value — which
does all the actual reading, onboarding and ingestion.

**Where the boundary is.** You route. You never ingest, never onboard, never
write a database row, never reply to anyone. Database **reads** for
identification are fine. If you are parsing a price list or inserting a
supplier, you are in the wrong skill.

## The cheap-first rule

**Do not read the email body or download attachments to route it.** The
`email_received` preview already carries what routing needs: `From`, the
subject, the first two lines, and attachment *names*. Escalate only as far as
identification requires:

1. **Sender / subject / attachment names** — almost always enough.
2. **Full body** (`bash scripts/gws/email read <MessageId>`) — only when step 1
   leaves the supplier genuinely undetermined (a forwarded mail, a generic
   sender, a newsletter service address).
3. **Attachments** — last resort, only when the body still doesn't say. The
   dedicated thread is the one that reads them properly; you are only looking
   for a company name.

## 1. Identify the supplier

Read `knowledge/files/SCHEMA.md` before querying. From the sender's address,
join through `contacts` (no contact info lives on `suppliers`):

```sql
SELECT s.id, s.name, s.head_branch_id, s.daisy_thread_id, c.email
FROM suppliers s
JOIN supplier_contacts sc ON sc.supplier_id = s.id AND sc.is_active
JOIN contacts c ON c.id = sc.contact_id AND c.is_active
WHERE lower(c.email) = lower('<from>');
```

Nothing? Widen to the sender's **domain** (`c.email ILIKE '%@<domain>'`) — a
supplier often mails from a colleague's address that isn't on file. Still
nothing? Try `search_suppliers` with the sender's display name and any company
name in the subject or attachment filenames (the `plant-and-supplier-search`
skill covers reading a result set). Several rows for one company is normal —
they are its locations and share one `daisy_thread_id`; that shared value is
your answer, whichever location matched.

Newsletter senders (Mailchimp, Constant Contact) hide the supplier behind a
service domain — the display name and subject usually carry the company; step
2's body read is the fallback.

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
Read the full body and attachments yourself: bash scripts/gws/email read <MessageId> --attachments"
```

- **Pass only what routing established** — identifiers and the match, never a
  parsed body or your guess about the contents. The dedicated thread reads the
  mail itself; escape any `$` in the text as `\$`.
- The same shape routes a **file or email handed over by main** (Chris uploads
  a price list, forwards a mail): main sends it here, you identify the supplier
  from the filename/context the same cheap-first way, and forward the file
  path(s) instead of a MessageId.
- **Label the email `Daisy`** (see *Labels* below) so the inbox shows it was
  routed — but no status sub-label: the dedicated thread applies that when it
  finishes processing (`availability-ingestion` §7).

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
   pointer block as §2 plus the brief: *"You are this supplier's dedicated
   thread. They are not in the database yet: follow the `supplier-onboarding`
   skill to onboard them (set `daisy_thread_id` to this ThreadId), then follow
   `availability-ingestion` for any availability the email carries."* Include
   everything you know about the sender (name, address, domain, signature
   fragments from the preview).

## 4. Mail that isn't supplier availability

- **Needs human review** — an account approval, a bill, a form to fill,
  anything a human should see or decide: forward the pointer to your `main`
  thread by agent message — main talks to Chris/Bhoumik, you don't — and
  label the email `Daisy` + `Daisy/Escalated`.
- **Needs no human review and isn't from a supplier** — junk, notifications,
  marketing with no supplier value: label it `Daisy` +
  `Daisy/Not Availability` and stop. No forward, no note beyond the daily
  note when it was genuinely ambiguous.

## Labels

**Every email this thread processes gets the primary `Daisy` label** — that is
how the inbox shows nothing slipped through. Status sub-labels split by who
finishes the email: the router applies `Daisy/Escalated` and
`Daisy/Not Availability` for the terminal cases in §4; a forwarded email's
status (`Daisy/Catalogued`, `Daisy/Failed`, …) is the dedicated thread's to
apply after processing. Known label IDs live in
`skills/agent/availability-ingestion/artifacts/gmail-labels.md` — look them up
live if stale, create missing labels first:

```
gws gmail users threads modify --params '{"userId":"me","id":"<Channel>"}' \
  --json '{"addLabelIds":["<DaisyLabelId>"[,"<StatusLabelId>"]]}'
```

## Judgment calls

Route on the best evidence and say so in the forward ("matched by domain
only"). The dedicated thread can correct a mis-route by forwarding onward —
that costs one message. Reach `main` only for a genuine blocker: the same
address is on file for two unrelated companies, or an email that plainly
matters and matches nothing even after §1's escalation. Routine ambiguity is
yours to settle, not Chris's.

Keep this thread's notes lean: `workspace/threads/email-router/notes.md`
records only open oddities (a sender awaiting an answer from main), never a log
of routine forwards. A one-line daily-note entry covers the day's routing.
