# Intake: create the job and its lines

Goal: Chris sees a usable job in the app within minutes. **Load first, ask
later.** He edits faster in the app than he answers questions.

## 1. Decide the request type

| Chris sends | Do |
|---|---|
| A price question ("how much is 15g Hesperaloe?") | Answer it. No job. |
| A plant list, screenshot, plan or email to price or source | New job → lines → prices. |
| "Quick quote" | New job → lines → prices → quote. Stop (no AR). |
| An order that is already committed ("put this in committed and create order") | New job → lines → [order](orders.md) (no AR). |
| Acceptance of an existing quote | That job → [order](orders.md). |

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
- Elsewhere (main, Telegram): `SELECT
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
- Job-wide customer requirements (delivery constraints, `Must be full`) go
  in the job's `note_internal`. The job's `note_for_customer` is only for
  information to the customer ([notes](notes.md)).

## 4. Create one line per requested plant

Insert rows into `job_request_items` right away, before any question. Each
insert also creates the line's **default candidate** (step 5), already
selected.

| Field | Rule |
|---|---|
| `name` | The customer's plant name, cultivar and variant as written. If both common and botanical names are given: `Common Name \| Botanical name`. Don't add a name from a price listing. |
| `size` | As requested; gallons as `G` (`30 gal or larger` → `30 G or larger`). Unknown → NULL. |
| `demanded_quantity` | Requested amount. **Not given → 1**, and ask `How many?` in your question batch. |
| `note_internal` | The customer's line requirements (alternatives they allow, color, form, units: `Single trunk`, `Red flowers only`) and open points for Chris; never supplier or price facts ([notes](notes.md)). |

- **Options in one line** (`20 live oaks, 15 G or 30 G`): one row, size
  `15 G or 30 G`, quantity 20, and a candidate per option. Chris picks.
- **Plants that may be alternatives** (`oaks and/or elms, 20`): one row for
  the first plant, a candidate per option (description `Elm`, note `Elm
  instead`). Don't ask which; Chris
  picks. Never copy one total onto several options.
- **Pots in flats or trays**: price per pot, never a per-pot price on a flat
  quantity. Size is the pot (`4 in`). Quantity is the number of pots. The
  pots per flat vary (Chris has said 18 and 24 on different jobs), so use the
  count given; if none, quantity 1 and ask `How many?`. Same idea for bundles and
  cases.
- **Missing plant name**: skip the row and note it on the job.
- **Duplicate-key error**: re-read, then add only the missing rows.
- Never write a line's `unit_price`, `total`, `status`, `available_quantity`
  or `note_for_customer` (deprecated: a line shows its selected candidate's),
  `updated_at`, thread references or changelog rows.

## 5. Create each line's candidates

The price list is indicative only: a listing isn't stock, and a missing
listing doesn't mean APS lacks the plant. So every line gets **candidates**:
the options Chris can ask a supplier about or pick. Alternatives come from
APS (`supplier_id = 1`) unless Chris names another supplier for this job.

| Candidate | Values |
|---|---|
| The **default** (the original ask; always, even when not listed) | Created by the database with the line: APS, `is_original = true`, the line's `name` and `size`, unpriced (NULL), selected. **Update it, never insert another**: `unit_price` from [pricing](pricing.md), **NULL = price not found** (0 is a $0 price: only when Chris gives $0); `mapped_inventory_id` = the exact listing or NULL; `description`. No `note_for_customer`. It can't be hidden, deleted or demoted. |
| Another supplier's original ask (only a supplier Chris named for this job) | A copy of the default for that supplier: `is_original = true`, same `name`, `size`, `description` (no quantity: it reads the line's); that supplier's list price (NULL = not found); no `mapped_inventory_id`. Select it (`select_candidate`, Chris's direction): the line shows it. The APS default stays unpriced unless APS is priced too. |
| Each listed alternative: nearest smaller and larger size, another variant or color | `is_original = false`. The listing's name and size, its own list price and inventory id; `note_for_customer` says how it differs, for the customer: `5 G NA, 3 G only` · `Only blue`. |

Every candidate also gets a short **`description`** (required): size plus
one common or botanical name, retaining the needed cultivar or variant. Never
repeat both names as `Common name | Scientific name`; `30 G Pride of Houston
Yaupon` is enough. What it *is*, for Chris: `5 G Shumard Oak` · `3 G Salvia greggii 'Furman's
Red'` · `1 G Gaura`. Don't mix the two: `description` names the plant,
`note_for_customer` is what the customer reads.

```sql
SET app.actor TO 'rosie';
-- The default: guarded on its untouched values (0 rows → re-read).
UPDATE candidates c SET unit_price = $price, mapped_inventory_id = $inventoryId,
  description = '5 G Shumard Oak'
FROM job_request_items ji
WHERE ji.id = $itemId AND c.id = ji.default_candidate_id
  AND c.unit_price IS NULL AND c.mapped_inventory_id IS NULL
RETURNING c.id;
-- Alternatives and hidden options
INSERT INTO candidates
  (supplier_id, job_request_item_id, is_original, description, name, size,
   unit_price, mapped_inventory_id, note_for_customer, hide_from_lps)
VALUES (1, $itemId, false, '5 G Shumard Oak', $name, $size,
        $price, $inventoryId, $note, $hideFromLps)
RETURNING id;
```

- **Exact match** (same plant, same size, priced by an exact listing, the same
  plant under another name, a price rule, or a price Chris gave): the
  default already is it and is selected; nothing to select (for a supplier
  Chris named, select that supplier's original instead). The line shows
  the selected candidate's size, price, status and customer note. The
  customer's requirements stay in `note_internal`, untouched.
- **Anything else** (other size, variant, color or plant): select one
  (`SELECT public.select_candidate($itemId, $candidateId);`) only when
  Chris's direction for this job or a standing selection rule
  (`knowledge/files/price-rules.md`, e.g. several requested sizes → cheapest
  priced) picks it. Otherwise the default stays selected (no price shows
  blank) and Chris drags one onto the line; don't select it yourself, even
  when it is the only one. `SELECT public.unselect_candidate($itemId);` goes
  back to the default. A supplier's substitute is a `diff_size_sub`
  candidate; the line moves to it on submission and then reads Diff Sz/Sub (see
  [supplier responses](supplier-responses.md#substitutes)).
- **Substitute options** (`hide_from_lps = true`): when the original ask is
  an exact match, the other rows above are not needed for sourcing, but the
  supplier still needs 2–3 similar plants to offer as a substitute if it
  turns out Unavailable. Add them from the **same supplier's** list, priced,
  closest first: the nearest smaller and larger size of the same plant, then
  a close relative or variant. Same values as a listed alternative, plus
  `hide_from_lps = true`: Chris's sourcing page leaves them out; the
  supplier's Diff Sz/Sub dialog offers them as choices, and a picked one
  becomes visible to Chris. Never select one. No exact match → show only
  the 3–4 nearest listed alternatives (fewer if fewer useful matches exist);
  keep the default visible and hide other alternatives with
  `hide_from_lps = true`. Rank same-plant nearest sizes before different
  variants or plants; never hide a selected candidate or the default.
- Never seed a candidate's `status` or `available_quantity` at intake;
  substitutes get theirs through the database ([supplier responses](supplier-responses.md#substitutes)).
  Never write `note_from_supplier` or `availability_request_id` directly.
  Its shown status is derived: **No price** (unanswered, price NULL; $0 is a price) →
  **Pending** (priced, not on an AR or only on an unsent draft) → **AR sent**
  (on a sent AR, unanswered) → the answer (Available, Partial Qty,
  Unavailable — also when it offers a substitute — Diff Sz/Sub for the
  substitute, Can Order, Arriving Soon; Unavailable with a price is still
  Unavailable).
- Retry: re-read the line's candidates (`job-snapshot`) and add only the
  missing ones.

## 6. Hand back, then price, then ask

1. As soon as the rows are saved, post in the **origin chat** (webchat or
   Telegram): what was captured and the link `[Continue in JR-<id>
   chat](thread:jr-<id>)`.
2. [Price every row](pricing.md): update its default and add the other
   candidates (step 5).
3. Post the result: priced lines, gaps (with the candidates found), and
   **one** batch of questions. **Do ask when in doubt** about the customer
   (name, identity), delivery vs pickup, dates (EDD), or any demanded row
   (quantity, unclear plant or size, an ambiguous line). **Never ask** which
   substitute or alternative to use: those are candidates. Small points for
   Chris go on the line's `note_internal` (`Flat count?`) so he can fix them
   in the app.
4. Apply answers to the existing rows with guarded updates. Never recreate
   the job or duplicate rows.

Quick quote: after pricing, render the quote (`quote-generation`) and stop.
Don't offer an AR.
