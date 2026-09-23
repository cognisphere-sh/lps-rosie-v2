BEGIN;
ALTER TABLE public.orders ADD COLUMN public_token uuid UNIQUE;
COMMENT ON COLUMN public.orders.public_token IS 'Revocable public read-only link. Null means private; closure or deactivation revokes it.';

CREATE FUNCTION public.guard_order_public_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('closed_won', 'closed_lost') OR NOT NEW.is_active THEN
    NEW.public_token := NULL;
  ELSIF NEW.public_token IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.suppliers WHERE id = NEW.supplier_id AND is_active
  ) THEN
    RAISE EXCEPTION 'Public orders require an active supplier';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_order_public_link BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_public_link();
NOTIFY pgrst, 'reload schema';
COMMIT;
