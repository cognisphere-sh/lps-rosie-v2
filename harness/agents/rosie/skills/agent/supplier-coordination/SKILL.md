---
name: supplier-coordination
description: Run a supplier's dedicated thread (`suppliers.rosie_thread_id`) — all order-side coordination with that supplier, across every job request. Covers the LPS Partner split (a portal availability request for a partner, mailbox outreach for everyone else), building an availability request from a jr thread's ask, the per-supplier coordination preferences remembered on the supplier row, and relaying the answers back to the jr thread. Use on every message a jr thread sends about this supplier, on every supplier-events notification, when their portal chat needs an answer, and when a request needs chasing. (v1.7.0)
metadata:
  author: lps
  version: "1.7.0"
---

# Supplier coordination

This procedure runs on a **supplier's dedicated thread** — the
`suppliers.rosie_thread_id` value (`supplier-<slug>`, one per company; every
location row shares its head branch's value). Everything order-side about this
supplier happens here, for **every** job request: availability asks,
follow-ups, their answers. The asking side is a `jr-<id>` thread
(`job-requests` §5.2); daisy's same-named thread is a different thread — hers
does ingestion and onboarding, this one does orders.

Read `knowledge/files/SCHEMA.md` before any query. You write
`availability_requests` and `availability_request_items` here; you only read
`suppliers`, `inventory` and the `job_request_*` tables (the jr thread writes
those).

## 0. Know this supplier first

Before acting, read the supplier's row — `is_lps_partner`, `notes`, and its
locations (`head_branch_id`). **`suppliers.notes` is where this supplier's
coordination preferences live**: whether customer details are shared with
them, preferred channel, how they like asks framed, ordering constraints.
Apply what is remembered; ask Chris **on this thread's own web chat**
(`webchat-cli send` — the notification reaches him; never via `main`) only
for a preference nothing
records yet — and **write his answer back into `suppliers.notes`** in the same
task, so the next job doesn't re-ask. Personalize to the supplier and their
`category`; a remembered per-supplier preference always wins over a
type-level habit.

## 1. LPS Partner or not

**`suppliers.is_lps_partner = true` makes them an LPS Partner** — they answer
structured asks in their portal (`/portal/<supplierId>`), and the channel is
an **availability request** (§2). Anyone else is reached by ordinary
outreach (§4).

## 2. Creating an availability request (LPS Partner)

A jr thread's ask arrives with the request id, the item ids and what its
look-up found per line. Creating the availability request is **this thread's
responsibility** — one per (job request, supplier), carrying **every active
line** of the job request unless Chris named a subset:

```sql
SET app.actor TO 'rosie';
INSERT INTO availability_requests (job_request_id, supplier_id, share_customer_details)
VALUES ($job, $supplier, $share)
RETURNING id;

-- Every active line. Add `AND id IN ($lines)` only when Chris named a subset.
INSERT INTO availability_request_items
  (availability_request_id, job_request_item_id, name, size, quantity)
SELECT $ar, id, name, size, quantity
FROM job_request_items
WHERE job_request_id = $job AND is_active;

-- Then the mapping, per line that has one (below). Not every line does.
UPDATE availability_request_items
   SET mapped_inventory_id = $inventoryId, unit_price = $price
 WHERE availability_request_id = $ar AND job_request_item_id = $item;
```

- **`share_customer_details`** shows the supplier the customer's name,
  company, contacts and shipping address. It follows the **remembered
  preference in `suppliers.notes`** (§0); with none remembered, ask Chris —
  one short message on this thread's web chat naming the supplier and the
  job — and record
  his answer as the preference. Default while unanswered: `false`, and the
  request waits.
- A line missing from their published list still goes on — it is the one they
  are most likely to surprise us on. A subset is Chris's instruction, never
  your inference.
- **Write down the mapping, then the price it gives.**
  `mapped_inventory_id` is the `inventory` row that answers the line for this
  supplier unambiguously (same plant, same size); `unit_price` is what you
  copy off it. The jr thread's ask names those rows (id + catalogued
  name/size/price) — seed from them, spot-checking rather than re-running its
  search; a guess is worse than an empty box.
  - **Both or neither, when you write the line.** Never a price without the
    row it came from — an unsourceable number is the thing this column exists
    to prevent. The other way round is fine: a mapped row whose catalogue
    price is NULL maps, and the price stays empty.
    - The rule is yours, not the table's. A request **created in the app**
      (Job Requests page → Availability request) seeds a price from the
      catalogue without recording a row, so a priced line with no mapping is
      an app-made request, not a contradiction — and every line written
      before 2026-08-26 is unmapped because the column didn't exist. Don't
      backfill one from a re-run search: a mapping means *this* is the row we
      asked from, and a later search is a different question.
  - **NULL is the ordinary answer**, on the lines that matter most: a line
    nothing on their list maps is exactly the one they may surprise us on,
    and it still goes on the request (above). Leave it NULL rather than
    reaching for a near-miss — a different size or a cousin plant is *not* a
    mapping, it is a `lps_notes` sentence.
  - Nothing shows it to anyone yet — it is ours, it is not on their portal,
    and no screen renders it. It is written for the traceback: which
    catalogue row we thought answered the line, read later against what they
    actually said.
- Never seed `status`, `available_quantity` or `notes` — those are the
  supplier's alone; `status` NULL is what says "unanswered".
- **`lps_notes` is what we tell the supplier, at both levels.** The
  request's own `lps_notes` carries job-level context worth their eyes —
  delivery window, site constraints, what matters across the lines
  (rendered on their portal card). A line's `lps_notes` carries what helps
  them answer *that line*: the alternative and price the inventory data
  mapped (`Substitute ok: Muskogee Crape Myrtle 30 G @ \$265/unit`), a
  special request from the customer, or a customer note worth passing on
  (rendered under the plant name). A few words, never a sentence; NULL when
  there is nothing to say. Both are supplier-visible, so the customer-safe
  rules apply — no customer identity unless `share_customer_details`, never
  our sourcing internals. `notes` stays theirs.
- Tell the jr thread the request went out (`AR-<id>`, line count), and note
  anything durable you learned in `suppliers.notes`. When the work was asked
  for over webchat, the web reply includes the panel button
  `[Open AR-<id>](ar:<id>)`.

## 3. The supplier submitted answers (`availability_submitted`)

The supplier pressed **Submit** (or **Re-Submit**) in their portal; the
`supplier-events` notification lands on this thread (each re-submit
re-notifies). Read the request and its items; the supplier's per-line
vocabulary:

| `status` | Meaning |
|---|---|
| `available` | Has all of it — the portal sets `available_quantity` to the demand; `unit_price` says at what |
| `can_order` | Can get it; the ETA is in `notes` |
| `diff_size_qty_sub` | Can supply something different — another size, a short quantity or another plant; what, in `notes`, how many in `available_quantity` |
| `arriving_soon` | Stock is on its way; when, in `notes` |
| `unavailable` | No — `available_quantity` is cleared with it |
| NULL | Didn't answer that line |

The request's own `status` tracks the same work: `new` (waiting on them, and
re-set by the database whenever we add a line to a request they had already
started), `processing` (they have answered at least one line since), then
`submitted`. `closed` is ours.

**`status` is the only column that says they answered** — a `unit_price` may
be our §2 prefill, so a NULL-status line is never "confirmed at that price".
Read each answer against `mapped_inventory_id`, the row we thought answered
that line: a `diff_size_qty_sub` or an unchanged price on a line that mapped
says something different from one on a line that mapped nothing, and a
`unavailable` on a line their own catalogue listed is worth naming in the
relay. Where the answer contradicts the mapping, the answer wins and the
mapping stays as it was — it records what we asked from, not what is true.

Then **message the jr thread** (`jr-<job_request_id>`) with the answers, item
by item — it owns the item statuses and moves them per `job-requests` §5.3.
A half-answered request may warrant a follow-up (§5); say in the relay what is
still open. A webchat report about the submission includes
`[Open AR-<id>](ar:<id>)`.

## 3.5 The supplier writes in their portal chat

A message with `Channel: portal` is **the supplier themselves**, typing in
their portal's chat — it lands on this thread, and only the portal-visible
half of this thread's web transcript reaches them back. Reply with
`bash scripts/webchat/webchat-cli send --portal --text "…"` — **without
`--portal` the supplier never sees it** (and internal replies must never
carry it). A portal reply is external supplier contact: routine
clarifications about an active availability request — which line, what size
meant, when the list updates — are the channel's purpose and yours to answer;
anything committing LPS — pricing, terms, new business — is asked of Chris on
this thread's own web chat first (never `main`). Relay anything that answers
a job's lines to the jr thread, and
put durable preferences in `suppliers.notes`.

## 4. Not an LPS Partner

Outreach is **sent from your own mailbox** (`chris@localplantsupply.com`, as
*Christopher Runyon*) once Chris approves the specific draft — drafted on the
`jr-<id>` thread when an order is behind it, here when none is:

1. **Where the draft and the approval happen depends on whether a job order is
   behind it** (`1-agent.md`, rule 5):
   - **Sourcing for a job order** — the `jr-<id>` thread drafts the ask and
     gets Chris's approval on **its** web chat, then routes you the approved
     text (`job-requests` §5.2). Send **exactly** that; if it is wrong for
     this supplier, send it back there for re-approval rather than editing an
     approved draft.
   - **Nothing to do with an order** — draft it here: short, casual, concrete
     (the supplier answers a question, not a form), two to three lines, no
     preamble, no restating what they already know, applying anything
     `suppliers.notes` remembers about how they like to be approached. Present
     it for **Chris's approval on this thread's web chat**.

   Either way approval is **per-draft**: a template or a past yes is never
   standing permission.
2. Send it yourself, plain text, on this thread:

   ```
   gws gmail +send --to <address> --subject "…" --body "…"
   gws gmail +reply --message-id <MessageId> --body "…"    # always, for a reply
   ```

   **Reply in the same Gmail thread** — never open a new one for an existing
   topic. Then route their answer back here: `bash scripts/gws/routes add
   --name route-<slug> --thread-id <this thread> --gmail-thread-id <the
   threadId +send printed>`, and re-add `router-all` last (`route-email`).
3. Their reply lands on this thread. Relay the substance to the jr thread, and
   **quote the reply in full to this thread's web chat** (below).

A supplier the database doesn't have at all is daisy's to onboard — ask
`main` to hand discovery/onboarding to her, and coordinate the order side here
once the row exists.

**The split with daisy is the subject, not the party.** Anything about this
supplier's **lifecycle** — onboarding, account setup, how availability reaches
us, a changed price-list format, correcting their record — is hers, and she
says it from `chris.r@localplantsupply.com`, even while you are mid-order with
them. Anything about **an order or a job request** — an availability ask for a
specific job, pricing on it, a substitute, a delivery date, a follow-up — is
yours, even on first contact. When mail that reaches you is really a lifecycle
matter, hand it to daisy rather than answering it (`message-routing` §2c).

## 5. Follow-ups

Unanswered lines, an unclear substitute, a missing price — chase on this
thread, through the same channel the ask went out on (a new or re-opened
availability request for a Partner; §4's flow otherwise), with the same
gates. Batch follow-ups; don't ping a supplier line by line.

## Judgment calls, and where Chris is asked

Make the defensible call and record it. **Anything about a job order that
needs Chris — an approval, a decision, a trade-off — goes to that order's
`jr-<id>` thread, not to this thread's web chat** (`1-agent.md`, rule 5): it
is the one place he is asked about that order, and the one thread that knows
the order's whole state. Ask here only about matters with no job order behind
them (this supplier's channel, a preference, standing terms). `main` stays the
Telegram escalation for a critical blocker — never routine questions.

**Route your inputs to the jr thread**: what the supplier answered, a price or
a substitute they named, a date they gave, anything that moves the order.
Those relays are not Chris-gated — only things that *reach the supplier* are.

## The web chat is this thread's contact history

**Every supplier contact is posted to this thread's own web chat in the same
task it happens** (`webchat-cli send`, **never `--portal`** — that flag would
show it to the supplier), so the team follows the supplier in the app. How
much you post depends on which of two kinds it is:

- **Direct communication** — anything addressed to us or sent to them, either
  direction: the ask that went out (the approved text, as Chris or daisy
  actually sent it), their reply, a relayed text. Post the **complete text,
  quoted**, headed by subject, who it was from or to, and — when whoever
  received it gave you a Gmail message id — a link:
  `https://mail.google.com/mail/u/0/?authuser=chris.r@localplantsupply.com#all/<MessageId>`
  (`?authuser=` pins the LPS mailbox, `#all/` survives labelling). **A summary
  never stands in for the text.** Mail you sent and received yourself you have
  verbatim; something relayed to you by Chris or daisy you quote as received,
  saying who sent it and when.
- **Broadcast** — an availability drop, price list or newsletter forwarded
  here: header only (subject, sender, first line, attachment names), never the
  body. Those are daisy's to ingest, not yours.

**Portal chat is already in this transcript** — a supplier's portal message
and your `--portal` reply are rows on this same thread, so they are the
contact history without being re-posted. Quote only what happened *outside*
the panel: email and text relayed to you, and asks Chris or daisy sent on your
behalf.

Keep posting this thread's milestones alongside it — ask received, AR out,
answers in.

**`notes.md` carries no communication log**: only open follow-ups still owed
an answer. Durable facts about the supplier go in `suppliers.notes`, task
updates nowhere.
