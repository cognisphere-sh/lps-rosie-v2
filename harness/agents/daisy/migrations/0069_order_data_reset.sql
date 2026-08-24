-- 0069: order-data reset — hard delete, no backup (Bhoumik's instruction).
-- Applied 2026-08-23 (Bhoumik, via Supabase MCP), after the rosie restructure
-- and its order-management UI landed: the pre-restructure test data
-- (1 job request with 11 lines and 27 changelog rows, 1 availability request
-- with 11 lines, 0 customers) is cleared so real orders start on the new
-- thread model with clean ids.
--
-- Data-only: no schema change. RESTART IDENTITY resets every id sequence to 1.

TRUNCATE public.availability_request_items,
         public.availability_requests,
         public.job_request_changelog,
         public.job_request_items,
         public.job_requests,
         public.customers
RESTART IDENTITY CASCADE;
