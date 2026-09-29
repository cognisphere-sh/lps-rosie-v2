---
name: supplier-email-routing
description: Route inbound supplier mail cheaply from the router thread. Includes sender lookup, forwarding to the supplier's thread, new-company threads, non-availability mail, Gmail labels and direct routing rules. Use on router arrivals, unknown handoffs from main, or when adding/removing a routing rule. (v3.0.0)
metadata:
  author: lps
  version: "3.0.0"
---

# Supplier email routing

Runs on `router`. Identify the supplier and forward a pointer. No parsing,
onboarding, database writes or supplier replies here.

1. **Identify** from sender, subject, preview and attachment names
   ([identify](artifacts/identify.md)). Read the body only if still unclear;
   an attachment only as a last resort.
2. **Forward** one pointer to the supplier's `daisy_thread_id`, or start a new
   supplier thread, or hand order mail to Rosie ([dispatch](artifacts/dispatch.md)).
3. **Label** every email `Daisy`. The router adds a status only when it
   finishes the email itself (not availability, escalated); otherwise the
   supplier thread adds it.
4. **Direct routes:** a sender that always maps to one supplier gets a Gmail
   routing rule ([routes](artifacts/routes.md)).

Route on the best evidence and say how you matched ("by domain only"); the
supplier thread can forward a mis-route onward. Escalate to `main` only when
one address belongs to two unrelated companies, or an important email matches
nothing. Keep `router` notes to open oddities; one daily-note line for the
day's routing.
