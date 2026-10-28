-- 0153 — favourite suppliers (2026-10-28)
--
-- (Bhoumik 2026-10-28) "on /suppliers page add a heart button to add
-- suppliers to favourite. Always show favourite suppliers on top. Even in
-- plant search."
-- * suppliers.is_favorite boolean NOT NULL DEFAULT false. Set on the company
--   (head branch) row; it covers every farm of that company. One flag for the
--   whole LPS team, not per user (there is one admin login).
-- * The app orders by it; no RPC changes (search_suppliers and
--   search_inventory are untouched).
-- Rollback: ALTER TABLE public.suppliers DROP COLUMN is_favorite;
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.suppliers ADD COLUMN is_favorite boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.suppliers.is_favorite IS
  'LPS favourite, set on the company (head branch) row and covering all its farms. The Suppliers page and plant search list favourite companies first.';

COMMIT;
