-- Run after the fixture and migration, in a disposable database ONLY.
BEGIN;
DO $$
DECLARE candidate text; customer_id bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers'
      AND column_name = 'type' AND data_type = 'text'
      AND is_nullable = 'YES' AND column_default IS NULL
  ) THEN RAISE EXCEPTION 'Customer type must be nullable text without a default'; END IF;

  IF EXISTS (
    SELECT 1 FROM customers_before_0090 old
    FULL JOIN public.customers customer USING (id)
    WHERE old.id IS NULL OR customer.id IS NULL
      OR old.snapshot IS DISTINCT FROM (to_jsonb(customer) - 'type')
      OR customer.type IS NOT NULL
  ) THEN RAISE EXCEPTION 'Migration changed or classified an existing customer'; END IF;

  INSERT INTO public.customers (name) VALUES ('New unclassified customer') RETURNING id INTO customer_id;
  IF (SELECT type FROM public.customers WHERE id = customer_id) IS NOT NULL
    THEN RAISE EXCEPTION 'Omitted type must remain NULL'; END IF;

  FOREACH candidate IN ARRAY ARRAY['Homeowner/Retail', 'Landscape Professional'] LOOP
    INSERT INTO public.customers (name, type) VALUES ('Explicit classification', candidate);
    UPDATE public.customers SET type = candidate WHERE id = customer_id;
    IF (SELECT type FROM public.customers WHERE id = customer_id) IS DISTINCT FROM candidate
      THEN RAISE EXCEPTION 'Valid classification did not persist'; END IF;
  END LOOP;
  UPDATE public.customers SET type = NULL WHERE id = customer_id;
  IF (SELECT type FROM public.customers WHERE id = customer_id) IS NOT NULL
    THEN RAISE EXCEPTION 'Clearing type must restore NULL'; END IF;

  FOREACH candidate IN ARRAY ARRAY['', ' ', 'Homeowner', 'Retail', 'homeowner/retail', 'Contractor', 'Landscape Professional '] LOOP
    BEGIN
      INSERT INTO public.customers (name, type) VALUES ('Invalid classification', candidate);
      RAISE EXCEPTION 'Accepted invalid inserted type: %', candidate;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
      UPDATE public.customers SET type = candidate WHERE id = customer_id;
      RAISE EXCEPTION 'Accepted invalid updated type: %', candidate;
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
END $$;
ROLLBACK;
