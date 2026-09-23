-- Remove objects with no callers in the current app, agent scripts/skills,
-- database functions, triggers, policies or retained views.
-- Deliberately use RESTRICT: an unexpected dependency must abort the cleanup.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DROP VIEW IF EXISTS public.rate_charts RESTRICT;
DROP FUNCTION IF EXISTS public.execute_readonly_query(text) RESTRICT;
DROP FUNCTION IF EXISTS public.normalize_identity_token_key(text) RESTRICT;
DROP FUNCTION IF EXISTS public.advance_job_on_partner_request() RESTRICT;

DROP TABLE IF EXISTS public.availability_queries RESTRICT;
DROP TABLE IF EXISTS public.custom_commands RESTRICT;
DROP TABLE IF EXISTS public.chat_sessions RESTRICT;
DROP TABLE IF EXISTS public.users RESTRICT;

-- Remove the obsolete dated snapshots.
DROP TABLE IF EXISTS backup_20260814.inventory RESTRICT;
DROP TABLE IF EXISTS backup_20260814.inventory_sources RESTRICT;
DROP TABLE IF EXISTS backup_20260814.plant_aliases RESTRICT;
DROP SCHEMA IF EXISTS backup_20260814 RESTRICT;

DROP TABLE IF EXISTS backup_20260826.availability_request_items RESTRICT;
DROP TABLE IF EXISTS backup_20260826.availability_requests RESTRICT;
DROP TABLE IF EXISTS backup_20260826.customers RESTRICT;
DROP TABLE IF EXISTS backup_20260826.job_request_changelog RESTRICT;
DROP TABLE IF EXISTS backup_20260826.job_request_items RESTRICT;
DROP TABLE IF EXISTS backup_20260826.job_requests RESTRICT;
DROP TABLE IF EXISTS backup_20260826.rosie_thread_messages RESTRICT;
DROP SCHEMA IF EXISTS backup_20260826 RESTRICT;

NOTIFY pgrst, 'reload schema';
COMMIT;
