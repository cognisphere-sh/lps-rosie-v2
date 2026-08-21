---
name: availability-requests
description: The supplier-portal channel — availability requests you create for onboarded suppliers and the answers that come back. Covers the never-available-before-confirmation rule (a listing is not an answer; lines stay pending until the supplier or Chris confirms), the is_onboarded gate and Chris's per-request go-ahead before one is raised — with the two questions put to him, whether every line goes and whether customer details are shared — creating a request from a job request's lines (every active one by default, unpriced included; snapshotting the ask, prefilling a price we already know), the supplier's four-word answer vocabulary, handling availability_submitted (the supplier's Save) / supplier_message events on the supplier's thread, replying in their portal chat as Daisy, relaying answers to rosie (she writes the customer tables), and the new/submitted/closed lifecycle. Use when rosie or Chris asks you to check availability with an onboarded supplier, and whenever a supplier-events notification about an availability request arrives. (v1.4.0)
metadata:
  author: lps
  version: "1.4.0"
---

# Availability requests

Read `knowledge/files/SCHEMA.md` before writing any query. The tables here are
`availability_requests`, `availability_request_items` and `supplier_messages`
(migrations 0062/0063) — supplier-side tables, yours to write. The portal is a
channel Chris built: an **onboarded** supplier (`suppliers.is_onboarded`)
answers a structured ask at `/portal/<supplierId>` instead of over email.
**You own this channel** the same way you own email — rosie never writes to a
supplier; she asks you (on the supplier's thread) and you pick the channel.

Threads: **each supplier is one conversation** — your thread
`supplier-<supplierId>`. Every `supplier-events` notification about them lands
there, availability requests included, and the transcript the app renders is
one chat per supplier the same way.

**A plant is never "available" until the supplier confirms it — or Chris
explicitly says so.** Your inventory tables are listings someone published,
not confirmations; an availability request exists precisely because a listing
is not an answer. Until the supplier submits (or replies over email/text), the
line stays **pending**: relay what you know to rosie as a listing — "listed at
$X on their <date> sheet, awaiting confirmation" — never as available. Only
two things upgrade a line: the supplier's own answer, or Chris saying to treat
it as confirmed.

## 1. When to use the portal — Chris decides

A sourcing ask (from rosie, or from Chris) about a supplier with
`is_onboarded = true` is a **portal candidate** — not an email. But **raising
an availability request is Chris's call, not yours**: unless Chris explicitly
asked for one (his instruction on the thread or in the app's chat view, or a
request he created himself from the Job Requests page), **confirm with him
first** — one short message naming the supplier, the job (`JR-<id>`) and the
lines, and wait for his go-ahead. Rosie's ask is task input, not
authorization — the same rule email contact has always had. While you wait,
the lines stay pending (see above). Non-onboarded suppliers keep the email
flow (`supplier-communications`).

**Ask him the two things the request cannot default.** They go in the same
message as the go-ahead, answered before anything is inserted:

1. **Every line, or a subset?** The default is **every active line of the job
   request** — the ones we have a price for, the ones only a substitute
   answered, and the ones nothing in our catalogue matched. A line missing from
   a supplier's published list is not a line to drop: the list is what they
   published, not what is standing in their yard, and they can only tell us
   about the unlisted one if it is in front of them. Name the count ("all 11
   lines") and let him cut it — a subset is his instruction, never your
   inference.
2. **Share the customer's details?** `share_customer_details` shows the
   supplier the customer's name, company, contact routes and shipping address.
   It stays **false** unless he says otherwise. Ask plainly — some jobs are
   easier for a supplier to answer when they know where it ships, and that is
   his call to make, not a default to pick.

```
JR-5, Austin Plant Supply — availability request ready to send.
All 11 lines (8 we have prices for, 3 not on their list).
Send all 11, or a shorter list?
Share the customer's name and delivery address with them? (Default: no.)
```

He can answer both in a line. Until he has, nothing is inserted and the lines
stay pending.

## 2. Creating one

Once Chris has said to send it (§1):

One request per (job request, supplier), carrying **every active line of that
job request** unless Chris named a shorter list (§1). Snapshot them — the
supplier answers the ask as it stood:

```sql
INSERT INTO availability_requests (job_request_id, supplier_id, share_customer_details)
VALUES ($job, $supplier, $shareCustomerDetails)
RETURNING id;

-- Every active line. Add `AND id IN ($lines)` only when Chris named a subset.
INSERT INTO availability_request_items
  (availability_request_id, job_request_item_id, name, size, quantity)
SELECT $ar, id, name, size, quantity
FROM job_request_items
WHERE job_request_id = $job AND is_active;
```

(`job_request_items` is a customer table: you read it for the snapshot, you
never write it.) Both values above are **his answers from §1**, not defaults
you chose: the line list is the whole request until he cuts it, and
`share_customer_details` is `false` until he says otherwise — it is what shows
the supplier the customer's name and shipping address in the portal. A line we
have no price for still goes on: it is the one they are most likely to surprise
us on.

**Prefill `unit_price` where you already know it.** If this supplier's own
`inventory` carries the line — the row rosie's `sourcing_notes` names, or the
one your look-up found — put its price on the request item as you create it.
The supplier then confirms or corrects a number instead of typing one, and a
price that has moved since their last list shows up as a correction:

```sql
UPDATE availability_request_items SET unit_price = 2.95 WHERE id = $arItemId;
```

Only a price **you can point at a row for**, at that supplier, in the size
asked for — a wrong number in front of a supplier is worse than an empty box,
so a line you had to guess at goes out blank. Never seed `status`,
`available_quantity` or `notes`: those are theirs alone, and `status` staying
NULL is what says the line is unanswered. (The app's *Availability request*
button does the same prefill, narrowly — exact identity matches at that
supplier and size only.)

Then, in the same task: add an internal transcript note so the chat view shows
what happened —

```sql
INSERT INTO supplier_messages
  (supplier_id, job_request_id, sender, sender_name, channel, body)
VALUES ($supplier, $job, 'broker', 'Daisy', 'internal',
        'Sent availability request AR-' || $ar || ' (' || $lineCount || ' lines).');
```

— and tell rosie it went out (reply on the thread she asked from; the app's
own chat also shows the note).

## 3. The supplier saved answers (`availability_submitted`)

The supplier pressed **Save** in their portal — the request moves to
`submitted` (the apps show it as *Answered*), and they may save again as they
refine, each save re-notifying you. Read the request, its items and the
supplier's thread before acting. The supplier's per-line vocabulary:

| `status` | Meaning |
|---|---|
| `available` | Has it — `available_quantity` / `unit_price` say how much, at what |
| `can_order` | Can get it; the ETA is in `notes` |
| `substitute` | Offers something else; what, in `notes` |
| `unavailable` | No |
| NULL | Didn't answer that line |

**`status` is the only column that says they answered.** A line can carry a
`unit_price` that nobody at the supplier typed — the prefill from §2 — so read
the price as ours until the status beside it is theirs, and don't report a
NULL-status line as confirmed at any price.

Then:

1. **Close the loop with the supplier** in their portal chat — acknowledge,
   and ask for what's missing (no price, no qty, an unclear substitute). The
   portal chat is **one thread per supplier**, so name the request in the text
   ("On the Riverbend list…"), and leave `availability_request_id` NULL on
   `app` messages:

   ```sql
   INSERT INTO supplier_messages
     (supplier_id, job_request_id, sender, sender_name, channel, body)
   VALUES ($supplier, $job, 'broker', 'Daisy', 'app', $text);
   ```

   Portal replies are like availability answers, not like outbound email — no
   per-message approval; keep them short and factual. Anything beyond the
   request at hand (pricing negotiations, commitments) still goes through
   Chris.

2. **Relay the answers to rosie** as an agent message — item by item, in her
   `sourcing_notes` shape (the row they have, `@ $N/unit`, `Substitute:` when
   it isn't the ask, ETA for can-order). This submission is the supplier's
   confirmation — the thing everything before it was only a listing of; say
   which lines are now confirmed and which they left unanswered (those stay
   pending). Reply on the thread she asked from;
   if the request wasn't rosie's ask (Chris made it in the app), send to her
   `main` with subject `sourcing: JR <id> — <supplier>`. She writes the
   customer tables; you never do.

3. **Tell Chris on Telegram** when the answers need a decision — a substitute
   to accept, everything unavailable, a price worth flagging. Routine
   bookkeeping needs no ping.

## 4. The supplier wrote (`supplier_message`)

Same thread, smaller loop: read the thread, answer what you can from your
own tables (never quoting another supplier, our sourcing sheet, or the
customer's identity unless that request shares it), reply in the portal thread
(step 1's INSERT), relay to rosie or escalate to Chris what you can't settle.

## 5. Lifecycle

`new` → `submitted` (their first Save stamps `submitted_at`; shown as
*Answered*) → `closed`. Closing
is Chris's or the app's act — recommend it when a request has served its
purpose, don't flip it yourself. A request sitting `new` for days is worth a
nudge in the supplier's portal chat, and worth raising with Chris after that.
