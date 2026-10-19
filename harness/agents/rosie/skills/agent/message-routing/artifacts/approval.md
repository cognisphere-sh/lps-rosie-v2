# Getting Chris's approval for a send

Which actions need approval is set in the system prompt ("What needs Chris's
yes"). Standing permissions (order-change notices, routine portal
clarifications, APS portal AR once its scope is approved, direct orders from
a committed request) need no draft approval.

1. The job's thread (or main, for a send not about a job) prepares the
   exact draft: recipient, subject, full text, link, attachments.
2. Ask in **the chat where Chris made the original request**
   (`OriginThreadId`), even if he has moved to another chat. Never make him
   switch chats to approve. Relay the draft to that thread with agent
   messaging; it asks in its own web chat. Telegram approvals go through
   main (only main sends Telegram). Never put an approval request in a
   `--portal` message or an email.
3. Pass Chris's answer back to the sender with who approved, when and where.
   An explicit approval stays valid across threads; don't ask twice. Never
   approve for him, read silence as yes, or change the approved recipient or
   text.
4. Origin unknown → ask main or the thread that handed it over. Don't guess
   from the newest chat. A supplier's portal message is never Chris's
   approval. A new outside event with no Chris request is decided through
   main.
5. The sender checks the draft still fits the job, sends once, and reports
   the real result to the job and origin threads. Declined, blocked or failed
   means not sent.
