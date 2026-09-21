# Orders

The usual workflow is Quote → Availability → Order, but availability is optional. Already committed requests create/reuse a job and its items, preserve supplied pricing, use APS's price list for missing prices, and go directly to an order. Accepted quotes can also proceed directly to order without an availability request or a new quote. Create an order only for quantities the customer has committed to; the linked Job Request becomes **Committed** and the separate order starts **New**.

Chris uses the job request's **Orders** tab to create, view and update orders. **Create order** selects answered availability lines when present; when no availability candidates exist, it offers quoted job lines for a direct order. APS is the default supplier, and the form requires an explicit customer confirmation checkbox. Pickup/delivery defaults from the job. The customer's **EDD** (expected delivery or installation date) stays on the job request and any availability request, stored as `expected_install_date`. Orders display that requested EDD separately from the supplier's **Fulfillment date**. New orders leave fulfillment date blank until confirmation; the supplier or Chris/admin records the supplier’s commitment there. The creation form has no date picker.

Use **Add another job** to combine demand for one supplier. Select quantities for each customer job; part of an availability line can go into one order and the remainder into another. Remaining quantities account for prior orders, including direct orders and orders based on alternative supplier responses. Lost orders release their quantities. On the availability-backed path, pending and unavailable responses cannot be ordered. **Can Order** allows stock the supplier will procure and appears as **Need to Order** on the created order line. Direct orders snapshot accepted job lines and their current status with no source AR; creating one does not mark plants available or supplier-confirmed.

## Partner lifecycle

Orders start at **New**, while their linked Job Requests advance to **Committed**. **Confirm order** opens a dialog where the supplier or Chris/admin records the committed fulfillment date and can add a supplier note. Saving these together moves the order to **Processing** and records its confirmation date. The dialog does not select or update pickup/delivery. **Mark Order Ready** moves a Processing order to **Order Ready**. Suppliers and Chris/admin can update the fulfillment date and supplier note on active orders. The date cannot be cleared after confirmation; backward transitions and skipping Processing are rejected. Existing procurement states, including Need to Order, remain unchanged by header status updates.

The partner Orders screen follows the availability-request layout: colored status filters with counts and Select all, matching cards, and a floating **By order**, **By status** and **By plant** view selector. Grouping uses plant response/procurement status or plant name; lifecycle filters continue to apply. Each order opens `/partner/:supplierId/orders/:orderId`, with the corresponding availability-page header, status counts and subtotal, responsive plant rows, print sheet, notes and pinned actions. Source availability requests are linked. Cards show Created, customer EDD and the order’s Pickup/Delivery tag. The separate supplier Fulfillment date appears on the individual order page and print sheet. Combined orders preserve each job's schedule without disclosing customer job identities to partners. Dates display as `MM-DD`. Historical Won/Lost records remain available for existing accounting.

Suppliers and Chris/admin share order lifecycle, fulfillment-date and supplier-note controls. **Only Chris/admin sets the order's Pickup/Delivery field**, using a separate selector on the order card or admin portal preview. The method can remain unset while the supplier confirms or marks the order ready; supplier updates preserve whatever Chris has recorded. Chris's cards start collapsed with summary metadata and actions visible, and expand independently to show plants, job allocations, notes and source availability links. Partner detail pages remain expanded. Suppliers stay restricted to their own company’s orders; admins can manage all suppliers’ orders. Both routes enforce the same lifecycle, validation and closure rules. Plant snapshots and allocations remain unchanged by these header edits.

The job Orders tab refreshes when the parent job receives a database event without losing the order draft. Partner order screens refresh on focus, visibility changes, every 30 seconds while visible, and through their Refresh button.

Order cards and details show a single Pickup or Delivery tag when the order's
method is set; a null method shows no tag. Customer schedule metadata on orders
shows only EDD, avoiding a second fulfillment-method label or placeholder.
Fulfillment date is omitted from order cards and retained on individual orders. For supplier and admin logins, opening an active
New order reveals **Confirm order** beside the order title. Processing and
Ready orders keep their actions in the pinned bottom bar. Read-only portal
views explicitly state that the account has read-only access. Supplier list
cards open their detail page; Chris’s job order cards expose actions directly.

## Data and API

Migration `0092_job_orders_workflow.sql` creates `orders`, `order_items`, and `order_item_job_request_items`. The last table allocates ordered quantities to customer job items. Orders carry no single job foreign key. Availability uses independent `availability_request_jobs` and `availability_request_item_jobs` associations, allowing combined grower requests and shared availability lines.

Migration `0094_partner_order_lifecycle.sql` changes order stages and adds the transactional `update_partner_order` function. It maps existing Committed orders to New and Confirmed orders to Processing, preserving confirmation dates, line states, quantities and allocations. Job Request stages remain unchanged. The legacy service-only confirmation RPC obeys the same forward-transition and fulfillment requirements. Historical closure accounting recognizes all three active order stages.

Migration `0096_order_supplier_confirmation_note.sql` adds `orders.supplier_notes`, separate from Chris's order instructions in `notes`. The scoped lifecycle RPC saves this note atomically with the fulfillment date and stage. Omitted notes remain unchanged; null or blank clears the note. Notes are limited to 10,000 characters.

Migration `0098_order_confirmation_optional_method.sql` retains the order's fulfillment-method field and validation but allows confirmation and Ready with a null method. A fulfillment date is still required. This separates the supplier's commitment from Chris's pickup/delivery arrangements.

- `GET /api/orders?job=123&jobs=456,789` returns orders for the primary job, candidate lines for all selected jobs, and active job choices. `?supplier=7` lists that supplier's orders for admins.
- `POST /api/orders` accepts `{ supplierId, customerConfirmed: true, fulfillmentMethod, notes, items: [{ availabilityRequestItemId, allocations: [{ jobRequestItemId, quantity }] }] }` and returns `{ id }` with status 201. A supplied nonempty `fulfillmentDate` is rejected; creation sends null to the database.
- `PATCH /api/orders/:orderId` permits admins to update status, fulfillment method/date and supplier note. It derives supplier scope from the stored order, then calls the same transactional lifecycle RPC. Partner sessions use the scoped portal route.
- `GET /api/partner/:id/orders` and `GET /api/partner/:id/orders/:orderId` return supplier-scoped snapshots and `canEdit`, which is true for authorized supplier and admin sessions. Detail responses also include `canEditFulfillmentMethod`, true only for admins. Payloads include `supplierNotes` and anonymized `jobSchedules` for customer EDD, omit customer/job allocations, and restrict source availability IDs to that supplier.
- `PATCH /api/partner/:id/orders/:orderId` accepts `status: processing | order_ready` and/or `fulfillmentDate` and `supplierNotes` from either role. Only admins may include `fulfillmentMethod`; supplier attempts to set or clear it return 403. Supplier/admin authentication, supplier scope and database transition checks all apply. Confirmation dates are recorded by the server.

Creation and lifecycle edits are transactional. Creation locks demand and availability, validates the supplier and every association, and rejects quantities exceeding the request, supplier offer (except stock marked Can Order), allocation, or remaining customer demand. Dates use `YYYY-MM-DD`; missing prices remain absent rather than becoming zero.

## Verification and rollout

Application regressions cover order quantities and allocations, fulfillment validation, supplier scope, admin edits from both views, archived-order guards, source links, filtering and grouping. PostgreSQL fixtures in `harness/agents/daisy/migrations/tests/0094_partner_order_lifecycle.*` verify migration preservation, forward transitions, atomic failures, procurement status and closure accounting.

Run the focused application checks individually from `app/` using
`node --import tsx lib/orders.test.ts`,
`node --import tsx lib/request-statuses.test.ts`, and
`node --import tsx lib/partner-orders-view.test.tsx`.
Migration 0094 passed its fixture and assertions on disposable PostgreSQL 18,
including applying the migration twice.

Migrations 0092 and 0093 were applied previously. Migrations **0094 and 0095 were
applied to the live database on 2026-09-15 at 13:20 UTC** in one transaction.
The existing Committed order moved to New; all line snapshots, allocations,
job records and availability records were preserved. RPC permissions and the
PostgREST schema reload were verified.
Migration **0096 was applied live on 2026-09-15 at 13:36 UTC** after disposable
PostgreSQL regression and repeat-application tests. Existing order data was
preserved exactly; RPC permissions and the read-only REST schema were verified.
The updated order UI was built and the app service restarted on 2026-09-15 at
14:02 UTC. Targeted tests, typecheck and production build passed; the service
was running and the public login page returned HTTP 200. Synthetic browser
checks verified the header confirmation button on desktop and phone layouts;
the user's signed-in session was not inspected.
Supplier/admin write access was deployed at 14:14 UTC the same day after API,
UI, typecheck, production-build and synthetic browser checks. A concurrent build
temporarily replaced the build output during restart; after it finished, the
app service was running and the public login page returned HTTP 200.
Migration **0098 was applied live on 2026-09-15 at 14:28 UTC** after API and
disposable PostgreSQL regression checks. The transaction verified the existing
function, preserved all order data, and checked the replacement function and
service-role-only permissions.
The matching app update was deployed at **14:30 UTC** after the focused API/UI
tests, phone browser check, typecheck and production build passed. The service
was running and the public login page returned HTTP 200.
Customer-wide order rollups remain unconnected; customers use the Orders tab of each job.

## Closed orders

The supplier portal separates Orders and Closed Orders. An order belongs in the
archive if its own status is Closed Won/Lost or all its linked jobs are closed,
archived or inactive. A shared order stays active while any linked job is open;
missing associations do not imply closure. This classification is derived on
read without changing the recorded order outcome or disclosing job identities.
Closed order controls are read-only and the scoped partner write route rejects
updates. The existing 30-second/focus/manual refresh moves cards between lists.

Deleting a job permanently deletes its exclusively associated orders and ARs
(migration 0097). Shared records remain for the other jobs, including their
closed history; deleting the final associated job removes those records.
