### Notify suppliers of changes after placement

Every verified update to a placed order requires a brief `orders.notes`
summary and a message to its supplier, as defined in `job-requests` →
**Changes after order placement**. This includes updates the supplier submitted;
acknowledge the recorded change without implying a new supplier confirmation.

1. Re-read the saved order and changed fields, verify the supplier and all
   affected allocations, and check the supplier transcript for a notification
   already sent for this exact change. Combine fields from one update into
   one concise message; do not repeat it on a retry or cross-thread relay.
2. Have the job owner persist/verify the brief change summary in `orders.notes`.
   For a supplier-originated update, relay the verified before/after details
   to that owner. Preserve existing instructions and `orders.supplier_notes`.
3. Send the supplier a short factual message naming the affected job(s),
   linking directly to the order in their portal, and explaining what
   changed, using verified old/new values where useful. Follow the job-name
   and portal-link rule in [supplier links](supplier-links.md). Include the current
   fulfillment plan when affected. Keep internal sourcing, approval chatter
   and other customers' identities out of the message.
4. Use the supplier's established channel and preferences: a partner portal
   message on this supplier thread uses `webchat-cli send --portal --text ...`;
   otherwise use the verified supplier email/contact channel. A saved order
   appearing in Orders, an internal webchat message without `--portal`, or
   an internal agent handoff is not a supplier message. This standing
   instruction authorizes the scoped change notification, including email,
   without a new draft-approval request. It does not authorize unrelated
   outreach, new commitments, or changes to the order itself.
5. Verify the send result and report the actual message reference/result to
   the job owner. If delivery fails or the contact/channel is missing, keep
   the notification pending, report the blocker and resolve/retry safely.
   After an uncertain send, check contact history before resending. A task is
   complete only when the note and actual supplier send are confirmed.
   Adding the summary or logging delivery must not trigger another notice.
