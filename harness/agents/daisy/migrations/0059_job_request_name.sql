-- 0059_job_request_name.sql
-- Applied 2026-08-18 via the Supabase MCP at Bhoumik's request, one step
-- recorded in the Supabase history as `job_request_name`.
--
-- One column: `job_requests.name` — what a job is called.
--
-- WHY. A request has been addressable only as `JR-<id>` and by whose it is.
-- That is enough to look one up and not enough to recognize one: a customer
-- with three open requests gives a card list three identical-looking heads,
-- and a person talking about "the Riverbend planting" has to translate it into
-- a number first. The name is the handle people already use out loud.
--
-- Nullable, and deliberately not defaulted. A name is a judgement about the
-- job — rosie writes one at intake and a person can retype it — and a
-- generated stand-in ("Request 12") would be worse than an empty slot, because
-- it looks like someone named it. The UI falls back to `JR-<id>`, which is the
-- true name of an unnamed request.
--
-- No backfill: `job_requests` was empty when this was applied.

ALTER TABLE public.job_requests
  ADD COLUMN IF NOT EXISTS name text;

COMMENT ON COLUMN public.job_requests.name IS
  'Human-readable name for the job — what it gets called out loud ("Riverbend patio planting"). NULL = unnamed, which the UI renders as JR-<id>. Written by rosie at intake and editable in the app; never generated from the id.';

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------ post-apply --
-- Verified 2026-08-18: column present, nullable, no default; an UPDATE of it
-- writes one `job_request_changelog` row naming only `name` (the 0055 trigger
-- diffs `to_jsonb(NEW)`, so it picked the new column up with no change); the
-- app's PATCH whitelist accepts it and PostgREST exposes it after the reload.
