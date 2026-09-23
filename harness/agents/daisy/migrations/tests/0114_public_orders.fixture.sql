-- Minimal isolated schema for the public-link guard; no production data.
CREATE TABLE public.suppliers (id bigint PRIMARY KEY, is_active boolean NOT NULL);
CREATE TABLE public.orders (id bigint PRIMARY KEY, supplier_id bigint REFERENCES public.suppliers,
  status text NOT NULL, is_active boolean NOT NULL DEFAULT true);
INSERT INTO public.suppliers VALUES (1, true), (2, false);
INSERT INTO public.orders VALUES (1, 1, 'new', true), (2, 1, 'processing', true), (3, 2, 'new', true);
