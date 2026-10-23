#!/usr/bin/env bash
# Reset the local demo database to a chapter's starting checkpoint.
#   S1 fresh seed, jordan on the temporary password
#   S2 password already changed
#   S3 S2 + chapter 3's answers on Barton Hills
#   S4 S3 + chapter 4's answers, note and submit
#   S5 S2 + a new request, Zilker Courtyard (chapter 6, s5.sql)
# Needs API_URL and SERVICE_ROLE_KEY of the LOCAL stack (supabase status -o env).
set -euo pipefail
CP=${1:-S1}
DB=${DEMO_DB:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}
HERE=$(cd "$(dirname "$0")" && pwd)
case "$API_URL" in http://127.0.0.1:*|http://localhost:*) ;; *) echo "refusing: API_URL is not local" >&2; exit 1 ;; esac

psql "$DB" -q -v ON_ERROR_STOP=1 <<'SQL'
set session_replication_role = replica;
do $$ begin
  execute (select 'truncate ' || string_agg(format('public.%I', tablename), ', ') || ' restart identity cascade'
           from pg_tables where schemaname = 'public');
end $$;
set session_replication_role = origin;
delete from auth.users;
drop schema if exists demo cascade;
SQL

auth() { curl -sf -X "$1" "$API_URL/auth/v1/admin/users${2:-}" -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H 'content-type: application/json' -d "$3"; }
auth POST '' '{"email":"jordan@demo.invalid","password":"k7mq-x2pn-r4tz-w8hd","email_confirm":true}' >/dev/null
psql "$DB" -q -v ON_ERROR_STOP=1 -f "$HERE/seed.sql"
mkdir -p "$HERE/chat-files"
rm -f "$HERE"/chat-files/portal-17[7-9]*   # files the supplier sent in earlier takes
cp "$HERE/photos/redbud-30g.jpg" "$HERE/chat-files/portal-1761000000000-0123456789abcdef01234567.jpg"  # seeded chat photo

[ "$CP" = S1 ] && exit 0
uid=$(psql "$DB" -Atc "select id from auth.users where email = 'jordan@demo.invalid'")
auth PUT "/$uid" '{"password":"Bluebonnet-Row-26"}' >/dev/null
psql "$DB" -q -c "update public.app_users set must_change_password = false where username = 'jordan'"

[ "$CP" = S2 ] && exit 0
if [ "$CP" = S5 ]; then psql "$DB" -q -v ON_ERROR_STOP=1 -f "$HERE/s5.sql"; exit 0; fi
psql "$DB" -q -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare ar bigint := (select a.id from public.availability_requests a join public.job_requests j on j.id = a.job_request_id
                      where j.name like 'Barton Hills%');
begin
  perform demo.answer(ar, (select id from public.candidates where availability_request_id = ar and name = 'Live Oak'), '{"status":"available"}');
  perform demo.answer(ar, (select id from public.candidates where availability_request_id = ar and name = 'Cedar Elm'),
    '{"status":"partial_qty","available_quantity":"3","note_from_supplier":"2 more ready in 3 weeks"}');
  perform demo.answer(ar, (select id from public.candidates where availability_request_id = ar and name = 'Dwarf Yaupon Holly'),
    '{"status":"can_order","note_from_supplier":"Ready mid-November from our Tyler farm"}');
  perform demo.answer(ar, (select id from public.candidates where availability_request_id = ar and name = 'Gulf Muhly'),
    '{"status":"available","unit_price":"14.00"}');
end $$;
SQL

[ "$CP" = S3 ] && exit 0
psql "$DB" -q -v ON_ERROR_STOP=1 <<'SQL'
do $$
declare ar bigint := (select a.id from public.availability_requests a join public.job_requests j on j.id = a.job_request_id
                      where j.name like 'Barton Hills%');
  redbud bigint := (select id from public.candidates where availability_request_id = ar and name like 'Texas Redbud%');
  alt bigint := (select c.id from public.candidates c join public.candidates r on r.id = redbud
                 where c.job_request_item_id = r.job_request_item_id and c.size = '30 G');
begin
  perform demo.answer(ar, redbud, jsonb_build_object('status', 'diff_size_sub', 'offered_candidate_id', alt::text));
  perform demo.answer(ar, (select id from public.candidates where availability_request_id = ar and name = 'Red Yucca'), '{"status":"unavailable"}');
  perform public.submit_availability_request_note(ar, 2, 'We can deliver Tuesday to Thursday, 7am to 3pm. Trees tagged on request.');
end $$;
SQL
