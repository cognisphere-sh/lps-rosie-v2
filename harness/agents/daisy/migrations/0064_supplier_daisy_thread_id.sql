-- 0064: suppliers.daisy_thread_id — the dedicated daisy harness thread per company.
-- Applied 2026-08-23 (Bhoumik, via Supabase MCP).
--
-- One thread per head branch: every location row carries its head branch's
-- value, so a company's whole conversation — onboarding, availability
-- ingestion, supplier communication — lives on one daisy thread.
--
-- Format: 'supplier-' || slug of the head branch's name (lowercase,
-- non-alphanumeric runs collapsed to '-'), with '-<head id>' appended only
-- when two distinct companies collide on the same slug. The slug (not the id)
-- is what lets the email-router thread mint the same thread id for a brand-new
-- supplier before its row exists; onboarding then writes the id it used into
-- this column.
--
-- Backfill result: 1,395 rows filled, 1,335 distinct threads (= head branches).

ALTER TABLE public.suppliers ADD COLUMN daisy_thread_id text;

COMMENT ON COLUMN public.suppliers.daisy_thread_id IS
  'Daisy''s dedicated harness thread for this supplier''s company — supplier-<slug of head-branch name>. One thread per head branch (every location row shares the head''s value): it onboards the supplier and handles all availability ingestion and communication with them. Set at onboarding; the email router forwards supplier traffic here.';

WITH heads AS (
  SELECT id,
         'supplier-' || NULLIF(trim(both '-' FROM regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), '') AS slug
  FROM public.suppliers
  WHERE head_branch_id = id
), dedup AS (
  SELECT id,
         CASE WHEN count(*) OVER (PARTITION BY slug) > 1 THEN slug || '-' || id ELSE slug END AS thread_id
  FROM heads
  WHERE slug IS NOT NULL
)
UPDATE public.suppliers s
SET daisy_thread_id = d.thread_id
FROM dedup d
WHERE s.head_branch_id = d.id;
