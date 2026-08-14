-- 0034_contact_supplier_links.sql
--
-- Contacts become many-to-many with suppliers (Bhoumik, 2026-08-14).
--
-- `contacts.supplier_id` said a person belongs to exactly one nursery. At a
-- multi-location company (0033) that is wrong: one sales rep covers several
-- farms, and the one-supplier column forced a duplicate row per location —
-- five "same" people who then drift apart as one of them gets a new phone
-- number. It also made "who else does Maria cover?" unanswerable.
--
-- `contacts` now describes the **person or inbox** only. The link to a
-- supplier — and with it `is_primary`, which is per supplier because the rep
-- who answers about availability at Bunnell need not be the one at Canal
-- Point — moves to `supplier_contacts`.
--
-- Two levels of `is_active`, and they mean different things:
--   contacts.is_active           the person is gone (left the company)
--   supplier_contacts.is_active  they no longer cover this location, but may
--                                still cover others
-- A contact is visible for a supplier only when both are true.

create table if not exists public.supplier_contacts (
  id          bigint generated always as identity primary key,
  supplier_id bigint not null references public.suppliers(id) on delete cascade,
  contact_id  bigint not null references public.contacts(id)  on delete cascade,
  is_primary  boolean not null default false,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint supplier_contacts_supplier_contact_key unique (supplier_id, contact_id)
);

comment on table public.supplier_contacts is
  'Which contacts cover which supplier locations, and which one is that '
  'location''s primary. See docs/supabase-schema.md.';

-- Same rule `contacts_one_primary_idx` enforced, now per location: demote the
-- incumbent before promoting a replacement or the insert/update trips this.
create unique index if not exists supplier_contacts_one_primary_idx
  on public.supplier_contacts (supplier_id) where is_primary and is_active;

create index if not exists supplier_contacts_supplier_idx
  on public.supplier_contacts (supplier_id, is_active);
create index if not exists supplier_contacts_contact_idx
  on public.supplier_contacts (contact_id, is_active);

create trigger handle_updated_at before update on public.supplier_contacts
  for each row execute function moddatetime('updated_at');

alter table public.supplier_contacts enable row level security;

create policy "authenticated full access" on public.supplier_contacts
  for all to authenticated using (true) with check (true);

-- One link per existing contact — no attempt to merge the per-location
-- duplicates this column created. Merging two rows into one person is a
-- judgment call about whether they really are one person (see the deliberate
-- `Felix Jr. Rivero` / `Felix Rivero` pair on supplier 255), so it stays a
-- separate, source-checked job.
insert into public.supplier_contacts (supplier_id, contact_id, is_primary, is_active, created_at, updated_at)
select c.supplier_id, c.id, c.is_primary, c.is_active, c.created_at, c.updated_at
  from public.contacts c
 where not exists (
   select 1 from public.supplier_contacts sc
    where sc.supplier_id = c.supplier_id and sc.contact_id = c.id
 );

drop index if exists public.contacts_one_primary_idx;
drop index if exists public.contacts_supplier_idx;

alter table public.contacts
  drop column if exists is_primary,
  drop column if exists supplier_id;

-- --------------------------------------------------------- the cascade trigger
--
-- Deactivating a supplier retires its links, not the people: a rep who covers
-- three locations keeps answering for the other two. Only a contact left with
-- no active link at all is retired with it.

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
  update public.supplier_contacts
    set is_active = false
    where supplier_id = new.id and is_active = true;
  update public.contacts c
    set is_active = false
    where c.is_active = true
      and exists (select 1 from public.supplier_contacts sc
                   where sc.contact_id = c.id and sc.supplier_id = new.id)
      and not exists (select 1 from public.supplier_contacts sc
                       where sc.contact_id = c.id and sc.is_active);
  return new;
end;
$function$;

-- ---------------------------------------------------------------- the RPC
--
-- Identical to the previous body apart from reaching the supplier's contacts
-- through `supplier_contacts` instead of `contacts.supplier_id`. The signature
-- is unchanged, so CREATE OR REPLACE keeps the existing grants.

create or replace function public.search_suppliers(
  search text default ''::text,
  category_filter text default null::text,
  fuzzy_ratio real default 0.34,
  sort_column text default null::text,
  sort_direction text default null::text
)
returns table(id bigint, name text, address text, city text, state text, zip text,
              primary_contact_name text, primary_contact_email text,
              primary_contact_phone text, website text, latitude double precision,
              longitude double precision, notes text, category text,
              created_at timestamp with time zone, updated_at timestamp with time zone,
              availability_source_type text, availability_update_days integer,
              hosted_availability_url text)
language plpgsql
stable
as $function$
declare
  q text := public.normalize_search_text(search);
  q_star text := case
    when length(substring(btrim(q) from '[a-z0-9]*$')) >= 3
      then btrim(q) || '*'
    else q
  end;
  trgm_ids bigint[] := '{}';
  contact_ids bigint[] := '{}';
  dir text := case when lower(coalesce(sort_direction, '')) = 'desc' then 'desc' else 'asc' end;
  col text := case sort_column
    when 'name'                          then 's.name'
    when 'category'                      then 's.category'
    when 'primary_contact_name'          then 'pc.name'
    when 'primary_contact_email'         then 'pc.email'
    when 'primary_contact_phone'         then 'pc.phone'
    when 'website'                       then 's.website'
    when 'address'                       then 's.address'
    when 'city'                          then 's.city'
    when 'state'                         then 's.state'
    when 'zip'                           then 's.zip'
    when 'notes'                         then 's.notes'
    when 'availability_source_type'      then 's.availability_source_type'
    when 'availability_update_days'      then 's.availability_update_days'
    when 'hosted_availability_url'       then 's.hosted_availability_url'
    when 'created_at'                    then 's.created_at'
    when 'updated_at'                    then 's.updated_at'
    else null
  end;
  order_extra text := case when col is null then '' else ', ' || col || ' ' || dir end;
begin
  if q <> '' then
    trgm_ids := array(
      select s.id
      from public.suppliers s
      where q <% public.normalize_search_text(
              coalesce(s.name, '') || ' ' || coalesce(s.address, '') || ' ' ||
              coalesce(s.city, '') || ' ' || coalesce(s.state, '') || ' ' ||
              coalesce(s.zip, '') || ' ' || coalesce(s.category, '') || ' ' ||
              coalesce(s.notes, ''))
    );

    -- A contact match now lights up every location that contact covers.
    contact_ids := array(
      select distinct sc.supplier_id
      from public.contacts c
      join public.supplier_contacts sc on sc.contact_id = c.id and sc.is_active
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
    select s.id, s.name, s.address, s.city, s.state, s.zip,
           pc.name, pc.email, pc.phone, s.website, s.latitude, s.longitude,
           s.notes, s.category, s.created_at, s.updated_at,
           s.availability_source_type, s.availability_update_days,
           s.hosted_availability_url
    from suppliers s
    left join lateral (
      select c.name, c.email, c.phone
      from public.supplier_contacts sc
      join public.contacts c on c.id = sc.contact_id and c.is_active
      where sc.supplier_id = s.id and sc.is_active
      order by sc.is_primary desc, c.id asc
      limit 1
    ) pc on true
    where s.is_active
      and ($1 is null or s.category = $1)
      and (
        $2 = ''
        or public.normalize_search_text(
             coalesce(s.name, '') || ' ' || coalesce(s.address, '') || ' ' ||
             coalesce(s.city, '') || ' ' || coalesce(s.state, '') || ' ' ||
             coalesce(s.zip, '') || ' ' || coalesce(s.category, '') || ' ' ||
             coalesce(s.notes, ''))
           &@~ pgroonga_condition($2, fuzzy_max_distance_ratio => $3)
        or public.normalize_search_text(
             coalesce(s.name, '') || ' ' || coalesce(s.address, '') || ' ' ||
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
