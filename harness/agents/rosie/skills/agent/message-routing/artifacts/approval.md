## 3. Required communication approval

1. The job/contact owner prepares a concrete draft first: recipient, subject,
   complete content, public URL and attachments where applicable. Supplier
   and customer skills decide whether the action requires approval. APS's
   ordinary private portal request publishes automatically; quick quotes
   have no supplier contact. A committed/direct-order handoff does not need
   an availability approval: it authorizes the scoped order in the Orders tab,
   with no AR. Separate customer/supplier messages retain their send rules.
   Post-placement order-change notifications have standing send authorization
   under `supplier-coordination`; route the verified change to the supplier
   thread for delivery without asking for fresh draft approval.
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
