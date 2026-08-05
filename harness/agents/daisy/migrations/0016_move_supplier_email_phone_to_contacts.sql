-- 0016_move_supplier_email_phone_to_contacts
--
-- Completes the normalization 0014/0015 started: `suppliers.email` and
-- `suppliers.phone` move into `contacts` and the two columns are dropped.
-- `suppliers` is left describing the company — name, category, address,
-- coordinates, website, notes — and every way of reaching a human or an inbox
-- lives in `contacts`.
--
-- One contact row per supplier is created from the pair, `title_department =
-- 'Main line'`. It becomes that supplier's primary only when no active primary
-- already exists, so the named people 0014/0015 established keep precedence
-- over a generic `info@` address.
--
-- ## Names are guessed from an allowlist, never from a pattern
--
-- The local part of an address is not a reliable name. A regex for
-- `first.last` matches `tynursery.orders`, `treeoflife.gardencenter` and
-- `customerservice.bhf`; a regex for a single first name matches `howdy`,
-- `fieldgrown` and `plants`. So both tiers below are **hand-curated lists of
-- the values actually present in this database**, reviewed one by one:
--
--   * 9 addresses yield a confident full name (`bobby.green` → Bobby Green).
--   * 6 more yield a confident first name where the rest is the company
--     (`shane.honeycreek` → Shane).
--   * ~118 single-token locals are recognisable first names (`adolfo`, `wendy`).
--
-- Everything else keeps `name = NULL` — a contact is perfectly valid with only
-- an email or phone, which is why the app's contact form marks name optional.
-- Ambiguous tokens were deliberately left out rather than guessed: `austin`
-- (also a city), `hunter`, `angel`, `cat`, `chance`, `moe`, `shorty`, `ikey`,
-- `gay`, and every initial+surname form (`dwinningham`, `bstitt`) whose first
-- name cannot be recovered without inventing it.
--
-- Every guessed row is stamped in `contacts.notes` with "Name inferred from the
-- email address; unverified." so a guess is never mistaken for a confirmed fact.
--
-- `suppliers.fax` (12 rows) is out of scope and untouched.

-- ------------------------------------------------------------ 0016a: snapshot

create table public.suppliers_contact_pre_move as
select id, email, phone, now() as snapshot_at
from public.suppliers
where coalesce(btrim(email), '') <> '' or coalesce(btrim(phone), '') <> '';

comment on table public.suppliers_contact_pre_move is
  'Snapshot of suppliers.email/phone taken 2026-08-05 before migration 0016 moved them into contacts and dropped the columns. Drop once the change has settled.';

-- ------------------------------------------------- 0016b: create the contact rows
--
-- Runs over ALL suppliers, active or not: the columns are about to disappear,
-- so a retired supplier's contact details have to move too. Their rows are
-- created inactive, matching the supplier.

with name_map(local, guess) as (values
  -- Confident full names.
  ('bobby.green', 'Bobby Green'),
  ('dean.decavitte', 'Dean Decavitte'),
  ('lee.trejo', 'Lee Trejo'),
  ('nancy.franklin', 'Nancy Franklin'),
  ('robert.elliott', 'Robert Elliott'),
  ('russell.griffis', 'Russell Griffis'),
  ('steve.allen', 'Steve Allen'),
  ('susan.sheffield', 'Susan Sheffield'),
  ('terri.carl', 'Terri Carl'),
  -- First name plus the company, so only the first name is recoverable.
  ('chris.codtrees', 'Chris'),
  ('lauren.enviropro', 'Lauren'),
  ('richard.eastcoastnurseryfl', 'Richard'),
  ('shane.honeycreek', 'Shane'),
  ('tanner_kitterlincreeknursery', 'Tanner'),
  ('watsonfarms-sam', 'Sam'),
  -- Single-token locals that are recognisable first names.
  ('adolfo','Adolfo'),('alan','Alan'),('alba','Alba'),('alex','Alex'),
  ('alyssa','Alyssa'),('andrew','Andrew'),('audrey','Audrey'),('bill','Bill'),
  ('bjarne','Bjarne'),('blake','Blake'),('bonnie','Bonnie'),('brad','Brad'),
  ('brian','Brian'),('brittany','Brittany'),('brooke','Brooke'),('carson','Carson'),
  ('chad','Chad'),('charles','Charles'),('cheryl','Cheryl'),('cleve','Cleve'),
  ('clint','Clint'),('courtney','Courtney'),('dalton','Dalton'),('dan','Dan'),
  ('dana','Dana'),('daniel','Daniel'),('danny','Danny'),('daryl','Daryl'),
  ('dave','Dave'),('david','David'),('desiree','Desiree'),('doug','Doug'),
  ('dustin','Dustin'),('eddie','Eddie'),('eric','Eric'),('evan','Evan'),
  ('forrest','Forrest'),('gabriel','Gabriel'),('gerald','Gerald'),('gilbert','Gilbert'),
  ('gina','Gina'),('grace','Grace'),('greg','Greg'),('hayden','Hayden'),
  ('henrik','Henrik'),('isidoro','Isidoro'),('jacob','Jacob'),('jared','Jared'),
  ('jeff','Jeff'),('jennifer','Jennifer'),('jeremy','Jeremy'),('jess','Jess'),
  ('jim','Jim'),('jimmy','Jimmy'),('joan','Joan'),('joann','Joann'),
  ('john','John'),('jon','Jon'),('jonny','Jonny'),('jose','Jose'),
  ('josh','Josh'),('karen','Karen'),('kay','Kay'),('keith','Keith'),
  ('kendra','Kendra'),('kevin','Kevin'),('kim','Kim'),('kimberly','Kimberly'),
  ('kirk','Kirk'),('larry','Larry'),('laura','Laura'),('leeann','Leeann'),
  ('leslie','Leslie'),('linda','Linda'),('lisa','Lisa'),('lori','Lori'),
  ('lucile','Lucile'),('lynne','Lynne'),('mark','Mark'),('mat','Mat'),
  ('matt','Matt'),('matthew','Matthew'),('michael','Michael'),('miguel','Miguel'),
  ('mike','Mike'),('molly','Molly'),('neal','Neal'),('neely','Neely'),
  ('pam','Pam'),('pat','Pat'),('patrick','Patrick'),('paul','Paul'),
  ('pete','Pete'),('phil','Phil'),('randy','Randy'),('renee','Renee'),
  ('rhonda','Rhonda'),('rick','Rick'),('robyn','Robyn'),('russell','Russell'),
  ('salvi','Salvi'),('sam','Sam'),('sean','Sean'),('sharri','Sharri'),
  ('shelby','Shelby'),('simond','Simond'),('stacy','Stacy'),('stephanie','Stephanie'),
  ('steve','Steve'),('terry','Terry'),('tim','Tim'),('todd','Todd'),
  ('tom','Tom'),('tony','Tony'),('travis','Travis'),('wayne','Wayne'),
  ('wendy','Wendy'),('william','William'),('wilmer','Wilmer')
),
src as (
  select s.id as supplier_id,
         s.is_active,
         nullif(btrim(s.email), '') as email,
         -- A leading '=' is a spreadsheet import artifact, not part of the number.
         nullif(btrim(regexp_replace(coalesce(s.phone, ''), '^=+', '')), '') as phone,
         lower(split_part(coalesce(s.email, ''), '@', 1)) as local
  from public.suppliers s
  where coalesce(btrim(s.email), '') <> '' or coalesce(btrim(s.phone), '') <> ''
),
prep as (
  select src.*,
         nm.guess as guessed_name,
         btrim(split_part(replace(src.phone, E'\n', ';'), ';', 1)) as phone_first,
         nullif(btrim(regexp_replace(replace(src.phone, E'\n', ';'), '^[^;]*;?', '')), '') as phone_rest
  from src left join name_map nm on nm.local = src.local
)
insert into public.contacts (supplier_id, name, email, phone, title_department, notes, is_primary, is_active)
select p.supplier_id,
       p.guessed_name,
       p.email,
       nullif(p.phone_first, ''),
       'Main line',
       nullif(concat_ws(' ',
         case when p.phone_rest is not null
              then 'Additional numbers on file: ' || p.phone_rest || '.' end,
         case when p.guessed_name is not null
              then 'Name inferred from the email address; unverified.' end), ''),
       -- Only take primary if a named person has not already claimed it.
       not exists (select 1 from public.contacts c
                   where c.supplier_id = p.supplier_id and c.is_active and c.is_primary),
       p.is_active
from prep p
where not exists (
  select 1 from public.contacts c
  where c.supplier_id = p.supplier_id
    and lower(coalesce(c.email, '')) = lower(coalesce(p.email, '~no~match~'))
);

-- The 20 suppliers whose email was already on a contact row were skipped above,
-- so their phone would vanish with the column. Fill it in where it is missing.
update public.contacts c
set phone = btrim(split_part(replace(regexp_replace(s.phone, '^=+', ''), E'\n', ';'), ';', 1))
from public.suppliers s
where c.supplier_id = s.id
  and lower(coalesce(c.email, '')) = lower(coalesce(s.email, '~no~match~'))
  and c.phone is null
  and coalesce(btrim(s.phone), '') <> '';

-- --------------------------------------------------------- 0016c: drop the columns

drop index public.suppliers_pgroonga_idx;

alter table public.suppliers
  drop column email,
  drop column phone;

create index suppliers_pgroonga_idx on public.suppliers
  using pgroonga (
    public.normalize_search_text(
      coalesce(name, '') || ' ' || coalesce(address, '') || ' ' ||
      coalesce(city, '') || ' ' || coalesce(state, '') || ' ' ||
      coalesce(zip, '') || ' ' || coalesce(category, '') || ' ' ||
      coalesce(notes, ''))
  ) with (tokenizer = 'TokenDelimit');

-- ------------------------------------------------- 0016d: search_suppliers rewrite
--
-- Loses the `phone` and `email` return columns and their sort keys. Nothing is
-- lost from *matching*: those values are now in `contacts`, which the contact
-- branch already searches.

drop function if exists public.search_suppliers(text, text, real, text, text);

create function public.search_suppliers(search text default ''::text, category_filter text default null::text, fuzzy_ratio real default 0.34, sort_column text default null::text, sort_direction text default null::text)
 returns table(id bigint, name text, address text, city text, state text, zip text, primary_contact_name text, primary_contact_email text, primary_contact_phone text, website text, latitude double precision, longitude double precision, notes text, category text, created_at timestamp with time zone, updated_at timestamp with time zone)
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
    when 'name'                  then 's.name'
    when 'category'              then 's.category'
    when 'primary_contact_name'  then 'pc.name'
    when 'primary_contact_email' then 'pc.email'
    when 'primary_contact_phone' then 'pc.phone'
    when 'website'               then 's.website'
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
