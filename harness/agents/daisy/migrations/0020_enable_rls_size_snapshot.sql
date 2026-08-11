-- 0020 — enable RLS on the 0019 rollback snapshot. Created after 0011_enable_rls
-- swept the schema, so it was the one table left exposed to anon via PostgREST.
-- No policies: only postgres/service_role (BYPASSRLS) ever read it, and it gets
-- dropped once the size rewrite has settled.
alter table public.inventory_pre_size_normalization enable row level security;
