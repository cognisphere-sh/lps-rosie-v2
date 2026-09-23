## 6. Supplier orders and confirmation

### Orders without an availability request

Follow `job-requests` → **Direct orders: committed intake and quote-to-order**.
Already committed requests and accepted quotes can use `create_direct_order`
without any AR. The job thread preserves supplied/accepted prices and fills
only missing prices from APS, then creates the order and relays its id, exact
allocations, commitment/pricing evidence and `skip_availability: true` here.
No new quote or separate availability-send approval is needed. This replaces
the obsolete internal/admin support-AR workaround and hidden-AR blocker.

Read the resulting order before coordinating it. Resolve its jobs through
`order_item_job_request_items`. Order items have no direct AR-item pointer;
related ARs come through the job-item mappings and must match the order supplier.
Do not create, publish, answer or submit an AR to supply missing source evidence,
or mark job items available to enable ordering. Customer commitment and catalogue
pricing do not establish supplier availability or confirmation. A separately
authorized job availability override retains its own provenance under `job-requests`.
The committed request authorizes the order's appearance in the supplier Orders
tab; separate email/customer sends still follow their approval rules.

Use `job-requests` for customer-accepted order creation and quantity allocation.
Orders are separate from ARs and appear in the supplier portal's **Orders** tab.
One order can contain rows from several requests and jobs; one job can have
several supplier orders. Read `order_items` and
`order_item_job_request_items` before matching supplier messages or relaying
updates. Preserve the supplier scope and every customer's allocated quantities.

Customer acceptance creates **New** orders and makes linked jobs **Committed**.
Orders progress **New → Processing → Order Ready**. An availability response or
submission is not supplier confirmation of an order. When the supplier
explicitly confirms the identified order, use
`confirm_order(orderId, supplierId, confirmationDate, fulfillmentDate)` to
record the actual `confirmation_date` and agreed pickup/delivery date. Do not
infer these dates from the job's expected install date. Ambiguous scope or
partial confirmation must be resolved before confirming the full order.
The supplier portal records its own confirmation directly; re-read it rather
than submitting a duplicate action. Supplier confirmation moves the **Order
to Processing** and leaves each linked **Job Request Committed**. Use
`update_partner_order` for the subsequent Order Ready transition. Job requests
have no Confirmed stage. Relay the actual order status/date to every linked
job and follow `job-requests` for its separate lifecycle; maintain useful
sourcing progress under [job-requests: notes](../../job-requests/artifacts/notes.md)
without redundant order-status summaries.
Use `close_order` only for an explicit Won/Lost outcome, never because an AR
was submitted or a customer was silent.

## Note ownership

Use `note_from_supplier` for the supplier's own order/header or line response,
and `note_for_supplier` for Chris/LPS instructions. Customer-origin information
belongs in the order header's `note_from_customer`; order items have no customer-origin note field. LPS's customer-facing updates belong in `note_for_customer`; never treat either as a supplier response or include them
in supplier-facing output. Orders have no generic `notes` field. Track internal
sourcing and supplier follow-up on the linked job/item's `note_internal`.
