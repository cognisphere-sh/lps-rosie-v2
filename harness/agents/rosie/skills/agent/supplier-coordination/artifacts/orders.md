# Supplier side of orders

The job thread creates orders (`job-requests` → [orders](../../job-requests/artifacts/orders.md)).
This thread tells the supplier and handles their replies.

## New order handed over

Read the order and its rows. An order belongs to one job
(`orders.job_request_id`) and one supplier; a job can have one open order per
supplier. The order already shows in the supplier's portal
Orders tab; that is all the committed request authorizes. A separate email or
customer message needs its own approval. Never create, answer or submit an AR
to back up an order.

## Supplier confirms or updates an order

`order_updated` / `order_status_updated` / `order_status_saved` events land
here. Re-read the order and lines. Portal confirmations are already saved; do
not record them again. The supplier's notes are saved as the order's and each
row's `note_from_supplier`. For a confirmation given in chat or email, record it
with `confirm_order(...)` ([job-side orders](../../job-requests/artifacts/orders.md#supplier-confirms)) once the scope
is clear. Relay the actual status and dates to every linked job. Pickup vs
delivery is Chris's choice; a supplier event doesn't change it. Never infer
customer acceptance from a supplier event.

## Tell the supplier about an order change

Standing permission: every verified change to a placed order gets a short
factual message to the supplier, no draft approval needed.

1. Re-read the order and the changed fields. Check this thread's
   history: if this exact change was already sent, don't send it again.
2. The job thread adds the dated line to `orders.note_for_supplier`. For a change the
   supplier made, relay the before/after to the job thread.
3. Send one message covering all fields changed in this update: job name,
   what changed (old → new where useful), current pickup/delivery plan if
   affected, and the order link. For a change the supplier made, just
   acknowledge it; it isn't a new confirmation.
4. Partner: `webchat-cli send --portal --text ...` on this thread. Otherwise:
   the supplier's known email ([email](email.md)). Only these reach the
   supplier; an internal message or the order showing in the portal does not.
5. Confirm it was sent and tell the job thread. If it failed or there's no
   contact, keep it pending and report the blocker. After an unclear send,
   check history before resending.
