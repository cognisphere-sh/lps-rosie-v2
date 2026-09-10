-- Run ONLY in an empty disposable PostgreSQL database, before migration 0082.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE TABLE public.suppliers (id bigint PRIMARY KEY, is_active boolean, is_lps_partner boolean);
CREATE TABLE public.job_requests (id bigint PRIMARY KEY, status text, is_active boolean);
CREATE TABLE public.availability_requests (
 id bigint PRIMARY KEY, job_request_id bigint, supplier_id bigint, is_active boolean DEFAULT true,
 status text DEFAULT 'new', submitted_at timestamptz
);
CREATE TABLE public.availability_request_items (
 id bigint PRIMARY KEY, availability_request_id bigint, is_active boolean DEFAULT true,
 status text CHECK (status IN ('available','unavailable','can_order','diff_size_qty_sub','arriving_soon')),
 available_quantity numeric, unit_price numeric, notes text
);
