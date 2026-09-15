---
name: supplier-coordination
description: Manage all order-side contact on a supplier's dedicated thread. Covers quote-first APS availability with Chris send approval, consolidated job allocations, supplier order confirmation, private/public availability requests, independent preparation and clarification, multiple-option demands and quote-only selection boundaries, useful LPS notes, HTML email, inventory mappings, submitted supplier-response relays to Chris, supplier-authorized portal transcription, likely equivalent catalogue-name pricing versus AR mappings, mandatory APS job-row notes and approval-gated alternatives, compact latest supplier snapshots and row outcomes, closed-request locks and job-thread handoffs. Use for supplier sourcing handoffs, availability events, supplier messages and follow-ups; a supplier lookup alone authorizes no outreach and a supplier reply alone authorizes no job-line change. (v3.8.0)
metadata:
  author: lps
  version: "3.8.0"
---

# Supplier coordination

Run on `suppliers.rosie_thread_id`, one thread per supplier company across
all jobs; locations share their head branch's id. Use `message-routing` to
resolve/mint the id and to obtain any required approval in the original request
chat. The job thread owns job/items; this thread owns ARs and supplier
correspondence. Read the schema and supplier row before acting.

A request only to find suppliers is research: return findings for Chris's
original chat response first, without starting outreach or an AR. The job
thread adds sourcing notes only under `job-requests` section 3: a request
actually sent/delivered, a concrete required supplier action, Chris's explicit
note instruction or an explicit supplier selection/plant-sourcing decision.
Chris's standing APS instruction also requires the job thread to maintain an
APS entry on every APS-scoped item in actual job sourcing/quick quotes,
including priced matches, gaps and 1–2 closest supported alternatives when
found. Research-only supplier lookups remain chat-only; notes do not authorize
contact or select an alternative. Do not treat a search handoff as a send
instruction. `job-requests` section 3 owns the JR note format: one compact
latest snapshot per supplier and one unlabelled plain-text overall summary. Relay the
latest current facts for that update; never ask the job thread to append an event history. The
supplier transcript retains full correspondence.

## 1. Select the channel and preserve preferences

- `is_lps_partner = true`: availability requests reach the supplier's private
  portal. This flag is derived from portal logins; do not change it.
- Non-partner: create an availability request with a public URL and send
  the approved ask as **HTML email including that URL**. Lack of a private
  portal does not mean skipping the structured request.
- Read `suppliers.notes` for customer-details sharing, contact/channel and
  framing preferences. Preserve existing preferences. With no remembered
  customer-details decision, ask Chris through `message-routing`, record
  his answer and leave `share_customer_details = false` while waiting.
  Do not expose customer identity while that decision is pending.
- **APS is the exclusive current supplier. Generate the APS price-list quote
  first and obtain Chris's approval before creating/publishing its availability
  request.** The job thread asks after the quote unless Chris explicitly
  approved that exact send already. A quick-quote-only handoff stops at quote:
  do not create an AR or send a follow-up availability approval ask. Require
  quote-completion and send-approval evidence in the handoff. An APS portal
  insert is publication, so it is behind this gate too. Preserve remembered
  customer-details sharing choices; private is the default. An explicit Chris
  exception is needed for another supplier, including combined grower asks.
- **Alternatives require explicit Chris confirmation to request availability
  for the specific plant/size before creation or send**, including hints in
  supplier-visible `lps_notes`. Approval to quote it is not AR authorization.
  Creating a portal request is not permission for an additional email.

## 2. Create or reuse the availability request

Before creating/sending an AR, review the handoff, existing records and
inventory evidence to resolve what you can yourself. Complete all independent
work before requesting clarification, including supplier/request lookup,
validated inventory mappings and supported price preparation. Have the job
thread persist known job/item details and qualifying sourcing updates under
`job-requests`; missing answers must not stall that work. Relay completed
work, pricing, other findings and remaining gaps to the job thread so it can
post them in the original request conversation and clarify with the requester.
You may raise any question about the order that affects the availability ask, not only
plant/size allocation. Wait for needed answers before creating/sending the
affected request; APS publication also requires Chris's send approval. Continue
independent research and preparation while waiting, and do not re-ask details
already supplied. Follow `job-requests` for the full intake sequence.

1. Read every linked job, active item list and this supplier's existing ARs. Reject
   new work against closed/inactive jobs. Reuse the existing active open
   request for the same sourcing ask; a retry must not create duplicates.
   A closed AR cannot be edited. Shared requests remain open while another
   linked job still needs them; never close one based only on its legacy job
   anchor. Follow database lifecycle hooks on reopening and never reuse a
   revoked link.
2. Include every active job line in the default APS ask, including unlisted
   plants, unless Chris explicitly selects/excludes items. For a targeted
   supplier handoff, use the item scope the job thread specified. Snapshot
   requested `name`, `size`, total `quantity` and every job-item allocation; a
   later job edit must not silently rewrite an ask already sent. A combined
   grower ask can serve multiple jobs, and a job item can span multiple asks.
   Combine compatible lines only within Chris's approved scope and record
   each original job-item id and its allocated quantity. Keep unknown demand
   NULL; known allocations must be positive. Never duplicate one combined
   total onto each linked job.
   Chris's cheapest-supported-requested-option rule selects the quoted
   size/variant based on supported price data, not confirmed stock. The JR's
   quoted-offering `name`/`size` contain only that actual offered plant and one
   actual size; the original demand and any customer-visible substitution note
   stay on the JR. The note is exactly `Substitute: <actual offering> instead
   of <original demand>`, never a reason or unavailable price. It does not
   silently narrow the supplier ask to that option:
   preserve original requested alternatives and single total quantity unless
   Chris separately resolves AR scope. Do not infer extra quantities, allocation
   or availability from shared notes recording other supported-option prices. A clear either-option request
   can retain its alternatives without redundant quote clarification; genuinely
   unresolved AR scope still needs resolution before publication.
   If a demand mentions multiple sizes or plants, check that the handoff
   resolves separate requirements versus alternatives and quantity allocation.
   Route unresolved choices to the job thread for clarification before
   creating/sending the affected ask; do not pick an option, combine lines
   or repeat a total quantity across options yourself.
3. **Resolve mappings, prices and allocations before writing.** Use the atomic
   creation RPC after quote completion, send approval and scope clarification:

   ```sql
   SET app.actor TO 'rosie';
   SELECT public.create_availability_request(
     $supplierId,
     '[{"name":"Live Oak","size":"15 G","quantity":20,"mapped_inventory_id":null,"unit_price":null,"lps_notes":null,"allocations":[{"job_request_item_id":7,"quantity":12},{"job_request_item_id":9,"quantity":8}]}]'::jsonb,
     $shareDetails, $publicToken
   );
   ```

   Use real ids and supported values from the handoff. Known positive
   allocations must sum to the item's requested quantity. If any allocation
   is unknown, preserve it as NULL and keep the combined quantity NULL too;
   do not invent quantities to satisfy the RPC. Orders later require explicit
   positive allocations. The RPC creates
   `availability_request_jobs` and `availability_request_item_jobs` atomically
   with the request and snapshots. These junctions are authoritative; legacy
   scalar job/item fields are compatibility anchors only. Use a NULL token for
   private requests and a new UUID for a public request. The app's
   `POST /api/availability-requests` also creates structured requests. Inspect
   current allocations before retrying to avoid duplicate requests or demand.
4. Distinguish genuine substitutions from likely equivalent catalogue names
   using `plant-and-supplier-search`. A supported likely name match may price
   the job directly with a concise internal mapping note; it needs no needless
   alternative label or substitution approval. Preserve the requested name/size
   in the supplier ask. Chris's Agave parryi truncata / Artichoke Parry’s Agave /
   generic Agave Parryi example authorizes pricing, not automatic exact AR mapping
   or availability. Verify actual identity/size for the AR independently; if only
   the pricing equivalence is established, leave mapping and seed price NULL
   rather than representing the generic listing as an exact requested item.
   Known differences or unsupported equivalence still require action-specific
   approval before any alternative ask or supplier-visible alternative hint.
   The mapping/price supplied to the RPC must come from this supplier's
   exact plant/size inventory row. **Do not insert empty items and UPDATE
   prices afterward**: an answer-field update is supplier work and would
   incorrectly move the new request to Processing. Use the inventory UUID
   in the job thread's handoff. A mapping with no price may remain unpriced. A near
   size or cultivar is not an exact mapping: leave the mapping NULL. Only
   describe an alternative in supplier-visible `lps_notes` after Chris has
   explicitly approved requesting availability for that alternative. Keep
   unapproved candidates in internal APS sourcing notes and relay the approval
   question to the original request chat; do not leak internal notes into the AR.
   Never replace a supplier-selected mapping with a later search result.
5. Never seed answer `status`, `available_quantity` or supplier `notes`.
   NULL answer status means unanswered even with a prefilled price. Request
   and item `lps_notes` contain only short, specific statements or keywords
   that help this supplier answer: additional context, constraints or useful
   hints. Examples, only when supported by the ask/evidence: `Needed by Sep 18`,
   `Single trunk only`, `30 G acceptable`, `Is listed Muskogee suitable?`.
   Put shared context at request level and plant-specific details on the
   relevant item. Do not repeat request notes on every line or restate the
   plant/size/quantity already shown. No generic or repeated boilerplate such
   as `Please confirm availability`, `Provide any additional information`,
   or `Let us know if you have questions`. Leave `lps_notes` NULL/blank when
   there is nothing useful to add. No internal source comparisons and no
   customer identity unless sharing was authorized.
6. Partner requests become visible in their portal. Non-partner public links
   use the **configured app origin** plus
   `/public/availability/<public_token>`; never invent the host. Creating a
   public link is not email delivery. Use section 3 for the actual send.
7. Relay AR id, items, allocations, current state, mappings and delivery outcome
   to every affected job thread so each updates qualifying supplier entries under `job-requests`
   section 3. Unsent requests qualify only for a concrete pending action or
   explicit note instruction (including the standing APS job-row instruction);
   label any pending action accurately, never as a delivered request. Include
   `[Open AR-<id>](ar:<id>)` in internal chat updates. Record
   `availability_sent` only after actual portal delivery/email send, through
   `public.record_job_workflow_event(jobId, 'availability_sent')`. This moves
   each linked Quote job to **Availability**; it does not regress Committed
   or reopen Won/Lost jobs. A prepared public link alone does not advance the
   job. Job Availability is separate from the AR's own status below.

Do not silently add lines to an already answered request: coordinate the
changed scope with the job thread. A new line is new work for the supplier;
keep the changed request and sourcing notes in sync.

## 3. HTML email for a non-partner

1. Draft a short, plain-language ask using an HTML body: greeting, useful
   job/delivery context, a compact table of plant/size/requested quantity
   (and this supplier's price when useful), and a clearly labelled link to
   answer the request. Use the same plants/sizes/quantities as the AR.
   Include a visible clickable public URL so the recipient can open it.
   HTML-escape inserted text and attributes. Never include internal sourcing
   notes or other suppliers' pricing.
2. Present the **complete recipient, subject, rendered/content-equivalent
   HTML and public link** for any required approval using `message-routing`.
   Preserve supplier preferences. Send exactly the approved draft; material
   changes need review again. A past draft/template is not standing approval.
3. Send from `chris@localplantsupply.com` as Christopher Runyon on this
   supplier thread. `gws gmail +send ... --body <approved-html> --html`
   supports HTML; inspect `+send --help` / `+reply --help` for the installed
   command before use. Reply in the existing Gmail thread for the same ask.
   Quote shell arguments safely, especially literal currency `$` values.
4. Check the send result. If uncertain, search Sent before retrying. Record
   the full sent content and metadata on this thread's internal web chat.
   Add a Gmail-thread route back here with the `route-email` skill, keeping
   `router-all` last. Only confirmed delivery marks `availability_sent`.

Email authentication/configuration failure is a blocker to report in the
original Chris interaction. Do not switch to another agent's mailbox or
claim the request was emailed. The prepared draft/link remains reviewable.

## 4. AR state and supplier responses

| Display | Stored state | Meaning |
|---|---|---|
| New | `new` | Created, no supplier work yet. |
| Processing | `processing` | Partial/unsent supplier work. |
| Completed | `submitted` | Supplier submitted the response. |
| Closed | `closed` | Job/request closed; public and private supplier edits forbidden. |

Listen for both `availability_updated` (draft/edit) and
`availability_submitted` (explicit submission). Re-read request/items on each
event to maintain safe current context, but **a local/saved, unsubmitted edit
stays on this supplier thread**: do not notify any job thread or Chris, update
JR sourcing notes, or treat it as a response. Relay only an explicit
submission and only its actual saved answers. Include the saved request-wide
`availability_requests.supplier_notes` along with line responses; it records
supplier conditions for the whole AR and is separate from LPS instructions.
Relay its applicable context to each linked job without turning it into a
line-level availability change. A saved price or note is supplier
work but is not submission. Inventory prefill is neither supplier work nor an
answer. Preserve `submitted_at` as the latest explicit submission evidence. An AR
shared across jobs stays open for its remaining open jobs. Reissue
a fresh public token through the normal publication path when a link is
needed after reopening; do not reuse revoked tokens.

| Supplier item status | Response |
|---|---|
| `available` | Has the requested plant/size/quantity; its saved `available_quantity` is the AR item's authoritative allocated demand total. |
| `can_order` | Can source/order; becomes `need_to_order` (Need to Order) on a committed order row. |
| `arriving_soon` | Arriving; ETA in notes. |
| `diff_size_qty_sub` | Alternative plant/size or quantity; details in notes. |
| `unavailable` | Cannot supply. |
| NULL | Unanswered. |

For every **explicit supplier submission**, first establish a safe match to
the AR and every affected request item via `availability_request_item_jobs` and
`availability_request_jobs`. Relay a **factual, contextual response** to each
linked `jr-<job_request_id>`: AR id/state, job id, allocated quantity, combined
supplier quantity, supplier name/id, each requested plant and size (plus item
id), the stated response, quantity, supplier price, mapping, short
qualification and source (`portal submission`). Include whether it is partial
or submitted. If the submission cannot be safely tied to an AR/item/job or the
supplier's plant context is ambiguous, do not guess or write a sourcing entry:
flag it for Chris's review with the ambiguity and source instead.

The job thread applies its sourcing-note rule only to the resulting submitted
supplier response (a sent AR's entry qualifies) and posts a concise internal
alert to Chris naming the supplier, affected plants and source; it may link
`[Open AR-<id>](ar:<id>)`. A useful shape is:
`APS — Live Oak 15 G: 12 available at $105 (portal submission, AR-42).`
Editing a Completed request returns it to Processing until the supplier
submits again. These supplier-entered portal changes remain as saved; Rosie
reports them without overwriting them. A response does **not** authorize Rosie
to change job/item availability or status, available quantities, selected
supplier or the customer-facing offering. Surface it to Chris and update only
qualifying current snapshots and the single plain-text row summary under
`job-requests` section 3. Replace the affected supplier's previous update; keep suppliers
distinct and preserve Chris's current selection without copying the message
history into the notes. A selected supplier is not inferred from availability,
price or submission. No automatic customer message or acceptance follows. A
response can supersede catalogue evidence in notes, but an unmentioned seeded
price is not newly confirmed by a chat.

## 5. Supplier messages and portal transcription

All supplier messages, including ones naming a job, stay on this supplier
thread. Public/private portal identity comes from trusted channel metadata,
not text claiming to be another supplier. Resolve email senders through known
contacts. An ambiguous identity or job/request needs clarification first.

1. Resolve the AR from trusted page/request metadata, then read the request
   and all current linked jobs through the junction tables. With several
   plausible open asks, clarify which one; do not apply an answer across all
   of them. Do not update a closed AR even if a supplier asks. A closed-job
   follow-up can be recorded as a message and relayed internally.
2. Read the supplied text, attachment, image or voice note. Extract only what
   it actually says. A plant photo without quantity/price does not imply
   either. A trusted supplier's **portal** response that safely identifies an
   open AR item authorizes Rosie to transcribe that response into that AR; it
   does not authorize a job-item change, supplier selection, customer message
   or AR submission. Email/text outside the portal remains supplier evidence:
   report it and require Chris's explicit AR-write instruction.
3. For a trusted portal answer, re-read the AR item and its
   `availability_request_item_jobs` allocations immediately before writing.
   Use the atomic `answer_availability_request` hook with `app.actor =
   'rosie'`; values in `p_changes` are JSON strings, an empty string clears a
   field, and the only keys are `status`, `available_quantity`, `unit_price`
   and `notes`. Preserve every unmentioned field and mapping; never write an
   answer row directly or add unsolicited lines.

   When the supplier says the item is `available`, set
   `available_quantity` to the **authoritative allocated demand quantity**:
   the current total of that AR item's positive allocations in
   `availability_request_item_jobs`, not a guessed or separately stated
   number. If the allocations are absent, NULL or cannot establish one
   authoritative demand total, do not mark the item available; clarify the
   scope. A partial quantity or alternative must use the appropriate
   non-`available` status and the stated details instead.

   ```sql
   SET app.actor TO 'rosie';
   SELECT public.answer_availability_request(
     $arId, $supplierId, $arItemId,
     '{"status":"available","available_quantity":"<allocated-demand-total>","unit_price":"12.00"}'::jsonb,
     false
   );
   ```

   The RPC serializes with public/private edits, checks request/job closure
   and moves the AR to Processing. Do not submit: the supplier must review
   and explicitly Submit.
4. **Voice-to-text portal response sequence:** after a safe AR/item match,
   first acknowledge the supplier with a brief `--portal` message (for
   example, “Thanks — I’ll enter that response for you now.”). Then transcribe
   the stated answer under step 3, verify the saved row, and send a second
   `--portal` message asking them to review the entry and tap **Submit** (or
   **Re-Submit**). Do not say it was submitted. If the match or transcription
   is unsafe, acknowledge the message and ask the supplier to identify or
   clarify the affected line instead; do not write it.
5. Rosie submits only on Chris's explicit instruction. A supplier saying a
   reply is finished does not authorize Rosie to submit the AR. A supplier's
   own portal Submit is already recorded and needs no duplicate write. For an
   explicitly instructed submission without another edit, call the same RPC
   with NULL item/changes and `p_submit = true`; it records Completed and
   `submitted_at`. Never claim submission after a blocked/failed update.
6. A transcribed portal response remains local, saved supplier work until the
   supplier explicitly submits. At submission, section 4 supplies the sole
   job-thread/Chris relay and sourcing-note update. Do not send a separate
   local-edit notification. After a Chris-instructed email/non-portal update,
   report the actual saved result as directed; if matching remains unsafe,
   surface it for Chris's review rather than applying it.

For portal replies use `webchat-cli send --portal --text ...`; without
`--portal` the supplier cannot see it. Routine clarifications within an
active request follow the existing portal coordination authorization;
commitments about LPS pricing, terms or new business require Chris's
approval via `message-routing`. Never expose internal approval messages
with `--portal`. Do not automatically send an email acknowledgement without
its email authorization.

## 6. Supplier orders and confirmation

Use `job-requests` for customer-accepted order creation and quantity allocation.
Orders are separate from ARs and appear in the supplier portal's **Orders** tab.
One order can contain rows from several requests and jobs; one job can have
several supplier orders. Read `order_items` and
`order_item_job_request_items` before matching supplier messages or relaying
updates. Preserve the supplier scope and every customer's allocated quantities.

Customer acceptance creates **Committed** orders. An availability response or
submission is not supplier confirmation of an order. When the supplier
explicitly confirms the identified order, use
`confirm_order(orderId, supplierId, confirmationDate, fulfillmentDate)` to
record the actual `confirmation_date` and agreed pickup/delivery date. Do not
infer these dates from the job's expected install date. Ambiguous scope or
partial confirmation must be resolved before confirming the full order.
The supplier portal records its own confirmation directly; re-read it rather
than submitting a duplicate action. Supplier confirmation makes the **Order
Confirmed** and leaves each linked **Job Request Committed**. Job requests
have no Confirmed stage. Relay the actual order status/date to every linked
job and follow `job-requests` for its separate lifecycle; maintain only the
latest relevant supplier snapshot and plain-text current row summary.
Use `close_order` only for an explicit Won/Lost outcome, never because an AR
was submitted or a customer was silent.

## 7. Follow-ups and records

Batch unresolved questions and use the same supplier thread/channel, with
the same approval rules. Avoid repeated ARs or messages for identical work.

The supplier thread's web transcript is the contact history: quote external
email/relayed text in full, including sender/recipient, subject and known
message link. Use the mailbox actually containing it in Gmail links; Rosie's
mail uses `authuser=chris@localplantsupply.com`. Portal messages/replies are
already recorded and need no duplicate transcript entry. Internal summaries
never use `--portal`.

Keep only open follow-ups in thread notes, and durable preferences in
`suppliers.notes`. Send lifecycle matters (onboarding, account setup, price
list ingestion, supplier record corrections) to Daisy via `message-routing`;
continue the job coordination here.
