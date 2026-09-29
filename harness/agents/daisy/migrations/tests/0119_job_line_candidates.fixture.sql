-- Disposable PostgreSQL only.
\ir 0115_merged_audience_notes.fixture.sql
\ir ../0115_merged_audience_notes.sql
\ir ../0116_job_item_selected_supplier_response.sql

-- Live objects the older fixtures predate.
CREATE TABLE public.inventory (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE public.availability_request_items
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD CONSTRAINT availability_request_items_mapped_inventory_id_fkey
    FOREIGN KEY (mapped_inventory_id) REFERENCES public.inventory(id) ON DELETE SET NULL,
  ADD CONSTRAINT availability_request_items_available_quantity_check
    CHECK (available_quantity IS NULL OR available_quantity >= 0),
  ADD CONSTRAINT availability_request_items_unit_price_check CHECK (unit_price IS NULL OR unit_price > 0);
CREATE INDEX availability_request_items_request_idx ON public.availability_request_items (availability_request_id, is_active);
CREATE INDEX availability_request_items_mapped_inventory_idx ON public.availability_request_items (mapped_inventory_id)
  WHERE mapped_inventory_id IS NOT NULL;
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.availability_request_items
  FOR EACH ROW EXECUTE FUNCTION public.moddatetime('updated_at');
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.availability_requests
  FOR EACH ROW EXECUTE FUNCTION public.moddatetime('updated_at');
CREATE FUNCTION public.availability_request_reopen_on_new_line() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.availability_requests SET status = 'new'
   WHERE id = NEW.availability_request_id AND is_active AND status IN ('processing', 'submitted');
  RETURN NULL;
END $$;
CREATE TRIGGER availability_request_items_reopen AFTER INSERT ON public.availability_request_items
  FOR EACH ROW EXECUTE FUNCTION public.availability_request_reopen_on_new_line();
INSERT INTO public.suppliers(id, is_active, is_lps_partner) VALUES (9002, true, false);

-- Live has no AR line shared by several job lines; keep each line's first link.
DELETE FROM public.availability_request_item_jobs l
  WHERE job_request_item_id <> (SELECT min(job_request_item_id) FROM public.availability_request_item_jobs k
    WHERE k.availability_request_item_id = l.availability_request_item_id);

-- ... and no AR linked to several jobs; keep each AR's first job.
DELETE FROM public.availability_request_jobs l
  WHERE job_request_id <> (SELECT min(job_request_id) FROM public.availability_request_jobs k
    WHERE k.availability_request_id = l.availability_request_id);
CREATE TEMP TABLE ar_jobs_before AS SELECT * FROM public.availability_request_jobs;

CREATE TEMP TABLE candidates_before AS
  SELECT i.*, ar.supplier_id AS ar_supplier_id, l.job_request_item_id AS linked_item_id
  FROM public.availability_request_items i
  JOIN public.availability_requests ar ON ar.id = i.availability_request_id
  LEFT JOIN public.availability_request_item_jobs l ON l.availability_request_item_id = i.id;
