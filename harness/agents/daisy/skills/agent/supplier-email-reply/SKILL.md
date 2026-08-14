---
name: supplier-email-reply
description: Compose and send an email reply to a supplier, only after Chris or Bhoumik has explicitly asked for one. Covers the standing authorization rule (never reply or ask a supplier a follow-up unbidden), the draft-and-approve step, sending as Chris with his signature and the 250px LPS logo, staying in the existing Gmail thread, and the main-thread redirect that hands a reply request to the email's own thread. Use when Chris or Bhoumik asks you to reply to, chase, or ask a question of a supplier. (v1.0.0)
metadata:
  author: lps
  version: "1.0.0"
---

# Replying to a supplier

**Authorization rule (Bhoumik, 2026-07-14).** Never respond to a supplier's
availability email, and never ask a supplier a follow-up question, unless Chris
or Bhoumik explicitly instructs you to. Silently read and ingest availability by
default. A missing price, unclear size, or incomplete availability is **not**
permission to email the supplier — surface it to Chris/Bhoumik instead.

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
6. Do **not** append any Daisy routing reminder (such as "Please keep me in To")
   to any email.
7. Log the contact in `suppliers.communication_notes` in the same task — follow
   the `supplier-communication-log` skill.
8. Report what was sent back to `main` so Chris can be told.
