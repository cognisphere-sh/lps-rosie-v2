### Direct orders: committed intake and quote-to-order

Use this path for already committed requests and accepted quotes that skip
availability. Migration 0100 provides `public.create_direct_order`; the earlier
internal/admin support-AR workaround and its hidden-AR blocker are obsolete.
No AR, supplier answer or availability override is required.

1. Create/reuse the job, its `jr-<id>` thread and every supplied item before
   ordering. Read current rows, recent changes and **all** existing order
   allocations for those identified job-item ids, including AR-backed orders.
   Do not search other jobs by plant to decide whether to reuse a job.
   Preserve exact commitment evidence,
   accepted offerings and positive quantities. Use APS (`supplier_id = 1`)
   unless Chris explicitly selected another supplier. Resolve only material
   ambiguity; do not re-ask for acceptance already established in the request.
2. Apply [pricing](pricing.md)'s pricing precedence and save the resolved offering and
   `unit_price` on each accepted job item. The RPC snapshots those fields;
   it does not look up APS prices. Preserve original demand and phases. Do not
   use a cheaper option to replace an accepted size or price. A separate quote
   document, quote delivery, AR or availability-send approval is not required.
3. Create the order atomically with real ids and accepted quantities:

   ```sql
   SET app.actor TO 'rosie';
   SELECT public.create_direct_order(
     $supplierId,
     '[{"job_request_item_id":7,"quantity":10}]'::jsonb,
     $fulfillmentMethod, $fulfillmentDate, $notes, true
   );
   ```

   The final argument represents actual customer commitment, including an
   already committed request relayed by Chris. For multiple jobs, every
   included allocation needs its own customer's acceptance. Set method/date
   only when supported; unknown values stay NULL and do not block creation.
   Never copy customer EDD into the supplier's fulfillment date by assumption.
4. The transaction creates an Order **New** and its allocations and moves
   represented Quote/Availability jobs to **Committed**. Its order rows have
   `availability_request_item_id = NULL` and snapshot job-item name, size, price,
   shared note and current item status. Do not mark job items available, set
   `available_quantity`, fabricate supplier answers/submissions or confirmation
   dates, or create even a hidden/support AR to enable the order. An explicit
   separate availability instruction follows [supplier responses](supplier-responses.md) with its own provenance.
5. Verify the saved order, exact lines/prices/quantities, allocations and job
   stage. After an uncertain result, inspect existing orders before retrying:
   the RPC's remaining-demand cap does not make repeated partial orders
   idempotent. Reuse an order already covering the accepted scope. Both direct
   and AR-backed orders consume the same remaining customer demand.
6. Report the actual order and relay its id/allocations to the supplier thread
   with `skip_availability: true`, acceptance and pricing evidence, and origin
   context. The order appears in the supplier portal's Orders tab; the committed
   request authorizes this scoped creation. Do not ask to publish an AR or send
   a separate email/customer message without its applicable authorization.

If the deployed database lacks `create_direct_order`, report that specific
capability gap with the prepared job/items; do not revive the support-AR
workaround, fabricate availability or claim an order exists.
