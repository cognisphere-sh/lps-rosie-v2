-- Six selectable job stages: Active, Quote, Availability, Confirmed, Won, Lost.
-- Retain established keys, defaults and history; restore Availability separately
-- from Quote without guessing which historical quoted jobs were availability work.
BEGIN;

ALTER TABLE public.job_requests DROP CONSTRAINT job_requests_status_check;
ALTER TABLE public.job_requests ADD CONSTRAINT job_requests_status_check CHECK (
  status IN ('sourcing', 'quoted', 'availability', 'confirmed', 'closed_won', 'closed_lost', 'archived')
);

CREATE OR REPLACE FUNCTION public.record_job_workflow_event(p_job_request_id bigint, p_event text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE job public.job_requests; next_status text;
BEGIN
  IF p_event IS NULL OR p_event NOT IN
    ('pricing_fetched', 'availability_sent', 'quote_shared', 'customer_confirmed') THEN
    RAISE EXCEPTION 'Unknown job workflow event';
  END IF;
  SELECT * INTO job FROM public.job_requests WHERE id = p_job_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job request not found'; END IF;
  IF job.is_active AND job.status IN ('sourcing', 'quoted', 'availability') THEN
    IF p_event = 'customer_confirmed' THEN
      next_status := 'confirmed';
    ELSIF p_event = 'availability_sent' THEN
      next_status := 'availability';
    ELSIF job.status = 'sourcing' THEN
      next_status := 'quoted';
    END IF;
    IF next_status IS NOT NULL AND next_status <> job.status THEN
      UPDATE public.job_requests SET status = next_status WHERE id = job.id;
      RETURN next_status;
    END IF;
  END IF;
  RETURN job.status;
END $$;
REVOKE ALL ON FUNCTION public.record_job_workflow_event(bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_job_workflow_event(bigint, text) TO service_role;

COMMENT ON COLUMN public.job_requests.status IS
  'Sales stage: sourcing (Active, default), quoted (Quote), availability (Availability), confirmed (Confirmed), closed_won (Won), closed_lost (Lost). Archived is legacy history only. The first four stages stay active. Pricing/quote work advances Active to Quote; delivered availability advances Active/Quote to Availability; customer confirmation advances any pre-confirmation working stage to Confirmed. Repeated events never regress stages or reopen closed jobs.';

COMMIT;
