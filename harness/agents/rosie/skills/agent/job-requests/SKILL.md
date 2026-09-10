---
name: job-requests
description: The operating procedure for the customer job-request tables rosie owns. Covers intake as a reserved id handed to the request's own `jr-<id>` thread, the concurrency discipline for tables the app edits too, the Austin-Plant-Supply-first sourcing and pricing ladder, the confirmation gate that holds a priced line until the supplier answers, and the request and item statuses. Use whenever you create, read, edit or advance a job request or its items, when an ask needs pricing, when a supplier's answer comes back, and before any contact with a customer. (v3.5.0)
metadata:
  author: lps
  version: "3.5.0"
---

# Job requests

Read `knowledge/files/SCHEMA.md` before writing any query. The tables here are
`customers`, `job_requests`, `job_request_items` and the read-only
`job_request_changelog`. You own every agent-side write to the first three; the
app's users edit the same rows from the UI, which is why the concurrency
section below is not optional.

**This thread is the source for its order** (`1-agent.md`, rule 5). Everything
job-related that needs Chris — an approval, a decision, a trade-off only he can
settle — is put to him **here**, on this thread's own web chat, never on the
customer's or supplier's thread. Those threads own their channel and their
contact history and they **route their inputs back here**: what the supplier
answered, what the customer said, a changed date, a cut scope. So this thread
is the one that knows the order's whole state, and the only place Chris has to
look to follow it. What goes out is drafted here, approved here, and sent by
whichever thread owns that channel, exactly as approved.

## 1. Intake

An intake starts one of two ways, and **neither of them writes a row on
`main`**:

- **An ask arrives as text** — Chris/Bhoumik on `main`, later a channel.
  `main` reserves the id and forwards the ask whole. That is all it does.
- **Someone clicks New job request in the app.** The button reserves the id
  and opens `jr-<id>` with nothing behind it; the ask is typed straight into
  that chat.

Either way **the rows are the jr thread's to create** — the customer, the
request and its lines. The thread that owns the request for its life is the
thread that writes it into existence, and `main` never creates a row it will
not be working on.

### On `main` — reserve, hand over

1. **Take the id without creating anything.**

   ```sql
   SELECT nextval('public.job_requests_id_seq');
   ```

   `job_requests.id` is `GENERATED ALWAYS`, so this is the only way to know
   the number before the row exists — and the number is what the thread is
   named by. (The app's button does the same through
   `reserve_job_request_id()`, migration 0072.) An ask that never becomes a
   request leaves a gap in the numbering: that is what a sequence is for, not
   something to repair.

2. **Hand the ask whole to `jr-<id>`.** The agent message carries the
   customer's full original words, the reserved id, the delivery date, and
   names this skill as the procedure to follow. Then acknowledge on `main` and
   let the thread work — a webchat acknowledgement includes the panel button
   `[Continue in JR-<id> chat](thread:jr-<id>)`.

   **The same handoff applies later**: any message `main` receives about an
   existing job request — a change, a question, a chase — is forwarded to its
   `jr-<id>` thread, never worked on `main` (and on webchat, answered with
   the same `thread:` button).

### On `jr-<id>` — write the rows

3. **Read your own row first.** The thread is named after the request, so the
   id is in your thread name:

   ```sql
   SELECT id, customer_id, name, status FROM job_requests WHERE id = $threadId;
   ```

   Nothing back means this thread is still a reservation — you are at step 4.
   A row back means the request exists (a thread reopened later, or a person
   started it in the app): read it, and take the ask as a change to it rather
   than creating anything.

4. **Find the customer before creating one.** Match in this order: `email`,
   then `phone`, then `name` + `company`. Never guess a person's name from an
   email address; if all you have is `jalvarez@…`, the name stays unknown until
   someone tells you.

   ```sql
   SELECT id, name, company, email, phone FROM customers
   WHERE is_active AND (email = lower($email) OR phone = $phone);
   ```

5. **No customer identifiable? Create the request anonymous.** `customer_id`
   is nullable by design. Put every identity clue you do have (a first name, a
   phone fragment, "the landscaper Chris met Tuesday") into the request's
   `customer_notes` so mapping is possible later.

6. **Create the request under your own thread's id.** The id is not the
   sequence's to choose here — it was reserved before this thread existed, and
   the thread is named after it, so state it and override the identity:

   ```sql
   SET app.actor TO 'rosie';
   INSERT INTO job_requests (id, customer_id, name, customer_notes)
   OVERRIDING SYSTEM VALUE
   VALUES ($threadId, $customerId, $name, $customerNotes);
   ```

   `status` defaults to `sourcing`. The overall message goes in
   `customer_notes` — **only what no other column already holds** (§4).

   **Name the request only when the job/site is actually known.**
   `job_requests.name` is the job/site descriptor — a real residence name,
   street number/name, PO, or named project/site (for example, "Riverbend
   patio planting"). It is never a combined company/job title: the app's
   company-first `Company — Job name` display is presentation logic. Leave
   `name` NULL until one of those real descriptors is known; do not infer a
   generic short-description fallback from the plant list, delivery timing, id
   or other shape of the ask. A person may correct the company or descriptor
   later, but never manufacture a combined stored name. It is what the
   request's conversation is called in the app's thread list, so populate it
   promptly once the real descriptor is available.

   `INSERT 0 1` is the check that matters: a duplicate-key error means the row
   already exists (step 3 raced you) — re-read it and continue from there.

7. **Then the lines**, one per asked-for plant: `name` and `size` carrying the
   customer's ask with gallon notation normalized to `G` in the table (`"30
   gal or larger"` becomes `"30 G or larger"`), and what they said about an
   item in the item's `customer_notes` — same remainder rule. Then run the
   sourcing round (§5); this thread owns the request for its life.

8. **Mapping an anonymous request later** is a find-or-create of the customer
   (step 4) followed by a targeted update:

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

4. **Two note columns, two disciplines.**

   `sourcing_notes` — on a request or on an item — is **free text you edit in
   place** (§4). It is a working sheet, not a log: when a supplier's answer
   changes you rewrite that supplier's line, you don't add a second one.
   Because you are overwriting, read it and write it back in the same breath,
   and keep every line you didn't come to change:

   ```sql
   SET app.actor TO 'rosie';
   SELECT sourcing_notes FROM job_request_items WHERE id = $itemId;
   -- edit the text you just read, then write the whole column back:
   UPDATE job_request_items SET sourcing_notes = $text WHERE id = $itemId;
   ```

   Overwriting a copy you fetched ten minutes ago is how a person's line
   disappears. The changelog keeps every before and after, so it is
   recoverable — but only if somebody notices it went.

   **A newline is `E'…\n…'`, never `'…\n…'`.** Postgres stores a plain
   single-quoted `\n` as the two characters `\` and `n`, so the note reads
   `APS: Thryallis 3 G @ $23/unit\nVerde River: 5 G` on one line — in the app,
   in the quote, in every later read of it. One line per supplier only works if
   the line breaks are real. Prefix the string with `E`, or put an actual line
   break inside the quotes:

   ```sql
   UPDATE job_request_items
   SET sourcing_notes = E'APS: Substitute: Thryallis 3 G @ $23/unit\nVerde River: Yellow Thryallis 5 G listed; price not on file'
   WHERE id = $itemId;
   ```

   There is no append-only note column left to write: `customers`' contact log
   was dropped by migration 0073 and the customer's own thread carries that
   history (`customer-coordination`).

   The name is whose entry it is — `Rosie` for your own, `Chris` / `Bhoumik`
   for what they decided.

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
that is what `sourcing_notes` is for.

## 4. The three notes, and who gets to see what

| Column | Whose words | Discipline |
|---|---|---|
| `customer_notes` | The customer's, verbatim | Evidence. Never edited. **What the structured columns don't already hold.** |
| `sourcing_notes` | Ours, internal | **Free text, edited in place.** A line per supplier, in §4.1's shape. |
| `external_notes` | Ours, **customer-visible** | Written to be shown/sent to the customer. **Never how we sourced it** — §4.2. |

**`customer_notes` is the remainder, not a transcript.** Everything a customer
told you that a column already holds — the plant, the size, the quantity, the
delivery address, who they are — belongs in that column and **only** there. What
goes in `customer_notes` is what has nowhere else to live: constraints,
preferences, deadlines, conditions, reasons, and anything you had to leave out
of a structured field.

| They said | Where it goes |
|---|---|
| "10 Live Oak, 30 gal" | `job_request_items.name` / normalized `size` (`30 G`) / `quantity` |
| "deliver to 88 NW Quimby St, Portland" | `job_requests.shipping_*` |
| "I'm Dan at Terra Firma, 503-555-0134" | `customers.name` / `company` / `phone` |
| "needs to be on site before the Jul 15 inspection" | request `customer_notes` |
| "client is picky about branching — send photos first" | item `customer_notes` |
| "partial is fine if the rest ships by then" | item `customer_notes` |
| "same crew as the Riverbend job last spring" | request `customer_notes` |

Two consequences worth stating:

- **Do not restate the ask.** An item whose `customer_notes` reads "wants 10 in
  30 gal" adds nothing to `quantity = 10, size = '30 G'` — it just gives a
  later reader two places to check and a chance for them to disagree. If the
  ask is all they said, leave the column NULL.
- **A note that duplicates a column is a signal you filled the column wrong.**
  "30 gal or larger" in `customer_notes` means `size` should have read
  `30 G or larger`. Normalize the gallon token to `G`; don't keep both.

The app shows this column exactly that way: an item's note is a sub-line under
its name, and the request's is read in the expanded card — as the *extra* the
customer said, alongside the fields rather than repeating them.

`sourcing_notes` on an item is the **sourcing sheet** — what each supplier
said, a line each, kept current:

```
APS: Substitute: Muskogee Crape Myrtle 30 G @ $265/unit
Acosta: Crape Myrtle Natchez 30 G @ $50/unit, confirmed available
Everde: no 30 G
Customer flexible on size if it saves 2 weeks
```

Written that way it is read at a glance, across ten lines at once. Written as
prose — "I asked Austin Plant Supply about the Live Oak and they came back
saying…" — it is read once, by somebody with time.

### 4.1 The supplier line

One shape, so ten of them read as a column:

```
<Supplier>: [Substitute: ]<the row they have> @ $<price>/unit[, <facts>]
```

**The thing comes before the price it is priced at.** `APS: $175/unit, Dwarf
Sabal Minor/Silver Palmetto 15 G` makes a reader work out which of those two
halves is the offer; `APS: Dwarf Sabal Minor/Silver Palmetto 15 G @ $175/unit`
says it in the order it is thought. Four habits:

- **A line per supplier.** `APS` is Austin Plant Supply; anyone else gets a
  short recognizable name. The fewest words that carry the fact, not a
  sentence.
- **Name the row, then `@ $N/unit`.** `<name> <size>` as the catalogue prints
  them, sizes `XX G`. Leave the row out only when it is word for word the ask —
  then the price alone carries it, and `APS: $7/unit` means "the ask, at our
  price". Naming it is never wrong; the catalogue rarely words a plant the way
  a customer did.
- **`Substitute:` when it isn't the ask.** A different plant, cultivar or size
  gets the prefix, so a swap is visible at the start of the line instead of
  buried at the end of it. The line goes in as soon as you propose the swap;
  the `Quoted for <offering>.` note in `external_notes` and the
  `alternative_proposed` status follow when the offer is confirmed (§5.3) —
  same test, later moment. A catalogue that merely names the same plant
  differently is not a substitution and takes none of the three.
- **Nothing to price → no `@` clause**, just what is missing: `APS: no 30 G`.
  Same for a row carrying no price: `APS: Live Oak 30 G, no price on file`.

Three more, unchanged by the shape:

- **Update the line, don't add another.** When APS answers, that first line
  *becomes* `APS: Substitute: Muskogee Crape Myrtle 30 G @ $265/unit, 40
  available` — the old text goes. The changelog holds what it said before,
  and who changed it when, so rewriting loses nothing.
- **Free text is welcome.** Anything that isn't about a supplier but matters
  gets its own line. The shape above is a habit, not a rule, and nothing
  enforces it.
- **Never what a column already holds** — not the ask, the quantity, the
  status, or the price you just wrote into `unit_price`. Naming the supplier's
  row is not restating the ask: it is which row you priced, and it is the
  point of the line.

### 4.2 The request's sheet, and what the customer sees

`sourcing_notes` on the **request** is about the job, not its lines — only what
changed about the order itself:

```
Delivery date 8/22 → 8/29
Ship-to moved to the Riverbend site
Trees split off into their own request
```

A line's sourcing detail never goes here. It goes on the line.

**The customer-visibility rule.** When a quantity changes, or a substitute is
quoted or recommended, the customer has to be able to see **what** they are
being offered. Write it on the item's `external_notes` in the same task as the
status move that makes it an offer (§5.3) — a substitute nobody has confirmed
yet is a `sourcing_notes` line and nothing more:

```
Quoted for Little Ollie 3 G.
Quoted for Skyward Holly 15 G.
Quoted for 12 rather than 10.
```

**Use `Quoted for <what we are offering>`.** Write a customer-facing note only
when the offered plant or size differs from the ask: `Quoted for Skyward Holly
15 G.` Do **not** add a note merely because catalogue naming differs for the
same offered plant. State the offer, not the reason. Why we substituted is
ours: a price we don't hold, a grower who is out this season, a supplier who
sells in dozens. "5 G price is not on file", "Natchez unavailable this season",
"the supplier sells in dozens" — every one of those is an `sourcing_notes`
line.

**Where we source from is never in it.** The shared note says what the customer
is getting; it says nothing about how we got it. Supplier names, supplier or
catalogue pricing, price lists, stock counts, who was asked and what they came
back with — none of it belongs in `external_notes`, however plainly the
sourcing sheet carries it. `Quoted for Muskogee Crape Myrtle 30 G.` is the
note; `APS quoted Muskogee at $265` is a `sourcing_notes` line typed into the
wrong column. **The one exception is being told to.** When Chris (or the
customer) explicitly asks for a supplier, a price list or any of the rest to be
named in what the customer sees, write that and only that, and record who asked
in `sourcing_notes` in the same task. Never volunteer it, and never read the
instruction into a message that merely happens to mention a supplier.

**Sizes are written `XX G`** — `1 G`, `3 G`, `30 G` — the way the inventory
prints them, in both note columns. Not `3-gallon`, not `3gal`, not `#3`. The
item's own `size` follows the same gallon notation: normalize any gallon
spelling to `G` (`"5 gal"` → `"5 G"`, `"30 gal or larger"` → `"30 G or larger"`).

## 5. Pricing and sourcing — Austin Plant Supply first

**The round runs on the request's own `jr-<requestId>` thread** — handed the
request at intake, kept for its life (`1-agent.md`, *Threads*). Every look-up
below returns a screen of catalogue rows *per line*; none of it belongs on
`main`. The jr thread does the look-ups and the item writes, sends the
availability asks to each supplier's thread (§5.2), and reports on its own
web chat what is priced, what is waiting and what needs a decision. A genuinely long
read (a whole price list, a wide changelog sweep) can still go to a task
thread per the base prompt.

**Austin Plant Supply (`suppliers.id = 1`) is the default source.** It is the
house yard, its catalogue is in the database, and reading it is not contacting
a supplier — you look it up yourself with `plant-and-supplier-search`, scoped
to that supplier. Every line is priced from Austin Plant Supply unless
something below moves it off.

### A listing is not a confirmation

The inventory tables are price lists somebody published — Austin Plant Supply's
included. They say what a plant costs and how the supplier worded it. They do
not say it is there. So the ladder settles **which row prices the line**, not
whether the line can be filled, and every rung leaves the item **`pending`**.
Exactly two things move it off `pending` (§5.3), and nothing else does:

- **The supplier answered** — an availability request they submitted, or an
  email/text reply, relayed by their supplier thread (§5.2).
- **Chris said to treat it as confirmed** — in as many words, on this line or
  this request.

A stock count in the catalogue is not the third: `inventory.quantity` is what
the sheet claimed on the day it was ingested. It goes on the supplier line as a
fact about the sheet — `listed 32,000 on their Aug 18 sheet` — never as a
reason to call a line available.

The ladder. Stop at the first rung that answers the line:

1. **Austin Plant Supply has the ask** — the plant, at the size asked for,
   with a price. Fill `unit_price` from their row (§5.1) and write the `APS:`
   line. Nothing leaves this thread *for the price*; the line is priced, not
   confirmed, and stays `pending` until §5.3.
2. **They don't have it as asked → propose their closest alternative.** A
   neighbouring size, a near cultivar, the species where the customer named a
   selection. Price it from that row and prefix its `sourcing_notes` line
   `Substitute:` (§4.1). The line stays `pending`: `alternative_proposed` is
   what the substitute becomes when it is confirmed (§5.3), and the customer's
   `external_notes` note is written then, not now (§4.2).
3. **Nothing close at Austin Plant Supply → other suppliers.** Search the rest
   of the inventory yourself, and ask each candidate supplier's own thread
   what the database can't answer (§5.2) — that thread owns the conversation
   and picks the channel (an availability request in an LPS Partner's portal,
   or gated outreach otherwise; `supplier-coordination`).
   What you find stays in `sourcing_notes` — **another supplier's price
   never goes in `unit_price`** (§5.1). The lines say **why the line left
   Austin Plant Supply**, **which supplier quoted** and **what they quoted**, in
   §4.1's shape — a price that isn't theirs must never be silent about whose it
   is, nor about which row it prices — and `unit_price` stays NULL until Chris
   says to carry that price.
4. **Nothing anywhere** — no row at Austin Plant Supply, none elsewhere, and
   the supplier threads' answers are in too → `unavailable`, with the reason in
   `sourcing_notes`. What the customer is told is that the line can't be
   supplied, not why.

Two things move a line off the default without walking the ladder: **Chris or
the customer naming another supplier**, or naming one to keep out of it ("don't
ask Austin"). Follow the instruction and record it — who said it, and what they
said — in the item's `sourcing_notes`. A supplier named that way is the one
case where `unit_price` carries a price that isn't Austin Plant Supply's: the
instruction is what put it there, and the note has to say so.

When rungs 2 and 3 both have an answer — a close Austin Plant Supply substitute
*and* the exact ask at another supplier — put both on the line and leave the
choice to Chris. Which one the customer is offered is his call, and a line
waiting on it stays `pending`: what he is choosing between is on the line, and
the two supplier rows say it better than a status word could.

### 5.1 Filling the price

**The price column is Austin Plant Supply's.** Rungs 1 and 2 fill `unit_price`
from their row. Rung 3 does not: another supplier's price goes on that
supplier's `sourcing_notes` line and `unit_price` stays NULL, until Chris or
the customer explicitly sources the line there — the only instruction that puts
someone else's price in the column, and it goes on the line with it.

### Cultivar/color pricing convention

For **crape myrtles, plumbago and salvias**, price a customer-named variety or
color from Austin Plant Supply's **general line at the matching size** when the
catalogue does not identify that variety. Keep the customer's requested name
and size on the item — a generic price line is a pricing basis, **not** a
substitute offer, so do not add an `external_notes` substitution note or change
the item to `alternative_proposed` solely for that difference. Record the
basis concisely in `sourcing_notes`, for example:

```
APS: Generic Salvia 1 G catalogue price @ $5/unit — priced per Chris direction
```

This applies to variety/color only: a different size, a different plant, or a
customer constraint that makes the variety material still follows the normal
substitute/confirmation path. Catalogue price is still not availability; the
item stays `pending` until the supplier confirms it or Chris explicitly directs
it be treated as confirmed.

Write **`unit_price` only**, taken from the inventory row you sourced:

```sql
SET app.actor TO 'rosie';
UPDATE job_request_items SET unit_price = 295.00 WHERE id = $itemId;
```

- **`total` writes itself** — generated as `quantity * unit_price`, the
  **customer's asked quantity** times the unit price. That is what a quoted
  line is: what they asked for, at our price. Never write it.
- **Never write `available_quantity`.** How many we can actually supply is
  settled by people in the app, not by you. Leave it NULL — the app shows a
  dash — and put what you learned about supply in `sourcing_notes` instead.
- `unit_price` stays NULL until genuinely priced, **never 0**. An inventory row
  carrying no price — or a `0`, which in this data means the same thing — is
  not a price: that line is on rung 2 or 3, not rung 1. A rung-3 line is
  unpriced by rule, not by oversight — its price is on its supplier line.

Then say where it came from, on the item's own line (§4.1):

```
APS: Quercus Virginiana Live Oak 30 G @ $295/unit
```

A line sourced off the default carries its price the same way — in the note,
not the column:

```
APS: no 30 G
Acosta: Live Oak 30 G @ $310/unit, 8 ready Sep
```

### 5.2 Asking the supplier's thread

The jr thread never reaches a supplier itself (`1-agent.md`, rule 1) — every
supplier conversation lives on that supplier's **own dedicated thread**, the
`suppliers.rosie_thread_id` value, running `supplier-coordination`. What you
ask it for is the **confirmation the database cannot give** (§5.3); it owns
the channel — an availability request in an LPS Partner's portal, gated
outreach otherwise.

**When the ask needs Chris's approval, it is asked here** (`1-agent.md`, rule
5) — a Partner's portal availability request does not, but outreach to a
non-Partner does. Draft it here, applying what `suppliers.notes` remembers
about how they like to be approached, put it to Chris on this thread's web
chat, and route the **approved text verbatim** to the supplier thread to send
exactly as approved (`supplier-coordination` §4). One order, one place Chris
is asked.

**Every line of the request goes into the ask, not a subset.** The ones Austin
Plant Supply priced, the ones only a substitute answered, and the ones nothing
in the catalogue matched at all — all of them. A line missing from a price
list is exactly the line worth asking a human about: the sheet is a snapshot of
what they published, not of what is standing in their yard, and a supplier who
has it unlisted can only say so if the line was put in front of them. The only
line left out is one **Chris explicitly excluded**, and his instruction goes in
its `sourcing_notes` beside the omission.

A question with no supplier in mind ("who has 30 G Live Oaks?") is a database
search you run yourself (`plant-and-supplier-search`); finding *new* suppliers
is daisy's scope, raised through `main`.

Availability asks go as **one agent-message per (request, supplier)**,
carrying every line, the demand, and **the mapped inventory rows your look-up
found at that supplier** — id, catalogued name/size, price — so the supplier
thread prefills from your mapping instead of re-running the search:

```bash
bash scripts/agent-msg/send --to-agent rosie --thread-id "<rosie_thread_id>" \
  --from-agent rosie --from-thread-id <ThreadId> \
  --subject "sourcing: JR <requestId> — <customer or 'anonymous'>" \
  --message "Availability check for job request <requestId> — all <n> lines,
delivery <date>. Demand and this supplier's mapped inventory rows, line by line:
1. (item <itemId>) 10x Live Oak, 30 G — inventory 4821: Quercus Virginiana Live Oak 30 G @ \$295/unit
2. (item <itemId>) 4x Crape Myrtle Natchez, 15 G — only 30 G listed (inventory 5127 @ \$265/unit)
3. (item <itemId>) 52x Berkeley sedge, 1 G — nothing on their list
Every line needs confirming, the priced ones included. Follow
supplier-coordination."
```

- Escape every `$` as `\$` in `--subject`/`--message`.
- Include the item ids — the answer comes back item by item.
- **Say what the look-up found on every line**, including "nothing on their
  list", and name the `inventory` row (id + catalogued name/size/price) when
  one maps — an unambiguous mapped row is what the supplier thread stores as
  the line's `mapped_inventory_id` and seeds its price from. The id is the
  part that matters: a name and a price it can't trace back to a row is a
  number it has to drop. Only a **same plant, same size** row is a mapping;
  a near-miss (line 2 above) is described in the prose and named as *not*
  mapping, so the supplier thread writes a note rather than a row.
- When the relay lands, put it on each item's supplier line — one line per
  supplier named, in §4.1's shape (the row they have, then its price, and
  `Substitute:` when it isn't the ask). Another supplier's pricing stays on
  the line: `unit_price` is not filled from it (§5.1).
  **A relay is a listing until it says the supplier confirmed it** — read it
  in §5.3's terms and move only the lines it actually answers.

### 5.3 Confirming a line

The jr thread never fetches a confirmation itself (`1-agent.md`, rule 1). It
reaches you one of two ways.

**The supplier answered, through their thread.** Ask on the supplier's own
thread (§5.2), with **every line of the request in the ask** — priced,
substituted and unmatched alike. That thread owns the channel and picks it: an
**availability request** in the supplier's portal when they are an LPS
Partner — Austin Plant Supply included — or Chris-gated outreach when they are
not (`supplier-coordination`; whether the customer's details are shared is the
remembered per-supplier preference, or Chris's answer). The relay comes back
item by item and says which
lines the supplier confirmed and which they left alone. Only those move:

| What the supplier said | The line becomes |
|---|---|
| Has it | `available`, priced per §5.1 |
| Can order it (ETA in their notes) | `available`, with the ETA on its supplier line |
| Offers something else | `alternative_proposed` — the offer named in `external_notes` in that same task (§4.2) |
| Doesn't have it | `unavailable`, or back to rung 2/3 for another source |
| Didn't answer that line | `pending` — nothing changed |

**Chris said so.** "Quote the Austin list", "treat the yew as confirmed" — that
is a confirmation, and the only one that arrives without a supplier. It has to
be in as many words about these lines; an instruction to get a quote out is
not one. Record it on the line, the way a supplier-named line records its
instruction (§5):

```
APS: Rose Iceberg 5 G @ $27/unit — Chris confirmed 2026-08-19, quote it
```

**Then report what is waiting — on this thread's own web chat.** When the
round is done, one short webchat message here (`webchat-cli send`, defaulting
to this thread): the job, how many lines are priced, which asks are out with
which suppliers, and anything only Chris can settle (a subset he might want
cut, an unremembered share-details preference the supplier thread has
raised). **This thread is the only webchat channel to Chris about this job —
nothing goes to `main`** (`1-agent.md`); the notification brings him here.
Then let it sit: don't chase, and don't quote off the listing while you wait.
The milestones post the same way as they happen: intake done, asks out,
answers in, quote ready.

## 6. Statuses

**`job_requests.status`** — `sourcing → quoted → closed_won | closed_lost`,
plus `archived`.

| Status | Means |
|---|---|
| `sourcing` | Intake done; availability/pricing being worked. The starting state. |
| `quoted` | A quote went to the customer (via the Chris-approved flow). |
| `closed_won` | Customer committed. **The convert-to-order hook — conversion is a later build; for now the status is the record.** |
| `closed_lost` | Customer declined or went quiet past follow-up. |
| `archived` | Terminal, deliberate shelving — Chris-approved, like `is_active = false`. |

**`job_request_items.status`** — `pending → available |
alternative_proposed | unavailable`. Four words, since migration 0058.

| Status | Means |
|---|---|
| `pending` | Not answered yet. The starting state, and where a line stays for as long as it is being worked — **priced off a catalogue included**. |
| `available` | **A supplier confirmed it**, or Chris said to treat it as confirmed (§5.3). The source is named in `sourcing_notes`. |
| `alternative_proposed` | The ask isn't to be had; a substitute the supplier confirmed (or Chris approved) is offered — named in `external_notes` (§4.2). |
| `unavailable` | No source found, or the line was dropped. The customer is told the line can't be supplied via `external_notes`; the reason stays in `sourcing_notes`. |

**The two middle states are answers, not findings.** Finding a row in the
catalogue — at Austin Plant Supply or anywhere else — never earns one; it fills
`unit_price` and a supplier line and leaves the status alone (§5.3). A line
carrying a price and a `pending` status is the normal, correct shape of a
sourced-but-unconfirmed line, and the two together are what tell a person there
is something to decide.

**A status is where a line stands, not what you are doing about it.** There is
no `sourcing` status: a line a supplier thread has been asked about is still `pending`, and
who has been asked — and what came back — is on the line's supplier rows:

```
APS: no 30 G
Acosta: Live Oak 30 G @ $42/unit, 8 ready Sep
```

Those two lines say more than a status word ever did, and they are the only
place the progress of a line is recorded. Do not restate them as a status.

`confirmed` and `cancelled` are gone too. A customer accepting a line does not
change what the line *is* — it stays `available` (or `alternative_proposed`),
and the acceptance is a note plus, when the whole request is committed,
`job_requests.status = 'closed_won'`. A line the customer drops becomes
`unavailable` with the reason in the notes; a line entered **in error** is
deactivated (`is_active = false`), never statused.

The request-level terminal states (`closed_won`, `closed_lost`, `archived`) are
left by human instruction only. Pricing a line — and the two columns you don't
touch — is §5.1.

## 7. Contacting the customer

Never unbidden, never unapproved (`1-agent.md`, rules 2 and 5) — and never
sent from the jr thread. **The approval is asked here; the sending is theirs.**

1. **Draft it here**, from **customer-safe fields only** (§4.2): what they are
   getting, never how we sourced it — no supplier names, no supplier pricing,
   no `[AGENT MESSAGE]` content. This thread holds all of that, which is
   exactly why the filtering happens at the draft, not after it. Read
   `customers.notes` first and apply what it remembers about how they like to
   be written to, so the text is **final** before Chris sees it.
2. **Put the draft to Chris on this thread's own web chat** (`webchat-cli
   send` — the notification reaches him; never via `main`), short and
   non-technical. Approval is of **that exact text**.
3. **Route the approved text to the customer's dedicated thread**
   (`customers.rosie_thread_id`, `customer-coordination`) — verbatim, in an
   agent message that says it is Chris-approved and when. That thread sends it
   **exactly as approved** and quotes it to its own web chat. If it sees a
   reason to change a word, it comes back here for re-approval rather than
   editing an approved draft.

What the customer answers comes back to this thread the same way. **Approval
for anything about this order is asked here**, whoever ends up sending it.

When the contact was a quote, move the request to `quoted` (guarded, §2) and
note the quote link in the request's `external_notes` (see
`quote-generation`).
