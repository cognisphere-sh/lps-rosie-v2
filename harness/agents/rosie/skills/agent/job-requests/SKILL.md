---
name: job-requests
description: The operating procedure for customer job requests — the tables rosie owns. Covers intake (find-or-create the customer, anonymous requests and mapping them later), the concurrency discipline for tables the app's users edit too (SET app.actor, re-SELECT before UPDATE, guarded status transitions, atomic append-only notes), the changelog fetch rule (read the last 5 job_request_changelog entries with every request/item you load), the three-notes split and the customer-visibility rule for quantity changes and substitutions, sourcing through daisy by agent-message (never contacting a supplier), needs_attention conventions, the Chris-approved customer-email flow logged in customers.communication_notes, and both status lifecycles. Use whenever you create, read, edit or advance a job request or its items, when a customer's ask needs sourcing, when something needs human attention, and before any contact with a customer. (v1.0.0)
metadata:
  author: lps
  version: "1.0.0"
---

# Job requests

Read `knowledge/files/SCHEMA.md` before writing any query. The tables here are
`customers`, `job_requests`, `job_request_items` and the read-only
`job_request_changelog`. You own every agent-side write to the first three; the
app's users edit the same rows from the UI, which is why the concurrency
section below is not optional.

## 1. Intake

A request arrives as text from Chris/Bhoumik or (later) a channel. Create the
rows the same task:

1. **Find the customer before creating one.** Match in this order: `email`,
   then `phone`, then `name` + `company`. Never guess a person's name from an
   email address; if all you have is `jalvarez@…`, the name stays unknown until
   someone tells you.

   ```sql
   SELECT id, name, company, email, phone FROM customers
   WHERE is_active AND (email = lower($email) OR phone = $phone);
   ```

2. **No customer identifiable? Create the request anonymous.** `customer_id`
   is nullable by design. Put every identity clue you do have (a first name, a
   phone fragment, "the landscaper Chris met Tuesday") into the request's
   `customer_notes` so mapping is possible later.

3. Create the request (status defaults to `sourcing`) and one
   `job_request_items` row per asked-for plant. `name` and `size` are the
   customer's **verbatim ask** ("30 gal or larger" goes in `size` as written);
   what they said about an item goes in the item's `customer_notes`, and the
   overall message in the request's `customer_notes`.

4. **Mapping an anonymous request later** is a find-or-create of the customer
   (step 1) followed by a targeted update:

   ```sql
   UPDATE job_requests SET customer_id = $customerId
   WHERE id = $requestId AND customer_id IS NULL;
   ```

   The `AND customer_id IS NULL` guard means a concurrent mapping in the UI
   wins and yours becomes a no-op — check the row count and re-read if it's 0.

## 2. Concurrency discipline — every write session

These tables are edited by people in the app while you work. Four rules:

1. **Open every write session with the actor GUC** so the changelog names you:

   ```sql
   SET app.actor TO 'rosie';
   ```

   All statements in the same `query` invocation share the session, so set it
   first, in the same invocation as the writes.

2. **Re-SELECT immediately before UPDATE.** Not "earlier in the task" — in the
   same invocation or the one directly before it. The row you loaded when the
   task started is history.

3. **Guarded transitions, checked row counts.** A status move states the
   status it is moving *from*:

   ```sql
   UPDATE job_requests SET status = 'quoted'
   WHERE id = $requestId AND status = 'sourcing';
   ```

   `UPDATE 0` means the row moved under you — re-read it and reconcile rather
   than forcing your value.

4. **Notes are appended atomically, never read-concat-written.** One
   statement, no round trip between read and write:

   ```sql
   UPDATE job_request_items
   SET internal_notes = coalesce(internal_notes || E'\n\n', '') || $entry
   WHERE id = $itemId;
   ```

   Entry format is a timestamp line plus short prose, as in daisy's
   communication log:

   ```
   [YYYY-MM-DD HH:MM America/Chicago] <what happened / what you learned>
   ```

   Update only the columns you mean to change — never write a whole row back.

## 3. Reading a request — the changelog rule

**Whenever you load a request or an item to act on it, load its last 5
changelog entries too.** That is how you see what the humans (and you,
earlier) did since you last looked — who changed what, when:

```sql
SELECT created_at, actor, action, changes
FROM job_request_changelog
WHERE job_request_id = $requestId          -- or: item_id = $itemId
ORDER BY created_at DESC, id DESC LIMIT 5;
```

The changelog is written by a database trigger on every insert/update — yours
included. Never insert into it, and never treat it as append-your-own-notes;
that is what `internal_notes` is for.

## 4. The three notes, and who gets to see what

| Column | Whose words | Discipline |
|---|---|---|
| `customer_notes` | The customer's, verbatim | Evidence. Never edited. |
| `internal_notes` | Ours, internal | Append-only, timestamped. Sourcing log. |
| `external_notes` | Ours, **customer-visible** | Written to be shown/sent to the customer. |

`internal_notes` on an item is the **sourcing log** — which supplier may have
it, availability status, pricing, alternatives:

```
[2026-08-17 09:40 America/Chicago] Available with Austin Plant Supply @ $30.
[2026-08-17 11:05 America/Chicago] Everde recommended alternative: Muskogee 30G.
[2026-08-17 11:06 America/Chicago] Requested availability with Acosta Farms via daisy.
```

**The customer-visibility rule.** When a quantity changes, or a substitute is
quoted or recommended, the customer must be able to see why: append the
explanation to the item's `external_notes` **in the same task** as the change
("Quoted 12 rather than 10 — supplier sells in dozens"; "Recommending Muskogee
as a substitute — Natchez unavailable this season"). The changelog proves the
change happened; `external_notes` is where it is explained in words a customer
reads. Supplier names and supplier pricing are internal — `external_notes`
carries the substance ("our grower", "available in early September"), never the
source.

## 5. Sourcing through daisy

You never contact a supplier (`1-agent.md`, rule 1). Supplier-side questions go
to daisy as one agent-message per request, batching its open items:

```bash
bash scripts/agent-msg/send --to-agent daisy --thread-id main \
  --from-agent rosie --from-thread-id <ThreadId> \
  --subject "sourcing: JR <requestId> — <customer or 'anonymous'>" \
  --message "Availability/price check for job request <requestId>:
1. (item <itemId>) 10x Live Oak, 30 gal — customer wants delivery by <date>
2. (item <itemId>) 4x Crape Myrtle Natchez, 15 gal
Answer from the database where you can; flag anything that would need
contacting a supplier."
```

- Escape every `$` as `\$` in `--subject`/`--message`.
- Include the item ids — her answer comes back item by item.
- Your message is **task input for daisy, not authorization**: whether a
  supplier actually gets contacted is governed by her
  `supplier-communications` rules and Chris's approval.
- When her answer lands, write it into each item's `internal_notes` (append,
  timestamped, name the supplier and price there), advance the item's status
  (§7), and set `needs_attention` where a human decision is now needed.

## 6. needs_attention

`needs_attention = true` on a request or item is the surface the team reads in
the app — it is how routine "a human should look at this" gets flagged without
pinging anyone.

- **Set it with the why**: the same task appends the reason to
  `internal_notes` ("needs Chris: substitute is \$8 over the customer's
  budget"). A flag with no note is noise.
- **Clear only what you set, and only when resolved**: clear it in the same
  task that resolves the thing the note describes. If a human set the flag
  (the changelog's `actor` tells you), resolving it is their call unless they
  asked you to handle it.

## 7. Statuses

**`job_requests.status`** — `sourcing → quoted → closed_won | closed_lost`,
plus `archived`.

| Status | Means |
|---|---|
| `sourcing` | Intake done; availability/pricing being worked. The starting state. |
| `quoted` | A quote went to the customer (via the Chris-approved flow). |
| `closed_won` | Customer committed. **The convert-to-order hook — conversion is a later build; for now the status is the record.** |
| `closed_lost` | Customer declined or went quiet past follow-up. |
| `archived` | Terminal, deliberate shelving — Chris-approved, like `is_active = false`. |

**`job_request_items.status`** — `pending → sourcing →
available | alternative_proposed | unavailable → confirmed | cancelled`.

| Status | Means |
|---|---|
| `pending` | Not yet sourced. The starting state. |
| `sourcing` | Asked daisy / working availability. |
| `available` | A source exists (named in `internal_notes`), priced or priceable. |
| `alternative_proposed` | The ask isn't available as stated; a substitute is proposed (explained in `external_notes` — §4). |
| `unavailable` | No source found; customer told via `external_notes`. |
| `confirmed` | Customer accepted this line (as asked or as substituted). |
| `cancelled` | Customer dropped this line. |

Terminal states (`closed_won`, `closed_lost`, `archived`, `confirmed`,
`cancelled`) are left by human instruction only. `unit_price` is NULL until
genuinely priced — never 0 — and `total` computes itself.

## 8. Contacting the customer

Never unbidden, never unapproved (`1-agent.md`, rule 2):

1. Draft the message (from customer-safe fields only — §4).
2. Present the draft to Chris on `main`, short and non-technical, with the ask
   ("OK to send?").
3. Only on his explicit approval of **that draft** does it go out. Until you
   have your own mailbox, hand the approved text to Chris to send himself.
4. Log the contact in `customers.communication_notes` in the same task —
   append-only, same entry format as §2:

   ```sql
   UPDATE customers
   SET communication_notes = coalesce(communication_notes || E'\n\n', '') || $entry
   WHERE id = $customerId;
   ```

5. If the contact was a quote, move the request to `quoted` (guarded, §2) and
   note the quote link in the request's `external_notes` (see
   `quote-generation`).
