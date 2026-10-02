# Supabase schema

Live `public` catalog for project `xyeyiqchadfszewztnrf` (2026-09-23; 0121–0124 changes 2026-09-30).
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

Trigger `availability_requests_apply_selected`: when an AR is submitted, each
of its candidates answered since the previous submission takes its supplier
reply as `note_for_customer`, then every open (Quote/Availability) job line
selecting one is re-applied (see `job_request_items`).

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

One AR per job (migration 0119 replaced `availability_request_jobs`):
`job_request_id` is NULL only for history kept after its job was deleted, and
all its candidates belong to that job's lines. Inserting a Partner supplier's
AR records the job's `availability_sent` event when it is sent (`availability_requests_progress`);
closing the job closes its ARs.
ARs cannot be deleted or truncated (0127 database guards); the header has no
`is_active` deletion flag. Former inactive headers become private Draft history
with revoked tokens, retaining all answers and associations. Whole-job deletion
closes its ARs and retains their supplier snapshots.
Published requests can return to `draft`, immediately revoking their public link.
LPS content edits (header note/disclosure, candidate details/answers/notes,
additions and removals, selected-line edits) reset published requests to `new`
and clear `submitted_at`. Draft preparation stays Draft; closed history stays
closed. `edit_availability_request` is the service-only admin answer RPC, using
the same answer validation and substitute handling with Draft support. Supplier
RPCs still refuse Draft and advance to Processing/Completed. Submission-derived
note and line synchronization does not reset the request to New.
Job reopening never reopens an AR automatically.

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
- `candidates_job_request_item_id_fkey`: `FOREIGN KEY (job_request_item_id) REFERENCES job_request_items(id) ON DELETE SET NULL`
- `candidates_mapped_inventory_id_fkey`: `FOREIGN KEY (mapped_inventory_id) REFERENCES inventory(id) ON DELETE SET NULL`
- `candidates_pkey`: `PRIMARY KEY (id)`
- `candidates_offered_candidate_id_fkey`: `FOREIGN KEY (offered_candidate_id) REFERENCES candidates(id) ON DELETE SET NULL`
- `candidates_offer_not_self`: `CHECK ((offered_candidate_id IS DISTINCT FROM id))`
- `candidates_offer_quantity_check`, `candidates_offer_unit_price_check`: `>= 0` and finite when set
- `candidates_status_check`: `CHECK (((status IS NULL) OR (status = ANY (ARRAY['available'::text, 'partial_qty'::text, 'can_order'::text, 'diff_size_qty_sub'::text, 'arriving_soon'::text, 'unavailable'::text]))))`
- `candidates_supplier_id_fkey`: `FOREIGN KEY (supplier_id) REFERENCES suppliers(id)`
- `candidates_unit_price_check`: `CHECK (((unit_price IS NULL) OR (unit_price >= (0)::numeric)))`

- `description` says what the candidate is, for Chris (`5 G Shumard Oak`);
  `is_original` marks the line's original request as the customer asked it
  (0120).
- `unit_price` 0 on an unanswered candidate means "price not found"; answering
  Unavailable sets `available_quantity` to 0 and keeps `unit_price` (0122: no
  status changes a price; only an explicit `unit_price` does).
- A candidate is one fixed plant and size (0121). `partial_qty` = fewer than
  demanded. A substitute (answered as Diff Sz/Sub, or Unavailable + one) is
  applied on save (0123): the asked candidate is stored `unavailable`
  (quantity 0, price kept) with `offered_candidate_id`, and
  `apply_candidate_offer` makes the substitute Available (Partial Qty if
  short) on the same AR without reopening it (`lps.applying_offer` skips the
  reopen/processing triggers). A picked tag is another active candidate of the
  same supplier and line; a typed one (`offer_description`) gets a new
  candidate named with the text. Replacing it resets a tag to unanswered or
  retires a typed row; since 0124 a replaced tag also leaves the AR. The
  substitute stays on the AR (`create_order` needs it there), but the app
  lists only the asked row, which reads Diff Sz/Sub. `link_candidate_offer`
  records one by hand. Stored `diff_size_qty_sub` rows are older answers that
  rewrote size and price.
- `hide_from_lps` (0124): a substitute option Rosie adds only for the
  supplier's Unavailable/Sub dialog when the line already has an exact match.
  The sourcing page leaves it out; `apply_candidate_offer` clears it when a
  supplier picks it, for good.
- `note_for_supplier` is LPS's ask; `note_from_supplier` is the supplier's reply
  (the supplier's only writable note). `note_for_customer` is the job line's
  customer note for this candidate (e.g. `3 G NA, only 5 G`).
- Triggers: `candidates_guard` rejects writes to candidates on a closed or
  deleted AR, a supplier that differs from the AR's, and another job's AR;
  `candidates_reopen` returns a processing/submitted
  AR to New when a candidate joins it; `candidates_processing` marks answers.
- A deleted job line deletes its candidates. A deleted job deletes its unasked
  candidates and keeps asked ones (job link NULL) as supplier history.

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

`demanded_quantity` is the customer-requested amount; NULL means unspecified.
`available_quantity` records approved supply. Allocation tables retain `quantity`.

Job and item notes have the same meaning, scoped to the job or line:

- `note_for_customer`: information for the customer only (e.g. `5 G NA, 3 G
  only`, an ETA, why a substitute). Rendered once in **Note for customer**;
  never beneath the plant name. On a line it follows the selected candidate's
  `note_for_customer`.
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
unit_price numeric(10,2)
total numeric(12,2) GENERATED AS ((demanded_quantity * unit_price))
status text NOT NULL DEFAULT 'pending'::text
note_internal text
note_for_customer text
is_active boolean NOT NULL DEFAULT true
created_at timestamptz NOT NULL DEFAULT now()
updated_at timestamptz NOT NULL DEFAULT now()
available_quantity numeric
selected_candidate_id bigint
```

`selected_candidate_id` (0116, renamed in 0119) is the candidate filling this
line; NULL means none. `select_candidate` copies its size, price (0 stays
blank), available quantity capped at demand, computed status (the original
request's answer, `can_order` → `need_to_order`; `alternative_proposed` for a
substitute on offer or any other answered candidate; `pending`/`unavailable`
as answered) and `note_for_customer`. Submission of its AR re-applies it (above). Trigger
`job_request_items_candidate_note` writes an edit of the line's
`note_for_customer` back to the selected candidate.

Constraints:
- `job_request_items_available_quantity_check`: `CHECK (((available_quantity IS NULL) OR (available_quantity >= (0)::numeric)))`
- `job_request_items_job_request_id_fkey`: `FOREIGN KEY (job_request_id) REFERENCES job_requests(id) ON DELETE CASCADE`
- `job_request_items_pkey`: `PRIMARY KEY (id)`
- `job_request_items_selected_candidate_id_fkey`: `FOREIGN KEY (selected_candidate_id) REFERENCES candidates(id) ON DELETE SET NULL`
- `job_request_items_demanded_quantity_check`: `CHECK (((demanded_quantity IS NULL) OR (demanded_quantity > (0)::numeric)))`
- `job_request_items_status_check`: `CHECK ((status = ANY (ARRAY['available'::text, 'partial_qty'::text, 'unavailable'::text, 'alternative_proposed'::text, 'need_to_order'::text, 'arriving_soon'::text, 'pending'::text])))`

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

AR-backed order lines snapshot the candidate's supplier ask and reply (joined) and allocated job items'
merged customer notes (distinct notes joined with blank lines). Direct orders
snapshot the job item's customer note; their supplier note starts NULL. Header
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
```

Constraints:
- `order_items_order_id_fkey`: `FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE`
- `order_items_pkey`: `PRIMARY KEY (id)`
- `order_items_quantity_check`: `CHECK (((quantity > (0)::numeric) AND (quantity < 'Infinity'::numeric)))`
- `order_items_status_check`: `CHECK ((status = ANY (ARRAY['available'::text, 'partial_qty'::text, 'unavailable'::text, 'diff_size_qty_sub'::text, 'need_to_order'::text, 'arriving_soon'::text, 'pending'::text])))`
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
| `add_candidates_to_availability_request(p_request_id bigint, p_candidate_ids bigint[])` | `bigint` | service_role only | Ask unasked candidates of open job lines on an open AR of their supplier. |
| `apply_candidate_offer(p_candidate_id bigint)` | `void` | service_role only | Make an answer's substitute Available on its AR (0121; applied on save since 0123). |
| `answer_availability_request(p_request_id bigint, p_supplier_id bigint, p_item_id bigint DEFAULT NULL, p_changes jsonb DEFAULT NULL, p_submit boolean DEFAULT false)` | `bigint` | service_role only | Save a supplier line answer or submit the request; locks the request. |
| `answer_public_availability(p_token uuid, p_item_id bigint DEFAULT NULL, p_changes jsonb DEFAULT NULL, p_submit boolean DEFAULT false)` | `bigint` | service_role only | Resolve a public token, then save/submit through the same guarded answer path. |
| `close_order(p_order_id bigint, p_status text)` | `bigint` | service_role only | Close an order Won/Lost and update fully covered jobs. |
| `compose_plant_name(common_name text, botanical_name text, cultivar_variety_trade_name text)` | `text` | public | Compose common, botanical and cultivar parts into the display name. |
| `confirm_order(p_order_id bigint, p_supplier_id bigint, p_confirmation_date date DEFAULT current_date, p_fulfillment_date date DEFAULT NULL)` | `bigint` | service_role only | Supplier confirmation through the order lifecycle. |
| `create_availability_request(p_supplier_id bigint, p_candidate_ids bigint[], p_share_customer_details boolean DEFAULT false, p_public_token uuid DEFAULT NULL)` | `bigint` | service_role only | Create a draft AR asking one job's candidates, atomically. |
| `create_direct_order(p_supplier_id bigint, p_items jsonb, p_fulfillment_method text DEFAULT NULL, p_fulfillment_date date DEFAULT NULL, p_note_for_supplier text DEFAULT NULL, p_customer_confirmed boolean DEFAULT false, p_note_for_customer text DEFAULT NULL)` | `bigint` | service_role only | Create a confirmed order directly from quoted job lines, without an AR. |
| `create_order(p_supplier_id bigint, p_items jsonb, p_fulfillment_method text DEFAULT NULL, p_fulfillment_date date DEFAULT NULL, p_note_for_supplier text DEFAULT NULL, p_customer_confirmed boolean DEFAULT false, p_note_for_customer text DEFAULT NULL)` | `bigint` | service_role only | Create a confirmed order from answered availability lines and allocations. |
| `delete_job_request(p_job_request_id bigint)` | `jsonb` | service_role only | Hard-delete a job; returns counts of removed related rows. |
| `delete_candidate(p_candidate_id bigint)` | `void` | service_role only | Soft-delete a candidate (also from its AR) and unselect it; the line keeps its values. |
| `delete_job_request_item(p_job_request_id bigint, p_job_request_item_id bigint)` | `jsonb` | service_role only | Hard-delete a job line and its candidates; returns counts or null. |
| `delete_order_item(p_order_id bigint, p_order_item_id bigint)` | `boolean` | service_role only | Hard-delete an open order line; delete the order too if empty; returns success. |
| `link_thread(p_agent text, p_thread_id text)` | `bigint` | public | Upsert and return a thread ID for an agent/thread pair. |
| `normalize_plant_key(txt text)` | `text` | public | Normalize plant identity to lowercase letters. |
| `normalize_search_text(txt text)` | `text` | public | Normalize search text and token boundaries. |
| `normalize_size(s text)` | `text` | public | Canonicalize a size string; callers apply it explicitly. |
| `plant_photo_document(name text, size text, caption text, tags text[], notes text)` | `text` | public | Build indexed search text for a photo. |
| `plant_photo_reclaimable(older_than_days integer DEFAULT 30)` | `table (projection below)` | anon, authenticated, service_role | List unreferenced old photo objects for review. |
| `record_job_workflow_event(p_job_request_id bigint, p_event text)` | `text` | service_role only | Apply a guarded job workflow event; returns the resulting status. |
| `request_candidate_availability(p_candidate_id bigint)` | `bigint` | service_role only | Add a candidate to its supplier's open (Draft/New/Processing) AR for the job, or a new draft; returns the AR id. |
| `reserve_job_request_id()` | `bigint` | service_role only | Reserve and return the next job request ID. |
| `search_inventory(search text DEFAULT '', fuzzy_ratio real DEFAULT 0.34)` | `table (projection below)` | public | Rank inventory matches. |
| `search_plant_photos(search text DEFAULT '', fuzzy_ratio real DEFAULT 0.34)` | `table (projection below)` | public | Rank photo matches. |
| `send_availability_request(p_request_id bigint)` | `bigint` | service_role only | Send a draft AR with at least one candidate: status `new`, a public link for non-Partners. |
| `link_candidate_offer(p_candidate_id bigint, p_offered_candidate_id bigint)` | `void` | service_role only | Record another candidate as an Unavailable answer's substitute and apply it (0121/0123). |
| `select_candidate(p_job_request_item_id bigint, p_candidate_id bigint)` | `void` | service_role only | Select one of an open line's candidates and copy it onto the line. |
| `search_suppliers(search text DEFAULT '', category_filter text DEFAULT NULL, fuzzy_ratio real DEFAULT 0.34, sort_column text DEFAULT NULL, sort_direction text DEFAULT NULL)` | `table (projection below)` | public | Search and sort active suppliers. |
| `submit_availability_request_note(p_request_id bigint, p_supplier_id bigint, p_note text)` | `bigint` | service_role only | Submit an AR and save its supplier-wide note (max 10,000 chars). |
| `submit_public_availability_note(p_token uuid, p_note text)` | `bigint` | service_role only | Resolve public token, then submit AR and save supplier-wide note. |
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
  `offered_candidate_id`, `offer_description`, `offer_unit_price`,
  `offer_quantity` (no `size` since 0121); blank clears a field. Status
  Unavailable forces the quantity to 0 (never the price, 0122); an answer with
  a substitute is stored `unavailable` and creates or updates the substitute's
  row (0123); `diff_size_qty_sub` is refused without one. Each
  answer stamps `answered_at`.
  `p_submit = true` submits the request. Public variants resolve `p_token`
  before applying the same write. Supplier-note RPCs submit and store a note
  of at most 10,000 characters; blank clears it.
- `create_order.p_items`: `[{candidate_id,
  allocations: [{job_request_item_id, quantity}]}]` — the allocation must be the
  candidate's own job line. The candidate id is used only during creation to
  validate and snapshot an answer; `order_items` stores no AR pointer. Related
  ARs are derived through the job lines' candidates and the order supplier. Existing same-supplier allocations, including
  direct orders, consume each related AR's job/supply limits.
  `create_direct_order.p_items`: entries contain
  `job_request_item_id` and positive `quantity`. Both require
  `p_customer_confirmed = true` and cannot exceed remaining job demand.
- `update_partner_order.p_patch`: `status`, `fulfillment_method`,
  `fulfillment_date`, `note_for_supplier`. Status advances
  `new` → `processing` → `order_ready`; Processing and Ready require a date.
  `update_partner_order_item.p_status` accepts `pending`, `available`,
  `partial_qty`, `unavailable`, `diff_size_qty_sub`, `need_to_order`, `arriving_soon`.
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
