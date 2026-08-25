-- 0074_rename_is_onboarded_to_is_lps_partner.sql
-- Applied 2026-08-25 via the Supabase MCP at Bhoumik's request, recorded in the
-- Supabase history as `rename_is_onboarded_to_is_lps_partner`.
--
-- Renames `suppliers.is_onboarded` → `suppliers.is_lps_partner`, and projects
-- the column from `search_suppliers` so the Supplier Search page can filter on
-- it in SQL.
--
-- WHY. The flag already had two names. The column said "onboarded" while every
-- prompt, skill and screen that reads it says **LPS Partner** — the tag beside
-- a supplier's name, the split rosie forks on (a portal availability request
-- when they are one, drafted outreach when they are not). "Onboarded" is also
-- the wrong word twice over: daisy *onboards* suppliers into our database
-- (contacts, availability, ingestion) without any of them becoming partners, so
-- the same word named two different states. One name, and it is the one people
-- use out loud.
--
-- SCOPE. The column and its comment, plus `search_suppliers`' projection. No
-- view, policy, index, constraint or other function referenced the old name
-- (checked before applying), so a plain RENAME is the whole data change; 1 of
-- 1,396 supplier rows is TRUE.
--
-- `search_suppliers` is dropped and recreated rather than replaced because its
-- RETURNS TABLE gains a column. The body is unchanged apart from the one new
-- item in the projection: the page previously read `is_onboarded` in a second
-- `suppliers` query and stitched it onto the RPC's rows, which is enough to
-- draw the tag but not to filter — a filter has to run over the whole match
-- set, before the page is taken, or it means "filter within this page".

ALTER TABLE public.suppliers RENAME COLUMN is_onboarded TO is_lps_partner;

COMMENT ON COLUMN public.suppliers.is_lps_partner IS
  'TRUE = an LPS Partner: they answer availability requests in the supplier portal (/portal/<id>). FALSE = reached only through our own channels (email/text), the thread logged in the agent conversation. Not a login — portal auth is a deliberately deferred step. Independent of whether daisy has onboarded them into the database.';

COMMENT ON TABLE public.availability_requests IS
  'One availability ask, from one job request to one LPS Partner (suppliers.is_lps_partner). The supplier answers per line in availability_request_items and presses Submit.';

DROP FUNCTION IF EXISTS public.search_suppliers(text, text, real, text, text);

CREATE FUNCTION public.search_suppliers(
  search text DEFAULT ''::text,
  category_filter text DEFAULT NULL::text,
  fuzzy_ratio real DEFAULT 0.34,
  sort_column text DEFAULT NULL::text,
  sort_direction text DEFAULT NULL::text
)
RETURNS TABLE(
  id bigint, name text, address text, city text, state text, zip text,
  primary_contact_name text, primary_contact_email text, primary_contact_phone text,
  website text, latitude double precision, longitude double precision,
  notes text, category text,
  created_at timestamp with time zone, updated_at timestamp with time zone,
  availability_source_type text, availability_update_days integer,
  hosted_availability_url text, is_lps_partner boolean
)
LANGUAGE plpgsql
STABLE
AS $function$
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
           s.hosted_availability_url, s.is_lps_partner
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

-- Re-granted explicitly: DROP took the old function's ACL with it, and the
-- recreated one would otherwise rely on the PUBLIC default.
GRANT EXECUTE ON FUNCTION public.search_suppliers(text, text, real, text, text)
  TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------ post-apply --
-- Verified 2026-08-25: `suppliers.is_lps_partner` carries the old column's data
-- (1 of 1,396 rows TRUE — Austin Plant Supply); no `is_onboarded` remains on
-- the table; `search_suppliers('')` returns the new column and the one partner
-- row; EXECUTE re-granted to anon / authenticated / service_role.
