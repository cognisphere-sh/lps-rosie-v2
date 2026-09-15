# Orders

After quoting and availability, create an order only when the customer has confirmed the selected quantities. The job request's **Orders** tab shows every linked order. **Create order** selects answered availability lines, offers APS by default, and requires an explicit customer confirmation checkbox. Pickup/delivery defaults from the job; the order's pickup/delivery date is separate from the job's expected install date.

Use **Add another job** to combine demand for one supplier. Select quantities for each customer job; part of an availability line can go into one order and the remainder into another. The remaining quantities account for prior orders, including orders based on alternative supplier responses. Lost orders release their quantities. Pending and unavailable responses cannot be ordered. **Can Order** allows stock the supplier will procure and appears as **Need to Order** on the order line.

Creating an order sets it to **Committed** and advances its jobs to Committed. The supplier's existing portal **Orders** tab lists these orders and provides **Confirm order**, a confirmation date, and a pickup/delivery date. Admins can also record supplier confirmation. Confirmation does not overwrite an item's procurement status. Supplier confirmation sets the Order to Confirmed and records its confirmation date; the Job Request remains Committed. Migration 0093 removes Confirmed only from Job Request statuses. Admins close orders as Won or Lost; related jobs close only when their known demand is covered by terminal orders. The supplier cannot close orders or access other suppliers' orders.

The admin tab refreshes when the parent job receives a database event without losing the order draft. The supplier tab refreshes on focus, visibility changes, every 30 seconds while visible, and through its Refresh button.

## Data and API

Migration `0092_job_orders_workflow.sql` creates `orders`, `order_items`, and `order_item_job_request_items`. The last table allocates ordered quantities to customer job items. Orders carry no single job foreign key. Availability uses independent `availability_request_jobs` and `availability_request_item_jobs` associations, allowing combined grower requests and shared availability lines.

- `GET /api/orders?job=123&jobs=456,789` returns orders for the primary job, candidate lines for all selected jobs, and active job choices. `?supplier=7` lists that supplier's orders for admins.
- `POST /api/orders` accepts `{ supplierId, customerConfirmed: true, fulfillmentMethod, fulfillmentDate, notes, items: [{ availabilityRequestItemId, allocations: [{ jobRequestItemId, quantity }] }] }` and returns `{ id }` with status 201.
- `PATCH /api/orders/:orderId` records `status: confirmed` with optional `confirmationDate` and `fulfillmentDate`, closes with `status: closed_won | closed_lost`, or updates `fulfillmentDate` alone.
- `GET /api/partner/:id/orders` returns only that supplier's order snapshots. Internal customer/job allocations are omitted.
- `PATCH /api/partner/:id/orders/:orderId` allows confirmation or a pickup/delivery date update, subject to the existing partner access gate and an order-to-supplier scope check.

Creation, confirmation, and closure use transactional database functions. Creation locks demand and availability, validates the supplier and every association, and rejects quantities exceeding the request, supplier offer (except stock marked Can Order), allocation, or remaining customer demand. Dates use `YYYY-MM-DD`; missing prices remain absent rather than becoming zero.

Verification: `cd app && node --import tsx --test lib/orders.test.ts`. Tests cover customer approval, quantities and dates, competing/split orders and lost-order capacity, archived jobs, portal data disclosure, and authorization/scoping for writes. Database lifecycle invariants are tested separately in the PostgreSQL fixtures for migrations 0092 and 0093.

## Rollout

Migration 0092 was applied and verified in the live database on 2026-09-14.
Migration 0093 was applied and verified on 2026-09-15; it removes Confirmed only
from Job Requests, preserving Orders and all existing records.
The updated app deployment and production harness restart remain pending.

New environments need migrations 0092 and 0093 before the updated app and harness.
Migration 0092 maps historical Active jobs to Quote and historical customer-confirmed jobs to
Committed, backfills availability associations, and creates no historical orders.
The customer-wide order rollups remain unconnected; the customer page directs
users to the Orders tab of each job.
