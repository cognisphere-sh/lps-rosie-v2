-- Five selectable sales stages: New, In Progress, Confirmed, Closed Won,
-- Closed Lost. Keep established sourcing/quoted values for agent compatibility.
-- Quote and Availability are now the same In Progress stage; the existing
-- changelog trigger records any availability -> quoted conversion.
BEGIN;

ALTER TABLE public.job_requests DROP CONSTRAINT job_requests_status_check;
UPDATE public.job_requests SET status = 'quoted' WHERE status = 'availability';
ALTER TABLE public.job_requests ADD CONSTRAINT job_requests_status_check CHECK (
  status IN ('sourcing', 'quoted', 'confirmed', 'closed_won', 'closed_lost', 'archived')
);

COMMENT ON COLUMN public.job_requests.status IS
  'Sales stage: sourcing (New, default), quoted (In Progress), confirmed, closed_won, closed_lost. Archived is legacy history only. Migration 0084 combines prior Quote and Availability into In Progress; the first three stages stay active.';

COMMIT;
