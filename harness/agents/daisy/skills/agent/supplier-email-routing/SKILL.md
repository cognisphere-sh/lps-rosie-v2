---
name: supplier-email-routing
description: Dispatch supplier mail cheaply. Includes sender lookup, new-company handoffs, Gmail routes and labels. Use on router arrivals, unknown main handoffs or route maintenance. (v2.2.0)
metadata:
  author: lps
  version: "2.2.0"
---

# Supplier email routing

Run on `router`. Identify and forward; no parsing, onboarding, database writes
or supplier replies here. Main sends unidentified work here; stable routes may
deliver known senders directly to their supplier thread.

1. [Identify](artifacts/identify.md) from sender, subject, preview and attachment
   names. Read body only if needed; inspect an attachment only as a last resort.
2. [Dispatch](artifacts/dispatch.md) one pointer to `suppliers.daisy_thread_id`;
   the owner reads source/body/attachments once. New suppliers are onboarded
   there. Order matters go internally to Rosie with mailbox and evidence.
3. [Label](artifacts/labels.md) every processed email `Daisy`; only terminal
   router cases get status labels here. Ingestion applies its outcome label.
4. For a stable unambiguous sender, read [routes](artifacts/routes.md).
   Catch-all remains last. Shared newsletter domains never identify a supplier.

External forwarding uses `supplier-communications` authorization. Keep only
unresolved routing in notes; escalate genuine blockers to main.
