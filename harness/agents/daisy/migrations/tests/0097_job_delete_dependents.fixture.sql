-- Disposable database only: established order/AR relations and production job audit.
\ir 0093_remove_job_confirmed_status.fixture.sql
\ir ../0093_remove_job_confirmed_status.sql
ALTER TABLE public.job_request_changelog DROP CONSTRAINT job_request_changelog_job_request_id_fkey;
ALTER TABLE public.job_request_changelog ADD FOREIGN KEY(job_request_id) REFERENCES public.job_requests(id) ON DELETE CASCADE;
CREATE TABLE public.threads(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, agent text NOT NULL, thread_id text NOT NULL, UNIQUE(agent,thread_id));
CREATE TABLE public.thread_messages(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, thread_id bigint REFERENCES public.threads(id) ON DELETE CASCADE, text text);
ALTER TABLE public.job_requests ADD COLUMN rosie_thread_ref bigint REFERENCES public.threads(id) ON DELETE SET NULL;
\ir ../0079_job_request_delete_drops_thread.sql
CREATE FUNCTION public.link_thread(p_agent text,p_thread_id text) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE result bigint; BEGIN
  INSERT INTO public.threads(agent,thread_id) VALUES(p_agent,p_thread_id)
  ON CONFLICT(agent,thread_id) DO UPDATE SET agent=excluded.agent RETURNING id INTO result;
  RETURN result;
END $$;
INSERT INTO job_requests(id,status) VALUES (2000,'quoted'),(2001,'quoted'),(2002,'quoted');
INSERT INTO job_request_items(id,job_request_id,quantity) VALUES (2000,2000,5),(2001,2001,7),(2002,2002,9);
INSERT INTO availability_requests(id,job_request_id,supplier_id) VALUES (2000,2000,1),(2001,2000,1),(2002,2002,1);
INSERT INTO availability_request_items(id,availability_request_id,job_request_item_id,name,quantity)
VALUES (2000,2000,2000,'Solo',5),(2001,2001,2000,'Shared',5),(2002,2002,2002,'Unrelated',9);
INSERT INTO availability_request_item_jobs VALUES (2001,2001,7);
INSERT INTO orders(id,supplier_id,status) OVERRIDING SYSTEM VALUE VALUES (2000,1,'committed'),(2001,1,'committed'),(2002,1,'committed');
INSERT INTO order_items(id,order_id,availability_request_item_id,name,quantity)
OVERRIDING SYSTEM VALUE VALUES (2000,2000,2000,'Solo',5),(2001,2001,2001,'Shared',12),(2002,2002,2002,'Unrelated',9);
INSERT INTO order_item_job_request_items VALUES (2000,2000,5),(2001,2000,5),(2001,2001,7),(2002,2002,9);
INSERT INTO threads(agent,thread_id) VALUES ('rosie','jr-2000'),('rosie','jr-2001'),('rosie','jr-2002'),('rosie','supplier-1');
INSERT INTO thread_messages(thread_id,text) SELECT id,'Keep only surviving threads' FROM threads;
-- The canonical deletion also works without a rosie_thread_ref on legacy rows.
UPDATE job_requests SET status='closed_won' WHERE id=2001;
