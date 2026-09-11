-- After the 0082/0083/0084 fixtures and migrations, in a disposable DB ONLY.
ALTER TABLE public.job_request_items
  ADD COLUMN job_request_id bigint REFERENCES public.job_requests(id) DEFAULT 1,
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.availability_request_items
  ADD COLUMN name text NOT NULL DEFAULT 'Oak',
  ADD COLUMN size text,
  ADD COLUMN quantity numeric,
  ADD COLUMN lps_notes text,
  ADD COLUMN mapped_inventory_id uuid;
ALTER TABLE public.availability_requests ADD CONSTRAINT availability_requests_status_check
  CHECK (status IN ('new','processing','submitted','closed'));

-- The existing 0075 reopen trigger, independent of its retired item vocabulary.
CREATE FUNCTION public.availability_request_reopen_on_new_line()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.availability_requests SET status = 'new'
  WHERE id = NEW.availability_request_id AND is_active AND status IN ('processing','submitted');
  RETURN NULL;
END $$;
CREATE TRIGGER availability_request_items_reopen AFTER INSERT ON public.availability_request_items
  FOR EACH ROW EXECUTE FUNCTION public.availability_request_reopen_on_new_line();

-- A pre-existing open request on a closed job must be reconciled by 0088.
INSERT INTO public.availability_requests(id,job_request_id,supplier_id,public_token)
VALUES (99,5,1,'10000000-0000-4000-8000-000000000099');
INSERT INTO public.availability_requests(id,job_request_id,supplier_id,status)
VALUES (98,5,1,'closed');
