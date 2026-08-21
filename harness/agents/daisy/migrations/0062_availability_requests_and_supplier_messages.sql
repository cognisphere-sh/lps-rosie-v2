-- 0062_availability_requests_and_supplier_messages.sql
-- Applied 2026-08-19 via the Supabase MCP, one step recorded in the Supabase
-- history as `availability_requests_and_supplier_messages`.
--
-- The supplier side of sourcing a job request. Until now the only way to ask a
-- supplier "do you have these?" was daisy's email; this adds the second way:
-- an in-database availability request that an *onboarded* supplier answers in
-- their own portal view (`/portal/<supplierId>`), plus a per-supplier
-- conversation thread shared by both flavours of supplier.
--
-- Three tables and one flag:
--
-- * `suppliers.is_onboarded` — this supplier answers availability requests in
--   the portal. FALSE (everyone today) = reached only through daisy's
--   channels; their thread lives in `supplier_messages` all the same, logged
--   rather than typed. Portal *credentials* are deliberately absent — auth is
--   a later step (Bhoumik, 2026-08-19); the flag is about the workflow, not
--   the login.
--
-- * `availability_requests` — one ask, from one job request to one supplier.
--   `share_customer_details` decides whether the portal shows who the job is
--   for; default is not to. Status is the request's lifecycle in the
--   supplier's hands: `new` → `submitted` (they pressed Submit; `submitted_at`
--   stamps it) → `closed` (we are done with it).
--
-- * `availability_request_items` — the lines shared with the supplier (one or
--   more of the job request's lines), **snapshotted** at share time: `name`,
--   `size`, `quantity` are copied, not joined, because what we asked a
--   supplier is evidence — a later edit to the job request must not silently
--   rewrite the question they are answering. `job_request_item_id` keeps the
--   traceback (SET NULL so a deleted line doesn't take the supplier's answer
--   with it). The response columns are the supplier's: `status` is NULL until
--   they answer (a dash, never a guess) and is their four-word vocabulary —
--   `available` | `unavailable` | `can_order` (they can get it; ETA in
--   `notes`) | `substitute` (what instead, in `notes`).
--
-- * `supplier_messages` — the back-and-forth between the broker (Chris, or an
--   agent writing as itself) and a supplier. One thread per supplier, oldest
--   first; a message may also point at the job request and/or availability
--   request it is about, so the request view can show just its slice.
--   `channel` says where the exchange actually happened: `app` = typed in the
--   portal or the admin thread, `email` / `text` = happened outside and
--   logged here. Append-only like every conversation log — rows are never
--   edited, so there is no `updated_at` and no soft delete.
--
-- Who writes what: the app creates requests (from the Job Requests page) and
-- the supplier's answers (from the portal); rosie may create requests for
-- onboarded suppliers and reads the answers back into
-- `job_request_items.sourcing_notes`. This is the one sanctioned crack in
-- "rosie never contacts a supplier": the portal is a channel Chris built for
-- exactly this, so writing into it is not cold outreach. Daisy mirrors her
-- outside-app exchanges into `supplier_messages` so the thread is complete.

-- ---- suppliers.is_onboarded -------------------------------------------------
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS is_onboarded boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.suppliers.is_onboarded IS
  'Answers availability requests in the supplier portal. FALSE = reached only through daisy''s channels (email/text), thread still logged in supplier_messages. Not a login — portal auth is a later step.';

-- ---- availability_requests --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.availability_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_request_id bigint NOT NULL REFERENCES public.job_requests(id) ON DELETE CASCADE,
  supplier_id bigint NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  share_customer_details boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'submitted', 'closed')),
  submitted_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.availability_requests IS
  'One availability ask, from one job request to one (onboarded) supplier. The supplier answers per line in availability_request_items and presses Submit.';
COMMENT ON COLUMN public.availability_requests.share_customer_details IS
  'Whether the portal shows the supplier who the job is for (customer name/company and shipping address). Default: it does not.';
COMMENT ON COLUMN public.availability_requests.status IS
  'new = awaiting the supplier; submitted = they pressed Submit (submitted_at stamps it); closed = we are done with it.';

CREATE INDEX IF NOT EXISTS availability_requests_supplier_idx
  ON public.availability_requests (supplier_id, is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS availability_requests_job_request_idx
  ON public.availability_requests (job_request_id, is_active);

-- ---- availability_request_items ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.availability_request_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  availability_request_id bigint NOT NULL
    REFERENCES public.availability_requests(id) ON DELETE CASCADE,
  job_request_item_id bigint
    REFERENCES public.job_request_items(id) ON DELETE SET NULL,
  -- The ask, snapshotted at share time — evidence, not a join.
  name text NOT NULL,
  size text,
  quantity numeric CHECK (quantity IS NULL OR quantity > 0),
  -- The supplier's answer. All NULL until they respond.
  status text
    CHECK (status IS NULL OR status IN ('available', 'unavailable', 'can_order', 'substitute')),
  available_quantity numeric CHECK (available_quantity IS NULL OR available_quantity >= 0),
  unit_price numeric(10,2) CHECK (unit_price IS NULL OR unit_price > 0),
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.availability_request_items IS
  'The lines shared with the supplier, snapshotted (name/size/quantity copied at share time), plus their per-line answer.';
COMMENT ON COLUMN public.availability_request_items.status IS
  'The supplier''s answer: available | unavailable | can_order (ETA in notes) | substitute (what instead, in notes). NULL = not answered yet.';
COMMENT ON COLUMN public.availability_request_items.notes IS
  'The supplier''s note about this line — the substitute they propose, the ETA for can_order, conditions.';

CREATE INDEX IF NOT EXISTS availability_request_items_request_idx
  ON public.availability_request_items (availability_request_id, is_active);

-- ---- supplier_messages --------------------------------------------------------
-- Append-only: no updated_at, no is_active. A conversation is a record of what
-- was said; nothing edits or retires a message.
CREATE TABLE IF NOT EXISTS public.supplier_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  supplier_id bigint NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  job_request_id bigint REFERENCES public.job_requests(id) ON DELETE SET NULL,
  availability_request_id bigint
    REFERENCES public.availability_requests(id) ON DELETE SET NULL,
  sender text NOT NULL CHECK (sender IN ('broker', 'supplier')),
  -- Who on that side: 'Chris', 'Rosie', 'Daisy', or the supplier-side name if
  -- known. NULL when nobody recorded it.
  sender_name text,
  channel text NOT NULL CHECK (channel IN ('email', 'text', 'app')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.supplier_messages IS
  'The broker↔supplier conversation, one thread per supplier. channel: app = typed in the portal/admin thread; email/text = happened outside and logged here. Append-only.';
COMMENT ON COLUMN public.supplier_messages.sender IS
  'Which side spoke: broker (Chris or an agent) or supplier.';
COMMENT ON COLUMN public.supplier_messages.sender_name IS
  'Who on that side — Chris, Rosie, Daisy, or the supplier contact''s name when known.';

CREATE INDEX IF NOT EXISTS supplier_messages_supplier_idx
  ON public.supplier_messages (supplier_id, created_at);
CREATE INDEX IF NOT EXISTS supplier_messages_availability_request_idx
  ON public.supplier_messages (availability_request_id, created_at)
  WHERE availability_request_id IS NOT NULL;

-- ---- updated_at ----------------------------------------------------------------
DROP TRIGGER IF EXISTS handle_updated_at ON public.availability_requests;
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.availability_requests
  FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');

DROP TRIGGER IF EXISTS handle_updated_at ON public.availability_request_items;
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON public.availability_request_items
  FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');

-- ---- RLS -----------------------------------------------------------------------
-- Same shape as every application table: `anon` reaches nothing,
-- `authenticated` has full access, the app's secret key and the agents'
-- `postgres` role bypass RLS. The portal (no supplier auth yet) reads through
-- the app's server-side secret key, never a browser key.
ALTER TABLE public.availability_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supplier_messages          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated full access" ON public.availability_requests;
CREATE POLICY "authenticated full access" ON public.availability_requests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated full access" ON public.availability_request_items;
CREATE POLICY "authenticated full access" ON public.availability_request_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated full access" ON public.supplier_messages;
CREATE POLICY "authenticated full access" ON public.supplier_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------ post-apply --
-- Verified 2026-08-19: all three tables created (13 / 9 / 9 columns),
-- suppliers.is_onboarded present (910 rows, all false), RLS enabled on each
-- with the standard `authenticated full access` policy, updated_at triggers on
-- the two mutable tables. supplier_messages is append-only by convention —
-- no updated_at, no is_active, nothing edits a message.
