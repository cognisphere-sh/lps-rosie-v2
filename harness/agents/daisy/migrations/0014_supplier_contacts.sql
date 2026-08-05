-- 0014_supplier_contacts
--
-- Split the supplier point-of-contact out of `suppliers` into its own
-- `public.contacts` table, so a supplier can carry more than one contact
-- person. `suppliers.poc_name` / `poc_email` / `poc_phone` held exactly one,
-- and 47 of 910 rows used them at all.
--
-- Applied in numbered steps: Daisy's guarded runner rejects large
-- multi-statement DDL batches, and the backfill must be verified before the
-- old columns are dropped.

-- ---------------------------------------------------------------- 0014a: table

create table public.contacts (
  id                bigint generated always as identity primary key,
  supplier_id       bigint not null references public.suppliers (id) on delete cascade,
  -- Nullable: two backfilled rows carry only an email/phone (a shared sales
  -- inbox), and inventing a name for them would be fabricating data.
  name              text,
  email             text,
  phone             text,
  title_department  text,
  notes             text,
  is_primary        boolean not null default false,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.contacts is
  'People at a supplier. Replaces suppliers.poc_name/poc_email/poc_phone (0014).';
comment on column public.contacts.is_primary is
  'The supplier''s default point of contact. At most one active primary per supplier.';
comment on column public.contacts.title_department is
  'Free text as the supplier gives it — "Sales Manager", "Availability desk".';
comment on column public.contacts.notes is
  'Durable facts about this person (best time to call, which lists they own). Contact history stays in suppliers.communication_notes.';

create index contacts_supplier_idx on public.contacts (supplier_id, is_active);

-- At most one active primary per supplier. Partial, so retired contacts keep
-- their is_primary flag as history without blocking the current one.
create unique index contacts_one_primary_idx
  on public.contacts (supplier_id)
  where is_primary and is_active;

-- Must stay byte-identical to the expression search_suppliers builds
-- `contact_ids` from, or the index is skipped.
create index contacts_pgroonga_idx on public.contacts
  using pgroonga (
    public.normalize_search_text(
      coalesce(name, '') || ' ' || coalesce(email, '') || ' ' ||
      coalesce(phone, '') || ' ' || coalesce(title_department, ''))
  ) with (tokenizer = 'TokenDelimit');

create trigger handle_updated_at
  before update on public.contacts
  for each row execute function extensions.moddatetime('updated_at');

alter table public.contacts enable row level security;

create policy "authenticated full access" on public.contacts
  for all to authenticated using (true) with check (true);

-- --------------------------------------------------------------- 0014b: backfill

insert into public.contacts (supplier_id, name, email, phone, is_primary, is_active)
select s.id,
       nullif(btrim(s.poc_name), ''),
       nullif(btrim(s.poc_email), ''),
       nullif(btrim(s.poc_phone), ''),
       true,
       s.is_active
from public.suppliers s
where coalesce(btrim(s.poc_name), '')  <> ''
   or coalesce(btrim(s.poc_email), '') <> ''
   or coalesce(btrim(s.poc_phone), '') <> '';

-- ------------------------------------------------------- 0014c: drop the columns
--
-- suppliers_pgroonga_idx concatenates poc_name, so it has to go and come back
-- without it. The rebuilt expression must stay byte-identical to the document
-- search_suppliers matches on.

drop index public.suppliers_pgroonga_idx;

alter table public.suppliers
  drop column poc_name,
  drop column poc_email,
  drop column poc_phone;

create index suppliers_pgroonga_idx on public.suppliers
  using pgroonga (
    public.normalize_search_text(
      coalesce(name, '') || ' ' || coalesce(email, '') || ' ' ||
      coalesce(phone, '') || ' ' || coalesce(address, '') || ' ' ||
      coalesce(city, '') || ' ' || coalesce(state, '') || ' ' ||
      coalesce(zip, '') || ' ' || coalesce(category, '') || ' ' ||
      coalesce(notes, ''))
  ) with (tokenizer = 'TokenDelimit');

-- --------------------------------------------------- 0014d: cascade deactivation
--
-- SCHEMA.md documents supplier deactivation as cascading. Contacts join that
-- cascade so a retired supplier cannot leave live contacts behind.

create or replace function public.cascade_supplier_deactivation()
returns trigger
language plpgsql
as $function$
begin
  update public.inventory
    set is_active = false
    where supplier_id = new.id and is_active = true;
  update public.inventory_sources
    set is_active = false
    where supplier_id = new.id and is_active = true;
  update public.contacts
    set is_active = false
    where supplier_id = new.id and is_active = true;
  return new;
end;
$function$;

-- ------------------------------------------------- 0014e: search_suppliers rewrite
--
-- Same matching and ordering as 0003; the poc_* columns become
-- primary_contact_* resolved from `contacts`, and a supplier now also matches
-- on any of its active contacts. The return type changes, so the old function
-- is dropped rather than replaced.

drop function if exists public.search_suppliers(text, text, real, text, text);

create function public.search_suppliers(search text default ''::text, category_filter text default null::text, fuzzy_ratio real default 0.34, sort_column text default null::text, sort_direction text default null::text)
 returns table(id bigint, name text, address text, city text, state text, zip text, phone text, email text, primary_contact_name text, primary_contact_email text, primary_contact_phone text, website text, latitude double precision, longitude double precision, notes text, category text, created_at timestamp with time zone, updated_at timestamp with time zone)
 language plpgsql
 stable
as $function$
declare
  q text := public.normalize_search_text(search);
  q_star text := case
    when length(substring(btrim(q) from '[a-z0-9]*$')) >= 3
      then btrim(q) || '*' -- last token becomes a Groonga prefix search
    else q
  end;
  trgm_ids bigint[] := '{}';
  contact_ids bigint[] := '{}';
  dir text := case when lower(coalesce(sort_direction, '')) = 'desc' then 'desc' else 'asc' end;
  col text := case sort_column
    when 'name'                  then 's.name'
    when 'category'              then 's.category'
    when 'primary_contact_name'  then 'pc.name'
    when 'primary_contact_email' then 'pc.email'
    when 'primary_contact_phone' then 'pc.phone'
    when 'website'               then 's.website'
    when 'email'                 then 's.email'
    when 'phone'                 then 's.phone'
    when 'address'               then 's.address'
    when 'city'                  then 's.city'
    when 'state'                 then 's.state'
    when 'zip'                   then 's.zip'
    when 'notes'                 then 's.notes'
    when 'created_at'            then 's.created_at'
    when 'updated_at'            then 's.updated_at'
    else null
  end;
  order_extra text := case when col is null then '' else ', ' || col || ' ' || dir end;
begin
  if q <> '' then
    trgm_ids := array(
      select s.id
      from public.suppliers s
      where q <% public.normalize_search_text(
              coalesce(s.name, '') || ' ' || coalesce(s.email, '') || ' ' ||
              coalesce(s.phone, '') || ' ' || coalesce(s.address, '') || ' ' ||
              coalesce(s.city, '') || ' ' || coalesce(s.state, '') || ' ' ||
              coalesce(s.zip, '') || ' ' || coalesce(s.category, '') || ' ' ||
              coalesce(s.notes, ''))
    );

    -- A supplier is also reachable through its people. Resolved up front, the
    -- same way trgm_ids is, so the main query keeps using suppliers_pgroonga_idx.
    contact_ids := array(
      select distinct c.supplier_id
      from public.contacts c
      where c.is_active
        and (
          public.normalize_search_text(
            coalesce(c.name, '') || ' ' || coalesce(c.email, '') || ' ' ||
            coalesce(c.phone, '') || ' ' || coalesce(c.title_department, ''))
            &@~ pgroonga_condition(q, fuzzy_max_distance_ratio => fuzzy_ratio)
          or public.normalize_search_text(
            coalesce(c.name, '') || ' ' || coalesce(c.email, '') || ' ' ||
            coalesce(c.phone, '') || ' ' || coalesce(c.title_department, ''))
            &@~ q_star
        )
    );
  end if;

  return query execute format($q$
    select s.id, s.name, s.address, s.city, s.state, s.zip, s.phone, s.email,
           pc.name, pc.email, pc.phone, s.website, s.latitude, s.longitude,
           s.notes, s.category, s.created_at, s.updated_at
    from suppliers s
    left join lateral (
      select c.name, c.email, c.phone
      from public.contacts c
      where c.supplier_id = s.id and c.is_active
      order by c.is_primary desc, c.id asc
      limit 1
    ) pc on true
    where s.is_active
      and ($1 is null or s.category = $1)
      and (
        $2 = ''
        or public.normalize_search_text(
             coalesce(s.name, '') || ' ' || coalesce(s.email, '') || ' ' ||
             coalesce(s.phone, '') || ' ' || coalesce(s.address, '') || ' ' ||
             coalesce(s.city, '') || ' ' || coalesce(s.state, '') || ' ' ||
             coalesce(s.zip, '') || ' ' || coalesce(s.category, '') || ' ' ||
             coalesce(s.notes, ''))
           &@~ pgroonga_condition($2, fuzzy_max_distance_ratio => $3)
        or public.normalize_search_text(
             coalesce(s.name, '') || ' ' || coalesce(s.email, '') || ' ' ||
             coalesce(s.phone, '') || ' ' || coalesce(s.address, '') || ' ' ||
             coalesce(s.city, '') || ' ' || coalesce(s.state, '') || ' ' ||
             coalesce(s.zip, '') || ' ' || coalesce(s.category, '') || ' ' ||
             coalesce(s.notes, ''))
           &@~ $5
        or s.id = any($4)
        or s.id = any($6)
      )
    order by
      case when $2 = '' then 0
           else pgroonga_score(s.tableoid, s.ctid) end desc%s,
      s.updated_at desc,
      s.name asc
  $q$, order_extra)
  using category_filter, q, fuzzy_ratio, trgm_ids, q_star, contact_ids;
end
$function$;
