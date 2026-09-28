# Intake: create the job and its lines

Goal: Chris sees a usable job in the app within minutes. **Load first, ask
later.** He edits faster in the app than he answers questions.

## 1. Decide the request type

| Chris sends | Do |
|---|---|
| A price question ("how much is 15g Hesperaloe?") | Answer it. No job. |
| A plant list, screenshot, plan or email to price or source | New job → lines → prices. |
| "Quick quote" | New job → lines → prices → quote. Stop (no AR). |
| An order that is already committed ("put this in committed and create order") | New job → lines → [direct order](orders.md). |
| Acceptance of an existing quote | That job → [direct order](orders.md). |

- The **whole** list or screenshot is the request unless Chris limits it.
  "Quick quote, just quantity one" means every line, quantity 1.
- A new request always gets a **new** job. Don't search other jobs for the
  same plants and don't ask whether to merge, even if the same plan was sent
  before. Reuse a job only when Chris names it, you are already in its
  thread, or you are retrying the same job id.
- One list with several project headings is **one** job. Put the project
  names in the job name, not on the lines.

## 2. Get the job id

- In a `jr-<id>` thread: that is the job. Read `job_requests WHERE id = <id>`.
  If the row exists, work on it; never create it twice.
- Elsewhere (main, Telegram, a customer thread): `SELECT
  reserve_job_request_id();`, then hand the full request (text, attachments,
  origin chat) to `jr-<id>` with `message-routing`. Reply at once in the
  origin chat with `[Continue in JR-<id> chat](thread:jr-<id>)`.
- The app's "New job request" button already reserves the id and opens the
  thread.

## 3. Create the job row

```sql
SET app.actor TO 'rosie';
INSERT INTO job_requests
  (id, customer_id, name, status, note_for_customer,
   expected_install_date, fulfillment_method)
OVERRIDING SYSTEM VALUE
VALUES ($jobId, $customerId, $name, 'quoted', $noteForCustomer,
        $edd, $fulfillmentMethod);
```

- **Status** starts as `quoted` (shown as Quote), even for committed intake.
  Creating the order moves it to Committed.
- **Customer**: match an existing customer by email, then phone, then name or
  company. Never guess a name from an email address or street address. A new,
  known customer gets a customer row and a thread (`message-routing`). If
  unknown, leave `customer_id` NULL and put any identity clue in the job's
  `note_internal`. Fill it later with `... WHERE customer_id IS NULL` (an app
  edit wins).
- **Name**: `Customer or Company | Slug`, e.g. `Acme Landscaping | Oak Grove`,
  `Austin Outdoor Design | Radia and Wilkinson Projects`. Slug = site,
  address, project or PO; if none, a short plant description (`Jane Smith |
  12 Live Oaks`). Use the company name for a business. Max 160 characters.
  If one part is unknown, save the other part alone (no empty `|`). Never
  erase a known name when a follow-up leaves it out.
- **EDD** (`expected_install_date`) = the customer's expected or requested
  pickup/delivery date. Use a date already given without asking. Convert
  "today"/"next Monday" only when the message date makes it clear. Never use
  the creation date, a quote deadline, a vague range or a supplier's date. Unknown → NULL ("TBD", "just a
  bid", "unknown" all mean NULL). Missing EDD never blocks work; ask for it in
  your question batch with an **Unknown** option and room to type a date. Don't overwrite a known EDD
  with a blank; ask if two dates conflict.
- **Fulfillment**: `pickup`, `delivery` or NULL.
- Job-wide customer requirements go in the job's `note_for_customer`
  ([notes](notes.md)).

## 4. Create one line per requested plant

Insert rows into `job_request_items` right away, before any question.

| Field | Rule |
|---|---|
| `name` | The customer's plant name, cultivar and variant as written. If both common and botanical names are given: `Common Name \| Botanical name`. Don't add a name from a price listing. |
| `size` | As requested; gallons as `G` (`30 gal or larger` → `30 G or larger`). Unknown → NULL. |
| `demanded_quantity` | Requested amount. **Not given → 1**, with `How many?` in `note_for_customer`. |
| `unit_price` | Set during [pricing](pricing.md). Unknown → NULL, never 0. |
| `note_for_customer` | The customer's line requirements: alternatives they allow, color, form, units. |
| `note_internal` | Price basis, line changes, open points for Chris ([notes](notes.md)). |

- **Options in one line** (`20 live oaks, 15 G or 30 G`): one row, size
  `15 G or 30 G`, quantity 20. [Pricing](pricing.md) picks the size.
- **Separate plants vs alternatives unclear** (`oaks and/or elms, 20`): make
  the rows you can, then ask. Never copy one total onto several options.
- **Pots in flats or trays**: price per pot, never a per-pot price on a flat
  quantity. Size is the pot (`4 in`). Quantity is the number of pots. The
  pots per flat vary (Chris has said 18 and 24 on different jobs), so use the
  count given; if none, quantity 1 and `How many?`. Same idea for bundles and
  cases.
- **Missing plant name**: skip the row and note it on the job.
- **Duplicate-key error**: re-read, then add only the missing rows.
- Never write `total` (generated), `updated_at`, thread references or
  changelog rows.

## 5. Hand back, then price, then ask

1. As soon as the rows are saved, post in the **origin chat** (webchat or
   Telegram): what was captured and the link `[Continue in JR-<id>
   chat](thread:jr-<id>)`.
2. [Price every row](pricing.md).
3. Post the result: priced lines, gaps (with nearest listed sizes), and
   **one** batch of questions that block a quote, AR or order. Put
   everything else on the line as a short note, so Chris can fix it in the
   app: questions for the customer in `note_for_customer` (`How many?`),
   points for Chris in `note_internal` (`Flat count?`).
4. Apply answers to the existing rows with guarded updates. Never recreate
   the job or duplicate rows.

Quick quote: after pricing, render the quote (`quote-generation`) and stop.
Don't offer an AR.
