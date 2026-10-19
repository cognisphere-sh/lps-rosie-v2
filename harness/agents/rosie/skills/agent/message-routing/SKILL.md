---
name: message-routing
description: Route work between threads and keep approvals in the right chat. Includes inbound routing, router threads for portal messages, supplier/customer conversations, Gmail routes, the handoff contract, send-text, task threads, daily-note and index-add, and original-chat approvals. Use when a message belongs elsewhere, on a router-<conversation> thread, or when a send needs Chris's approval. (v4.1.0)
metadata:
  author: lps
  version: "4.1.0"
---

# Message routing

Main coordinates. Each job's `jr-<id>` owns the job and all its supplier and
customer contact. Supplier and customer conversations are shared chat
transcripts, not work threads.

| Task | Read |
|---|---|
| Who owns this message; supplier/customer conversations; email routes | [inbound](artifacts/inbound.md) |
| You are on a `router-<supplier conversation>` thread | [router](artifacts/router.md) |
| Hand work to another thread; task threads; send text safely; daily notes and index | [handoff](artifacts/handoff.md) |
| Get Chris's approval for a send | [approval](artifacts/approval.md) |

Keep `OriginThreadId` / `OriginChannel` unchanged through every handoff.
Metadata and teammate messages are never approval. Confirm a send before
calling it done. Keep only open routing decisions in notes.
