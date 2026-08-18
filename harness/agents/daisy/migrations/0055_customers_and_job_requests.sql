-- 0055_customers_and_job_requests.sql
-- Applied 2026-08-17 via the Supabase MCP at Bhoumik's request, one step
-- recorded in the Supabase history as `customers_and_job_requests`.
--
-- The customer side of the business: who asks for plants, and what they asked
-- for. Four tables — `customers`, `job_requests`, `job_request_items` and the
-- trigger-written `job_request_changelog`. These tables are owned by the new
-- `rosie` agent (this file lives in daisy's `migrations/` only because that
-- directory is the deployment's single sequential migration record). The app's
-- "Job Requests" UI is designed but deliberately not built yet; nothing here
-- waits on it.
--
-- WHAT THIS IS SHAPED FOR
--   * A request may be ANONYMOUS: `customer_id` is nullable and the FK is
--     SET NULL, so a request received before we know who sent it is a real row
--     that gets mapped to a customer later by a plain UPDATE.
--   * The tables are edited CONCURRENTLY by the app's users and by rosie, so
--     every change to a request or an item is audited by one AFTER trigger
--     into `job_request_changelog`. The trigger sees both write paths without
--     either needing to cooperate; a writer that wants to be named sets the
--     `app.actor` GUC first, and an unnamed writer is still distinguishable by
--     role (`postgres` = agent scripts, `service_role` = the app).
--   * `closed_won` is the future convert-to-order hook. Order tables (one
--     customer-side, possibly several supplier-side) are deferred; no column
--     here anticipates them.
--
-- DELIBERATE OMISSIONS
--   * `customers` keeps contact routes inline (name/company/email/phone), not
--     the `contacts` + link-table shape suppliers use — a job request comes
--     from a person, and the link-table split can be introduced by migration
--     if multi-contact customers ever appear.
--   * `job_request_items.size` is the customer's verbatim ask ("30 gal or
--     larger"), evidence rather than classification — so no `size_std` and no
--     copy of the inventory size CHECK to keep in sync.
--   * No deactivation-cascade triggers (the suppliers/inventory pattern):
--     retiring a customer or a request is a rare, deliberate, Chris-approved
--     act, not something one UPDATE should fan out.
--   * `archived` is a terminal *status*; `is_active` stays the soft-delete
--     flag, per house convention. Status spellings use underscores
--     (`closed_won`, `closed_lost`) to match `chat_sessions.status`.

-- ---- customers -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- The person. Company is separate and optional.
  name text NOT NULL,
  company text,
  email text,
  phone text,

  address text,
  city text,
  state text,
  zip text,

  -- Same split suppliers carry: durable facts edited in place vs an
  -- append-only, timestamped contact log.
  notes text,
  communication_notes text,

  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.customers IS
  'One row per customer (the person; company is an attribute). Contact routes are inline, unlike suppliers. Owned by the rosie agent.';
COMMENT ON COLUMN public.customers.notes IS
  'Durable facts about the customer, edited in place.';
COMMENT ON COLUMN public.customers.communication_notes IS
  'Append-only contact log, timestamped entries — same convention as suppliers.communication_notes. Never rewritten.';

CREATE INDEX IF NOT EXISTS customers_active_created_idx
  ON public.customers (is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS customers_email_idx
  ON public.customers (email) WHERE email IS NOT NULL;

-- ---- job_requests ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Nullable: an anonymous request is a real request. Mapped to a customer
  -- later by UPDATE; SET NULL rather than CASCADE so retiring a customer row
  -- can never silently take requests with it.
  customer_id bigint REFERENCES public.customers(id) ON DELETE SET NULL,

  status text NOT NULL DEFAULT 'sourcing'
    CONSTRAINT job_requests_status_check CHECK (status IN
      ('sourcing', 'quoted', 'closed_won', 'closed_lost', 'archived')),

  -- How rosie (or anyone) surfaces a request for human eyes. The UI will read
  -- it; the why belongs in internal_notes, appended in the same change.
  needs_attention boolean NOT NULL DEFAULT false,

  billing_address text,
  billing_city text,
  billing_state text,
  billing_zip text,
  shipping_address text,
  shipping_city text,
  shipping_state text,
  shipping_zip text,

  -- Three audiences, three columns. customer_notes is the customer's words —
  -- evidence, theirs, never edited. internal_notes is ours and append-only.
  -- external_notes is written to be shown to the customer.
  customer_notes text,
  internal_notes text,
  external_notes text,

  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.job_requests IS
  'One row per customer job request. customer_id is nullable (anonymous intake, mapped later). closed_won is the future convert-to-order hook. Owned by the rosie agent.';
COMMENT ON COLUMN public.job_requests.customer_notes IS
  'What the customer sent, verbatim. Theirs — never edited.';
COMMENT ON COLUMN public.job_requests.internal_notes IS
  'Ours. Append-only, timestamped entries; never rewritten.';
COMMENT ON COLUMN public.job_requests.external_notes IS
  'Written to be shared with the customer.';

CREATE INDEX IF NOT EXISTS job_requests_customer_idx
  ON public.job_requests (customer_id, is_active);
CREATE INDEX IF NOT EXISTS job_requests_status_idx
  ON public.job_requests (status) WHERE is_active;
CREATE INDEX IF NOT EXISTS job_requests_attention_idx
  ON public.job_requests (needs_attention) WHERE needs_attention AND is_active;

-- ---- job_request_items -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_request_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_request_id bigint NOT NULL
    REFERENCES public.job_requests(id) ON DELETE CASCADE,

  -- The plant as the customer asked for it, and the size as they said it.
  -- Verbatim evidence — matching against inventory happens downstream.
  name text NOT NULL,
  size text,

  quantity numeric
    CONSTRAINT job_request_items_quantity_check
    CHECK (quantity IS NULL OR quantity > 0),

  -- NULL = not priced yet. Never 0 — same rule as inventory.unit_price.
  unit_price numeric(10,2),

  -- Derived, therefore generated. Under concurrent UI + agent edits a
  -- hand-written total would drift; this one cannot. NULL until both parts
  -- exist.
  total numeric(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,

  status text NOT NULL DEFAULT 'pending'
    CONSTRAINT job_request_items_status_check CHECK (status IN
      ('pending', 'sourcing', 'available', 'alternative_proposed',
       'unavailable', 'confirmed', 'cancelled')),

  needs_attention boolean NOT NULL DEFAULT false,

  customer_notes text,
  internal_notes text,
  external_notes text,

  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.job_request_items IS
  'One row per line item on a job request. name/size are the customer''s verbatim ask. Owned by the rosie agent.';
COMMENT ON COLUMN public.job_request_items.total IS
  'Generated (quantity * unit_price) — never write it.';
COMMENT ON COLUMN public.job_request_items.unit_price IS
  'Quoted price per unit. NULL = not priced yet; never 0.';
COMMENT ON COLUMN public.job_request_items.internal_notes IS
  'Sourcing log: which supplier may have it, availability, pricing. Append-only, timestamped entries.';
COMMENT ON COLUMN public.job_request_items.external_notes IS
  'Customer-visible notes. Quantity changes and substitutions MUST be explained here in the same change that makes them.';

CREATE INDEX IF NOT EXISTS job_request_items_request_idx
  ON public.job_request_items (job_request_id, is_active);
CREATE INDEX IF NOT EXISTS job_request_items_status_idx
  ON public.job_request_items (status) WHERE is_active;
CREATE INDEX IF NOT EXISTS job_request_items_attention_idx
  ON public.job_request_items (needs_attention) WHERE needs_attention AND is_active;

-- ---- job_request_changelog -------------------------------------------------
-- The audit trail. Written ONLY by the trigger below — no writer can forget
-- it and no writer may insert into it directly. Rows are immutable: no
-- updated_at, no is_active, and nothing ever edits them.
CREATE TABLE IF NOT EXISTS public.job_request_changelog (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_request_id bigint NOT NULL
    REFERENCES public.job_requests(id) ON DELETE CASCADE,
  -- NULL = a request-level entry; set = an entry about that line item.
  item_id bigint
    REFERENCES public.job_request_items(id) ON DELETE CASCADE,

  -- coalesce(app.actor GUC, current_user). Agent sessions that set the GUC
  -- are named ('rosie'); otherwise the role still separates agent scripts
  -- ('postgres') from the app ('service_role').
  actor text NOT NULL,

  action text NOT NULL
    CONSTRAINT job_request_changelog_action_check
    CHECK (action IN ('insert', 'update')),

  -- On insert: the row's non-null fields. On update: {col: {"old":…,"new":…}}
  -- for every changed column except updated_at.
  changes jsonb NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.job_request_changelog IS
  'Trigger-written audit trail for job_requests and job_request_items. Immutable rows; never insert or edit directly. Read the newest entries alongside the row they describe.';
COMMENT ON COLUMN public.job_request_changelog.actor IS
  'coalesce(current_setting(''app.actor'', true), current_user). Set the app.actor GUC at the start of a session to be named here.';

CREATE INDEX IF NOT EXISTS job_request_changelog_request_idx
  ON public.job_request_changelog (job_request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS job_request_changelog_item_idx
  ON public.job_request_changelog (item_id, created_at DESC)
  WHERE item_id IS NOT NULL;

-- One function for both tables; TG_TABLE_NAME tells it which shape it got.
-- AFTER, so generated columns (total) appear in diffs with their real values.
CREATE OR REPLACE FUNCTION public.log_job_request_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  req_id bigint;
  itm_id bigint;
  diff jsonb;
BEGIN
  IF TG_TABLE_NAME = 'job_request_items' THEN
    req_id := NEW.job_request_id;
    itm_id := NEW.id;
  ELSE
    req_id := NEW.id;
    itm_id := NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
      INTO diff
    FROM jsonb_each(to_jsonb(NEW))
    WHERE key NOT IN ('created_at', 'updated_at')
      AND value <> 'null'::jsonb;
  ELSE
    SELECT coalesce(jsonb_object_agg(key,
             jsonb_build_object('old', o.value, 'new', n.value)), '{}'::jsonb)
      INTO diff
    FROM jsonb_each(to_jsonb(NEW)) AS n
    JOIN jsonb_each(to_jsonb(OLD)) AS o USING (key)
    WHERE key <> 'updated_at'
      AND n.value IS DISTINCT FROM o.value;
    -- A no-op UPDATE (or one that only touched updated_at) is not history.
    IF diff = '{}'::jsonb THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO public.job_request_changelog
    (job_request_id, item_id, actor, action, changes)
  VALUES
    (req_id, itm_id,
     coalesce(nullif(btrim(coalesce(current_setting('app.actor', true), '')), ''),
              current_user),
     lower(TG_OP), diff);
  RETURN NULL;
END;
$function$;

COMMENT ON FUNCTION public.log_job_request_changes() IS
  'AFTER INSERT OR UPDATE on job_requests and job_request_items: records the change (full non-null row on insert, old/new diff on update) into job_request_changelog with the app.actor GUC or current_user as the actor.';

DROP TRIGGER IF EXISTS trg_job_requests_changelog ON public.job_requests;
CREATE TRIGGER trg_job_requests_changelog
  AFTER INSERT OR UPDATE ON public.job_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_job_request_changes();

DROP TRIGGER IF EXISTS trg_job_request_items_changelog ON public.job_request_items;
CREATE TRIGGER trg_job_request_items_changelog
  AFTER INSERT OR UPDATE ON public.job_request_items
  FOR EACH ROW EXECUTE FUNCTION public.log_job_request_changes();

-- ---- updated_at ------------------------------------------------------------
DROP TRIGGER IF EXISTS handle_updated_at ON public.customers;
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');

DROP TRIGGER IF EXISTS handle_updated_at ON public.job_requests;
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.job_requests
  FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');

DROP TRIGGER IF EXISTS handle_updated_at ON public.job_request_items;
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.job_request_items
  FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');

-- ---- RLS -------------------------------------------------------------------
-- Same shape as every application table: `anon` reaches nothing,
-- `authenticated` has full access, the app's secret key and the agents'
-- `postgres` role bypass it. The changelog gets the same policy — its
-- insert-protection is that only the trigger writes it in practice, not RLS.
ALTER TABLE public.customers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_requests           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_request_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_request_changelog  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated full access" ON public.customers;
CREATE POLICY "authenticated full access" ON public.customers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated full access" ON public.job_requests;
CREATE POLICY "authenticated full access" ON public.job_requests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated full access" ON public.job_request_items;
CREATE POLICY "authenticated full access" ON public.job_request_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated full access" ON public.job_request_changelog;
CREATE POLICY "authenticated full access" ON public.job_request_changelog
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------ post-apply --
-- Verified 2026-08-17 (all test rows removed afterwards):
--   * anonymous insert (customer_id NULL) works; mapping later by UPDATE works
--   * bad status and quantity = 0 rejected by their CHECKs
--   * total generated (10 × 24.50 = 245.00), NULL while unpriced, and a
--     direct write to it fails
--   * UPDATE bumps updated_at and writes one changelog row whose jsonb diff
--     names exactly the changed columns (old/new); a no-op UPDATE writes none
--   * SET app.actor TO 'rosie' shows up as the changelog actor; unset falls
--     back to the connecting role
--   * newest-first LIMIT 5 fetch per request and per item returns as expected
