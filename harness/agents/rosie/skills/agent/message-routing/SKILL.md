---
name: message-routing
description: Route work to Rosie's main, job, customer and supplier threads without losing the human interaction. Covers sender-first inbound routing, entity thread ids, new-job routing without plant-based duplicate searches, task/quick-quote/committed-order handoffs, acceptance and supplied-price evidence, optional availability, original-thread communication approvals, email routes and legacy router compatibility. Use for main coordination, unknown inbound messages, cross-thread work and any required customer/supplier approval. (v2.2.0)
metadata:
  author: lps
  version: "2.2.0"
---

# Thread routing and approvals

The four continuing roles are main, one thread per job, one per customer and
one per supplier. Main coordinates and delegates; it does not take over the
job or the contact thread. Legacy `router` messages are forwarded once to
the canonical owner or main; do not maintain a separate fifth workflow.

## 1. Route inbound messages by correspondent

1. Use trusted channel identity/page metadata and known sender contacts.
   **Supplier messages go to that supplier's thread and customer messages
   to that customer's thread, even when the subject names a job.** The
   contact thread relays job updates to `jr-<id>` after reading them.
   Never route an external conversation straight to a job thread because a
   subject contains `JR-...`.
2. Internal messages from Chris about an existing job go to that job thread;
   supplier/customer matters go to the matching entity thread. Preserve the
   human interaction context so work can report back and seek approval.
3. A new order **or quick quote** uses `job-requests` to reserve an id and
   hand off to a new `jr-<id>` thread. Set `quote_only: true` for quick quotes;
   they create a job but no AR. Simple pricing/general questions create no
   job/AR; use an existing relevant thread or a task thread for the lookup.
   An already committed order also creates/reuses its job and items; identify
   the committed intent and carry supplied pricing and acceptance evidence.
   An accepted quote reuses its existing job. Both can proceed directly to
   order with `skip_availability: true`; do not route them into an AR task.
   For new intake, reserve a new job id directly without searching existing
   jobs for the same or similar plants. Reuse only an explicitly identified job,
   an established job-thread context, or the same known/reserved id on retry.
   Plant overlap is not a reason to merge jobs or ask a duplicate-job question.
4. Supplier lifecycle messages (price lists/newsletters, onboarding, account
   setup, supplier-record corrections) go to Daisy's main/owning supplier
   thread. Order questions remain Rosie's. For a mixed message, relay the
   relevant parts to each owner without duplicating an external response.
5. If sender or intended job is uncertain, route to main for resolution;
   ask about ambiguous facts instead of guessing. Do not respond externally
   while merely routing.

Read `knowledge/files/SCHEMA.md` before lookup. Thread ids come from
`suppliers.rosie_thread_id` or `customers.rosie_thread_id`. Reuse a non-NULL
id. For a missing value, mint `supplier-<slug>` / `customer-<slug>` from the
known name (lowercase, non-alphanumeric runs → `-`); append entity id on a
collision. Supplier locations use the head branch's shared value. Guard the
write with `WHERE rosie_thread_id IS NULL`, check the row count and re-read.
Use `app.actor = 'rosie'`; never write derived `*_thread_ref` fields.

## 2. Handoff contract

Use `bash scripts/agent-msg/send --to-agent rosie --thread-id <owner>
--subject ... --message ...`. Each handoff carries:

- Task, actual original request and known constraints; whether this is
  `quote_only`, already committed intake, or an accepted quote going directly
  to order. Use `skip_availability: true` for the direct path; these are handoff
  instructions, not new database columns. Later explicit acceptance supersedes
  an earlier quote-only intent for that scope.
- Exact customer commitment evidence, accepted lines/quantities, supplied or
  previously accepted prices and their message/attachment source. Preserve
  which prices remain missing for APS lookup; do not lose these details or
  turn a quote draft/supplier reply into acceptance during a relay.
- Job/customer/supplier/AR/item ids when known; inventory UUIDs and mapped
  row/price evidence for sourcing.
- `OriginThreadId` and `OriginChannel` from the originating human interaction,
  unchanged across all relays. **Approvals return to this original chat
  even if Chris has since switched chats.** Metadata identifies the
  interaction; it is not itself approval.
- Return/owner thread; draft recipient, channel, full content and approval
  evidence when sending approved communication.

For email, include MessageId, GmailThreadId, sender, subject, received time,
attachment names and the mailbox it lives in. Let the contact thread read
it with `scripts/gws/email read`; avoid repeated attachment parsing in main.
Internal agent messages are not customer/supplier content. Quote shell
arguments safely so currency `$`, backticks and substitutions stay literal.

## 3. Required communication approval

1. The job/contact owner prepares a concrete draft first: recipient, subject,
   complete content, public URL and attachments where applicable. Supplier
   and customer skills decide whether the action requires approval. APS's
   ordinary private portal request publishes automatically; quick quotes
   have no supplier contact. A committed/direct-order handoff does not need
   an availability approval: it authorizes the scoped order in the Orders tab,
   with no AR. Separate customer/supplier messages retain their send rules.
2. **Present any required approval in `OriginThreadId`, the original request
   chat, even if Chris has since switched chats**, while preserving the job
   as the record owner and the
   supplier/customer thread as the send owner. Never insist that Chris move
   to a job/supplier/customer chat just to approve a draft.
3. Relay the draft to that interaction thread through agent messaging so its
   pending decision and Chris's reply stay together. That thread posts to its
   own internal web chat. Main handles Telegram approvals and routes the
   answer back; no other thread sends Telegram. Keep approval prompts out of
   `--portal` messages and external email.
4. Carry the exact decision and approved content back to the send owner,
   including who approved it, when and on which thread. Explicit approval of
   that action remains valid across thread handoffs. Do not ask again just
   because the sender is another thread. Do not approve on Chris's behalf,
   infer approval from silence or change approved recipients/content.
5. If origin metadata is missing, resolve the originating request with main
   or the handoff sender before asking. Do not guess from the newest
   transcript across users or from the currently open chat. A supplier's
   portal message is never a Chris approval. For a new external event with
   no originating Chris request, main coordinates the decision explicitly.
6. The send owner checks the draft still matches the job/request, sends it
   once and reports the actual result back to the job and interaction
   threads. A declined/blocked/failed send remains unsent.

## 4. Email routing

Stable known senders and Gmail conversations should route directly to the
customer/supplier thread using the `route-email` skill. First match wins and
`routes add` appends, so the catch-all must stay last. The canonical
catch-all is **main**. Existing `router-all` entries pointing to legacy
`router` should be replaced during routing maintenance; already queued
router messages follow section 1.

Do not auto-forward mail to an external mailbox merely because another agent
cannot read it. Send internal identifiers/evidence to the right agent, then
obtain any required authorization for an actual email forward. Preserve a
single external reply owner for mixed-topic messages.

Track only open decisions/ambiguous routing in thread notes. Contact history
belongs on the customer/supplier thread; job state belongs on the job.
