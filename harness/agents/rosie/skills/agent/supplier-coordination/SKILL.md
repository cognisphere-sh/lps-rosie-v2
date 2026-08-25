---
name: supplier-coordination
description: Run a supplier's dedicated thread (`suppliers.rosie_thread_id`) — all order-side coordination with that supplier, across every job request. Covers the LPS Partner split (a portal availability request for a partner, drafted outreach for everyone else), building an availability request from a jr thread's ask, the per-supplier coordination preferences remembered on the supplier row, and relaying the answers back to the jr thread. Use on every message a jr thread sends about this supplier, on every supplier-events notification, when their portal chat needs an answer, and when a request needs chasing. (v1.1.2)
metadata:
  author: lps
  version: "1.1.2"
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
- **Prefill `unit_price`** on a line only where this supplier's own
  `inventory` row answers it unambiguously (same plant, same size). The jr
  thread's ask names the mapped rows (id + catalogued name/size/price) — seed
  from those, spot-checking rather than re-running its search; a guess is
  worse than an empty box. Never seed `status`, `available_quantity` or
  `notes` — those are the supplier's alone; `status` NULL is what says
  "unanswered".
- **`lps_notes` is what we tell the supplier, at both levels.** The
  request's own `lps_notes` carries job-level context worth their eyes —
  delivery window, site constraints, what matters across the lines
  (rendered on their portal card). A line's `lps_notes` carries what helps
  them answer *that line*: the substitute and price the inventory data
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

## 3. The supplier saved answers (`availability_submitted`)

The supplier pressed **Save** in their portal; the `supplier-events`
notification lands on this thread (each re-save re-notifies). Read the request
and its items; the supplier's per-line vocabulary:

| `status` | Meaning |
|---|---|
| `available` | Has it — `available_quantity` / `unit_price` say how much, at what |
| `can_order` | Can get it; the ETA is in `notes` |
| `substitute` | Offers something else; what, in `notes` |
| `unavailable` | No |
| NULL | Didn't answer that line |

**`status` is the only column that says they answered** — a `unit_price` may
be our §2 prefill, so a NULL-status line is never "confirmed at that price".

Then **message the jr thread** (`jr-<job_request_id>`) with the answers, item
by item — it owns the item statuses and moves them per `job-requests` §5.3.
A half-answered request may warrant a follow-up (§5); say in the relay what is
still open. A webchat report about the save includes `[Open AR-<id>](ar:<id>)`.

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

You have no mailbox, so outreach is drafted here and sent by someone who has
one:

1. Draft the ask — short, casual, concrete (the supplier answers a question,
   not a form). Apply anything `suppliers.notes` remembers about how they like
   to be approached.
2. Present draft + channel proposal for **Chris's approval on this thread's
   web chat**. The
   channels: Chris sends it himself, or — when he says so — **daisy's
   supplier thread sends it from the shared mailbox** (message
   `--to-agent daisy --thread-id <suppliers.daisy_thread_id>` with the
   approved text; her `supplier-communications` gates still apply on her
   side).
3. The reply comes back to this thread — routed by whoever receives it (daisy
   forwards supplier replies that are about an order; `main`/`router` forward
   what Chris pastes). Relay the substance to the jr thread, and record the
   exchange as a dated pointer in this thread's `notes.md`.

A supplier the database doesn't have at all is daisy's to onboard — ask
`main` to hand discovery/onboarding to her, and coordinate the order side
here once the row exists.

## 5. Follow-ups

Unanswered lines, an unclear substitute, a missing price — chase on this
thread, through the same channel the ask went out on (a new or re-opened
availability request for a Partner; §4's flow otherwise), with the same
gates. Batch follow-ups; don't ping a supplier line by line.

## Judgment calls

Make the defensible call and record it; approvals are asked on this thread's
own web chat, and `main` is only the Telegram escalation for a critical
blocker — never routine questions. Relays to jr threads are not
Chris-gated — only things that *reach the supplier* are. **Post this thread's
milestones to its own web chat** (`webchat-cli send`, no `--portal` — ask
received, AR out, answers in) so the team follows the supplier in the app.
Keep this thread's
`notes.md` to dated pointers for exchanges and open follow-ups; durable facts
about the supplier go in `suppliers.notes`, task updates nowhere.
