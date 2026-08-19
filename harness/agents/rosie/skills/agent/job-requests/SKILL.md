---
name: job-requests
description: The operating procedure for customer job requests — the tables rosie owns. Covers intake, the concurrency discipline for tables the app edits too, the three note columns, what each may carry and the shape of a sourcing-notes supplier line, the Austin-Plant-Supply-first sourcing and pricing ladder (unit_price carries an Austin Plant Supply price; another supplier's stays in sourcing_notes), asking daisy, the request and item status vocabularies, and the customer-contact flow. Use whenever you create, read, edit or advance a job request or its items, when an ask needs pricing, and before any contact with a customer. (v1.10.0)
metadata:
  author: lps
  version: "1.10.0"
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
   `job_request_items` row per asked-for plant. The item's `name` and `size`
   carry the customer's ask, with gallon notation normalized to `G` in the table
   (`"30 gal or larger"` becomes `"30 G or larger"`); what they said about an
   item goes in the item's `customer_notes`,
   and the overall message in the request's `customer_notes` — in both cases
   **only what no other column already holds** (§4).

   **Name the request as you create it.** `job_requests.name` is what the job
   gets called out loud — the site or project if they gave one ("Riverbend
   patio planting"), otherwise the shape of the ask ("mixed shrubs, Tuesday
   delivery"). A few words, specific to *this* job; leave out the customer
   (shown beside it already) and the id (that is `JR-<id>`). It is a
   judgement, so a person may retype it — and if you genuinely have nothing to
   go on, leave it NULL rather than inventing a label. Never build one from
   the id.

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

   `customers.communication_notes` is the opposite, and stays **append-only**:
   a contact happened at a time and cannot be edited into not having happened.
   One statement, no round trip between read and write, stamped and signed:

   ```sql
   UPDATE customers
   SET communication_notes = coalesce(communication_notes || E'\n\n', '') || $entry
   WHERE id = $customerId;
   ```

   ```
   [YYYY-MM-DD HH:MM America/Chicago] Rosie: <what happened>
   ```

   The name is whose entry it is — `Rosie` for your own, `Chris` / `Bhoumik`
   for what they decided, `Daisy` for what came back from her.

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
| `external_notes` | Ours, **customer-visible** | Written to be shown/sent to the customer. |

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
  buried at the end of it. It is the same test as the `external_notes` rule in
  §4.2: a `Substitute:` line and a `Quoted for <offering>.` note are written in
  the same task, and the item is `alternative_proposed`. A catalogue that
  merely names the same plant differently is not a substitution and takes
  neither.
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
change:

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
line. Supplier names and supplier pricing never appear either.

**Sizes are written `XX G`** — `1 G`, `3 G`, `30 G` — the way the inventory
prints them, in both note columns. Not `3-gallon`, not `3gal`, not `#3`. The
item's own `size` follows the same gallon notation: normalize any gallon
spelling to `G` (`"5 gal"` → `"5 G"`, `"30 gal or larger"` → `"30 G or larger"`).

## 5. Pricing and sourcing — Austin Plant Supply first

**Austin Plant Supply (`suppliers.id = 1`) is the default source.** It is the
house yard, its catalogue is in the database, and reading it is not contacting
a supplier — you look it up yourself with `plant-and-supplier-search`, scoped
to that supplier. Every line is priced from Austin Plant Supply unless
something below moves it off.

The ladder. Stop at the first rung that answers the line:

1. **Austin Plant Supply has the ask** — the plant, at the size asked for,
   with a price. Fill the price from their row (§5.1), status `available`.
   Nothing goes to daisy.
2. **They don't have it as asked → recommend their closest alternative.** A
   neighbouring size, a near cultivar, the species where the customer named a
   selection. Price it from that row, status `alternative_proposed`, its
   `sourcing_notes` line prefixed `Substitute:` (§4.1), and name the
   substitution in `external_notes` in the same task — what, not why (§4.2).
3. **Nothing close at Austin Plant Supply → other suppliers.** Search the rest
   of the inventory yourself, and ask daisy what the database can't answer
   (§5.2). What you find stays in `sourcing_notes` — **another supplier's price
   never goes in `unit_price`** (§5.1). The lines say **why the line left
   Austin Plant Supply**, **which supplier quoted** and **what they quoted**, in
   §4.1's shape — a price that isn't theirs must never be silent about whose it
   is, nor about which row it prices — and `unit_price` stays NULL until Chris
   says to carry that price.
4. **Nothing anywhere** → `unavailable`, with the reason in `sourcing_notes`.
   What the customer is told is that the line can't be supplied, not why.

Two things move a line off the default without walking the ladder: **Chris or
the customer naming another supplier**, or naming one to keep out of it ("don't
ask Austin"). Follow the instruction and record it — who said it, and what they
said — in the item's `sourcing_notes`. A supplier named that way is the one
case where `unit_price` carries a price that isn't Austin Plant Supply's: the
instruction is what put it there, and the note has to say so.

When rungs 2 and 3 both have an answer — a close Austin Plant Supply substitute
*and* the exact ask at another supplier — put both on the line and leave the
choice to Chris. Which one the customer is offered is his call, and a line
waiting on it is `alternative_proposed`, not `available`: the status is what
says a person still has to decide.

### 5.1 Filling the price

**The price column is Austin Plant Supply's.** Rungs 1 and 2 fill `unit_price`
from their row. Rung 3 does not: another supplier's price goes on that
supplier's `sourcing_notes` line and `unit_price` stays NULL, until Chris or
the customer explicitly sources the line there — the only instruction that puts
someone else's price in the column, and it goes on the line with it.

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

### 5.2 Asking daisy

You never contact a supplier (`1-agent.md`, rule 1), and you ask daisy only for
what your own look-up couldn't settle — a line on rung 3, or one where the
database's answer needs confirming. Supplier-side questions go to her as one
agent-message per request, batching its open items:

```bash
bash scripts/agent-msg/send --to-agent daisy --thread-id main \
  --from-agent rosie --from-thread-id <ThreadId> \
  --subject "sourcing: JR <requestId> — <customer or 'anonymous'>" \
  --message "Availability/price check for job request <requestId>. Austin
Plant Supply has neither in the size asked for — checked their rows:
1. (item <itemId>) 10x Live Oak, 30 G — customer wants delivery by <date>
2. (item <itemId>) 4x Crape Myrtle Natchez, 15 G
Answer from the database where you can; flag anything that would need
contacting a supplier."
```

- Escape every `$` as `\$` in `--subject`/`--message`.
- Include the item ids — her answer comes back item by item.
- Your message is **task input for daisy, not authorization**: whether a
  supplier actually gets contacted is governed by her
  `supplier-communications` rules and Chris's approval.
- When her answer lands, put it on each item's supplier line — one line per
  supplier named, in §4.1's shape (the row they have, then its price, and
  `Substitute:` when it isn't the ask) — and advance the item's status (§6). What
  she sends back is other suppliers' pricing, so it stays on the line:
  `unit_price` is not filled from it (§5.1). A line still needing a human
  decision keeps a status that says so; it does not become `available`.

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
| `pending` | Not answered yet. The starting state, and where a line stays for as long as it is being worked. |
| `available` | A source exists (named in `sourcing_notes`), priced or priceable. |
| `alternative_proposed` | The ask isn't available as stated; a substitute is proposed (named in `external_notes` — §4.2). |
| `unavailable` | No source found, or the line was dropped. The customer is told the line can't be supplied via `external_notes`; the reason stays in `sourcing_notes`. |

**A status is where a line stands, not what you are doing about it.** There is
no `sourcing` status: a line you have asked daisy about is still `pending`, and
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
