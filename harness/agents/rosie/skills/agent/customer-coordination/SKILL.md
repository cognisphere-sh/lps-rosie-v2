---
name: customer-coordination
description: Run a customer's dedicated thread (`customers.rosie_thread_id`) — every conversation with that customer, across all their job requests. Covers minting the thread id on first contact, the draft → Chris approves → Chris sends flow (rosie has no mailbox), and logging contact and quirks on the customer row. Use on every message a jr thread or main sends about contacting this customer, whenever something comes back from them, and when relaying what they said to the request it concerns. (v1.1.1)
metadata:
  author: lps
  version: "1.1.1"
---

# Customer coordination

This procedure runs on a **customer's dedicated thread** — the
`customers.rosie_thread_id` value (`customer-<slug of name>`): one
conversation per customer, across every job request of theirs. The asking side
is a `jr-<id>` thread (a quote to deliver, a question to put to them) or
`main` (Chris relaying something the customer said).

Read `knowledge/files/SCHEMA.md` first. You write `customers` columns here
(`notes`, `communication_notes`, `rosie_thread_id`, contact fields as they
firm up) — with `job-requests` §2's concurrency discipline (`SET app.actor TO
'rosie'`, targeted updates, `communication_notes` append-only).

## Thread id

On first contact with a customer, mint and record the id if the column is
NULL: `customer-` + slug of their name (lowercase, non-alphanumeric runs
collapsed to `-`); on a collision with a *different* customer append `-<id>`.

```sql
UPDATE customers SET rosie_thread_id = '<id>'
WHERE id = $customerId AND rosie_thread_id IS NULL;
```

## Contacting the customer — never unbidden, never unapproved

Rule 2 (`1-agent.md`) in full:

1. Draft the message from **customer-safe fields only** (`job-requests` §4.2):
   what they are getting, never how we sourced it — no supplier names, no
   supplier pricing, no `[AGENT MESSAGE]` content.
2. Present the draft for **Chris's approval of that specific draft** on this
   thread's own web chat (`webchat-cli send` — the notification reaches him;
   never via `main`), short and non-technical.
3. Only on his approval does it go out — and until you have a mailbox, Chris
   sends it himself.
4. Log the contact in the same task — append-only, stamped:

   ```sql
   UPDATE customers
   SET communication_notes = coalesce(communication_notes || E'\n\n', '') || $entry
   WHERE id = $customerId;
   ```

   ```
   [YYYY-MM-DD HH:MM America/Chicago] Rosie: <what happened>
   ```

   The name is whose entry it is — `Chris` for what he sent or decided.
5. If the contact was a quote, tell the jr thread so it moves the request to
   `quoted` and records the quote link (`job-requests` §7, `quote-generation`).

## When the customer answers

Whatever comes back (relayed by Chris on `main`, or later through a channel of
your own): log it in `communication_notes`, put durable preferences in
`customers.notes` (edited in place — delivery constraints, how they like to be
contacted, pickiness worth remembering), and **relay the substance to the
`jr-<id>` thread it concerns** — that thread owns the request's rows and next
steps. A message about no particular job stays here, on this thread's web
chat, unless it needs another thread's owner.

## Keep the thread's web chat current

Post this thread's milestones to its own web chat (`webchat-cli send`,
defaulting here) — draft ready, approval asked, sent, customer answered — so
the team follows the customer in the app. When Chris writes on this thread in
the panel, coordinate with him there directly.

## What lives where

- **`customers.communication_notes`** — every contact, append-only, stamped.
- **`customers.notes`** — durable facts and preferences, edited in place.
- **This thread's `notes.md`** — open items only (a draft awaiting approval,
  a question awaiting their answer), never a log.
- **Nowhere** — task updates, minor observations.
