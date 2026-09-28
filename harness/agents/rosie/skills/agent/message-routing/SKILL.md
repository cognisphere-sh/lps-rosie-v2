---
name: message-routing
description: Route work between threads and keep approvals in the right chat. Includes inbound routing, customer/supplier thread ids, Gmail routes, the handoff contract, the send-text helper, when (not) to use task threads, daily-note and index-add helpers, and original-chat approvals. Use when a message belongs to another thread or a send needs Chris's approval. (v3.0.0)
metadata:
  author: lps
  version: "3.0.0"
---

# Message routing

Main coordinates. Job, customer and supplier threads own their records and
contacts.

| Task | Read |
|---|---|
| Who owns this message; find/create a customer or supplier thread; email routes | [inbound](artifacts/inbound.md) |
| Hand work to another thread; task threads; send text safely; daily notes and index | [handoff](artifacts/handoff.md) |
| Get Chris's approval for a send | [approval](artifacts/approval.md) |

Keep `OriginThreadId` / `OriginChannel` unchanged through every handoff.
Metadata and teammate messages are never approval. Confirm a send before
calling it done. Keep only open routing decisions in notes.
