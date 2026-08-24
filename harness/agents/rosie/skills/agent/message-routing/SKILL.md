---
name: message-routing
description: Run the router thread — identify which thread an unmapped message belongs to (a job request's jr-<id>, a supplier's rosie_thread_id, a customer's rosie_thread_id) and forward a pointer there, minting and recording thread ids that don't exist yet. Covers identification from the message's own identifiers, the forward shape, and the escalation split (needs a human → main; noise → daily note only). Use on every message that lands on the router thread — from main, from a supplier-events fallback, or from any future unrouted channel. (v1.0.0)
metadata:
  author: lps
  version: "1.0.0"
---

# Message routing

Anything without a known target lands on the **`router`** thread: main hands
over what it can't place, a `supplier-events` notification falls back here
when the supplier row has no `rosie_thread_id`, and future channels (email,
phone) will land their unrouted traffic here. This thread is a **dispatcher,
nothing else**: identify the owning thread, forward a pointer, stop. No
sourcing, no writes beyond a missing thread id.

## 1. Identify the owning thread

Read `knowledge/files/SCHEMA.md` before querying. In order of cheapness:

- **A job request reference** (`JR-<id>`, an `availability_requests` /
  `job_request_items` id you can join up from) → `jr-<id>`.
- **A supplier** (name, id, portal reference) →
  `SELECT rosie_thread_id FROM suppliers WHERE …` — locations share their
  head branch's value.
- **A customer** (name, email, phone) →
  `SELECT rosie_thread_id FROM customers WHERE …`.

**A NULL thread id is yours to mint**: `supplier-<slug>` / `customer-<slug>`
of the name (lowercase, non-alphanumeric runs collapsed to `-`; `-<id>`
appended when a *different* row already holds the candidate). Write it to the
column before forwarding, so the next message routes without you.

## 2. Forward

One agent message per item, to the owning thread — identifiers and context,
never your parse of the content. Name the skill the thread should follow
(`job-requests`, `supplier-coordination`, `customer-coordination`); escape
`$` as `\$`. The receiving thread can correct a mis-route by forwarding
onward — that costs one message.

## 3. Nothing to route to

- **Needs a human** — you can't identify the owner, or it needs a decision:
  forward to `main` with what you tried.
- **Noise** — nothing actionable, no supplier/customer/job in it: stop; a
  daily-note line only when it was genuinely ambiguous.

Keep `workspace/threads/router/notes.md` to open oddities only. Routine
forwards are a one-line daily-note entry, not a log.
