-- Optional customer classification. Existing customers remain unclassified.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.customers
  ADD COLUMN type text
    CONSTRAINT customers_type_check
    CHECK (type IN ('Homeowner/Retail', 'Landscape Professional'));

COMMENT ON COLUMN public.customers.type IS
  'Optional customer classification: Homeowner/Retail or Landscape Professional. NULL means unknown; no default or inferred classification.';

NOTIFY pgrst, 'reload schema';
COMMIT;
