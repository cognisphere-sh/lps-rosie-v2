---
name: customer-coordination
description: Handle customer contact on its dedicated thread. Covers inbound commitments, approved drafts, delivery and transcript records. Use for customer messages, acceptance or order updates. (v3.5.0)
metadata:
  author: lps
  version: "3.5.0"
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
   A new order follows `job-requests` intake, including a request that is
   already committed. Relay the original message/attachments, supplied prices,
   exact accepted scope and any instruction to skip availability. The job
   thread creates/reuses the job and items before ordering. A pricing question
   does not create a job.
3. Put durable customer preferences/contact corrections in `customers.notes`
   or their structured fields. The transcript is the communication log;
   there is no `customers.communication_notes` column.
4. Explicit customer acceptance is relayed with its exact scope/evidence so
   the job thread creates supplier Orders **New** and makes their jobs
   **Committed** for the accepted quantities. Already committed intake and
   accepted quotes may go directly to an order: preserve supplied/accepted
   pricing, fill only missing prices from APS, and require no new quote or AR.
   Do not ask the customer to accept again when the commitment is already clear.
   Supplier confirmation moves Orders to **Processing**, then **Order Ready**,
   while the Job remains Committed; jobs have no Confirmed stage.
   One job may have several orders and one order may serve several jobs;
   acceptance applies only to this customer's stated scope and quantities.
   Relay supplied expected install dates and pickup/delivery choices for the
   job's structured fields; keep the supplier's actual fulfillment date separate.
   Won/Lost require an explicit closure instruction; acceptance does not close
   or reopen a job. Resolve partial acceptance or offer changes before
   committing the affected quantities.

## Outbound communication

1. Receive the job thread's customer-safe draft or prepare a requested
   non-job draft here. Apply customer preferences. Use only requested/
   approved offerings, customer prices, relevant delivery details and
   `note_for_customer`. No internal sourcing rows, supplier comparisons or
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
   keeps initial jobs at Quote without moving Availability/Committed backwards.
   An internal draft has not been shared with the customer.

Post meaningful milestones in this thread so the whole customer history is
readable. Store only open follow-ups in thread notes. When Chris writes
here, coordinate with him here while the job thread continues to own job
records and supplier threads continue to own supplier communication.
