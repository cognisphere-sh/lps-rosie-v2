-- 0013: convert historical missing-price placeholders from zero to NULL
-- Approved by Bhoumik, 2026-08-04.
--
-- This is a one-time cleanup of legacy rows. Future numeric zeroes remain valid
-- only when a supplier explicitly prints zero; absent prices must be NULL.

UPDATE public.inventory
SET unit_price = NULL
WHERE unit_price = 0;
