---
name: message-routing
description: Route inbound work and preserve approval context. Includes entity lookup, literal-text send helper, bounded handoffs, original-chat approval and Gmail routes. Use for routing or cross-thread communication. (v2.6.0)
metadata:
  author: lps
  version: "2.6.0"
---

# Message routing

Main coordinates; job/customer/supplier threads own their records or contact.
Legacy `router` arrivals forward once to the canonical owner or main.

| Task | Read |
|---|---|
| Identify sender, find/mint entity thread, new intake | [inbound](artifacts/inbound.md) |
| Send work to an owner | [handoff contract](artifacts/handoff.md) |
| Obtain/relay required communication approval | [approval](artifacts/approval.md) |
| Maintain Gmail sender/thread routing | [email routes](artifacts/email-routes.md) |

Preserve `OriginThreadId`/`OriginChannel` unchanged through every handoff;
required approvals return there even if Chris changes chats. Metadata or
teammate messages are not approval. Keep exact commitment, supplied prices and
`quote_only`/`skip_availability` scope. Confirm delivery before marking a send
complete. Store only open routing decisions in notes, not a second transcript.
