# Orders

The usual workflow is Quote → Availability → Order, but availability is optional. Already committed requests create/reuse a job and its items, preserve supplied pricing, use APS's price list for missing prices, and go directly to an order. Accepted quotes can also proceed directly to order without an availability request or a new quote. Create an order only for quantities the customer has committed to; the linked Job Request becomes **Committed** and the separate order starts **New**.

Chris uses the job request's **Orders** tab to create, view and update orders. **Create order** selects answered availability lines when present; when no availability candidates exist, it offers quoted job lines for a direct order. APS is the default supplier, and the form requires an explicit customer confirmation checkbox. Pickup/delivery defaults from the job. The customer's **EDD** (expected delivery or installation date) stays on the job request and any availability request, stored as `expected_install_date`. Orders display that requested EDD separately from the supplier's **Fulfillment date**. New orders leave fulfillment date blank until confirmation; the supplier or Chris/admin records the supplier’s commitment there. The creation form has no date picker.

Use **Add another job** to combine demand for one supplier. Select quantities for each customer job; part of an availability line can go into one order and the remainder into another. Remaining customer demand is read from `job_request_items.demanded_quantity`; order lines and per-job allocations retain `quantity`. Remaining quantities account for prior orders, including direct orders and orders based on alternative supplier responses. Lost orders release their quantities. On the availability-backed path, pending, unavailable and unpriced responses (such as a typed substitute Rosie has not priced yet) cannot be ordered, and the dialog leaves them out; an answered substitute's order line reads **Diff Sz/Sub** (`diff_size_sub`, renamed from `diff_size_qty_sub` by 0130). **Can Order** allows stock the supplier will procure and appears as **Need to Order** on the created order line. Every order line keeps a link to the candidate it was placed for (`order_items.candidate_id`, 0135): the answered candidate, or for a direct order the job line's selected candidate. Its values stay a snapshot taken at creation. Direct orders snapshot accepted job lines as `job_lines` reads them (the selected candidate's name, size and price — not the customer's ask the job table shows) and their current status with no source AR; unpriced lines are left out; creating one does not mark plants available or supplier-confirmed.

Admin order cards use the job request card's compact two-row header. The first row shows a matching-size status pill, order reference and job name, customer EDD pill, then right-aligned Pickup/Delivery, item count, total, and **Copy order**. The second row places the supplier name and fulfillment date in one pill, with related request links alongside. Combined orders label each job's EDD. **Copy order** matches the request card’s **Copy quote** action and is available while collapsed or expanded. It copies a formatted HTML order table and a plain-text alternative. It includes customer contact name, company, email and phone, delivery address, each linked job’s installation date, Pickup/Delivery, order notes, line quantities/prices/statuses/notes, subtotal, and the absolute supplier portal order URL. Combined orders include every linked job once. Missing details are marked as not provided or to be confirmed. Browsers without rich clipboard support copy HTML source and label the result accordingly. Customer contact data remains admin-only; supplier API payloads retain their anonymized schedules.

Order items store their own snapshots and use `order_item_job_request_items`
for job allocations. Migration `0112_drop_order_item_availability_anchor.sql`
removes their direct AR-item pointer. Related ARs are derived through
the job lines' asked `candidates` and matched to `orders.supplier_id`; they do
not identify a historical source selection. The optional AR selection in the
creation request remains a transient input for validating/copying the response.
Supplier/AR limits count quantities already allocated to that supplier for the
linked job line, including direct orders.
Customer demand counts active order allocations across all suppliers. Never
count the entire quantity of a combined order row once per job. Supplier order
creation is serialized so these checks also cover concurrent direct orders.

## Partner lifecycle

Orders start at **New**, while their linked Job Requests advance to **Committed**. **Confirm order** opens a dialog where the supplier or Chris/admin records the committed fulfillment date and can add a supplier note. Saving these together moves the order to **Processing** and records its confirmation date. The dialog does not select or update pickup/delivery. **Mark Order Ready** moves a Processing order to **Order Ready**. Suppliers and Chris/admin can update the fulfillment date and supplier note on active orders. The date cannot be cleared after confirmation; backward transitions and skipping Processing are rejected. Existing procurement states, including Need to Order, remain unchanged by header status updates.

The partner Orders screen follows the availability-request layout: colored multi-select New / Processing / Ready status filters with counts (New + Processing selected on a fresh visit; no All button), matching cards, and a floating **By order**, **By status** and **By plant** view selector. Grouping uses plant response/procurement status or plant name; lifecycle filters continue to apply. Each order opens `/partner/:supplierId/orders/:orderId`, with the corresponding availability-page header, status counts and subtotal, responsive plant rows, print sheet, notes and pinned actions. Related availability requests are linked through shared job items and restricted to the order supplier. Cards show Created, customer EDD and the order’s Pickup/Delivery tag. The separate supplier Fulfillment date appears on the individual order page and print sheet. Combined orders preserve each job's schedule without disclosing customer job identities to partners. Dates display as `MM-DD`. Historical Won/Lost records remain available for existing accounting.

Suppliers and Chris/admin share order lifecycle, fulfillment-date and supplier-note controls. **Only Chris/admin sets the order's Pickup/Delivery field**, using a separate selector on the order card or admin portal preview. The method can remain unset while the supplier confirms or marks the order ready; supplier updates preserve whatever Chris has recorded. Chris's cards start collapsed with summary metadata and actions visible, and expand independently to show plants, job allocations, notes and related availability links. Partner detail pages remain expanded. Suppliers stay restricted to their own company’s orders; admins can manage all suppliers’ orders. Both routes enforce the same lifecycle, validation and closure rules. Plant snapshots and allocations remain unchanged by these header edits. Admin order rows display one merged note per audience; supplier rows, copied orders and print sheets include only the merged supplier note. Customer fields are omitted from supplier API payloads, not just hidden in the UI.

The job Orders tab refreshes when the parent job receives a database event without losing the order draft. Partner order screens refresh on focus, visibility changes, every 30 seconds while visible, and on live updates; neither the order list nor the order detail page has a Refresh button (2026-10-07, matching the request pages).

Order cards and details show a single Pickup or Delivery tag when the order's
method is set; a null method shows no tag. Customer schedule metadata on orders
shows only EDD, avoiding a second fulfillment-method label or placeholder.
Fulfillment date is shown with the supplier on admin job order cards and retained on individual orders. For supplier and admin logins, opening an active
New order reveals **Confirm order** beside the order title. Processing and
Ready orders keep their actions in the pinned bottom bar. Read-only portal
views explicitly state that the account has read-only access. Supplier list
cards open their detail page and are the portal's two-row list card (status and
name, then date · item count · customer; see the app README); the supplier
detail page follows the request page's layout (*Request and order detail pages*
in the app README). Chris’s job order cards expose actions directly.

## Data and API

Migration `0092_job_orders_workflow.sql` creates `orders`, `order_items`, and `order_item_job_request_items`. The last table allocates ordered quantities to customer job items. Orders carry no single job foreign key. Availability is simpler since migration 0119: each AR belongs to one job (`availability_requests.job_request_id`) and each candidate to one job line.

Migration `0094_partner_order_lifecycle.sql` changes order stages and adds the transactional `update_partner_order` function. It maps existing Committed orders to New and Confirmed orders to Processing, preserving confirmation dates, line states, quantities and allocations. Job Request stages remain unchanged. The legacy service-only confirmation RPC obeys the same forward-transition and fulfillment requirements. Historical closure accounting recognizes all three active order stages.

Migration `0115_merged_audience_notes.sql` merges customer-origin and customer-facing notes into `note_for_customer`, and supplier instructions/responses into `note_for_supplier`, on order headers and items. Both desktop and mobile views, print and copy show one supplier note column, with no note beneath the plant name. Customer notes are omitted from supplier payloads. The scoped lifecycle RPC saves the shared supplier note atomically with date and stage; omitted notes remain unchanged, while null or blank clears the whole shared note. Notes are limited to 10,000 characters.

Order creation rejects the obsolete `noteFromCustomer` input with HTTP 400 and
directs callers to `noteForCustomer`, before either order-creation RPC runs.
This also applies when both fields are supplied or the obsolete field is blank
or null, so older clients cannot silently discard a customer note.

Migration `0098_order_confirmation_optional_method.sql` retains the order's fulfillment-method field and validation but allows confirmation and Ready with a null method. A fulfillment date is still required. This separates the supplier's commitment from Chris's pickup/delivery arrangements.

- `GET /api/orders?job=123&jobs=456,789` returns orders for the primary job, candidate lines for all selected jobs, and active job choices. `?supplier=7` lists that supplier's orders for admins.
- `POST /api/orders` accepts `{ supplierId, customerConfirmed: true, fulfillmentMethod, noteForSupplier, noteForCustomer, items: [{ availabilityRequestItemId, allocations: [{ jobRequestItemId, quantity }] }] }` and returns `{ id }` with status 201. A supplied nonempty `fulfillmentDate` is rejected; creation sends null to the database.
- `PATCH /api/orders/:orderId` permits admins to update status, fulfillment method/date and supplier note. It derives supplier scope from the stored order, then calls the same transactional lifecycle RPC. Partner sessions use the scoped portal route.
- `GET /api/partner/:id/orders` and `GET /api/partner/:id/orders/:orderId` return supplier-scoped snapshots and `canEdit`, which is true for authorized supplier and admin sessions. Detail responses also include `canEditFulfillmentMethod`, true only for admins. Payloads include `noteForSupplier` on headers and lines, omit `noteForCustomer`, and include anonymized `jobSchedules` for customer EDD, omit customer/job allocations, and restrict related availability IDs to that supplier.
- `PATCH /api/partner/:id/orders/:orderId` accepts `status: processing | order_ready` and/or `fulfillmentDate` and `noteForSupplier` from either role. Only admins may include `fulfillmentMethod`; supplier attempts to set or clear it return 403. Supplier/admin authentication, supplier scope and database transition checks all apply. Confirmation dates are recorded by the server.

Creation and lifecycle edits are transactional. Creation locks demand and availability, validates the supplier and every association, and rejects quantities exceeding the request, supplier offer (except stock marked Can Order), allocation, or remaining customer demand. Dates use `YYYY-MM-DD`; since 0130 a source with no price (NULL or 0) is refused.

## Verification and rollout

Application regressions cover order quantities and allocations, fulfillment validation, supplier scope, admin edits from both views, archived-order guards, related links, filtering and grouping. PostgreSQL fixtures in `harness/agents/daisy/migrations/tests/0094_partner_order_lifecycle.*` verify migration preservation, forward transitions, atomic failures, procurement status and closure accounting.

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

Order and AR record titles use saved per-job names (`JR-42:Order-1`,
`JR-42:AR-1`). Migration 0104 backfills linked historical records and assigns
new names automatically; deploy it before the app that selects `record_name`.
Sequences are independent per job/type and do not change after deletion,
status edits or new allocations. Shared records keep their original naming
anchor. Records without a job link keep the legacy ID fallback until linked.
Numeric IDs and portal paths remain unchanged. Supplier chat/email updates
continue to use actual job names only, with direct portal links.

Migration 0111 renames existing note columns in place, adds only the missing
order audience fields, and removes the old generic order-item column name.
Old AR-backed line notes retain supplier authorship; old direct-quote notes
retain their customer audience. New order lines snapshot supplier fields and `note_for_customer` (the source's
effective customer note since 0130)
without putting customer-facing notes in supplier responses. No internal job
notes are copied to orders. Header inputs use the three explicit creation
fields; the legacy `notes` input is rejected.

### Supplier portal layout

The sidebar has Orders and Availability Requests, with Order/Request History at
its bottom. History has Orders and Requests tabs; existing archive URLs remain
valid. Queue filters are single selections and default to All. Request completion
continues to use Completed; order fulfillment uses Ready.

Order and AR details share the customer/fulfillment header and count strip. Order
headers expose linked job names and customer contact/delivery addresses to the
owning supplier, while internal job IDs, allocations, and customer-only notes
remain omitted. AR customer disclosure still follows `share_customer_details`.
Order rows show Qty, Size, Name,
Status, Unit price, Line total, and Note for supplier. Price edits use the existing inline AR input and the scoped
`update_partner_order_item_price` RPC from migration 0113 (applied 2026-10-14). Generated line totals update automatically.
New orders use Acknowledge Received; processing orders use Mark as Ready.


## Public order links

Admins can use **Share public link** on a job's order card to make an open
order public, copy its URL, or make it private. “Copy order” includes the public
URL while published and otherwise uses the authenticated supplier portal URL.
Publishing again after revocation generates a new UUID; previous links stay invalid.

`/public/orders/[token]` is a read-only supplier-facing order view, accessible
without signing in. `/api/public/orders/[token]` returns uncached supplier data:
plants, quantities, prices, statuses, supplier notes, schedules, and fulfillment
contacts/addresses already visible in the supplier portal. It excludes customer
notes, allocation IDs, related availability requests, and the sharing token.
The page refreshes every 30 seconds and on focus; unavailable links clear the view.
No public write endpoints exist.

Admin `PATCH /api/orders/[orderId]` accepts `{ isPublic: boolean }` as a standalone
operation. Migration `0114_public_orders.sql` adds the nullable unique token and
revokes it when an order closes or becomes inactive. Reads also reject inactive
suppliers and orders whose linked jobs are all closed. This migration was applied
on 2026-09-23 at 14:40:01 UTC; the app must also be deployed to expose the controls.
