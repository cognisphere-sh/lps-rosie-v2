---
name: customer-coordination
description: Run a customer's dedicated thread (`customers.rosie_thread_id`) — every conversation with that customer, across all their job requests. Covers minting the thread id on first contact, where a draft is approved (the jr thread, for anything about an order) and rosie sending it from her own mailbox, and where a contact and a durable quirk each get recorded. Use on every message a jr thread or main sends about contacting this customer, whenever something comes back from them, and when relaying what they said to the request it concerns. (v2.3.0)
metadata:
  author: lps
  version: "2.3.0"
---

# Customer coordination

This procedure runs on a **customer's dedicated thread** — the
`customers.rosie_thread_id` value (`customer-<slug of name>`): one
conversation per customer, across every job request of theirs. The asking side
is a `jr-<id>` thread (a quote to deliver, a question to put to them) or
`main` (Chris relaying something the customer said).

Read `knowledge/files/SCHEMA.md` first. You write `customers` columns here
(`notes`, `rosie_thread_id`, contact fields as they firm up) — with
`job-requests` §2's concurrency discipline (`SET app.actor TO 'rosie'`,
targeted updates).

**There is no contact-log column.** `customers.communication_notes` was
dropped by migration 0073, the same move the supplier side made in 0063: this
thread's own web chat is the contact history, and the app's customer page
opens it from a Rosie button beside the customer's name.

## Thread id

On first contact with a customer, mint and record the id if the column is
NULL: `customer-` + slug of their name (lowercase, non-alphanumeric runs
collapsed to `-`); on a collision with a *different* customer append `-<id>`.

```sql
UPDATE customers SET rosie_thread_id = '<id>'
WHERE id = $customerId AND rosie_thread_id IS NULL;
```

## Contacting the customer — never unbidden, never unapproved

Rules 2 and 5 (`1-agent.md`) in full:

1. **Where the draft and the approval happen depends on whether a job order is
   behind it** (`1-agent.md`, rule 5):
   - **About a job order** — the `jr-<id>` thread drafts it and gets Chris's
     approval on **its** web chat, then routes you the approved text
     (`job-requests` §7). You do not re-draft it and you do not re-ask: send
     **exactly** what was approved. If something in it is wrong for this
     customer — a preference `customers.notes` remembers, a name they don't
     use — send it back to the jr thread for re-approval rather than editing
     an approved draft.
   - **Nothing to do with an order** — draft it here from **customer-safe
     fields only** (`job-requests` §4.2): what they are getting, never how we
     sourced it — no supplier names, no supplier pricing, no `[AGENT MESSAGE]`
     content. Present it for **Chris's approval of that specific draft** on
     this thread's own web chat (`webchat-cli send` — the notification reaches
     him; never via `main`), short and non-technical.
2. Only on approval does it go out — **sent from your own mailbox**
   (`chris@localplantsupply.com`, as *Christopher Runyon*), plain text, on
   this thread:

   ```
   gws gmail +send --to <address> --subject "…" --body "…"
   gws gmail +reply --message-id <MessageId> --body "…"    # always, for a reply
   ```

   **Reply in the same Gmail thread**, and route their answer back here:
   `bash scripts/gws/routes add --name route-<slug> --thread-id <this thread>
   --gmail-thread-id <the threadId +send printed>`, re-adding `router-all`
   last (`route-email`). Chris can still send something himself when he
   prefers to.
3. Post the contact to this thread's own web chat in the same task
   (`webchat-cli send`) — **the complete text, quoted**, to whom, and who sent
   it. Say whose act it was: `Chris` for what he sent or decided. That message
   is the record; there is no column to append to.
4. If the contact was a quote, tell the jr thread so it moves the request to
   `quoted` and records the quote link (`job-requests` §7, `quote-generation`).

## When the customer answers

Whatever comes back — a reply to your own mailbox, routed here or forwarded by
`router`, or something Chris relays on `main`: quote it in full to this
thread's web chat, put durable preferences in
`customers.notes` (edited in place — delivery constraints, how they like to be
contacted, pickiness worth remembering), and **relay the substance to the
`jr-<id>` thread it concerns** — that thread owns the request's rows and next
steps, and is where Chris is asked about them (`1-agent.md`, rule 5). Route
everything that touches the order, not just an answer you were waiting for: a
changed date, a cut scope, a complaint, a question you cannot settle. **Don't
put a job-order question to Chris here** — it goes to the jr thread, which
decides and comes back with the approved text. A message about no particular
job stays here, on this thread's web chat, unless it needs another thread's
owner.

## Keep the thread's web chat current

This thread's web chat is both the coordination surface and the contact
record, so it has to be complete. Post every milestone to it (`webchat-cli
send`, defaulting here) — draft ready, approval asked, sent, customer answered
— so the team can read the whole history of this customer in the app. When
Chris writes on this thread in the panel, coordinate with him there directly.

## What lives where

- **This thread's web chat** — every contact, both directions, in order.
- **`customers.notes`** — durable facts and preferences, edited in place.
- **This thread's `notes.md`** — open items only (a draft awaiting approval,
  a question awaiting their answer), never a log.
- **Nowhere** — task updates, minor observations.
