---
name: message-routing
description: Route work between threads and keep approvals in the right chat. Includes inbound routing, supplier/customer threads and conversations, Gmail routes, the handoff contract, send-text, task threads, daily-note and index-add, and original-chat approvals. Use when a message belongs elsewhere, on a supplier-<slug> or customer-<slug> thread, or when a send needs Chris's approval. (v5.0.0)
metadata:
  author: lps
  version: "5.0.0"
---

# Message routing

Main coordinates. Each job's `jr-<id>` owns the job and all its supplier and
customer contact. Each supplier and customer has one conversation, and a
thread of the same id that only routes what they send.

| Task | Read |
|---|---|
| Who owns this message; supplier/customer conversations; email routes | [inbound](artifacts/inbound.md) |
| You are on a `supplier-<slug>` or `customer-<slug>` thread | [party thread](artifacts/party-thread.md) |
| Hand work to another thread; task threads; send text safely; daily notes and index | [handoff](artifacts/handoff.md) |
| Get Chris's approval for a send | [approval](artifacts/approval.md) |

Keep `OriginThreadId` / `OriginChannel` unchanged through every handoff.
Metadata and teammate messages are never approval. Confirm a send before
calling it done. Keep only open routing decisions in notes.
