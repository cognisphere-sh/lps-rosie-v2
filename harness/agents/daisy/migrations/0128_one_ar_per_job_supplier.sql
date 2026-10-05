-- 0128 — One availability request per job and supplier. Later asks to that
-- supplier for the job are added to its existing AR (reopen it if closed).
-- JR-55's AR-35/AR-36 predate this rule and are retained (ARs cannot be
-- deleted), so the rule is an insert guard rather than a unique index.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE FUNCTION public.guard_one_ar_per_job_supplier() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE existing bigint;
BEGIN
  IF NEW.job_request_id IS NULL THEN RETURN NEW; END IF;
  -- Serialize concurrent creates for the job, the same lock create_availability_request takes.
  PERFORM 1 FROM public.job_requests WHERE id = NEW.job_request_id FOR UPDATE;
  SELECT id INTO existing FROM public.availability_requests
    WHERE job_request_id = NEW.job_request_id AND supplier_id = NEW.supplier_id
    ORDER BY id DESC LIMIT 1;
  IF existing IS NOT NULL THEN
    RAISE EXCEPTION 'JR-% already has AR-% with this supplier; add candidates to it (reopen it if closed)',
      NEW.job_request_id, existing;
  END IF;
  RETURN NEW;
END $function$;
CREATE TRIGGER availability_requests_one_per_job_supplier BEFORE INSERT ON public.availability_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_one_ar_per_job_supplier();

CREATE INDEX availability_requests_job_supplier_idx ON public.availability_requests(job_request_id, supplier_id);
NOTIFY pgrst, 'reload schema';
COMMIT;
