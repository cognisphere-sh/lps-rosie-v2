-- 0018_supplier_availability_source.sql
--
-- Where a supplier's availability comes from, and how often it refreshes.
--
-- Until now this was prose in `suppliers.notes` ("sends an XLSX every Monday",
-- "avail is on their website"), which nothing can filter or sort on. These
-- three columns make it structured:
--
--   availability_source_type  Email | Hosted — how the list reaches us
--   availability_update_days  how often it refreshes, in days
--   hosted_availability_url   the page it lives on, when it is hosted
--
-- All three are nullable, and null means "not established yet" rather than
-- "none" — every one of the 909 rows starts null. There is deliberately **no**
-- constraint tying the URL to `availability_source_type = 'Hosted'`: a row is
-- routinely half-filled while someone is still working out how a supplier
-- publishes, and a supplier that both emails a sheet and posts one is real.
--
-- Additive only: no data is rewritten. The search document and
-- `suppliers_pgroonga_idx` are untouched — an enum, an integer and a URL are
-- not text worth matching a search query against, and rebuilding the index
-- would mean keeping two more byte-identical expressions in step for nothing.

alter table public.suppliers
  add column availability_source_type text
    constraint suppliers_availability_source_type_check
    check (availability_source_type in ('Email', 'Hosted')),
  add column availability_update_days integer
    constraint suppliers_availability_update_days_check
    check (availability_update_days > 0),
  add column hosted_availability_url text;

comment on column public.suppliers.availability_source_type is
  'How the supplier''s availability reaches us: Email (they send it) or Hosted (we fetch it from a page they publish). Null = not established yet.';
comment on column public.suppliers.availability_update_days is
  'How often the supplier refreshes their availability, in days (7 = weekly). Null = unknown.';
comment on column public.suppliers.hosted_availability_url is
  'The page a Hosted availability list lives on. Not constrained to Hosted rows — a supplier can both email a sheet and publish one.';

-- ------------------------------------------------- search_suppliers rewrite
--
-- Identical to 0016's function apart from the three new return columns and
-- their sort keys. Matching, ordering and the contact branch are unchanged.

drop function if exists public.search_suppliers(text, text, real, text, text);

create function public.search_suppliers(search text default ''::text, category_filter text default null::text, fuzzy_ratio real default 0.34, sort_column text default null::text, sort_direction text default null::text)
 returns table(id bigint, name text, address text, city text, state text, zip text, primary_contact_name text, primary_contact_email text, primary_contact_phone text, website text, latitude double precision, longitude double precision, notes text, category text, created_at timestamp with time zone, updated_at timestamp with time zone, availability_source_type text, availability_update_days integer, hosted_availability_url text)
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
    select s.id, s.name, s.address, s.city, s.state, s.zip,
           pc.name, pc.email, pc.phone, s.website, s.latitude, s.longitude,
           s.notes, s.category, s.created_at, s.updated_at,
           s.availability_source_type, s.availability_update_days,
           s.hosted_availability_url
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
