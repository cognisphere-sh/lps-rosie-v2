# Orders

The usual workflow is Quote → Availability → Order, but availability is optional. Already committed requests create/reuse a job and its items, preserve supplied pricing, use APS's price list for missing prices, and go straight to an order. Create an order only for what the customer has committed to; the job becomes **Committed** and the order starts **New**.

Since migration 0146 (2026-10-16) **an order belongs to one job and one supplier** (`orders.job_request_id`), and **each order row is one job line's selected candidate**. Chris uses the job's **Orders** tab: **Create order** lists the job's lines whose selected candidate is not on an order yet, grouped by the candidate's supplier (APS first). Every line is ticked; Chris unticks what isn't ordered yet and saves. There is no customer-confirmation checkbox. A job has at most one open order per supplier: if one exists, the ticked lines are added to it (the dialog says so and hides the header fields), otherwise a new order is made with the chosen Pickup/delivery and notes. The job's pickup/delivery is the default. The customer's **EDD** stays on the job request (`expected_install_date`) and shows separately from the supplier's **Fulfillment date**, which the supplier enters when confirming; the creation form has no date picker.

Each row copies its candidate at order time and keeps `order_items.candidate_id` (unique: a candidate is on at most one row): name, size, price, status in the line vocabulary (`can_order` → Need to Order, unanswered → Pending), LPS's ask (`note_for_supplier`), the supplier's reply (`note_from_supplier`) and the effective customer note. The quantity is what the job line shows available (capped at its Qty), else its Qty; a line with neither is refused. Unpriced and unanswered lines can be ordered and fixed on the order. After that the row is the order's own: Chris edits name, size, quantity, price, status and the three notes in place, **Add row** adds a blank row (no candidate), and the bin deletes a row (the last row takes the order with it). None of this changes the candidate or the job line, and candidate edits don't change the order.

Admin order cards use the job request card's compact two-row header. The first row shows a matching-size status pill, order reference and job name, customer EDD pill, then right-aligned Pickup/Delivery, item count, total, and **Copy order**. The second row is indented to the title column and places the supplier name, fulfillment date and (truncated) note for supplier in one segmented pill, with the order's availability request link alongside; in a narrow card (under 32rem, e.g. phones) the pill's segments stack instead of sharing one line. **Copy order** matches the request card's **Copy quote** action and is available while collapsed or expanded. It copies a formatted HTML order table and a plain-text alternative. It includes customer contact name, company, email and phone, delivery address, the job's installation date, Pickup/Delivery, order notes, line quantities/prices/statuses/notes, subtotal, and the absolute supplier portal order URL. Missing details are marked as not provided or to be confirmed. Browsers without rich clipboard support copy HTML source and label the result accordingly. Customer contact data remains admin-only; supplier API payloads retain their anonymized schedules.

The order's **availability request** is the supplier's AR for the same job (one per job and supplier), linked in the order header for Chris and the supplier (never a Draft for the supplier). The old allocation table `order_item_job_request_items` and its remaining-demand and supplier-capacity checks are gone (backed up as `order_item_job_request_items_pre_0146`).

## Partner lifecycle

Orders start at **New**, while their linked Job Requests advance to **Committed**. **Confirm order** opens a dialog where the supplier or Chris/admin records the committed fulfillment date and can add a supplier note. Saving these together moves the order to **Processing** and records its confirmation date. The dialog does not select or update pickup/delivery. **Mark Order Ready** moves a Processing order to **Order Ready**. Suppliers and Chris/admin can update the fulfillment date and supplier note on active orders. The date cannot be cleared after confirmation; backward transitions and skipping Processing are rejected. Existing procurement states, including Need to Order, remain unchanged by header status updates.

The partner Orders screen follows the availability-request layout: colored multi-select New / Processing / Ready status filters with counts (New + Processing selected on a fresh visit; no All button), matching cards, and a floating **By order**, **By status** and **By plant** view selector. Grouping uses plant response/procurement status or plant name; lifecycle filters continue to apply. Each order opens `/partner/:supplierId/orders/:orderId`, with the corresponding availability-page header, status counts and subtotal, responsive plant rows, print sheet, notes and pinned actions. The header links the supplier's availability request for the job, if any. Cards show Created, customer EDD and the order’s Pickup/Delivery tag. The separate supplier Fulfillment date appears on the individual order page and print sheet. Job identities are not disclosed to partners. Dates display as `MM-DD`. Historical Won/Lost records remain available for existing accounting.

Suppliers and Chris/admin share order lifecycle, fulfillment-date and supplier-note controls. **Only Chris/admin sets the order's Pickup/Delivery field**, using a separate selector on the order card or admin portal preview. The method can remain unset while the supplier confirms or marks the order ready; supplier updates preserve whatever Chris has recorded. Chris's cards start collapsed with summary metadata and actions visible, and expand independently to show plants, notes, **Add row** and the availability request link. Partner detail pages remain expanded. Suppliers stay restricted to their own company’s orders; admins can manage all suppliers’ orders. Both routes enforce the same lifecycle, validation and closure rules. Plant rows remain unchanged by these header edits. Admin order rows show Note for supplier, Note from supplier and Note for customer; supplier rows, copied orders and print sheets omit the customer note. Customer fields are omitted from supplier API payloads, not just hidden in the UI.

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

- `GET /api/orders?job=123` returns the job's orders, `lines` (its lines whose selected candidate is not on an order: supplier, name, size, status, quantity and price as `create_order` copies them) and the job's `fulfillmentMethod`. `?supplier=7` lists that supplier's orders for admins.
- `POST /api/orders` accepts `{ jobRequestId, supplierId, jobRequestItemIds, fulfillmentMethod, noteForSupplier, noteForCustomer }` and returns `{ id }` (the new order, or the open one the lines were added to) with status 201. It calls `create_order(job, supplier, line ids, method, note for supplier, note for customer)`.
- `POST /api/orders/:orderId/items` adds a blank row (`New plant`, quantity 1, Pending, no candidate) to an open order; `PATCH /api/orders/:orderId/items/:itemId` edits one cell (`name`, `size`, `quantity`, `unit_price`, `note_for_supplier`, `note_from_supplier`, `note_for_customer`) or the status; `DELETE` removes the row (`delete_order_item`).
- `PATCH /api/orders/:orderId` permits admins to update status, fulfillment method/date and the note for the supplier. It derives supplier scope from the stored order, then calls the same transactional lifecycle RPC. Partner sessions use the scoped portal route.
- `GET /api/partner/:id/orders` and `GET /api/partner/:id/orders/:orderId` return supplier-scoped snapshots and `canEdit`, which is true for authorized supplier and admin sessions. Detail responses also include `canEditFulfillmentMethod`, true only for admins. Payloads include `noteForSupplier` and `noteFromSupplier` on headers and rows, omit `noteForCustomer`, the job id and row candidates, include anonymized `jobSchedules` for customer EDD, and link only a non-draft AR.
- `PATCH /api/partner/:id/orders/:orderId` accepts `status: processing | order_ready`, `fulfillmentDate` and the supplier's own `noteFromSupplier`. `noteForSupplier` (LPS's note) and `fulfillmentMethod` return 403. Confirmation dates are recorded by the server.
- `PATCH /api/partner/:id/orders/:orderId/items/:itemId` accepts `{ status, noteFromSupplier? }` (`update_partner_order_item`; an omitted note is kept, blank clears it) or `{ unitPrice }` (no longer offered in the portal since 2026-10-21; the route still takes it). The portal's status dialog edits the row's saved note and Save sends one `order_status_saved` event to Rosie; the Note cell writes `{ status, noteFromSupplier }` with the row's saved status and sends none.

Creation locks the job row, so orders for one job are made one at a time; there is no supplier-wide lock any more. Dates use `YYYY-MM-DD`; a $0 price is a price (0143).

## Verification and rollout

Application regressions cover order creation from selected candidates, fulfillment validation, supplier scope, admin edits from both views, archived-order guards, related links, filtering and grouping. PostgreSQL fixtures in `harness/agents/daisy/migrations/tests/0094_partner_order_lifecycle.*` verify migration preservation, forward transitions, atomic failures, procurement status and closure accounting.

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
archive if its own status is Closed Won/Lost or its job is closed, archived or
inactive. This classification is derived on
read without changing the recorded order outcome or disclosing job identities.
Closed order controls are read-only and the scoped partner write route rejects
updates. The existing 30-second/focus/manual refresh moves cards between lists.

Deleting a job permanently deletes its orders and ARs (migrations 0097, 0146).
`close_order` closes the job when its last open order closes: Won if any of its
orders was won, else Lost (0146).

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
valid. Both tabs draw the same frame — the *Order/Request History* header on
desktop and a plain left-aligned tab row — so switching tabs never moves the page. Queue filters are single selections and default to All. Request completion
continues to use Completed; order fulfillment uses Ready.

Order and AR details share the customer/fulfillment header and count strip. Order
headers expose the job name and customer contact/delivery address to the
owning supplier, while the internal job ID, row candidates and customer-only
notes remain omitted. AR customer disclosure still follows `share_customer_details`.
Order rows are drawn as the AR line table (2026-10-21): Qty, Size, Plant (with
LPS's note beneath it), Status, Note, Unit price and Line total, with the same
padding, hairlines and tone bar and tint. Qty and Unit price are read-only. The
Note cell is the supplier's own `note_from_supplier`, typed in place (one line
until focused) and saved on blur with the row's saved status; it sends no Rosie
event. Phone cards show Status, Note, Unit price and Line total under the plant.
New orders use Acknowledge Received; processing orders use Mark as Ready, which
asks once more (**Confirm: ready for <date>**) before it writes. The job's
**Create order** form shows the picked rows' total (and how many have no price)
and says the supplier sees the order — or the rows added to their open one —
straight away.


## Public order links

Admins publish an open order from a job's order card with **Copy order → Public**
(`CopyOrderMenu`): the first public copy creates the link, later ones reuse it,
and the copied order carries the public URL. **Copy order → Private** uses the
authenticated supplier portal URL. The app has no Make private control; a link is
revoked by `PATCH /api/orders/[orderId]` with `{ isPublic: false }` or when the
order closes. Publishing again after revocation generates a new UUID; previous
links stay invalid.

`/public/orders/[token]` is a read-only supplier-facing order view, accessible
without signing in. `/api/public/orders/[token]` returns uncached supplier data:
plants, quantities, prices, statuses, supplier notes, schedules, and fulfillment
contacts/addresses already visible in the supplier portal. It excludes customer
notes, the availability request link, and the sharing token.
The page refreshes every 30 seconds and on focus; unavailable links clear the view.
No public write endpoints exist.

Admin `PATCH /api/orders/[orderId]` accepts `{ isPublic: boolean }` as a standalone
operation. Migration `0114_public_orders.sql` adds the nullable unique token and
revokes it when an order closes or becomes inactive. Reads also reject inactive
suppliers and orders whose linked jobs are all closed. This migration was applied
on 2026-09-23 at 14:40:01 UTC; the app must also be deployed to expose the controls.
