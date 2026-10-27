# Orders

The usual workflow is Quote → Availability → Order, but availability is optional. Already committed requests create/reuse a job and its items, preserve supplied pricing, use APS's price list for missing prices, and go straight to an order. Create an order only for what the customer has committed to; the job becomes **Committed** and the order starts **New**.

Since migration 0146 (2026-10-16) **an order belongs to one job and one supplier** (`orders.job_request_id`), and **each order row is one job line's selected candidate**. Chris uses the job's **Orders** tab: **Create order** lists the job's lines whose selected candidate is not on an order yet, grouped by the candidate's supplier (APS first). Every line is ticked; Chris unticks what isn't ordered yet and saves. There is no customer-confirmation checkbox. A job has at most one open order per supplier: if one exists, the ticked lines are added to it (the dialog says so and hides Additional details), otherwise a new order is made with the form's **Additional details**. Since migration 0149 (2026-10-21) an order has no pickup/delivery, date or customer note of its own: its **Mode** is the job's `fulfillment_method` and its **Target date** the job's EDD (`expected_install_date`), so Chris changes them on the job. The creation form has neither a method select nor a date picker.

**Additional details** (`orders.additional_details`, renamed from `note_for_supplier`) is what the supplier needs to deliver the order (2026-10-21), stored as JSON since 0151: an ordered list of `{ field, value }` (`OrderDetail[]`, `parseOrderDetails` in `lib/orders.ts`; the database's `is_order_details` check: 1–50 entries of non-blank text, field ≤ 100, value ≤ 2000) — customer, delivery address, delivery and billing contacts (one field each: `Name, email, phone`), payment method and other delivery facts where known. 0151 converted the old markdown rows and kept other text as a `Notes` field. The **Change log** is its own field, `orders.change_log` (0150): `- MM/DD: change` bullets of material changes only (plant, size, quantity, price, pickup/delivery, target date); events such as the order being placed or acknowledged are not logged. The Create order form starts Additional details from the job (`GET /api/orders?job=` returns fields for the customer's company or name, the job's shipping address and the delivery contact as `name, email, phone`); a new order has no change log. Rosie writes and maintains both by the same format (`job-requests` → orders). On the job's Orders tab (where Chris edits both in place) and on the supplier's order page each is a collapsible section: Additional details right below the order card, the Change log below the order's rows. Both start collapsed, except Additional details on the supplier's order page, which starts open on desktop (2026-10-21) and collapsed on phones (under 900px, 2026-10-23). Opened, Additional details shows its fields label over value, several to a row, and the Change log its bullets (a log written as a pipe table reads as `date: change` bullets, `changeLogBullets` in `lib/order-share.ts`). Chris edits Additional details with a field editor (clicking the fields, or **Edit**): a field and a value input per row, move up/down, remove, **Add field**, then **Save details**; the Create order form uses the same editor. Rows left entirely blank are dropped; a field without a value (or a value without a field) is refused inline. The Change log is edited as text in place. Neither the print sheet nor Copy order carries the change log. The print sheet puts two fields to a row; the HTML copy gives each field its own row of the details table; the text copy has one `Field: value` line each.

Each row copies its candidate at order time and keeps `order_items.candidate_id` (unique: a candidate is on at most one row): name, size, price, status in the line vocabulary (`can_order` → Need to Order, unanswered → Pending), LPS's ask (`note_for_supplier`) and the supplier's reply (`note_from_supplier`). Orders and rows have no customer note (0149). The quantity is what the job line shows available (capped at its Qty), else its Qty; a line with neither is refused. Unpriced and unanswered lines can be ordered and fixed on the order. After that the row is the order's own: Chris edits name, size, quantity, price, status and both notes in place, **Add row** adds a blank row (no candidate), and the bin deletes a row (the last row takes the order with it). None of this changes the candidate or the job line, and candidate edits don't change the order.

Admin order cards are one row in the `/requests` job card's grid (2026-10-21; the status column fits the order pill): chevron, status pill, job name (the order reference only when there is none), EDD, Pickup/Delivery (the job's, read-only), item count, total, and **Copy order**. There is no supplier pill or second row. On phones the row wraps as the job card does: status and Copy order, then the name, then EDD · mode · items · total. The order's Additional details show below the row, collapsed or not. Expanding shows the action bar (Mark as Ready, staged status saves, supplier name, acknowledged date, availability request link), the supplier's order note, and the rows. The desktop rows are drawn as the job page's AR table (the AR drawer's focused-job drawing): Qty, Size, Plant (LPS's note for the supplier beneath the name), Status, Note (the supplier's reply), Unit price and Line total; the same padding, tone bar and tint; no footer (the card header shows the total). Every value reads as plain text and becomes a field when clicked (press and hold on touch), saving on blur. Phone rows keep their cards: Status, Unit price and the notes, with no line total (2026-10-26).

**Copy order** matches the request card's **Copy quote** action and is available while collapsed or expanded. **Public** and **Private** copy a formatted HTML order with a plain-text alternative; **Text** copies only the plain text. Each is titled with the job's name (`O-<id>` only when there is none) linked to the order — the public page for Public, the supplier's portal order page for Private and Text. One details table follows: Mode, Target date and each Additional details field (which carry the customer) as its own row, with no table inside a cell; a multi-line value keeps its line breaks. The change log is not copied. Then come the rows as Qty, Size, Name (LPS's note for the supplier under it), Unit Price and Total, then the subtotal; the rows table is only as wide as its content (up to the copy's width), so Name is as wide as the longest name rather than taking the leftover space. The text rows use the Text Quote's line format without the line total (`qty x size name - note - unit`; the subtotal still closes it). There is no supplier and no separate Customer row. Missing details read *To be confirmed*. Browsers without rich clipboard support copy HTML source. The menu's last item, **Print**, prints the supplier order page's print sheet (below) from the job's order card: the card mounts the sheet, calls `window.print()` and unmounts it on `afterprint`.

The order's **availability request** is the supplier's AR for the same job (one per job and supplier), linked in the order header for Chris and the supplier (never a Draft for the supplier). The old allocation table `order_item_job_request_items` and its remaining-demand and supplier-capacity checks are gone (backed up as `order_item_job_request_items_pre_0146`).

## Partner lifecycle

Orders start at **New**, while their linked Job Requests advance to **Committed**. **Acknowledge Received** opens a dialog with no inputs (0149): it tells the supplier to message Local Plant Supply from the Chat sidebar if anything about the order changes, and its button moves the order to **Processing** and records the acknowledgement date. **Mark as Ready** moves a Processing order to **Order Ready** after one more press (**Confirm: ready for <target date>**). Backward transitions and skipping Processing are rejected. Existing procurement states, including Need to Order, remain unchanged by header status updates.

The partner Orders screen follows the availability-request layout: colored multi-select New / Processing / Ready status filters with counts (New + Processing selected on a fresh visit; no All button), matching cards, and a floating **By order**, **By status** and **By plant** view selector. Grouping uses plant response/procurement status or plant name; lifecycle filters continue to apply. Each order opens `/partner/:supplierId/orders/:orderId`, with the corresponding availability-page header, status counts and subtotal, responsive plant rows, print sheet, notes and pinned actions. The header links the supplier's availability request for the job, if any. Cards show Created, the job's EDD and Pickup/Delivery tag. The print sheet (2026-10-21) starts with the job name, then one bordered label/value table of Mode, Target date and the Additional details' fields (which carry the customer), two to a row, with any other details text under it — no change log — then Qty, Size, Name (LPS's note under it), Unit price, Total, a **Ready** and a **Need to Order** column of empty boxes for the yard to tick, and an empty **Note** column to write in, and the subtotal. It shows no order number, supplier, status or AR. Job identities are not disclosed to partners. Dates display as `MM-DD`. Historical Won/Lost records remain available for existing accounting.

Suppliers and Chris/admin share the order lifecycle controls. Pickup/delivery and the target date are the job's; nobody sets them on an order. Only Chris/admin writes the Additional details (the supplier's portal route refuses them with 403). Chris's cards start collapsed with summary metadata, Additional details and actions visible, and expand independently to show plants, notes, **Add row** and the availability request link. Partner detail pages remain expanded. Suppliers stay restricted to their own company’s orders; admins can manage all suppliers’ orders. Both routes enforce the same lifecycle, validation and closure rules. Plant rows remain unchanged by these header edits. Admin order rows show Note for supplier and Note from supplier. Supplier payloads omit the job id and row candidates.

The job Orders tab refreshes when the parent job receives a database event without losing the order draft. Partner order screens refresh on focus, visibility changes, every 30 seconds while visible, and on live updates; neither the order list nor the order detail page has a Refresh button (2026-10-07, matching the request pages).

Order cards and details show a single Pickup or Delivery tag when the job's
method is set; a null method shows no tag. The supplier's order page opens
with the list card's row (2026-10-21; the order reference and job name are its
heading), then a tinted strip with the supplier's own note, the availability
request link, any read-only notice and the acknowledged date, then the
Additional details; it has no Contact or Delivery address rows. For
supplier and admin logins, an active New order shows **Acknowledge Received**
and a Processing order **Mark as Ready** in the pinned bottom bar. Read-only portal
views explicitly state that the account has read-only access. Supplier list
cards (2026-10-21) are the `/requests` job card's one row — status, job name (no
order reference), EDD, Pickup/Delivery, items, total — with no customer, and the whole
card opens the detail page. Admin cards, supplier list cards and the supplier
page header share that row (`RecordRow` in `components/workspace/record-row.tsx`,
also the portal's request cards). On phones the row's EDD · mode · items · total
line wraps as its own row under the name, apart from the status and actions
above it; below the header the supplier page follows
the request page's layout (*Request and order detail pages* in the app README). Chris’s job order cards expose actions directly.

## Data and API

Migration `0092_job_orders_workflow.sql` creates `orders`, `order_items`, and `order_item_job_request_items`. The last table allocates ordered quantities to customer job items. Orders carry no single job foreign key. Availability is simpler since migration 0119: each AR belongs to one job (`availability_requests.job_request_id`) and each candidate to one job line.

Migration `0094_partner_order_lifecycle.sql` changes order stages and adds the transactional `update_partner_order` function. It maps existing Committed orders to New and Confirmed orders to Processing, preserving confirmation dates, line states, quantities and allocations. Job Request stages remain unchanged. The legacy service-only confirmation RPC obeys the same forward-transition and fulfillment requirements. Historical closure accounting recognizes all three active order stages.

Migration `0115_merged_audience_notes.sql` merged customer-origin and customer-facing notes into `note_for_customer`, and supplier instructions/responses into `note_for_supplier`, on order headers and items. Migration 0149 then dropped both `note_for_customer` columns and renamed the header's `note_for_supplier` to `additional_details` (values backed up in `orders_pre_0149` and `order_items_pre_0149`). The scoped lifecycle RPC saves the Additional details atomically with the stage; omitted fields remain unchanged, while null or blank clears them. Notes are limited to 10,000 characters.

Order creation rejects the removed `fulfillmentMethod`, `noteForSupplier` and
`noteForCustomer` inputs with HTTP 400 before `create_order` runs, so older
clients cannot silently lose them.

Migration `0098_order_confirmation_optional_method.sql` allowed confirmation and Ready with a null method. Migration 0149 dropped the order's method and fulfillment date altogether (backed up in `orders_pre_0149`): both are the job's, and confirming needs neither.

- `GET /api/orders?job=123` returns the job's orders, `lines` (its lines whose selected candidate is not on an order: supplier, name, size, status, quantity and price as `create_order` copies them) and `additionalDetails`, the field list a new order's Additional details start from. `?supplier=7` lists that supplier's orders for admins.
- `POST /api/orders` accepts `{ jobRequestId, supplierId, jobRequestItemIds, additionalDetails }` and returns `{ id }` (the new order, or the open one the lines were added to) with status 201. It calls `create_order(job, supplier, line ids, additional details)`.
- `POST /api/orders/:orderId/items` adds a blank row (`New plant`, quantity 1, Pending, no candidate) to an open order; `PATCH /api/orders/:orderId/items/:itemId` edits one cell (`name`, `size`, `quantity`, `unit_price`, `note_for_supplier`, `note_from_supplier`) or the status; `DELETE` removes the row (`delete_order_item`).
- `PATCH /api/orders/:orderId` permits admins to update status, `additionalDetails` and `changeLog`. It derives supplier scope from the stored order, then calls the same transactional lifecycle RPC. Partner sessions use the scoped portal route.
- `GET /api/partner/:id/orders` and `GET /api/partner/:id/orders/:orderId` return supplier-scoped snapshots and `canEdit`, which is true for authorized supplier and admin sessions. Payloads include `additionalDetails`, `changeLog` and `noteFromSupplier` on headers, `noteForSupplier` and `noteFromSupplier` on rows, the job's `fulfillmentMethod`, the customer's name in `customerDetails`, and anonymized `jobSchedules` for the EDD; they omit the job id and row candidates, and link only a non-draft AR.
- `PATCH /api/partner/:id/orders/:orderId` accepts `status: processing | order_ready` and the supplier's own `noteFromSupplier`. `additionalDetails` and `changeLog` (LPS's) return 403; `fulfillmentMethod` and `fulfillmentDate` return 400. Confirmation dates are recorded by the server.
- `PATCH /api/partner/:id/orders/:orderId/items/:itemId` accepts `{ status, noteFromSupplier? }` (`update_partner_order_item`; an omitted note is kept, blank clears it) or `{ unitPrice }` (no longer offered in the portal since 2026-10-21; the route still takes it). The portal's status dialog edits the row's saved note and Save sends one `order_status_saved` event to Rosie; the Note cell writes `{ status, noteFromSupplier }` with the row's saved status and sends none.

Creation locks the job row, so orders for one job are made one at a time; there is no supplier-wide lock any more. Dates use `YYYY-MM-DD`; a $0 price is a price (0143).

## Verification and rollout

Application regressions cover order creation from selected candidates, Additional details, supplier scope, admin edits from both views, archived-order guards, related links, filtering and grouping. PostgreSQL fixtures in `harness/agents/daisy/migrations/tests/0094_partner_order_lifecycle.*` verify migration preservation, forward transitions, atomic failures, procurement status and closure accounting.

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
retained their customer audience until 0149 dropped order customer notes. New
order lines snapshot the candidate's supplier notes. No internal job notes are
copied to orders; the legacy `notes` input is rejected.

### Supplier portal layout

The sidebar has Orders and Availability Requests, with Order/Request History at
its bottom. History has Orders and Requests tabs; existing archive URLs remain
valid. Both tabs draw the same frame — the *Order/Request History* header on
desktop and a plain left-aligned tab row — so switching tabs never moves the page. Queue filters are single selections and default to All. Request completion
continues to use Completed; order fulfillment uses Ready.

Order and AR details share the fulfillment header and count strip. Order
headers show the job name, mode and target date; the customer, contacts and
delivery address are in the Additional details below the header (2026-10-21).
The internal job ID and row candidates remain omitted. AR customer disclosure still follows `share_customer_details`.
Order rows are drawn as the AR line table (2026-10-21): Qty, Size, Plant (with
LPS's note beneath it), Status, Note, Unit price and Line total, with the same
padding, hairlines and tone bar and tint. Qty and Unit price are read-only. The
Note cell is the supplier's own `note_from_supplier`, typed in place (one line
until focused) and saved on blur with the row's saved status; it sends no Rosie
event. On phones (below 900px) every order line — the supplier portal's order
page, the public order link, the partner Orders views and the job page's Orders
tab — is the shared `LineCard` the AR and job item cards use (2026-10-27):
`Qty × Size Plant name`, LPS's note under it, then **Status · Price** (an order
has no Avail, so the cells row has two columns; no line total since 2026-10-26),
then **Supplier reply**. The status is the card's toned pill with the native
picker over it. Values read as text and open on a tap where editable: Chris
edits every field and has a delete button; the supplier edits the status and
the reply.
New orders use Acknowledge Received; processing orders use Mark as Ready, which
asks once more (**Confirm: ready for <target date>**) before it writes. The job's
**Create order** form shows the picked rows' total (and how many have no price)
and says the supplier sees the order — or the rows added to their open one —
straight away.


## Public order links

Admins publish an open order from a job's order card with **Copy order → Public**
(`CopyOrderMenu`): the first public copy creates the link, later ones reuse it,
and the copied order links the public URL. **Copy order → Private** and
**Text** link the authenticated supplier portal order. The app has no Make private control; a link is
revoked by `PATCH /api/orders/[orderId]` with `{ isPublic: false }` or when the
order closes. Publishing again after revocation generates a new UUID; previous
links stay invalid.

`/public/orders/[token]` is a read-only supplier-facing order view, accessible
without signing in. `/api/public/orders/[token]` returns uncached supplier data:
plants, quantities, prices, statuses, supplier notes, schedules and the
Additional details already visible in the supplier portal. It excludes the
availability request link and the sharing token.
The page refreshes every 30 seconds and on focus; unavailable links clear the view.
No public write endpoints exist.

Admin `PATCH /api/orders/[orderId]` accepts `{ isPublic: boolean }` as a standalone
operation. Migration `0114_public_orders.sql` adds the nullable unique token and
revokes it when an order closes or becomes inactive. Reads also reject inactive
suppliers and orders whose linked jobs are all closed. This migration was applied
on 2026-09-23 at 14:40:01 UTC; the app must also be deployed to expose the controls.
