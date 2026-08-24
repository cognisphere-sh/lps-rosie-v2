-- 0072: reserve_job_request_id() — take the next job request id without
-- creating the row. Applied 2026-08-24 (Bhoumik, via Supabase MCP).
--
-- A job request's conversation is named after its row (`jr-<id>`), and rosie
-- writes the row from that conversation — so the app's New job request button
-- needs the id before there is anything to take it from. This is `nextval` on
-- the identity sequence and nothing else: no row, no side effect, and an
-- abandoned start leaves a gap in the numbering, which is what a sequence is
-- for. `job_requests.id` is GENERATED ALWAYS, so the row rosie inserts against
-- a reserved id names it explicitly with OVERRIDING SYSTEM VALUE.
--
-- Only `service_role` may call it — the app holds that key, and no anonymous
-- caller should be able to burn ids.

CREATE OR REPLACE FUNCTION public.reserve_job_request_id()
RETURNS bigint
LANGUAGE sql
VOLATILE
AS $$ SELECT nextval('public.job_requests_id_seq'); $$;

COMMENT ON FUNCTION public.reserve_job_request_id() IS
  'Takes the next job_requests id without inserting a row, so a request''s jr-<id> conversation can be named before rosie writes the row from it (app: POST /api/requests/reserve). An unused id is a gap in the sequence, by design.';

REVOKE ALL ON FUNCTION public.reserve_job_request_id() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_job_request_id() TO service_role;
