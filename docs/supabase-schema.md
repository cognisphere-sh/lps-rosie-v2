# Supabase schema

Live `public` catalog for project `xyeyiqchadfszewztnrf` (2026-09-23; 0121–0124 changes 2026-09-30;
the job-line model of 0130, 2026-10-14; `thread_messages` job tags of 0147, 2026-10-19). 0131 (drop the deprecated job-line value columns) is
written but applied only after the app and Rosie read `job_lines`.
Daisy and Rosie’s `knowledge/files/SCHEMA.md` paths symlink here.

## Tables

Columns are `name type [NOT NULL] [DEFAULT value | IDENTITY | GENERATED]`.
Constraints include primary and unique keys, foreign keys and checks. RLS is
enabled on every table. Trigger-maintained values include `updated_at`, plant
identity columns, `suppliers.is_lps_partner` and `*_thread_ref` columns.

### `app_users`

```text
id uuid NOT NULL
username text NOT NULL
role text NOT NULL
supplier_id bigint
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
must_change_password boolean NOT NULL DEFAULT false
```

Constraints:
- `app_users_id_fkey`: `FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE`
- `app_users_pkey`: `PRIMARY KEY (id)`
- `app_users_role_check`: `CHECK ((role = ANY (ARRAY['admin'::text, 'partner'::text])))`
- `app_users_role_scope`: `CHECK ((((role = 'partner'::text) AND (supplier_id IS NOT NULL)) OR ((role = 'admin'::text) AND (supplier_id IS NULL))))`
- `app_users_supplier_id_fkey`: `FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE`

Unique indexes: `app_users_username_key` on `lower(username)`.

### `availability_requests`

Header `note_for_supplier` includes supplier-relevant job-wide `note_for_customer`, LPS
instructions and the supplier's request-wide reply. Its lines are `candidates`.

Trigger `availability_requests_apply_selected` (entering `submitted`, 0130):
on this AR's open (Quote/Availability) job lines, a selected candidate of this
AR answered Unavailable with an active same-line substitute since the previous
submission switches the line to the substitute; then the supplier's other
alternatives on those lines, asked on this AR or never asked (0132), get
`hide_from_lps` (`hide_submitted_alternatives`) — not the line's default or
selection, the supplier's originals, or the substitutes they offer. A
candidate LPS unhid can be hidden again by a later submission of the same AR.
Nothing is copied onto lines or notes.

```text
id bigint NOT NULL IDENTITY ALWAYS
supplier_id bigint NOT NULL
share_customer_details boolean NOT NULL DEFAULT false
status text NOT NULL DEFAULT 'new'::text
submitted_at timestamptz
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
note_for_supplier text
public_token uuid
job_request_id bigint NOT NULL
```

Constraints:
- `availability_requests_job_request_id_fkey`: `FOREIGN KEY (job_request_id) REFERENCES job_requests(id) ON DELETE SET NULL` (never fires since 0139: deleting a job deletes its ARs first, see below)
- `availability_requests_pkey`: `PRIMARY KEY (id)`
- `availability_requests_public_token_key`: `UNIQUE (public_token)`
- `availability_requests_status_check`: `CHECK ((status = ANY (ARRAY['draft'::text, 'new'::text, 'processing'::text, 'submitted'::text, 'closed'::text])))`
- `availability_requests_supplier_id_fkey`: `FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE`

New ARs start as `draft` (0120): built on the job card, invisible to the
supplier (portal, public link and answer RPCs refuse drafts) until
`send_availability_request` makes them `new`.

One AR per job and supplier (migration 0119 replaced `availability_request_jobs`;
0128's `availability_requests_one_per_job_supplier` BEFORE INSERT trigger
refuses a second AR for the same job and supplier — later asks go onto the
existing one; JR-55's AR-35/AR-36 predate it and are retained):
`job_request_id` is never NULL (0139 deleted the job-less ARs and made it NOT
NULL; hard-deleting a job that has ARs therefore fails), and all its candidates
belong to that job's lines. Inserting a Partner supplier's
AR records the job's `availability_sent` event when it is sent (`availability_requests_progress`);
closing the job closes its ARs.
ARs cannot be deleted on their own or truncated (0127 database guards); the
header has no `is_active` deletion flag. Former inactive headers become private
Draft history with revoked tokens, retaining all answers and associations.
Whole-job deletion deletes everything of the job (0139/0141: the job's BEFORE
DELETE trigger `job_requests_preserve_shared_availability` →
`close_orphaned_availability_on_job_delete` deletes its orders (each order
belongs to one job since 0146), then its
lines, and so their candidates, then its ARs, through the transaction-local
`lps.ar_delete` that `prevent_availability_request_delete` honours).
Published requests can return to `draft`, immediately revoking their public link
(only that clears `submitted_at`). Nothing returns an AR to `new` automatically
(0130): LPS edits of the header, candidates or answers keep its status.
Reopening is explicit — `reopen_availability_request` moves submitted or
processing to `new`, or closed to `new` while its job is open (minting a link
for a non-Partner); `submitted_at` is kept as history. Candidates can be added
only to a draft or new AR (reopen first). `edit_availability_request` is the
service-only admin answer RPC, using the same answer validation and substitute
handling with Draft support, and keeps the AR's status. Supplier RPCs still
refuse Draft and advance to Processing/Completed. Job reopening never reopens
an AR automatically.

### `candidates`

Supplier/plant/size options for one job line (migration 0119; formerly
`availability_request_items`). Price lists are only indicative, so each line
gets a candidate for the original request plus listed alternatives. A candidate
is asked once `availability_request_id` is set; its status is derived: Pending
(not on an AR), AR sent (asked, `status` NULL), else the supplier's answer.

```text
id bigint NOT NULL IDENTITY ALWAYS
availability_request_id bigint
name text NOT NULL
size text
status text
available_quantity numeric
unit_price numeric(10,2)
is_active boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
note_for_supplier text
mapped_inventory_id uuid
supplier_id bigint NOT NULL
job_request_item_id bigint NOT NULL
note_from_supplier text
note_for_customer text
answered_at timestamptz
description text
is_original boolean NOT NULL DEFAULT false
offered_candidate_id bigint
offer_description text
offer_unit_price numeric
offer_quantity numeric
hide_from_lps boolean NOT NULL DEFAULT false
```

Constraints:
- `candidates_availability_request_id_fkey`: `FOREIGN KEY (availability_request_id) REFERENCES availability_requests(id) ON DELETE CASCADE`
- `candidates_available_quantity_check`: `CHECK (((available_quantity IS NULL) OR (available_quantity >= (0)::numeric)))`
- `candidates_job_request_item_id_fkey`: `FOREIGN KEY (job_request_item_id) REFERENCES job_request_items(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED` (0130: a line's default is inserted just before the line; the name is an app embed hint. 0139: a deleted line takes all its candidates, asked ones included)
- `candidates_mapped_inventory_id_fkey`: `FOREIGN KEY (mapped_inventory_id) REFERENCES inventory(id) ON DELETE SET NULL`
- `candidates_pkey`: `PRIMARY KEY (id)`
- `candidates_offered_candidate_id_fkey`: `FOREIGN KEY (offered_candidate_id) REFERENCES candidates(id) ON DELETE SET NULL`
- `candidates_offer_not_self`: `CHECK ((offered_candidate_id IS DISTINCT FROM id))`
- `candidates_offer_quantity_check`, `candidates_offer_unit_price_check`: `>= 0` and finite when set
- `candidates_status_check`: `CHECK (((status IS NULL) OR (status = ANY (ARRAY['available'::text, 'partial_qty'::text, 'can_order'::text, 'diff_size_sub'::text, 'arriving_soon'::text, 'unavailable'::text]))))` (0130 renamed `diff_size_qty_sub`)
- `candidates_supplier_id_fkey`: `FOREIGN KEY (supplier_id) REFERENCES suppliers(id)`
- `candidates_unit_price_check`: `CHECK (((unit_price IS NULL) OR (unit_price >= (0)::numeric)))`

- `description` says what the candidate is, for Chris (`5 G Shumard Oak`);
  `is_original` marks a supplier's original request as the customer asked it
  (0120). Each line's **default** candidate (`job_request_items.default_candidate_id`,
  0130) is the APS (`supplier_id` 1) original, created by the database when the
  line is inserted (unpriced, description `size name`); while the line exists
  it cannot be hidden, deactivated, deleted, demoted or moved
  (`candidates_protect_default`). No automation changes `is_original` (0130
  removed 0129's promotion and reverted its 27 promotions).
- Candidate status is the supplier's answer. Status sets the quantity for
  every writer (`candidates_status_quantity`, only when the status changes):
  `available` = demand (the candidate's, else the line's), `unavailable` = 0,
  `diff_size_sub` = demand unless given; `partial_qty` keeps the given
  quantity; a change back to pending (NULL) clears it (0132). `unit_price` NULL means "price not found" and 0 is a $0 price (0143); no status changes a price
  (0122).
- A candidate is one fixed plant and size (0121). `partial_qty` = fewer than
  demanded. A substitute answer stores the asked candidate `unavailable`
  (quantity 0, price kept) with `offered_candidate_id`; `apply_candidate_offer`
  makes the substitute `diff_size_sub` at full demand on the same AR, visible
  to LPS. A picked tag is another active candidate of the same supplier and
  line, not one asked on that AR in its own right; a typed one
  (`offer_description`) gets a placeholder named with the text (`unit_price`
  NULL, `note_from_supplier` = the text) that Rosie enriches after
  submission. Supplier price, quantity and reply edits on the asked row go to
  the substitute; the substitute itself is answered only through the asked
  row. Leaving Unavailable (or clearing the substitute) resets a tag to
  unanswered and off the AR, or retires a typed placeholder
  (`release_candidate_offer`). `offer_unit_price` / `offer_quantity` are
  unused since 0130. Rows still `diff_size_sub` without an offer are older
  single-row answers.
- `hide_from_lps` (0124): a substitute option Rosie adds only for the
  supplier's Diff Sz/Sub dialog when the line already has an exact match.
  The sourcing page leaves it out; `apply_candidate_offer` clears it when a
  supplier picks it. Submission hides the supplier's other alternatives (see
  `availability_requests`). LPS can also set or clear it from the job page
  (Hide / Unhide); selecting a hidden candidate unhides it (0152).
- `note_for_supplier` is LPS's ask; `note_from_supplier` is the supplier's reply
  (the supplier's only writable note). `note_for_customer` is LPS's override
  of the customer note: NULL follows the reply, `''` is deliberately blank,
  text replaces it. A new, non-empty `note_from_supplier` clears the override
  unless the same write sets it (`candidates_reset_customer_note`, 0132), so
  the customer note starts as the supplier's reply. The effective note is
  `CASE WHEN note_for_customer IS NOT NULL THEN nullif(btrim(note_for_customer), '') ELSE nullif(btrim(note_from_supplier), '') END`.
- Triggers: `candidates_guard` rejects writes to candidates on a closed or
  deleted AR (except LPS's own values through `update_job_line`,
  `lps.lps_override`), a supplier that differs from the AR's, and another
  job's AR; `candidates_protect_default` (above); `candidates_reselect_default`
  returns lines selecting a deactivated candidate to their default;
  `candidates_status_quantity` (above). No candidate change moves its AR's
  status.
- Deleting a job line deletes it and its unasked candidates; asked ones stay
  on their AR with no line (0130), as on job deletion.

### `contacts`

```text
id bigint NOT NULL IDENTITY ALWAYS
name text
email text
phone text
title_department text
notes text
is_active boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
```

Constraints:
- `contacts_pkey`: `PRIMARY KEY (id)`

### `customers`

```text
id bigint NOT NULL IDENTITY ALWAYS
name text NOT NULL
company text
email text
phone text
address text
city text
state text
zip text
notes text
is_active boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
rosie_thread_id text
rosie_thread_ref bigint
type text
```

Constraints:
- `customers_pkey`: `PRIMARY KEY (id)`
- `customers_rosie_thread_ref_fkey`: `FOREIGN KEY (rosie_thread_ref) REFERENCES threads(id) ON DELETE SET NULL`
- `customers_type_check`: `CHECK ((type = ANY (ARRAY['Homeowner/Retail'::text, 'Landscape Professional'::text])))`

### `deleted_job_threads`

```text
agent text NOT NULL
thread_id text NOT NULL
job_request_id bigint NOT NULL
deleted_at timestamptz NOT NULL DEFAULT now()
purged_at timestamptz
deleted_counts jsonb NOT NULL DEFAULT '{}'::jsonb
```

Constraints:
- `deleted_job_threads_pkey`: `PRIMARY KEY (agent, thread_id)`

### `inventory`

```text
id uuid NOT NULL DEFAULT gen_random_uuid()
name text NOT NULL
size text
unit_price numeric(10,2)
created_at timestamptz DEFAULT now()
updated_at timestamptz DEFAULT now()
image_url text
notes text
height text
width text
caliper text
supplier_id bigint
is_active boolean NOT NULL DEFAULT true
source_id uuid
quantity numeric
name_key text GENERATED AS (normalize_plant_key(name))
height_std float8
width_std float8
caliper_std float8
size_std text
internal_notes text
common_name text
botanical_name text
cultivar_variety_trade_name text
common_name_key text
botanical_name_key text
cultivar_keys text[]
```

Constraints:
- `inventory_size_std_check`: `CHECK (((size_std IS NULL) OR (size_std ~ '^[0-9]+(\.[0-9]+)?G$'::text) OR (size_std ~ '^[0-9]+(\.[0-9]+)?" Pot$'::text) OR (size_std ~ '^[0-9]+" Box$'::text) OR (size_std = ANY (ARRAY['Bare Root'::text, 'Liners'::text, 'Plug'::text, 'Trays'::text, 'B&B'::text, 'Field Grown'::text, 'Grow Bags'::text, 'Root Pruned'::text, 'other'::text]))))`
- `inventory_source_id_fkey`: `FOREIGN KEY (source_id) REFERENCES inventory_sources(id)`
- `plants_pkey`: `PRIMARY KEY (id)`
- `rate_charts_supplier_id_fkey`: `FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE`

### `inventory_sources`

```text
id uuid NOT NULL DEFAULT gen_random_uuid()
supplier_id bigint NOT NULL
file_path text NOT NULL
notes text
is_active boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL DEFAULT now()
```

Constraints:
- `inventory_sources_pkey`: `PRIMARY KEY (id)`
- `inventory_sources_supplier_id_fkey`: `FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE`

### `job_request_changelog`

```text
id bigint NOT NULL IDENTITY ALWAYS
job_request_id bigint NOT NULL
item_id bigint
actor text NOT NULL
action text NOT NULL
changes jsonb NOT NULL
created_at timestamptz NOT NULL DEFAULT now()
```

Constraints:
- `job_request_changelog_action_check`: `CHECK ((action = ANY (ARRAY['insert'::text, 'update'::text])))`
- `job_request_changelog_item_id_fkey`: `FOREIGN KEY (item_id) REFERENCES job_request_items(id) ON DELETE CASCADE`
- `job_request_changelog_job_request_id_fkey`: `FOREIGN KEY (job_request_id) REFERENCES job_requests(id) ON DELETE CASCADE`
- `job_request_changelog_pkey`: `PRIMARY KEY (id)`

### `job_request_items`

A job line owns only the customer's ask (0130): `name`, `size` (the requested
size), `demanded_quantity` (NULL = unspecified) and `note_internal`. Its price,
status, available quantity and customer note are its **selected candidate's**,
read through the `job_lines` view and written with `update_job_line`. The
line's own name and size are plain `job_request_items` edits that never reach
a candidate (0144, 0145).
Allocation tables retain `quantity`.

Job and item notes have the same meaning, scoped to the job or line:

- `note_for_customer`: information for the customer only (e.g. `5 G NA, 3 G
  only`, an ETA, why a substitute). Rendered once in **Note for customer**;
  never beneath the plant name. On a line it is the selected candidate's
  effective note (`job_lines.note_for_customer`).
- `note_internal`: the customer's additional requests and requirements
  (cultivar, color, form, purchasing units, single trunk, …) and other
  internal context — never supplier, listing or price facts (those live on
  `candidates`); never included in customer-facing output. A requirement the
  supplier must meet is also put in the candidate's `note_for_supplier`.

```text
id bigint NOT NULL IDENTITY ALWAYS
job_request_id bigint NOT NULL
name text NOT NULL
size text
demanded_quantity numeric
unit_price numeric(10,2)                 -- deprecated by 0130, dropped in 0131
total numeric(12,2) GENERATED AS ((demanded_quantity * unit_price))  -- deprecated, 0131
status text NOT NULL DEFAULT 'pending'::text  -- deprecated, 0131
note_internal text
note_for_customer text                   -- deprecated, 0131
is_active boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
available_quantity numeric               -- deprecated, 0131
selected_candidate_id bigint NOT NULL
default_candidate_id bigint NOT NULL
```

The five deprecated columns are no longer read or written by any function;
0131 drops them (their pre-0130 values stay in `job_request_items_pre_0130`).

`default_candidate_id` (0130) is the line's APS original candidate. Inserting a
line creates it (`job_request_items_create_default`, BEFORE INSERT) and selects
it unless a selection is given, so raw INSERTs keep working; Rosie then prices,
maps and describes the default with an UPDATE. Editing the line's name or
size changes only the line, never a candidate (0144): a candidate's price is
for its own plant and size. To change the default too, update it explicitly.
While the default is unasked, an Available default keeps quantity = demand
(`job_request_items_sync_default`). Demand is
the line's alone (candidates have no `demanded_quantity` since 0139); the same trigger re-checks every active candidate of
the line when it changes: Available with 0 < Avail < demand becomes Partial
Qty, Partial Qty with Avail >= demand becomes Available. `selected_candidate_id` is the candidate filling the line;
`select_candidate` points it at an active candidate of the open line
(unhiding it if hidden, 0152), `unselect_candidate` returns it to the default, and deactivating the
selected candidate does too. Trigger `trg_job_request_items_changelog` still
logs line edits; price, status and note history now lives on candidates, which
have no changelog yet.

Constraints:
- `job_request_items_available_quantity_check`: `CHECK (((available_quantity IS NULL) OR (available_quantity >= (0)::numeric)))`
- `job_request_items_default_candidate_id_fkey`: `FOREIGN KEY (default_candidate_id) REFERENCES candidates(id) ON DELETE RESTRICT`
- `job_request_items_default_candidate_id_key`: `UNIQUE (default_candidate_id)`
- `job_request_items_job_request_id_fkey`: `FOREIGN KEY (job_request_id) REFERENCES job_requests(id) ON DELETE CASCADE`
- `job_request_items_pkey`: `PRIMARY KEY (id)`
- `job_request_items_selected_candidate_id_fkey`: `FOREIGN KEY (selected_candidate_id) REFERENCES candidates(id) ON DELETE RESTRICT`
- `job_request_items_demanded_quantity_check`: `CHECK (((demanded_quantity IS NULL) OR (demanded_quantity > (0)::numeric)))`

Index `job_request_items_selected_candidate_idx`. 0130 dropped
`job_request_items_status_check` and `job_request_items_status_idx`.

### `job_lines` (view)

`security_invoker` read model (0130; SELECT for `authenticated` and
`service_role`, not `anon`): every line with its selected candidate `c`.

```text
id, job_request_id, name, requested_size (= size), demanded_quantity, note_internal,
is_active, created_at, updated_at, default_candidate_id, selected_candidate_id,
size               coalesce(c.size, requested size)
unit_price         c.unit_price (NULL = not priced, 0 = $0; 0143)
demand             the line's demanded_quantity (candidates carry none, 0139)
available_quantity least(c.available_quantity, demand); NULL = not answered
total              demanded_quantity * unit_price
note_for_customer  c's effective note (see candidates)
candidate_description, candidate_name, candidate_supplier_id,
is_substitute      NOT c.is_original
quote_name         the line name for an original, else coalesce(c.description, c.name)
candidate_status   c.status as stored; NULL = unanswered
```

The line's status is `candidate_status` (0137), nothing derived: readers name
it in the line vocabulary (`pending`, `available`, `partial_qty`,
`unavailable`, `diff_size_sub`, `need_to_order`, `arriving_soon`) with NULL →
`pending` and `can_order` → `need_to_order`. Whether a candidate is the
original never changes it. The derived `status` column (which read a
non-original or an Unavailable answer offering a substitute as Diff Sz/Sub and
Available below demand as Partial Qty) was dropped by 0138.
`alternative_proposed` is retired. A view is not in the realtime publication: subscribe to
`candidates` and `job_request_items`.

### `job_request_items_pre_0130`

Backup of every line's `id, unit_price, status, available_quantity,
note_for_customer, total, selected_candidate_id` before 0130 moved them onto
candidates (RLS on, no `anon`/`authenticated` grants). Kept after 0131.

### `candidates_pre_0130`

Full copy of `candidates` before the 0130 backfill (same access as above).
Drop it once 0130 is verified.

### `job_requests`

The two note fields follow the definitions above, for job-wide information;
line-specific information belongs on `job_request_items`.

```text
id bigint NOT NULL IDENTITY ALWAYS
customer_id bigint
status text NOT NULL DEFAULT 'quoted'::text
billing_address text
billing_city text
billing_state text
billing_zip text
shipping_address text
shipping_city text
shipping_state text
shipping_zip text
note_internal text
note_for_customer text
is_active boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
name text
rosie_thread_ref bigint
expected_install_date date
fulfillment_method text
```

Constraints:
- `job_requests_customer_id_fkey`: `FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL`
- `job_requests_fulfillment_method_check`: `CHECK ((fulfillment_method = ANY (ARRAY['pickup'::text, 'delivery'::text])))`
- `job_requests_pkey`: `PRIMARY KEY (id)`
- `job_requests_rosie_thread_ref_fkey`: `FOREIGN KEY (rosie_thread_ref) REFERENCES threads(id) ON DELETE SET NULL`
- `job_requests_status_check`: `CHECK ((status = ANY (ARRAY['quoted'::text, 'availability'::text, 'committed'::text, 'closed_won'::text, 'closed_lost'::text, 'archived'::text])))`

### `order_item_job_request_items_pre_0146`

The order line → job line allocations as they were before 0146 dropped
`order_item_job_request_items` (RLS on, no `anon`/`authenticated` grants).

### `functions_pre_0146`

`signature`, `definition` (`pg_get_functiondef`) of the six functions 0146
replaced or dropped, for rollback (same access as above).

### `orders_pre_0151`

`orders.id`, `additional_details` as markdown, before 0151 made them JSON
(same access as below).

### `orders_pre_0150`

`orders.id`, `additional_details` before 0150 moved their change logs to
`change_log` (same access as below).

### `orders_pre_0149`, `order_items_pre_0149`, `functions_pre_0149`

What 0149 dropped, for rollback (same access as above): `orders.id`,
`fulfillment_method`, `fulfillment_date`, `note_for_customer`;
`order_items.id`, `note_for_customer`; and the `create_order`,
`update_partner_order` and `confirm_order` definitions it replaced.

### `order_items`

A row has two notes (0146, 0149): `note_for_supplier` (LPS's ask) and
`note_from_supplier` (the supplier's reply). Orders carry no customer note
(dropped in 0149); internal progress stays on the job/line `note_internal`.

Each row is one job line's **selected candidate** at order time (0146):
`candidate_id` is UNIQUE, so a candidate is on at most one row. `create_order`
copies its name, size (else the line's), price, status in the line vocabulary
(NULL → `pending`, `can_order` → `need_to_order`), `note_for_supplier` and
`note_from_supplier`; the quantity is the job
line's available quantity capped at its Qty, else its Qty. Afterwards the row
is the order's own: edits on either side never touch the other, LPS can add
rows by hand (no candidate) and delete rows, and deleting the candidate sets
the link NULL and keeps the row. Rows from before 0146 keep their joined
`note_for_supplier` and no `note_from_supplier`. The header's
`additional_details` can be supplied at creation. Read current notes before changing
one, preserving relevant requirements and outcomes. Migration 0115 merges old
origin/destination text, retaining distinct nonblank text and collapsing exact
duplicates, then removes the redundant origin columns without changing audit
history, timestamps or lifecycle state.

```text
id bigint NOT NULL IDENTITY ALWAYS
order_id bigint NOT NULL
name text NOT NULL
size text
quantity numeric NOT NULL
unit_price numeric(10,2)
total numeric(12,2) GENERATED AS ((quantity * unit_price))
status text NOT NULL DEFAULT 'pending'::text
is_active boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
note_for_supplier text
candidate_id bigint
note_from_supplier text
```

Constraints:
- `order_items_candidate_id_fkey`: `FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL` (0135)
- `order_items_candidate_id_key`: `UNIQUE (candidate_id)` (0146)
- `order_items_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE`
- `order_items_pkey`: `PRIMARY KEY (id)`
- `order_items_quantity_check`: `CHECK (((quantity > (0)::numeric) AND (quantity < 'Infinity'::numeric)))`
- `order_items_status_check`: `CHECK ((status = ANY (ARRAY['available'::text, 'partial_qty'::text, 'unavailable'::text, 'diff_size_sub'::text, 'need_to_order'::text, 'arriving_soon'::text, 'pending'::text])))` (0130 renamed `diff_size_qty_sub`)
- `order_items_unit_price_check`: `CHECK (((unit_price >= (0)::numeric) AND (unit_price < 'Infinity'::numeric)))` (0143; was `> 0`)

### `orders`

An order belongs to one job and one supplier (0146); a job has at most one
open (New, Processing, Order Ready, Completed) active order per supplier. Its availability
request is the AR with the same job and supplier, if any.

Pickup/delivery and the target date are the job's `fulfillment_method` and
`expected_install_date`; the order has neither (0149). `additional_details`
(renamed from `note_for_supplier` in 0149; jsonb since 0151) is what the
supplier needs, as an ordered list of `{"field": "...", "value": "..."}`
(customer, delivery address, delivery and billing contacts as
`Name, email, phone`, payment method and other delivery facts where known);
0151 converted the markdown rows and put other text in a `Notes` field. `change_log` (0150) is `- MM/DD: change` bullets of
material changes only (plant, size, quantity, price, pickup/delivery,
target date), NULL until the first. `note_from_supplier` is the supplier's reply.

```text
id bigint NOT NULL IDENTITY ALWAYS
job_request_id bigint NOT NULL
supplier_id bigint NOT NULL
status text NOT NULL DEFAULT 'new'::text
confirmation_date date
additional_details jsonb
is_active boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
note_from_supplier text
change_log text
```

Constraints:
- `orders_additional_details_check`: `CHECK (is_order_details(additional_details))` — NULL or 1–50 `{"field","value"}` objects of non-blank text, field ≤ 100, value ≤ 2000 (0151)
- `orders_job_request_id_fkey`: `FOREIGN KEY (job_request_id) REFERENCES job_requests(id) ON DELETE CASCADE` (0146; index `orders_job_request_idx`)
- `orders_one_open_per_job_supplier`: UNIQUE `(job_request_id, supplier_id)` where `is_active` and status is `new`, `processing`, `order_ready` or `completed` (0146; `completed` since 0154)
- `orders_pkey`: `PRIMARY KEY (id)`
- `orders_status_check`: `CHECK ((status = ANY (ARRAY['new'::text, 'processing'::text, 'order_ready'::text, 'completed'::text, 'closed_won'::text, 'closed_lost'::text])))`
- `orders_supplier_id_fkey`: `FOREIGN KEY (supplier_id) REFERENCES suppliers(id)`

### `plant_aliases`

```text
id bigint NOT NULL IDENTITY ALWAYS
name text NOT NULL
other_name text NOT NULL
name_key text GENERATED AS (NULLIF(normalize_plant_key(name), ''::text))
other_name_key text GENERATED AS (NULLIF(normalize_plant_key(other_name), ''::text))
source_id uuid
source_line text
is_active boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
```

Constraints:
- `plant_aliases_pkey`: `PRIMARY KEY (id)`
- `plant_aliases_source_id_fkey`: `FOREIGN KEY (source_id) REFERENCES inventory_sources(id)`

Unique indexes: `plant_aliases_pair_key_idx` on `(name_key, other_name_key)`.

### `plant_photos`

```text
id uuid NOT NULL DEFAULT gen_random_uuid()
storage_bucket text NOT NULL DEFAULT 'plant-photos'::text
storage_path text NOT NULL
mime_type text
byte_size bigint
image_width integer
image_height integer
sha256 text
supplier_id bigint
common_name text
botanical_name text
cultivar_variety_trade_name text
name text
common_name_key text
botanical_name_key text
cultivar_keys text[]
size text
size_std text
height text
width text
caliper text
tags text[] NOT NULL DEFAULT '{}'::text[]
caption text
notes text
source text
captured_at timestamptz
is_active boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
name_key text GENERATED AS (normalize_plant_key(name))
```

Constraints:
- `plant_photos_pkey`: `PRIMARY KEY (id)`
- `plant_photos_storage_path_not_blank`: `CHECK ((btrim(storage_path) <> ''::text))`
- `plant_photos_supplier_id_fkey`: `FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL`

Unique indexes: `plant_photos_object_idx` on `(storage_bucket, storage_path)`; `plant_photos_sha256_idx` on `sha256` where non-null.

### `supplier_contacts`

```text
id bigint NOT NULL IDENTITY ALWAYS
supplier_id bigint NOT NULL
contact_id bigint NOT NULL
is_primary boolean NOT NULL DEFAULT false
is_active boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
```

Constraints:
- `supplier_contacts_contact_id_fkey`: `FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE`
- `supplier_contacts_pkey`: `PRIMARY KEY (id)`
- `supplier_contacts_supplier_contact_key`: `UNIQUE (supplier_id, contact_id)`
- `supplier_contacts_supplier_id_fkey`: `FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE`

Unique indexes: `supplier_contacts_one_primary_idx` on `supplier_id` where `is_primary AND is_active`.

### `suppliers`

```text
name text NOT NULL
created_at timestamptz DEFAULT now()
updated_at timestamptz DEFAULT now()
address text
city text
state text
zip text
notes text
id bigint NOT NULL IDENTITY BY DEFAULT
category text
is_active boolean NOT NULL DEFAULT true
website text
latitude float8
longitude float8
communication_notes text
availability_source_type text
availability_update_days integer
hosted_availability_url text
head_branch_id bigint NOT NULL
is_lps_partner boolean NOT NULL DEFAULT false
daisy_thread_id text
rosie_thread_id text
rosie_thread_ref bigint
daisy_thread_ref bigint
short_name text
is_favorite boolean NOT NULL DEFAULT false
```

`is_favorite` (0153): LPS favourite, set on the company's head-branch row and
covering all its farms; the Suppliers page and plant search list favourites first.

Constraints:
- `suppliers_availability_source_type_check`: `CHECK ((availability_source_type = ANY (ARRAY['Email'::text, 'Hosted'::text])))`
- `suppliers_availability_update_days_check`: `CHECK ((availability_update_days > 0))`
- `suppliers_category_check`: `CHECK ((category = ANY (ARRAY['Grower'::text, 'Wholesale Supplier'::text, 'Retail'::text, 'Broker/Platform'::text])))`
- `suppliers_daisy_thread_ref_fkey`: `FOREIGN KEY (daisy_thread_ref) REFERENCES threads(id) ON DELETE SET NULL`
- `suppliers_head_branch_id_fkey`: `FOREIGN KEY (head_branch_id) REFERENCES suppliers(id)`
- `suppliers_pkey`: `PRIMARY KEY (id)`
- `suppliers_rosie_thread_ref_fkey`: `FOREIGN KEY (rosie_thread_ref) REFERENCES threads(id) ON DELETE SET NULL`

### `thread_messages`

A supplier's or customer's conversation is one `threads` row shared by every
job; `job_request_id` tags a message's job, and a job's chat tab reads the
conversation filtered to it (0147). `sender_kind` is NULL only on rows from a
pre-0147 plugin (read as `agent` when `role = 'agent'`, `supplier` when
`portal`, else `lps`).

```text
id bigint NOT NULL IDENTITY ALWAYS
thread_id bigint NOT NULL
seq integer NOT NULL
role text NOT NULL
text text NOT NULL DEFAULT ''::text
files jsonb NOT NULL DEFAULT '[]'::jsonb
sender_name text
portal boolean NOT NULL DEFAULT false
created_at timestamptz NOT NULL DEFAULT now()
sender_kind text
origin_thread_id text
job_request_id bigint
```

Constraints:
- `thread_messages_pkey`: `PRIMARY KEY (id)`
- `thread_messages_role_check`: `CHECK ((role = ANY (ARRAY['user'::text, 'agent'::text])))`
- `thread_messages_sender_kind_check`: `CHECK (((sender_kind IS NULL) OR (sender_kind = ANY (ARRAY['lps'::text, 'agent'::text, 'supplier'::text, 'customer'::text]))))`
- `thread_messages_job_request_id_fkey`: `FOREIGN KEY (job_request_id) REFERENCES job_requests(id) ON DELETE SET NULL`
- `thread_messages_thread_id_fkey`: `FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE`
- `thread_messages_thread_id_seq_key`: `UNIQUE (thread_id, seq)`

Index `thread_messages_job_request_idx (job_request_id, thread_id) WHERE job_request_id IS NOT NULL`.

A job's id is reserved before its row exists (New job request), so messages
sent then are stored with `job_request_id` NULL and `origin_thread_id`
`jr-<id>`. The AFTER INSERT trigger `job_requests_tag_reserved_messages` on
`job_requests` (`tag_reserved_job_messages()`, 0148) tags those untagged rows
when the row is written.

### `threads`

```text
id bigint NOT NULL IDENTITY ALWAYS
agent text NOT NULL
thread_id text NOT NULL
web_read_id integer NOT NULL DEFAULT 0
portal_read_id integer NOT NULL DEFAULT 0
pending_since timestamptz
last_seq integer
last_at timestamptz
last_role text
last_sender text
last_text text
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
closed_at timestamptz
```

Constraints:
- `threads_agent_thread_id_key`: `UNIQUE (agent, thread_id)`
- `threads_pkey`: `PRIMARY KEY (id)`

## RPCs

`EXECUTE` shows grants besides the owner (`postgres`); `public` means all
roles. Table results are listed below.

| Function and arguments | Returns | EXECUTE | Purpose |
|---|---|---|---|
| `add_candidates_to_availability_request(p_request_id bigint, p_candidate_ids bigint[])` | `bigint` | service_role only | Ask unasked candidates of open job lines on a draft or new AR of their supplier (submitted/processing/closed: reopen first); an earlier supplier answer is cleared. |
| `apply_candidate_offer(p_candidate_id bigint)` | `void` | service_role only | Make an Unavailable answer's substitute Diff Sz/Sub at full demand on its AR, visible to LPS (0130). |
| `answer_availability_request(p_request_id bigint, p_supplier_id bigint, p_item_id bigint DEFAULT NULL, p_changes jsonb DEFAULT NULL, p_submit boolean DEFAULT false)` | `bigint` | service_role only | Save a supplier line answer or submit the request; locks the request. |
| `answer_public_availability(p_token uuid, p_item_id bigint DEFAULT NULL, p_changes jsonb DEFAULT NULL, p_submit boolean DEFAULT false)` | `bigint` | service_role only | Resolve a public token, then save/submit through the same guarded answer path. |
| `close_order(p_order_id bigint, p_status text)` | `bigint` | service_role only | Close an order Won/Lost; the job closes with its last open order, Won if any of its orders was won (0146). |
| `compose_plant_name(common_name text, botanical_name text, cultivar_variety_trade_name text)` | `text` | public | Compose common, botanical and cultivar parts into the display name. |
| `confirm_order(p_order_id bigint, p_supplier_id bigint, p_confirmation_date date DEFAULT current_date)` | `bigint` | service_role only | Supplier confirmation through the order lifecycle (no date since 0149). |
| `create_availability_request(p_supplier_id bigint, p_candidate_ids bigint[], p_share_customer_details boolean DEFAULT false, p_public_token uuid DEFAULT NULL)` | `bigint` | service_role only | Create a draft AR asking one job's candidates, atomically. |
| `create_order(p_job_request_id bigint, p_supplier_id bigint, p_job_request_item_ids bigint[], p_additional_details jsonb DEFAULT NULL)` | `bigint` | service_role only | Copy the lines' selected candidates (that supplier's, not yet on an order) onto the job's open order with the supplier, or a new one; returns its id (0146, 0149, 0151). |
| `delete_job_request(p_job_request_id bigint)` | `jsonb` | service_role only | Hard-delete a job with its lines, candidates, ARs (0139) and orders (0141, 0146); returns counts of removed related rows. |
| `delete_candidate(p_candidate_id bigint)` | `void` | service_role only | Soft-delete a candidate (not a line's default); lines selecting it return to their default. |
| `delete_job_request_item(p_job_request_id bigint, p_job_request_item_id bigint)` | `jsonb` | service_role only | Hard-delete a job line and all its candidates, asked ones included (0139: they leave their AR); returns counts or null. |
| `delete_order_item(p_order_id bigint, p_order_item_id bigint)` | `boolean` | service_role only | Hard-delete an open order line; delete the order too if empty; returns success. |
| `is_order_details(p jsonb)` | `boolean` | public | The `orders.additional_details` shape check (0151; immutable). |
| `link_thread(p_agent text, p_thread_id text)` | `bigint` | public | Upsert and return a thread ID for an agent/thread pair. |
| `normalize_plant_key(txt text)` | `text` | public | Normalize plant identity to lowercase letters. |
| `normalize_search_text(txt text)` | `text` | public | Normalize search text and token boundaries. |
| `normalize_size(s text)` | `text` | public | Canonicalize a size string; callers apply it explicitly. |
| `plant_word_distance(a text, b text)` | `int` | public | Edit distance between two words, a swap of adjacent letters counting one (0142). |
| `plant_photo_document(name text, size text, caption text, tags text[], notes text)` | `text` | public | Build indexed search text for a photo. |
| `plant_photo_reclaimable(older_than_days integer DEFAULT 30)` | `table (projection below)` | anon, authenticated, service_role | List unreferenced old photo objects for review. |
| `record_job_workflow_event(p_job_request_id bigint, p_event text)` | `text` | service_role only | Apply a guarded job workflow event; returns the resulting status. |
| `release_candidate_offer(p_candidate_id bigint)` | `void` | service_role only | Drop an answer's substitute: reset a picked one (off the AR) or retire a typed one; clear the offer (0130 helper). |
| `reopen_availability_request(p_request_id bigint)` | `void` | service_role only | Submitted/Processing → New, or Closed → New on an open job (a link for non-Partners); never automatic (0130). |
| `reserve_job_request_id()` | `bigint` | service_role only | Reserve and return the next job request ID. |
| `search_inventory(search text DEFAULT '', fuzzy_ratio real DEFAULT 0.34)` | `table (projection below)` | public | Rank inventory matches. |
| `search_query_groups(search text)` | `table (projection below)` | public | The query's scored groups: typed words, size spellings and the alias names added (0142). |
| `search_plant_photos(search text DEFAULT '', fuzzy_ratio real DEFAULT 0.34)` | `table (projection below)` | public | Rank photo matches. |
| `send_availability_request(p_request_id bigint)` | `bigint` | service_role only | Send a draft AR with at least one candidate: status `new`, a public link for non-Partners. |
| `select_candidate(p_job_request_item_id bigint, p_candidate_id bigint)` | `void` | service_role only | Point an open line at one of its active candidates, unhiding it if hidden (0152; nothing else is copied). |
| `search_suppliers(search text DEFAULT '', category_filter text DEFAULT NULL, fuzzy_ratio real DEFAULT 0.34, sort_column text DEFAULT NULL, sort_direction text DEFAULT NULL)` | `table (projection below)` | public | Search and sort active suppliers. |
| `submit_availability_request_note(p_request_id bigint, p_supplier_id bigint, p_note text)` | `bigint` | service_role only | Submit an AR and save its supplier-wide note (max 10,000 chars). |
| `submit_public_availability_note(p_token uuid, p_note text)` | `bigint` | service_role only | Resolve public token, then submit AR and save supplier-wide note. |
| `unselect_candidate(p_job_request_item_id bigint)` | `void` | service_role only | Return an open line's selection to its default candidate. |
| `update_job_line(p_item_id bigint, p_changes jsonb)` | `void` | service_role only | LPS edit of a line's status, price, available quantity or customer note, written to its selected candidate (0130). No size or name since 0145. |
| `update_partner_order(p_order_id bigint, p_supplier_id bigint, p_patch jsonb)` | `bigint` | service_role only | Apply a guarded order status/additional details/supplier note patch. |
| `update_partner_order_item(p_order_id bigint, p_supplier_id bigint, p_order_item_id bigint, p_status text, p_note_from_supplier text DEFAULT NULL)` | `bigint` | service_role only | Change an active order row's procurement status, and its supplier note when given (NULL keeps it, `''` clears it; 0146). |

JSON inputs and behavior:

- `search_inventory`: empty input returns no rows. Outer straight double quotes
  select literal, case-insensitive name substring matching; unquoted input
  searches name, size and notes with alias expansion and relevance ranking,
  and returns only rows scoring at least half the best row (0118). Aliases
  come from `search_query_groups` (0142): a span whose letters equal an alias
  name (exact); else an alias name of as many words, each typed or a typo of
  it (close: one edit from 5 letters, two from 8; a one-word span needs to be
  the whole plant name); else, only for the whole plant name, an unfinished
  last word or a run of words inside the alias names with the fewest extra
  words and typos, from at most three pairs (partial). A possessive's `s` is
  skipped. Both names of a close or partial pair are added.
  `search_plant_photos` uses unquoted search over name, size, caption, tags and
  notes. `search_suppliers` also matches linked contacts; `sort_column`
  accepts `name`, `category`, `primary_contact_name`,
  `primary_contact_email`, `primary_contact_phone`, `website`, `address`,
  `city`, `state`, `zip`, `notes`, `availability_source_type`,
  `availability_update_days`, `hosted_availability_url`, `created_at`,
  `updated_at`.
- `create_availability_request.p_candidate_ids` /
  `add_candidates_to_availability_request.p_candidate_ids`: active, unasked
  candidates of the AR's supplier on open lines of one job (the AR's job); a
  missing demand is taken from the job line.
- `answer_availability_request.p_changes`: string-valued `status`,
  `available_quantity`, `unit_price`, `note_from_supplier`,
  `offered_candidate_id`, `offer_description` (no `size` since 0121;
  `offer_unit_price` / `offer_quantity` are accepted and ignored since 0130);
  blank clears a field. Available = demand; Available with fewer than demand
  is stored `partial_qty`, Partial Qty at demand `available`; Unavailable = 0
  (never the price, 0122). `diff_size_sub` (or `unavailable`) with
  `offered_candidate_id` (picked) or `offer_description` (typed) stores the
  substitute shape (see `candidates`); `diff_size_sub` without one raises
  "Pick or describe the substitute" when the status or offer keys change;
  `{status: 'unavailable'}` alone keeps the current substitute, and
  `offered_candidate_id: ''` with `offer_description: ''` clears it. Price,
  quantity and reply on a row with a substitute go to the substitute; a
  substitute row is refused (answer the row that offers it), as is picking a
  candidate asked on the same AR in its own right. Each answer stamps
  `answered_at`; a supplier answer moves the AR to Processing, an admin edit
  keeps its status. `p_submit = true` submits the request. Public variants resolve `p_token`
  before applying the same write. Supplier-note RPCs submit and store a note
  of at most 10,000 characters; blank clears it.
- `update_job_line.p_changes` (0130): `status` in the line vocabulary
  (`pending` → NULL, `need_to_order` → `can_order`, others as named),
  `unit_price`, `available_quantity` (string or number; blank = NULL) and
  `note_for_customer` (`''` = deliberately blank, JSON null = follow the
  supplier). Written to the line's selected candidate, also on a closed AR;
  `answered_at`, the AR's status and `is_original` are untouched. A `status`
  sent without `available_quantity` other than `partial_qty`, `unavailable`
  or `pending` sets the quantity to the demand (0134). Available /
  Partial Qty normalise against demand as in the answer RPC; `diff_size_sub`
  on an original answered Unavailable with a live substitute stays
  Unavailable (keeping the offer); otherwise it is stored as given (0152); leaving
  Unavailable releases the substitute. `size` or `name` is refused ("Size and
  name are not line values…", 0145; 0133 had accepted them): the line's
  `name`, `size`, `demanded_quantity` and `note_internal` are plain
  `job_request_items` edits, and a candidate's own name, size and description
  are edited on the candidate. A candidate's price is for its own plant and
  size, so no line edit renames it.
- `create_order` (0146, 0149): the job must be open and the supplier active.
  Every `p_job_request_item_ids` entry must be an active line of the job whose
  selected candidate is the supplier's and on no order row yet; a line with
  neither an available quantity nor a Qty is refused. Unpriced and unanswered
  candidates are allowed. The job row lock serialises orders for a job. If the
  job has an open order with the supplier the rows go onto it and
  `p_additional_details` (a field list, `[]`/NULL for none; 0151) is ignored;
  else a new order is created with it. Jobs
  at Quote or Availability become Committed.
- `update_partner_order.p_patch`: `status`, `additional_details` (a field
  list, `[]` or null clears; 0151), `change_log` (0150), `note_from_supplier` (0149; the app lets suppliers
  write only the last).
  Refused when the order or its job is closed. Status advances
  `new` → `processing` → `order_ready` → `completed` (0154); none needs a date (0149).
  Completed is still open: `close_order` closes it Won/Lost.
  `update_partner_order_item.p_status` accepts `pending`, `available`,
  `partial_qty`, `unavailable`, `diff_size_sub`, `need_to_order`, `arriving_soon`
  (the old `diff_size_qty_sub` is stored as `diff_size_sub`).
  `close_order.p_status` accepts `closed_won` or `closed_lost`.
- `record_job_workflow_event.p_event` accepts `pricing_fetched`,
  `availability_sent`, `quote_shared`, `customer_confirmed`,
  `supplier_confirmed`. `reserve_job_request_id()` advances the ID sequence
  without inserting a row.

Table-returning RPC columns:

- `search_query_groups`: `g` (group number), `span` (the query words), `t` (one alternative), `is_size`, `typed` (the user's own words), `alias_match` (`exact` / `close` / `partial`), `alias_ids` (the `plant_aliases` pairs `t` came from).
- `search_inventory`: `id`, `name`, `common_name`, `botanical_name`, `cultivar_variety_trade_name`, `cultivar_keys`, `size`, `size_std`, `unit_price`, `quantity`, `supplier_id`, `image_url`, `notes`, `internal_notes`, `height`, `width`, `caliper`, `is_active`, `source_id`, `source`, `created_at`, `updated_at`, `supplier_name`, `supplier_category`, `supplier_state`, `supplier_city`, `height_std`, `width_std`, `caliper_std`, `relevance`.
- `search_suppliers`: `id`, `name`, `address`, `city`, `state`, `zip`, `primary_contact_name`, `primary_contact_email`, `primary_contact_phone`, `website`, `latitude`, `longitude`, `notes`, `category`, `created_at`, `updated_at`, `availability_source_type`, `availability_update_days`, `hosted_availability_url`, `is_lps_partner`.
- `search_plant_photos`: `id`, `storage_bucket`, `storage_path`, `mime_type`, `byte_size`, `image_width`, `image_height`, `sha256`, `supplier_id`, `supplier_name`, `supplier_category`, `supplier_city`, `supplier_state`, `name`, `name_key`, `common_name`, `botanical_name`, `cultivar_variety_trade_name`, `cultivar_keys`, `size`, `size_std`, `height`, `width`, `caliper`, `tags`, `caption`, `notes`, `source`, `captured_at`, `is_active`, `created_at`, `updated_at`, `relevance`.
- `plant_photo_reclaimable`: `object_name`, `reason`, `age_days`, `byte_size`, `photo_id`, `photo_name`.

### Public order links (migration 0114, applied 2026-09-23)

`orders.public_token uuid UNIQUE` is nullable (private by default). The
`guard_order_public_link` trigger clears it for closed/inactive orders and rejects
publication for inactive suppliers. No anonymous table or RPC grants are added.
