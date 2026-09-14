---
name: supplier-coordination
description: Manage all order-side contact on a supplier's dedicated thread. Covers private/public availability requests, independent preparation and clarification, multiple-plant/size demands and quote-only size-selection boundaries, useful LPS notes, HTML email, inventory mappings, factual supplier-response relays to Chris without automatic availability writes, likely equivalent catalogue-name pricing versus AR mappings, mandatory APS job-row notes and approval-gated alternatives, sourcing-note eligibility and decisions, closed-request locks and job-thread handoffs. Use for supplier sourcing handoffs, availability events, supplier messages and follow-ups; a supplier lookup alone authorizes no outreach and a supplier reply alone authorizes no availability change. (v2.10.0)
metadata:
  author: lps
  version: "2.10.0"
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
instruction.

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
- **APS requests publish automatically for ordinary jobs**, privately in
  their portal by default; no extra Chris approval is needed for the resolved
  original requested offering. **Alternatives require explicit Chris confirmation
  to request availability for the specific plant/size before creation or send**,
  even in APS requests or supplier-visible `lps_notes`. Ask in the original
  request chat via `message-routing`; a sourcing-note candidate or approval to
  quote it is not AR authorization. Preserve any
  remembered customer-details sharing choice. A quick quote has a job/thread
  but skips availability requests and outreach altogether. Creating a portal
  request is not permission for an additional email.

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
affected request; automatic APS publication follows this same rule. Continue
independent research and preparation while waiting, and do not re-ask details
already supplied. Follow `job-requests` for the full intake sequence.

1. Read the job, active item list and this supplier's existing ARs. Reject
   new work against closed/inactive jobs. Reuse the existing active open
   request for the same sourcing ask; a retry must not create duplicates.
   A closed AR cannot be edited. Job reopening restores its previous stage
   through the database lifecycle hook; never reopen it independently or
   reuse its revoked link.
2. Include every active job line in the default APS ask, including unlisted
   plants, unless Chris explicitly selects/excludes items. For a targeted
   supplier handoff, use the item scope the job thread specified. Snapshot
   requested `name`, `size`, `quantity` and `job_request_item_id`; a later
   job edit must not silently rewrite an ask already sent.
   Chris's smallest-priced-requested-size rule selects the quoted size based
   on supported price data, not confirmed stock. It does not silently narrow
   the supplier ask to that size: preserve original requested size alternatives
   and single total quantity unless Chris separately resolves AR scope. Do not
   infer extra quantities, allocation or availability from larger-size shared
   price notes. A clear either-size request can retain its options without
   redundant quote-size clarification; genuinely unresolved AR scope still needs
   resolution before publication.
   If a demand mentions multiple sizes or plants, check that the handoff
   resolves separate requirements versus alternatives and quantity allocation.
   Route unresolved choices to the job thread for clarification before
   creating/sending the affected ask; do not pick an option, combine lines
   or repeat a total quantity across options yourself.
3. **Resolve mappings/prices before writing.** Create the request and fully
   seeded item snapshots in one transaction, after the applicable gates.
   `$mappingJson` below contains validated rows from the job handoff with
   `job_request_item_id`, `mapped_inventory_id` (UUID) and `unit_price`:

   ```sql
   BEGIN;
   SET LOCAL app.actor TO 'rosie';
   INSERT INTO availability_requests
     (job_request_id, supplier_id, share_customer_details, public_token)
   VALUES ($jobId, $supplierId, $shareDetails, $publicToken)
   RETURNING id;
   -- Use the returned id; NULL token for private, gen_random_uuid() for public.
   WITH mappings AS (
     SELECT * FROM jsonb_to_recordset($mappingJson::jsonb)
       AS m(job_request_item_id bigint, mapped_inventory_id uuid, unit_price numeric)
   )
   INSERT INTO availability_request_items
     (availability_request_id, job_request_item_id, name, size, quantity,
      mapped_inventory_id, unit_price)
   SELECT $arId, j.id, j.name, j.size, j.quantity,
          m.mapped_inventory_id, m.unit_price
   FROM job_request_items j
   LEFT JOIN mappings m ON m.job_request_item_id = j.id
   WHERE j.job_request_id = $jobId AND j.is_active;
   COMMIT;
   ```

   Add an explicit item-id filter only for an instructed subset. The app's
   `POST /api/availability-requests` also supports `isPublic` and returns
   `publicPath`; the database path above is available to agent SQL tooling.
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
   The mapping/price prepared for that INSERT must come from this supplier's
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
7. Relay AR id, items, current state, mappings and delivery outcome to the
   job thread so it updates qualifying supplier entries under `job-requests`
   section 3. Unsent requests qualify only for a concrete pending action or
   explicit note instruction (including the standing APS job-row instruction);
   label any pending action accurately, never as a delivered request. Include
   `[Open AR-<id>](ar:<id>)` in internal chat updates. Record
   `availability_sent` only after actual portal delivery/email send, through
   `public.record_job_workflow_event(jobId, 'availability_sent')`. This moves
   an Active or Quote job to **Availability**; it does not regress Confirmed
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
event and relay only actual changes. A saved price or note is supplier work
but is not submission. Inventory prefill is neither supplier work nor an
answer. Preserve `submitted_at` as the latest explicit submission evidence. Job
closure remembers each AR stage; job reopening restores that stage. Reissue
a fresh public token through the normal publication path when a link is
needed after reopening; do not reuse revoked tokens.

| Supplier item status | Response |
|---|---|
| `available` | Has the requested plant/size/quantity. |
| `can_order` | Needs to order; ETA in notes. |
| `arriving_soon` | Arriving; ETA in notes. |
| `diff_size_qty_sub` | Alternative plant/size or quantity; details in notes. |
| `unavailable` | Cannot supply. |
| NULL | Unanswered. |

For every actual supplier change or resubmission, first establish a safe
match to the AR, its job and each affected request item. Relay a **factual,
contextual response** to `jr-<job_request_id>`: AR id/state, job id, supplier
name/id, each requested plant and size (plus item id), the stated response,
quantity, supplier price, mapping, short qualification, and source
(`portal saved edit`, `portal submission`, or supplier message/email). Include
whether it is partial or submitted. If the event cannot be safely tied to an
AR/item/job or the supplier's plant context is ambiguous, do not guess or
write a sourcing entry: flag it for Chris's review with the ambiguity and the
source instead.

The job thread applies its sourcing-note rule to the resulting factual
supplier response (a sent AR's entry qualifies) and
posts a concise internal alert to Chris naming the supplier, affected plants
and source; it may link `[Open AR-<id>](ar:<id>)`. A useful shape is:
`APS — Live Oak 15 G: 12 available at $105 (portal submission, AR-42).`
Editing a Completed request returns it to Processing until the supplier
submits again. These supplier-entered portal changes remain as saved; Rosie
reports them without overwriting them. A response does **not** authorize Rosie
to change job/item availability or status, available quantities, AR answers,
selected supplier or the customer-facing offering. Surface it to Chris and
update only qualifying sourcing notes. Keep multiple suppliers' responses
separate and preserve explicit plant-sourcing decisions. A selected supplier
is not inferred from availability, price or submission. No automatic customer
message or acceptance follows. A response can supersede catalogue evidence
in notes, but an unmentioned seeded price is not newly confirmed by a chat.

## 5. Supplier messages are reported before any availability write

All supplier messages, including ones naming a job, stay on this supplier
thread. Public/private portal identity comes from trusted channel metadata,
not text claiming to be another supplier. Resolve email senders through known
contacts. An ambiguous identity or job/request needs clarification first.

1. Resolve the AR from trusted page/request metadata, then read the request
   and current job. With several plausible open asks, clarify which one; do
   not apply an answer across all of them. Do not update a closed AR even if
   a supplier asks. A closed-job follow-up can be recorded as a message and
   relayed internally.
2. Read the supplied text, attachment, image or voice note. Extract only what
   it actually says. A plant photo without quantity/price does not imply
   either. Report the stated availability as supplier evidence, not a database
   status instruction.
3. Relay the factual response to the job thread and Chris as in section 4,
   identifying supplier, requested plant/size and source (`supplier message`
   or `supplier email`). The job thread updates qualifying Markdown entries,
   including explicit supplier selections and plant-sourcing decisions, and
   surfaces the response to Chris. Do not wait for or assume a webhook.
   Without Chris's explicit instruction to change availability/AR answers,
   stop at reporting and sourcing notes: no answer-field write or submission.
4. **Only when Chris explicitly instructs an AR update**, use the atomic
   supplier-answer hook with `app.actor = 'rosie'` for the specified request,
   item and fields. A supplier's reply is not that authorization. Read the
   current rows again and preserve other suppliers' requests and answers.
   Values in `p_changes` must be JSON
   strings; an empty string clears a field. The only permitted keys are
   `status`, `available_quantity`, `unit_price`, `notes`.

   ```sql
   SET app.actor TO 'rosie';
   SELECT public.answer_availability_request(
     $arId, $supplierId, $arItemId,
     '{"status":"available","available_quantity":"30","unit_price":"12.00"}'::jsonb,
     false
   );
   ```

   Leave unmentioned fields out of `p_changes`; preserve mappings. The RPC
   serializes with public/private edits, checks request/job closure and
   updates Processing. Do not write answer rows directly. Do not add request
   lines from an unsolicited offer; relay it to the job thread.
5. Rosie submits on Chris's explicit instruction only. A supplier saying a
   reply is finished does not authorize Rosie to submit the AR. A supplier's
   own portal Submit is already recorded and needs no duplicate write.
   For an explicitly instructed submission
   without another edit call the same RPC with NULL item/changes and
   `p_submit = true`; it records Completed and `submitted_at`. Never claim
   submission after a blocked/failed update.
6. After an explicitly instructed update, report the actual saved result to
   Chris and the owning job thread. Supplier-facing acknowledgement follows
   the applicable contact gate. If matching remains unsafe, surface it for
   Chris's review rather than applying it to a request or item.

For portal replies use `webchat-cli send --portal --text ...`; without
`--portal` the supplier cannot see it. Routine clarifications within an
active request follow the existing portal coordination authorization;
commitments about LPS pricing, terms or new business require Chris's
approval via `message-routing`. Never expose internal approval messages
with `--portal`. Do not automatically send an email acknowledgement without
its email authorization.

## 6. Follow-ups and records

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
