-- 0011: preserve missing supplier prices as NULL
-- Approved by Bhoumik, 2026-08-04.
--
-- NULL means the supplier did not provide a price. A positive numeric value is
-- a printed supplier price. This migration intentionally does not rewrite any
-- legacy zero rows: whether a historical zero means missing or a genuine
-- printed zero requires source-level review.

ALTER TABLE public.inventory
  ALTER COLUMN unit_price DROP NOT NULL;

COMMENT ON COLUMN public.inventory.unit_price IS
  'USD supplier unit price. NULL means no price was provided; do not coerce missing prices to zero.';
