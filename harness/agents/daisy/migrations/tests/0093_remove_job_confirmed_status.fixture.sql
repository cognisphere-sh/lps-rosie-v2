-- Empty disposable PostgreSQL database only. Run this fixture, 0093, then assertions
-- in one psql session; 0093 may be applied twice before assertions to check reruns.
\ir 0092_job_orders_workflow.fixture.sql
\ir ../0092_job_orders_workflow.sql
DROP TABLE workflow_history_before_0092;

ALTER TABLE public.job_requests ADD COLUMN sourcing_notes text,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.job_requests
  FOR EACH ROW EXECUTE FUNCTION public.moddatetime('updated_at');
INSERT INTO public.job_requests(id,status,is_active,sourcing_notes,expected_install_date,fulfillment_method)
  VALUES (1000,'confirmed',true,'APS: Oak 30 G: $20; selected.','2026-10-20','delivery'),
    (1001,'confirmed',false,'Inactive supplier-confirmed job.',NULL,NULL),
    (1002,'quoted',true,'Quote only.',NULL,NULL),
    (1003,'committed',true,'Awaiting order.',NULL,NULL),
    (1004,'closed_lost',true,'Historical loss.',NULL,NULL),
    (1005,'archived',true,'Historical archive.',NULL,NULL);
INSERT INTO public.job_request_items(id,job_request_id,quantity) VALUES (1000,1000,5);
INSERT INTO public.availability_requests(id,job_request_id,supplier_id,status,submitted_at,public_token)
  VALUES (1000,1000,1,'submitted','2026-09-12T12:30:00Z','00000000-0000-4000-8000-000000001000');
INSERT INTO public.availability_request_items(id,availability_request_id,job_request_item_id,name,quantity,status,unit_price)
  VALUES (1000,1000,1000,'Oak',5,'can_order',20);
INSERT INTO public.orders(id,supplier_id,status,confirmation_date,fulfillment_date,notes)
  OVERRIDING SYSTEM VALUE VALUES
    (1000,1,'confirmed','2026-09-12','2026-10-19','Supplier confirmation evidence'),
    (1001,1,'confirmed',NULL,NULL,'Legacy confirmation with unknown date'),
    (1002,1,'committed',NULL,NULL,'Awaiting supplier'),
    (1003,1,'closed_won','2026-09-10','2026-09-12','Delivered'),
    (1004,1,'closed_lost',NULL,NULL,'Cancelled');
INSERT INTO public.order_items(id,order_id,availability_request_item_id,name,quantity,unit_price,status)
  OVERRIDING SYSTEM VALUE VALUES (1000,1000,1000,'Oak',5,20,'need_to_order');
INSERT INTO public.order_item_job_request_items VALUES (1000,1000,5);

-- Exercise the real production audit function from 0078 with its required columns.
CREATE TABLE public.job_request_changelog (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_request_id bigint NOT NULL REFERENCES public.job_requests(id),
  item_id bigint, actor text NOT NULL, action text NOT NULL, changes jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
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

CREATE TRIGGER job_requests_changelog AFTER INSERT OR UPDATE ON public.job_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_job_request_changes();
INSERT INTO public.job_request_changelog(job_request_id,actor,action,changes,created_at)
  VALUES (1000,'supplier','update','{"status":{"old":"committed","new":"confirmed"}}','2026-09-12T12:30:00Z');
CREATE TEMP TABLE jobs_before_0093 AS SELECT * FROM public.job_requests;
CREATE TEMP TABLE orders_before_0093 AS SELECT * FROM public.orders;
CREATE TEMP TABLE order_items_before_0093 AS SELECT * FROM public.order_items;
CREATE TEMP TABLE order_allocations_before_0093 AS SELECT * FROM public.order_item_job_request_items;
CREATE TEMP TABLE availability_before_0093 AS SELECT * FROM public.availability_requests;
CREATE TEMP TABLE availability_items_before_0093 AS SELECT * FROM public.availability_request_items;
CREATE TEMP TABLE availability_jobs_before_0093 AS SELECT * FROM public.availability_request_jobs;
CREATE TEMP TABLE availability_allocations_before_0093 AS SELECT * FROM public.availability_request_item_jobs;
CREATE TEMP TABLE changelog_before_0093 AS SELECT * FROM public.job_request_changelog;
CREATE TEMP TABLE workflow_functions_before_0093 AS
  SELECT oid::regprocedure::text AS signature, pg_get_functiondef(oid) AS definition, proacl
  FROM pg_proc WHERE oid IN ('public.confirm_order(bigint,bigint,date,date)'::regprocedure,
    'public.close_order(bigint,text)'::regprocedure);
