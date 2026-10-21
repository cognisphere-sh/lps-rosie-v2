---
name: customer-coordination
description: Handle customer contact from the job's thread, logging it in the customer's conversation. Includes recording inbound messages, acting on requests and acceptance, sending approved quotes and drafts by email, and customer records. Use for customer messages, quote delivery or customer acceptance. (v5.1.1)
metadata:
  author: lps
  version: "5.1.1"
---

# Customer coordination

Work in the job's thread, `jr-<id>`: it owns the job and its customer
contact. The customer's **conversation** (`customers.rosie_thread_id`) is one
transcript across all their jobs; customers have no portal, so it is the log
of what they sent and what LPS sent them, and the job's customer tab shows
all of it. Customer email reaches main (or the job, when its
Gmail conversation is routed there); main hands it to the job
(`message-routing`).

## Inbound

1. Read the whole message. Log outside emails or relayed texts in full in
   the customer's conversation (`webchat-cli send --thread-id <conversation>
   --log-as customer --sender "<name>" --text "<sender, subject, body,
   link>"`). Skip if already there.
2. Handle every matter for this job here: change, date, question,
   acceptance, concern. One about another job goes to that `jr-<id>`.
   Unclear which job → ask; don't guess.
   - New request (even one already committed): main reserves a job id and
     hands over the message, attachments, supplied prices and exact scope
     (`job-requests` → intake). A price question creates no job.
   - **Acceptance**: with the exact lines and quantities accepted and the
     evidence, create the order (New); the job becomes Committed. Accepted quotes and committed requests go straight to an
     order: keep their prices, fill only missing prices from APS, no new
     quote or AR. Don't ask the customer to accept again when it's clear.
     Resolve partial acceptance or changed terms first. Acceptance covers
     only this customer's scope.
   - Relay dates (EDD) and pickup/delivery choices for the job fields; an
     order's target date and pickup/delivery are the job's. Contact, address
     or payment details for a placed order go in its additional details
     (`job-requests` → orders).
3. Lasting preferences and contact fixes go in `customers.notes` or the
   customer's fields (guarded writes). The chat transcript is the contact
   log.

Order and job stages: see `job-requests` → lifecycle. Won/Lost only on
Chris's explicit word.

## Outbound (needs Chris's approval unless he already approved this exact send)

1. Start from the job thread's customer-safe draft, or write a non-job draft
   here. Use only approved offerings, customer prices, delivery details and
   `note_for_customer`. Quote formatting: `quote-generation`.
   - Never name or hint at the supplier. No internal notes, costs,
     comparisons or agent messages.
   - An approved supplier-proposed alternative shows its own customer price.
     Never mention declined substitutions. If its name or price is unknown,
     hold that part of the draft.
2. Get approval with `message-routing` in **Chris's original chat**, showing
   recipient, subject, full text and attachments/links. Don't ask again if he
   already approved this exact content.
3. Send exactly what was approved, from `chris@localplantsupply.com` as
   Christopher Runyon, from the job's thread: `gws gmail +send` for new mail,
   `gws gmail +reply --message-id ...` in an existing conversation. A real
   change to the content or recipient needs a new approval.
4. Check the result. If unsure, search Sent before retrying. Sign-in or
   config failure: tell Chris in his chat, keep the draft ready, never use
   another mailbox or claim it was sent.
5. Route the Gmail conversation to this `jr-<id>` with `route-email`
   (`router-all` stays last). Record the full sent content in the customer's
   conversation (`webchat-cli send --thread-id <conversation> --portal`); if
   Chris sent it himself, say so.
6. A delivered quote records `quote_shared`; post its shared link in the
   job's chat (not in a note, so it doesn't print on the next quote).
   A draft is not delivered.

The customer's conversation holds only what they sent and what LPS sent
them; keep internal notes and open follow-ups in the job thread. Chris's
messages in the job's customer tab are LPS's words to the customer, recorded
there (they are not emailed); they reach the customer's own thread silently
and need no reply.
