---
name: customer-coordination
description: Keep all communication with a customer on their dedicated thread. Covers identity/thread lookup, customer-safe drafts, approval in the original request interaction, exact approved delivery, contact history and job-update/confirmation relays. Use for customer messages, requested customer sends and updates about any of their orders. (v3.0.1)
metadata:
  author: lps
  version: "3.0.1"
---

# Customer coordination

Run on `customers.rosie_thread_id`, one thread per customer across all their
jobs. All inbound customer messages land here, including messages that name
a particular job. `message-routing` resolves/mints the thread id. Read the
schema and customer's preferences before acting; use `job-requests`' guarded
write discipline for customer fields.

## Inbound communication

1. Read the actual message and record external email/relayed text in full on
   this thread's internal web chat, with sender, subject and known message
   link. A message already present in the transcript needs no duplicate.
2. Identify the relevant job(s). Relay every job update to its `jr-<id>`:
   a new request, scope change, delivery date, question, acceptance or concern.
   Ambiguous identity/job references need clarification, not a guessed write.
   A new order follows `job-requests` intake; a pricing question does not
   create a job.
3. Put durable customer preferences/contact corrections in `customers.notes`
   or their structured fields. The transcript is the communication log;
   there is no `customers.communication_notes` column.
4. Explicit customer acceptance is relayed with its exact scope/evidence so
   the job thread records **Confirmed** from Active, Quote or Availability.
   Won/Lost require an explicit closure instruction; acceptance does not
   close or reopen a job. A partial
   acceptance or request to change the offer must be resolved by the job
   thread before treating the whole order as confirmed.

## Outbound communication

1. Receive the job thread's customer-safe draft or prepare a requested
   non-job draft here. Apply customer preferences. Use only requested/
   approved offerings, customer prices, relevant delivery details and
   `external_notes`. No internal sourcing rows, supplier comparisons or
   agent messages. `quote-generation` owns quote formatting.
2. Use `message-routing` for any required approval in **the original request chat**, retaining the draft, recipient, subject and attachments/links.
   Do not require approval on the job thread merely because the draft
   concerns a job. If already explicitly approved, do not ask again.
3. Send exactly the approved content from
   `chris@localplantsupply.com`, as Christopher Runyon, on this customer
   thread. Use `gws gmail +send` for new mail and `+reply --message-id ...`
   for an existing Gmail conversation. A substantive correction to approved
   content returns for review; never silently change the offering or recipient.
4. Verify the send; on an uncertain result, search Sent before retrying.
   Authentication/configuration failures are reported to the active Chris
   interaction, with the prepared draft available. Do not claim delivery or
   substitute another mailbox without authorization.
5. Route the Gmail conversation back here using `route-email`, keeping
   `router-all` last. Quote the complete sent content and metadata in this
   thread's internal web chat; credit Chris if he sent it himself.
6. Relay actual delivery to the job thread. A shared quote records
   `quote_shared` there and its public link in customer-visible notes. This
   advances Active → Quote without moving Availability/Confirmed backwards.
   An internal draft has not been shared with the customer.

Post meaningful milestones in this thread so the whole customer history is
readable. Store only open follow-ups in thread notes. When Chris writes
here, coordinate with him here while the job thread continues to own job
records and supplier threads continue to own supplier communication.
