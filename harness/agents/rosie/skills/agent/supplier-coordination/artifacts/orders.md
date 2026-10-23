# Supplier side of orders

The job thread creates orders (`job-requests` → [orders](../../job-requests/artifacts/orders.md)),
tells the supplier and handles their replies.

## New order handed over

Read the order and its rows. An order belongs to one job
(`orders.job_request_id`) and one supplier; a job can have one open order per
supplier. The order already shows in the supplier's portal
Orders tab; that is all the committed request authorizes. A separate email or
customer message needs its own approval. Never create, answer or submit an AR
to back up an order.

## Supplier confirms or updates an order

`order_updated` / `order_status_updated` / `order_status_saved` events land
on the order's job thread. Re-read the order and lines. Portal confirmations are already saved; do
not record them again. The supplier's notes are saved as the order's and each
row's `note_from_supplier`. For a confirmation given in chat or email, record it
with `confirm_order(...)` ([job-side orders](../../job-requests/artifacts/orders.md#supplier-confirms)) once the scope
is clear. Post the actual status in the job's chat. Pickup vs delivery and
the target date are the job's (Chris's choice); a supplier event doesn't
change them. A supplier who acknowledges in the portal is told to message LPS
in the chat if anything changes, so treat such a message as a change request. Never infer
customer acceptance from a supplier event.

## Tell the supplier about an order change

Standing permission: every verified change to a placed order gets a short
factual message to the supplier, no draft approval needed.

1. Re-read the order and the changed fields. Check the supplier's
   conversation for this job: if this exact change was already sent, don't
   send it again.
2. A material change (plant, size, quantity, price, pickup/delivery, target
   date) gets a bullet in `orders.change_log`; a contact or address change
   updates its field in `orders.additional_details`; events (status,
   acknowledgement, messages) get neither
   ([format](../../job-requests/artifacts/orders.md#additional-details-and-change-log)). For a
   change the supplier made, post the before/after in the job's chat.
3. Send one message covering all fields changed in this update: job name,
   what changed (old → new where useful), current pickup/delivery plan if
   affected, and the order link. For a change the supplier made, just
   acknowledge it; it isn't a new confirmation.
   For a replacement-change notice, use the current `Customer/Company | Project`
   job name as a bold heading, a blank line, one plain replacement sentence, a blank
   line, then a short clickable `View order #<id>` linked to the verified order
   URL. Verify the stated price against the saved replacement row's unit price.
   Example (replace the heading, facts, id and URL with the verified record):

   ```text
   **Customer/Company | Project**

   Replaced 7 × 3G Variegated Hosta with 7 × 3G Leopard Plant (Ligularia) at $27

   [View order #<id>](<verified order URL>)
   ```

   Bold only the heading; no strikethrough, unsolicited totals, or added “each”
   or “on the order” wording. This replacement format overrides the general message shape;
   other change notices keep the guidance above.
4. Partner: `webchat-cli send --thread-id <conversation> --portal --text ...`. Otherwise:
   the supplier's known email ([email](email.md)). Only these reach the
   supplier; an internal message or the order showing in the portal does not.
5. Confirm it was sent and say so in the job's chat. If it failed or there's no
   contact, keep it pending and report the blocker. After an unclear send,
   check history before resending.
