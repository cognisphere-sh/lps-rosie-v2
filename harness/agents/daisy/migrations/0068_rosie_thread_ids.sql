-- 0068: rosie_thread_id on suppliers and customers — rosie's dedicated
-- coordination threads (order-side), mirroring daisy_thread_id (0064).
-- Applied 2026-08-23 (Bhoumik, via Supabase MCP).
--
-- Rosie's restructure gives her one thread per supplier and one per customer
-- for all order coordination. Supplier values are the same supplier-<slug>
-- strings daisy uses — thread ids are namespaced per agent, so the shared
-- string names two distinct threads and stays consistent for humans reading
-- either agent's workspace. Customer threads are customer-<slug of name>
-- ('-<id>' appended on collision), minted by rosie on first contact.
--
-- Backfill result: suppliers copied from daisy_thread_id (1,395 rows);
-- customers table was empty on apply, so no backfill.

ALTER TABLE public.suppliers ADD COLUMN rosie_thread_id text;

COMMENT ON COLUMN public.suppliers.rosie_thread_id IS
  'Rosie''s dedicated harness thread for this supplier''s company — same supplier-<slug> value as daisy_thread_id (thread ids are per-agent, so the shared string names two distinct threads). One per head branch, every location row shares it. Rosie coordinates all order-side supplier contact there: availability requests, follow-ups, portal submissions.';

-- Same value as daisy's: the slug is per company, the namespace is per agent.
UPDATE public.suppliers SET rosie_thread_id = daisy_thread_id
WHERE daisy_thread_id IS NOT NULL;

ALTER TABLE public.customers ADD COLUMN rosie_thread_id text;

COMMENT ON COLUMN public.customers.rosie_thread_id IS
  'Rosie''s dedicated harness thread for this customer — customer-<slug of name> (''-<id>'' appended on collision with a different customer). One conversation per customer across all their job requests. Set by rosie when she first coordinates with the customer.';

-- No customer backfill: the table is empty on apply (2026-08-23).
