BEGIN;
SET LOCAL lock_timeout = '250ms';
SET LOCAL statement_timeout = '2s';
ALTER TABLE public.suppliers ADD COLUMN short_name text;
COMMENT ON COLUMN public.suppliers.short_name IS
  'Short supplier code, e.g. APS or LPS. Null means none assigned.';
UPDATE public.suppliers SET short_name = 'APS' WHERE name = 'Austin Plant Supply';
UPDATE public.suppliers SET short_name = 'LPS' WHERE name = 'Local Plant Supply';
NOTIFY pgrst, 'reload schema';
COMMIT;
