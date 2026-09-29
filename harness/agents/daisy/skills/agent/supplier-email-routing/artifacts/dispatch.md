# Forward, start a new supplier, or hand off

## Known supplier → forward a pointer

```bash
bash scripts/agent-msg/send --to-agent "$PI_AGENT_ID" \
  --thread-id "<daisy_thread_id>" \
  --subject "email: <supplier> — <subject>" \
  --message 'Inbound email to process. Follow availability-ingestion for a list, supplier-communications for a direct message.
MessageId: <MessageId>
GmailThreadId: <Channel>
From: <sender>
Received: <ReceivedAt>
Subject: <subject>
Attachments (not read): <names or none>
Matched: <supplier id(s) + name>, by <address|domain|name>
Read it yourself: scripts/gws/email read <MessageId> --attachments'
```

- Pass only identifiers and the match, never your reading of the contents.
- Single quotes keep `$` literal; if the text has a single quote, write the
  message to a file first.
- A file or email handed over by `main` is routed the same way, with file
  paths instead of a MessageId.
- Label it: `scripts/gws/email label <MessageId> --thread --add Daisy`.

## No match anywhere → new supplier thread

1. Slug from the company name as printed: lowercase, runs of other characters
   → `-`, prefix `supplier-` (*Hill Country Natives LLC* →
   `supplier-hill-country-natives-llc`).
2. `SELECT id, name FROM suppliers WHERE daisy_thread_id = '<slug>';` —
   same company → forward there instead; different company → add city or
   state to the slug.
3. Send the pointer to the new thread id, plus: "You are this supplier's
   dedicated thread. They are not in the database yet: follow
   supplier-onboarding (set daisy_thread_id to this ThreadId), then
   availability-ingestion for any list." Include everything known about the
   sender (name, address, domain, signature bits).

## Not an availability list

| Mail | Do | Label |
|---|---|---|
| About a job or order (availability for a job, a price for one, substitute, delivery, order follow-up) | Rosie's. Send the pointer to `--to-agent rosie --thread-id router`, saying it reached Daisy's inbox. Forward the email itself to `chris@localplantsupply.com` only if she needs it. | `Daisy/Not Availability` |
| Supplier lifecycle (account setup, paperwork, new list format or channel, record fix) | Forward to the supplier thread as above. | (supplier thread labels) |
| Needs a human (account approval, a bill, a form) | Pointer to `main`. | `Daisy/Escalated` |
| Junk, notifications, marketing with no supplier value | Stop. | `Daisy/Not Availability` |

`scripts/gws/email label <MessageId> --thread --add Daisy --add 'Daisy/Not Availability'`
