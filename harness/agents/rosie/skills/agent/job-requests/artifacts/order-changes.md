### Changes after order placement

Whenever an existing placed order is updated, including its lines, quantities,
prices, allocations, fulfillment details, instructions or status, record a
brief change summary in `orders.notes` and notify the supplier through
`supplier-coordination`. This applies to direct and AR-backed orders and to
changes learned from Chris, customer/supplier relays or saved order events.
Order creation is placement; an order need not be confirmed first.

1. Re-read the order, affected lines, allocations and recent changes. Establish
   the actual before/after values and authorization for the underlying edit;
   this notification rule does not authorize additional order changes.
2. Apply only the authorized edit with guarded writes/RPCs and verify the saved
   result. For an update already saved by someone else, verify it without
   replaying it. No-op edits and retries are not new changes.
3. Add one concise, dated summary to `orders.notes`, preserving existing
   instructions and unrelated notes. Example: `09-22: Wax myrtle 15 G quantity
   10 → 12; pickup moved 09-24 → 09-25.` Use verified values only. This is an
   explicit exception to avoiding history in notes; keep the summary brief
   and supplier-safe. Do not put it only in job internal notes or overwrite
   `orders.note_from_supplier`, which belongs to the supplier. Re-read/guard the
   note write against concurrent edits and do not append it again on retry.
4. Relay the order id, supplier id, current affected job name(s), direct
   supplier-portal order URL, exact verified change summary, affected
   allocations and originating context to the supplier thread. Follow
   `supplier-coordination` for job-name and portal-link requirements on every
   Order/AR update message, including shared records. This standing
   instruction authorizes the factual change notification without a fresh
   draft approval. A portal record update or internal handoff alone is not
   supplier notification. Follow `supplier-coordination` for the actual send.
5. Track completion until both the saved order note and successful supplier
   message are verified. Report a failed/blocked note or send accurately and
   retain the pending follow-up; do not describe the notification as sent.
   Relay the saved changes to every affected job thread, preserving customer
   privacy. Do not notify again merely because this summary was added or
   notification bookkeeping changed.
