-- 0073: drop customers.communication_notes — the customer contact log.
-- Applied 2026-08-25 (Bhoumik, via Supabase MCP).
--
-- The same move the supplier side made in 0063/0066: a contact log kept as
-- append-only prose on the row duplicates the conversation it describes. Every
-- customer now has a dedicated rosie thread (`customers.rosie_thread_id`,
-- migration 0068), reachable from the customer page's Rosie button, and that
-- transcript IS the contact history. `customers.notes` keeps its half — the
-- durable facts and preferences, edited in place.
--
-- No backup table, unlike 0063/0066: the column was NULL on every row of the
-- table at apply time (2 customers, 0 with any text), so there is nothing to
-- archive.

ALTER TABLE public.customers DROP COLUMN communication_notes;
