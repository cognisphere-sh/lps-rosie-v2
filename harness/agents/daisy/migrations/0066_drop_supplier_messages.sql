-- 0066: drop the supplier chat transcript (applied 2026-08-23 by Bhoumik via
-- Supabase MCP, part of the agent restructure — the transcript UI left the
-- supplier page and the portal the same day, and the supplier-events plugin
-- that fed it was removed).
--
-- The 213 rows were snapshotted to `supplier_messages_backup_20260823` before
-- the drop (they include the 196 entries migration 0063 lifted out of
-- `suppliers.communication_notes`, which itself remains in place as the
-- frozen pre-0063 archive column). No view, rule, or FK depended on the
-- table. `availability_requests` / `availability_request_items` are untouched.

CREATE TABLE public.supplier_messages_backup_20260823 AS
SELECT * FROM public.supplier_messages;

DROP TABLE public.supplier_messages;
