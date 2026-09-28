---
name: customer-coordination
description: Handle customer contact on the customer's own thread. Includes recording inbound messages, relaying requests and acceptance to job threads, sending approved quotes and drafts by email, and customer records. Use for customer messages, quote delivery or customer acceptance. (v4.0.0)
metadata:
  author: lps
  version: "4.0.0"
---

# Customer coordination

Work on the customer's thread (`customers.rosie_thread_id`), one per
customer across all their jobs. Every customer message lands here, even one
that names a job. `message-routing` finds or creates the thread. Job threads
own job records; supplier threads own supplier contact.

## Inbound

1. Read the whole message. Post outside emails or relayed texts in full in
   this thread's web chat (sender, subject, link). Skip if already there.
2. Relay every job matter to its `jr-<id>`: new request, change, date,
   question, acceptance, concern. Unclear which job → ask; don't guess.
   - New request (even one already committed): relay the message,
     attachments, supplied prices and exact scope; the job thread creates the
     job (`job-requests` → intake). A price question creates no job.
   - **Acceptance**: relay the exact lines and quantities accepted and the
     evidence. The job thread creates the order (New) and the job becomes
     Committed. Accepted quotes and committed requests go straight to an
     order: keep their prices, fill only missing prices from APS, no new
     quote or AR. Don't ask the customer to accept again when it's clear.
     Resolve partial acceptance or changed terms first. Acceptance covers
     only this customer's scope.
   - Relay dates (EDD) and pickup/delivery choices for the job fields. The
     supplier's fulfillment date is separate.
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
   Christopher Runyon, on this thread: `gws gmail +send` for new mail,
   `gws gmail +reply --message-id ...` in an existing conversation. A real
   change to the content or recipient needs a new approval.
4. Check the result. If unsure, search Sent before retrying. Sign-in or
   config failure: tell Chris in his chat, keep the draft ready, never use
   another mailbox or claim it was sent.
5. Add a Gmail route to this thread with `route-email` (`router-all` stays
   last). Post the full sent content and metadata here; if Chris sent it
   himself, say so.
6. Tell the job thread it was delivered. A delivered quote records
   `quote_shared`; post its shared link in the job's chat (not in a note, so
   it doesn't print on the next quote).
   A draft is not delivered.

Post meaningful milestones here so the customer history reads well; keep
only open follow-ups in thread notes. When Chris writes in this thread, work
with him here; job and supplier
threads keep their own records.
