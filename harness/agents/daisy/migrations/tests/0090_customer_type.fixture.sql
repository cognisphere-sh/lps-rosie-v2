-- Disposable database ONLY: the relevant pre-migration customer shape.
CREATE TABLE public.customers (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  company text,
  is_active boolean NOT NULL DEFAULT true
);
INSERT INTO public.customers (name, company) VALUES
  ('Existing person', NULL), ('Existing company contact', 'Example Landscapes');
CREATE TEMP TABLE customers_before_0090 AS
  SELECT id, to_jsonb(customer) AS snapshot FROM public.customers customer;
