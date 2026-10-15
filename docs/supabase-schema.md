# Supabase schema

Live `public` catalog for project `xyeyiqchadfszewztnrf` (2026-09-23; 0121–0124 changes 2026-09-30;
the job-line model of 0130, 2026-10-14). 0131 (drop the deprecated job-line value columns) is
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
job_request_id bigint
```

Constraints:
- `availability_requests_job_request_id_fkey`: `FOREIGN KEY (job_request_id) REFERENCES job_requests(id) ON DELETE SET NULL`
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
`job_request_id` is NULL only for history kept after its job was deleted, and
all its candidates belong to that job's lines. Inserting a Partner supplier's
AR records the job's `availability_sent` event when it is sent (`availability_requests_progress`);
closing the job closes its ARs.
ARs cannot be deleted or truncated (0127 database guards); the header has no
`is_active` deletion flag. Former inactive headers become private Draft history
with revoked tokens, retaining all answers and associations. Whole-job deletion
closes its ARs and retains their supplier snapshots.
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
demanded_quantity numeric
status text
available_quantity numeric
unit_price numeric(10,2)
is_active boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
note_for_supplier text
mapped_inventory_id uuid
supplier_id bigint NOT NULL
job_request_item_id bigint
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
- `candidates_demanded_quantity_check`: `CHECK (((demanded_quantity IS NULL) OR (demanded_quantity > (0)::numeric)))`
- `candidates_demand_on_job_line`: `CHECK ((job_request_item_id IS NULL) OR (demanded_quantity IS NULL))` (0136: a job line's candidates read the line's `demanded_quantity`; only a job-less AR's candidates keep their own asked quantity)
- `candidates_job_request_item_id_fkey`: `FOREIGN KEY (job_request_item_id) REFERENCES job_request_items(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED` (0130: a line's default is inserted just before the line; the name is an app embed hint)
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
  line is inserted (price 0, description `size name`); while the line exists
  it cannot be hidden, deactivated, deleted, demoted or moved
  (`candidates_protect_default`). No automation changes `is_original` (0130
  removed 0129's promotion and reverted its 27 promotions).
- Candidate status is the supplier's answer. Status sets the quantity for
  every writer (`candidates_status_quantity`, only when the status changes):
  `available` = demand (the candidate's, else the line's), `unavailable` = 0,
  `diff_size_sub` = demand unless given; `partial_qty` keeps the given
  quantity; a change back to pending (NULL) clears it (0132). `unit_price` 0 means "price not found"; no status changes a price
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
  (Hide / Unhide); a hidden candidate cannot be selected.
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
read through the `job_lines` view and written with `update_job_line`, which
also edits the size and name the line shows (0133).
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
maps and describes the default with an UPDATE. While the default is unasked,
edits of the line's name or size follow onto it
(`job_request_items_sync_default`; an Available default keeps quantity =
demand; its description follows by `update_job_line`'s rule, 0133). Demand is
the line's alone (0136); the same trigger re-checks every active candidate of
the line when it changes: Available with 0 < Avail < demand becomes Partial
Qty, Partial Qty with Avail >= demand becomes Available. `selected_candidate_id` is the candidate filling the line;
`select_candidate` only points it (an active, visible candidate of the open
line), `unselect_candidate` returns it to the default, and deactivating the
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
unit_price         nullif(c.unit_price, 0)
demand             coalesce(c.demanded_quantity, line demand)
available_quantity least(c.available_quantity, demand); NULL = not answered
total              demanded_quantity * unit_price
note_for_customer  c's effective note (see candidates)
status             pending | available | partial_qty | unavailable | diff_size_sub | need_to_order | arriving_soon
candidate_description, candidate_name, candidate_supplier_id,
is_substitute      NOT c.is_original
quote_name         the line name for an original, else coalesce(c.description, c.name)
```

`status`: NULL → `pending`; `can_order` → `need_to_order`; `arriving_soon`
and `diff_size_sub` as stored; `unavailable` offering an active substitute →
`diff_size_sub`; `unavailable`; an answered non-original → `diff_size_sub`;
available below demand → `partial_qty`; else as stored. `alternative_proposed`
is retired. A view is not in the realtime publication: subscribe to
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

### `order_item_job_request_items`

```text
order_item_id bigint NOT NULL
job_request_item_id bigint NOT NULL
quantity numeric NOT NULL
```

Constraints:
- `order_item_job_request_items_job_request_item_id_fkey`: `FOREIGN KEY (job_request_item_id) REFERENCES job_request_items(id) ON DELETE CASCADE`
- `order_item_job_request_items_order_item_id_fkey`: `FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE`
- `order_item_job_request_items_pkey`: `PRIMARY KEY (order_item_id, job_request_item_id)`
- `order_item_job_request_items_quantity_check`: `CHECK (((quantity > (0)::numeric) AND (quantity < 'Infinity'::numeric)))`

### `order_items`

Order headers and items use `note_for_customer` and `note_for_supplier`.
Each combines the audience's sourcing requirements and relevant response facts.
Supplier payloads, copy and print include only the supplier field, rendered once
in its note column. Internal progress stays on the linked job/item `note_internal`.

Every order line records the candidate it was placed for in `candidate_id`
(0135): AR-backed lines the answered candidate, direct lines the job line's
selected candidate. The line's values are a snapshot of that candidate at
creation; deleting the candidate sets the link NULL and keeps the line.
AR-backed order lines snapshot the candidate's name, size, price, supplier ask
and reply (joined) and its effective customer note (0130). Direct orders
snapshot the selected candidate as `job_lines` reads it (`candidate_name`,
size, price, status, customer note; 0135); their supplier note starts NULL. Header
notes can be supplied explicitly at creation. Read current notes before changing
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
note_for_customer text
candidate_id bigint
```

Constraints:
- `order_items_candidate_id_fkey`: `FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL` (0135)
- `order_items_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE`
- `order_items_pkey`: `PRIMARY KEY (id)`
- `order_items_quantity_check`: `CHECK (((quantity > (0)::numeric) AND (quantity < 'Infinity'::numeric)))`
- `order_items_status_check`: `CHECK ((status = ANY (ARRAY['available'::text, 'partial_qty'::text, 'unavailable'::text, 'diff_size_sub'::text, 'need_to_order'::text, 'arriving_soon'::text, 'pending'::text])))` (0130 renamed `diff_size_qty_sub`)
- `order_items_unit_price_check`: `CHECK (((unit_price > (0)::numeric) AND (unit_price < 'Infinity'::numeric)))`

### `orders`

```text
id bigint NOT NULL IDENTITY ALWAYS
supplier_id bigint NOT NULL
status text NOT NULL DEFAULT 'new'::text
fulfillment_method text
confirmation_date date
fulfillment_date date
note_for_supplier text
is_active boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
note_for_customer text
```

Constraints:
- `orders_fulfillment_method_check`: `CHECK ((fulfillment_method = ANY (ARRAY['pickup'::text, 'delivery'::text])))`
- `orders_pkey`: `PRIMARY KEY (id)`
- `orders_status_check`: `CHECK ((status = ANY (ARRAY['new'::text, 'processing'::text, 'order_ready'::text, 'closed_won'::text, 'closed_lost'::text])))`
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
```

Constraints:
- `suppliers_availability_source_type_check`: `CHECK ((availability_source_type = ANY (ARRAY['Email'::text, 'Hosted'::text])))`
- `suppliers_availability_update_days_check`: `CHECK ((availability_update_days > 0))`
- `suppliers_category_check`: `CHECK ((category = ANY (ARRAY['Grower'::text, 'Wholesale Supplier'::text, 'Retail'::text, 'Broker/Platform'::text])))`
- `suppliers_daisy_thread_ref_fkey`: `FOREIGN KEY (daisy_thread_ref) REFERENCES threads(id) ON DELETE SET NULL`
- `suppliers_head_branch_id_fkey`: `FOREIGN KEY (head_branch_id) REFERENCES suppliers(id)`
- `suppliers_pkey`: `PRIMARY KEY (id)`
- `suppliers_rosie_thread_ref_fkey`: `FOREIGN KEY (rosie_thread_ref) REFERENCES threads(id) ON DELETE SET NULL`

### `thread_messages`

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
```

Constraints:
- `thread_messages_pkey`: `PRIMARY KEY (id)`
- `thread_messages_role_check`: `CHECK ((role = ANY (ARRAY['user'::text, 'agent'::text])))`
- `thread_messages_thread_id_fkey`: `FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE`
- `thread_messages_thread_id_seq_key`: `UNIQUE (thread_id, seq)`

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
| `close_order(p_order_id bigint, p_status text)` | `bigint` | service_role only | Close an order Won/Lost and update fully covered jobs. |
| `compose_plant_name(common_name text, botanical_name text, cultivar_variety_trade_name text)` | `text` | public | Compose common, botanical and cultivar parts into the display name. |
| `confirm_order(p_order_id bigint, p_supplier_id bigint, p_confirmation_date date DEFAULT current_date, p_fulfillment_date date DEFAULT NULL)` | `bigint` | service_role only | Supplier confirmation through the order lifecycle. |
| `create_availability_request(p_supplier_id bigint, p_candidate_ids bigint[], p_share_customer_details boolean DEFAULT false, p_public_token uuid DEFAULT NULL)` | `bigint` | service_role only | Create a draft AR asking one job's candidates, atomically. |
| `create_direct_order(p_supplier_id bigint, p_items jsonb, p_fulfillment_method text DEFAULT NULL, p_fulfillment_date date DEFAULT NULL, p_note_for_supplier text DEFAULT NULL, p_customer_confirmed boolean DEFAULT false, p_note_for_customer text DEFAULT NULL)` | `bigint` | service_role only | Create a confirmed order directly from priced job lines as `job_lines` quotes them, without an AR. |
| `create_order(p_supplier_id bigint, p_items jsonb, p_fulfillment_method text DEFAULT NULL, p_fulfillment_date date DEFAULT NULL, p_note_for_supplier text DEFAULT NULL, p_customer_confirmed boolean DEFAULT false, p_note_for_customer text DEFAULT NULL)` | `bigint` | service_role only | Create a confirmed order from answered, priced availability lines and allocations. |
| `delete_job_request(p_job_request_id bigint)` | `jsonb` | service_role only | Hard-delete a job; returns counts of removed related rows. |
| `delete_candidate(p_candidate_id bigint)` | `void` | service_role only | Soft-delete a candidate (not a line's default); lines selecting it return to their default. |
| `delete_job_request_item(p_job_request_id bigint, p_job_request_item_id bigint)` | `jsonb` | service_role only | Hard-delete a job line and its unasked candidates (asked ones stay on their AR); returns counts or null. |
| `delete_order_item(p_order_id bigint, p_order_item_id bigint)` | `boolean` | service_role only | Hard-delete an open order line; delete the order too if empty; returns success. |
| `link_thread(p_agent text, p_thread_id text)` | `bigint` | public | Upsert and return a thread ID for an agent/thread pair. |
| `normalize_plant_key(txt text)` | `text` | public | Normalize plant identity to lowercase letters. |
| `normalize_search_text(txt text)` | `text` | public | Normalize search text and token boundaries. |
| `normalize_size(s text)` | `text` | public | Canonicalize a size string; callers apply it explicitly. |
| `plant_photo_document(name text, size text, caption text, tags text[], notes text)` | `text` | public | Build indexed search text for a photo. |
| `plant_photo_reclaimable(older_than_days integer DEFAULT 30)` | `table (projection below)` | anon, authenticated, service_role | List unreferenced old photo objects for review. |
| `record_job_workflow_event(p_job_request_id bigint, p_event text)` | `text` | service_role only | Apply a guarded job workflow event; returns the resulting status. |
| `release_candidate_offer(p_candidate_id bigint)` | `void` | service_role only | Drop an answer's substitute: reset a picked one (off the AR) or retire a typed one; clear the offer (0130 helper). |
| `reopen_availability_request(p_request_id bigint)` | `void` | service_role only | Submitted/Processing → New, or Closed → New on an open job (a link for non-Partners); never automatic (0130). |
| `reserve_job_request_id()` | `bigint` | service_role only | Reserve and return the next job request ID. |
| `search_inventory(search text DEFAULT '', fuzzy_ratio real DEFAULT 0.34)` | `table (projection below)` | public | Rank inventory matches. |
| `search_plant_photos(search text DEFAULT '', fuzzy_ratio real DEFAULT 0.34)` | `table (projection below)` | public | Rank photo matches. |
| `send_availability_request(p_request_id bigint)` | `bigint` | service_role only | Send a draft AR with at least one candidate: status `new`, a public link for non-Partners. |
| `select_candidate(p_job_request_item_id bigint, p_candidate_id bigint)` | `void` | service_role only | Point an open line at one of its active, visible candidates (nothing is copied). |
| `search_suppliers(search text DEFAULT '', category_filter text DEFAULT NULL, fuzzy_ratio real DEFAULT 0.34, sort_column text DEFAULT NULL, sort_direction text DEFAULT NULL)` | `table (projection below)` | public | Search and sort active suppliers. |
| `submit_availability_request_note(p_request_id bigint, p_supplier_id bigint, p_note text)` | `bigint` | service_role only | Submit an AR and save its supplier-wide note (max 10,000 chars). |
| `submit_public_availability_note(p_token uuid, p_note text)` | `bigint` | service_role only | Resolve public token, then submit AR and save supplier-wide note. |
| `unselect_candidate(p_job_request_item_id bigint)` | `void` | service_role only | Return an open line's selection to its default candidate. |
| `update_job_line(p_item_id bigint, p_changes jsonb)` | `void` | service_role only | LPS edit of a line's status, price, available quantity or customer note, written to its selected candidate (0130), and of its shown size and name (0133). |
| `update_partner_order(p_order_id bigint, p_supplier_id bigint, p_patch jsonb)` | `bigint` | service_role only | Apply guarded supplier order status/date/method/note patch. |
| `update_partner_order_item(p_order_id bigint, p_supplier_id bigint, p_order_item_id bigint, p_status text)` | `bigint` | service_role only | Change an active order line procurement status for its supplier. |

JSON inputs and behavior:

- `search_inventory`: empty input returns no rows. Outer straight double quotes
  select literal, case-insensitive name substring matching; unquoted input
  searches name, size and notes with alias expansion and relevance ranking,
  and returns only rows scoring at least half the best row (0118).
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
  on an original keeps its offered substitute or is refused; leaving
  Unavailable releases the substitute. `size` and `name` (0133; string or
  null, may be combined with the other keys): a blank size is NULL, a blank
  or null name raises "Plant name is required". On an original selection they
  are written to the line's ask (`job_request_items.size` / `name`) and to the
  candidate; on a substitute only to the candidate (the line keeps the
  customer's requested size and name). A substitute's name edit rebuilds its
  `description` from its size and name (a substitute's description is what a
  quote prints). Otherwise a description equal to "<old size> <old name>"
  (case-insensitive) is regenerated from the new values; one starting
  "<old size> " has that size swapped on a size edit and keeps its own text;
  any other custom one is kept. A rebuilt description never repeats a size
  the name already starts with (a typed substitute named "15 G Oak"). `demanded_quantity` and `note_internal` stay
  plain `job_request_items` edits.
- `create_order.p_items`: `[{candidate_id,
  allocations: [{job_request_item_id, quantity}]}]` — the allocation must be the
  candidate's own job line. The candidate is validated, snapshotted and linked
  (`order_items.candidate_id`, 0135); `order_items` stores no AR pointer. Related
  ARs are derived through the job lines' candidates and the order supplier. Existing same-supplier allocations, including
  direct orders, consume each related AR's job/supply limits. A source must
  be answered (not NULL or `unavailable`) and priced (not NULL or 0, so an
  unenriched typed substitute is refused); its order status is `need_to_order`
  for `can_order`, `diff_size_sub` for an available/partial non-original, else
  its status.
  `create_direct_order.p_items`: entries contain
  `job_request_item_id` and positive `quantity`; a line `job_lines` shows
  unpriced is refused. Both require
  `p_customer_confirmed = true` and cannot exceed remaining job demand.
- `update_partner_order.p_patch`: `status`, `fulfillment_method`,
  `fulfillment_date`, `note_for_supplier`. Status advances
  `new` → `processing` → `order_ready`; Processing and Ready require a date.
  `update_partner_order_item.p_status` accepts `pending`, `available`,
  `partial_qty`, `unavailable`, `diff_size_sub`, `need_to_order`, `arriving_soon`
  (the old `diff_size_qty_sub` is stored as `diff_size_sub`).
  `close_order.p_status` accepts `closed_won` or `closed_lost`.
- `record_job_workflow_event.p_event` accepts `pricing_fetched`,
  `availability_sent`, `quote_shared`, `customer_confirmed`,
  `supplier_confirmed`. `reserve_job_request_id()` advances the ID sequence
  without inserting a row.

Table-returning RPC columns:

- `search_inventory`: `id`, `name`, `common_name`, `botanical_name`, `cultivar_variety_trade_name`, `cultivar_keys`, `size`, `size_std`, `unit_price`, `quantity`, `supplier_id`, `image_url`, `notes`, `internal_notes`, `height`, `width`, `caliper`, `is_active`, `source_id`, `source`, `created_at`, `updated_at`, `supplier_name`, `supplier_category`, `supplier_state`, `supplier_city`, `height_std`, `width_std`, `caliper_std`, `relevance`.
- `search_suppliers`: `id`, `name`, `address`, `city`, `state`, `zip`, `primary_contact_name`, `primary_contact_email`, `primary_contact_phone`, `website`, `latitude`, `longitude`, `notes`, `category`, `created_at`, `updated_at`, `availability_source_type`, `availability_update_days`, `hosted_availability_url`, `is_lps_partner`.
- `search_plant_photos`: `id`, `storage_bucket`, `storage_path`, `mime_type`, `byte_size`, `image_width`, `image_height`, `sha256`, `supplier_id`, `supplier_name`, `supplier_category`, `supplier_city`, `supplier_state`, `name`, `name_key`, `common_name`, `botanical_name`, `cultivar_variety_trade_name`, `cultivar_keys`, `size`, `size_std`, `height`, `width`, `caliper`, `tags`, `caption`, `notes`, `source`, `captured_at`, `is_active`, `created_at`, `updated_at`, `relevance`.
- `plant_photo_reclaimable`: `object_name`, `reason`, `age_days`, `byte_size`, `photo_id`, `photo_name`.

### Public order links (migration 0114, applied 2026-09-23)

`orders.public_token uuid UNIQUE` is nullable (private by default). The
`guard_order_public_link` trigger clears it for closed/inactive orders and rejects
publication for inactive suppliers. No anonymous table or RPC grants are added.
