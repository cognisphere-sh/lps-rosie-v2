-- 0078: threads + thread_messages — the web-chat transcripts move out of the
-- webchat plugin's per-agent JSONL files and into the database.
-- Applied 2026-08-26 (Bhoumik, via Supabase MCP).
--
-- One `threads` row per (agent, cognisphere thread id): the same string names
-- a different conversation under each agent (`supplier-<slug>` exists on rosie
-- AND daisy by design, migration 0068), so the natural key is the pair, never
-- the id alone. Each row carries the two read cursors the plugin kept in
-- read.json, the "working…" timestamp, and a trigger-maintained preview of
-- the newest message — enough for the app's notification bell to work from
-- this table alone, one Realtime event per message.
--
-- `thread_messages` is the transcript, one row per message, `seq` being the
-- per-thread id the JSONL rows carried (the plugin still allocates it: it is
-- the only writer). `files` keeps the JSONL shape verbatim; the bytes stay on
-- the agent's disk (inbox/ and state/outbox/), served by the plugin.
--
-- The entities keep their text `*_thread_id` columns as the agent-facing key
-- (skills, `webchat-cli --thread-id`, the portal and the app all speak it, and
-- `jr-<id>` is minted before its row exists). The new `*_thread_ref` foreign
-- keys are DERIVED from them by trigger — writing a text id upserts the
-- `threads` row and links it — so there is one source of truth and every
-- entity still carries a real FK. Same convention as every other derived
-- column here: never write `*_thread_ref` by hand.

create table public.threads (
  id             bigint generated always as identity primary key,
  agent          text not null,
  thread_id      text not null,
  web_read_id    integer not null default 0,
  portal_read_id integer not null default 0,
  pending_since  timestamptz,
  last_seq       integer,
  last_at        timestamptz,
  last_role      text,
  last_sender    text,
  last_text      text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (agent, thread_id)
);

comment on table public.threads is
  'One row per (agent, cognisphere thread id). Web-chat read cursors, the working indicator and a preview of the newest message; the transcript is thread_messages. Written by the webchat plugin; rows are also upserted by trigger when an entity''s *_thread_id text column is set.';
comment on column public.threads.thread_id is
  'The cognisphere thread id (main, router, jr-<id>, supplier-<slug>, customer-<slug>, <parent>-§-[TASK]-§-<slug>). Per-agent namespace: unique only with `agent`.';
comment on column public.threads.web_read_id is 'Newest seq the team''s panel has seen (was read.json `web`).';
comment on column public.threads.portal_read_id is 'Newest portal-visible seq the supplier''s portal has seen (was read.json `portal`).';
comment on column public.threads.pending_since is 'When the last web message was handed to the agent; NULL once answered. Cleared by the plugin on start.';
comment on column public.threads.last_seq is 'Trigger-maintained preview of the newest message (with last_at/last_role/last_sender/last_text). NULL = no transcript yet.';

create table public.thread_messages (
  id          bigint generated always as identity primary key,
  thread_id   bigint not null references public.threads(id) on delete cascade,
  seq         integer not null,
  role        text not null check (role in ('user', 'agent')),
  text        text not null default '',
  files       jsonb not null default '[]'::jsonb,
  sender_name text,
  portal      boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (thread_id, seq)
);

comment on table public.thread_messages is
  'Web-chat transcript, one row per message; `seq` is the per-thread message id the plugin allocates. `files` = [{name,label,mime,size,dir}] — the bytes live on the agent''s disk.';
comment on column public.thread_messages.portal is
  'Portal-visible: a message the supplier typed in the portal, or a `--portal` reply. The portal is served ONLY these rows.';

create trigger handle_updated_at
  before update on public.threads
  for each row execute function moddatetime('updated_at');

-- Preview of the newest message, so listing threads never touches the transcript.
create or replace function public.thread_messages_update_preview()
returns trigger language plpgsql as $$
begin
  update public.threads
     set last_seq = new.seq, last_at = new.created_at, last_role = new.role,
         last_sender = new.sender_name, last_text = left(new.text, 120)
   where id = new.thread_id and (last_seq is null or last_seq < new.seq);
  return new;
end $$;

create trigger thread_messages_preview
  after insert on public.thread_messages
  for each row execute function public.thread_messages_update_preview();

-- Upsert the threads row for an agent's thread id and return its pk.
create or replace function public.link_thread(p_agent text, p_thread_id text)
returns bigint language plpgsql as $$
declare v_id bigint;
begin
  if p_thread_id is null or p_thread_id = '' then return null; end if;
  insert into public.threads (agent, thread_id) values (p_agent, p_thread_id)
  on conflict (agent, thread_id) do update set agent = excluded.agent
  returning id into v_id;
  return v_id;
end $$;

alter table public.suppliers
  add column rosie_thread_ref bigint references public.threads(id) on delete set null,
  add column daisy_thread_ref bigint references public.threads(id) on delete set null;
alter table public.customers
  add column rosie_thread_ref bigint references public.threads(id) on delete set null;
alter table public.job_requests
  add column rosie_thread_ref bigint references public.threads(id) on delete set null;

comment on column public.suppliers.rosie_thread_ref is 'Derived: threads row for (rosie, rosie_thread_id). Maintained by trigger — never write.';
comment on column public.suppliers.daisy_thread_ref is 'Derived: threads row for (daisy, daisy_thread_id). Maintained by trigger — never write.';
comment on column public.customers.rosie_thread_ref is 'Derived: threads row for (rosie, rosie_thread_id). Maintained by trigger — never write.';
comment on column public.job_requests.rosie_thread_ref is 'Derived: threads row for (rosie, ''jr-''||id). Maintained by trigger — never write.';

create or replace function public.suppliers_link_threads()
returns trigger language plpgsql as $$
begin
  new.rosie_thread_ref := public.link_thread('rosie', new.rosie_thread_id);
  new.daisy_thread_ref := public.link_thread('daisy', new.daisy_thread_id);
  return new;
end $$;

create trigger suppliers_link_threads
  before insert or update of rosie_thread_id, daisy_thread_id on public.suppliers
  for each row execute function public.suppliers_link_threads();

create or replace function public.customers_link_threads()
returns trigger language plpgsql as $$
begin
  new.rosie_thread_ref := public.link_thread('rosie', new.rosie_thread_id);
  return new;
end $$;

create trigger customers_link_threads
  before insert or update of rosie_thread_id on public.customers
  for each row execute function public.customers_link_threads();

create or replace function public.job_requests_link_threads()
returns trigger language plpgsql as $$
begin
  new.rosie_thread_ref := public.link_thread('rosie', 'jr-' || new.id);
  return new;
end $$;

create trigger job_requests_link_threads
  before insert on public.job_requests
  for each row execute function public.job_requests_link_threads();

-- The link is derived, so it is not a change worth a history row.
create or replace function public.log_job_request_changes()
returns trigger language plpgsql as $$
declare
  req_id bigint;
  itm_id bigint;
  diff jsonb;
begin
  if tg_table_name = 'job_request_items' then
    req_id := new.job_request_id;
    itm_id := new.id;
  else
    req_id := new.id;
    itm_id := null;
  end if;

  if tg_op = 'INSERT' then
    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
      into diff
    from jsonb_each(to_jsonb(new))
    where key not in ('created_at', 'updated_at', 'rosie_thread_ref')
      and value <> 'null'::jsonb;
  else
    select coalesce(jsonb_object_agg(key,
             jsonb_build_object('old', o.value, 'new', n.value)), '{}'::jsonb)
      into diff
    from jsonb_each(to_jsonb(new)) as n
    join jsonb_each(to_jsonb(old)) as o using (key)
    where key not in ('updated_at', 'rosie_thread_ref')
      and n.value is distinct from o.value;
    if diff = '{}'::jsonb then
      return null;
    end if;
  end if;

  insert into public.job_request_changelog
    (job_request_id, item_id, actor, action, changes)
  values
    (req_id, itm_id,
     coalesce(nullif(btrim(coalesce(current_setting('app.actor', true), '')), ''),
              current_user),
     lower(tg_op), diff);
  return null;
end $$;

-- Backfill: every id already minted gets its threads row and its link. A
-- derived link is not an edit, so updated_at and the changelog stay quiet.
alter table public.suppliers disable trigger handle_updated_at;
alter table public.customers disable trigger handle_updated_at;
alter table public.job_requests disable trigger handle_updated_at;
alter table public.job_requests disable trigger trg_job_requests_changelog;
update public.suppliers
   set rosie_thread_ref = public.link_thread('rosie', rosie_thread_id),
       daisy_thread_ref = public.link_thread('daisy', daisy_thread_id)
 where rosie_thread_id is not null or daisy_thread_id is not null;
update public.customers set rosie_thread_ref = public.link_thread('rosie', rosie_thread_id)
 where rosie_thread_id is not null;
update public.job_requests set rosie_thread_ref = public.link_thread('rosie', 'jr-' || id);
alter table public.suppliers enable trigger handle_updated_at;
alter table public.customers enable trigger handle_updated_at;
alter table public.job_requests enable trigger handle_updated_at;
alter table public.job_requests enable trigger trg_job_requests_changelog;

create index suppliers_rosie_thread_ref_idx on public.suppliers (rosie_thread_ref);
create index suppliers_daisy_thread_ref_idx on public.suppliers (daisy_thread_ref);
create index customers_rosie_thread_ref_idx on public.customers (rosie_thread_ref);
create index job_requests_rosie_thread_ref_idx on public.job_requests (rosie_thread_ref);

-- Same posture as every other table: RLS on, no policies — anon is denied,
-- the app and the plugin use the secret key.
alter table public.threads enable row level security;
alter table public.thread_messages enable row level security;

-- Realtime: the app server subscribes to both (secret key) and fans changes
-- out to browsers over SSE.
alter publication supabase_realtime add table public.threads, public.thread_messages;
