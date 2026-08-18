-- 0058_job_request_item_status_vocabulary.sql
-- Applied 2026-08-18 via the Supabase MCP at Bhoumik's request, one step
-- recorded in the Supabase history as
-- `job_request_item_status_vocabulary`.
--
-- Narrow `job_request_items.status` from seven words to four.
--
--   pending → available, with alternative_proposed and unavailable as the two
--   ways a line can end up somewhere other than "yes".
--
-- WHAT WENT, AND WHY
--   * `sourcing` said "we are looking into it", which is not a state of the
--     line — it is an activity, and the activity is already recorded, item by
--     item and timestamped, in `internal_notes` (the sourcing log). Two places
--     recording the same thing is one place too many, and the note is the one
--     that says *what* was found out. A line being worked on is `pending`.
--   * `confirmed` was a stronger `available`, and nothing in the app or the
--     skills distinguished them. One word for "we can supply this".
--   * `cancelled` was a line withdrawn rather than a line we cannot fill; the
--     reason for either belongs in the notes, so `unavailable` carries both and
--     the note says which. (A line entered in error is deactivated —
--     `is_active = false` — not statused.)
--
-- The migration remaps before it narrows. At the time it was written only
-- `sourcing` (6 rows) and `available` (7) were in use, so the confirmed and
-- cancelled remaps were no-ops; they are here because rosie writes these rows
-- concurrently and a row could land between the count and the ALTER. Every
-- remap is recorded row by row in `job_request_changelog` by the existing
-- trigger, so the prior value of each line is recoverable.
--
-- `status` keeps its `pending` DEFAULT, which is still in the vocabulary, and
-- `job_request_items_status_idx` is untouched.
--
-- `job_requests.status` is NOT changed: `sourcing` there is the *request's*
-- lifecycle stage (sourcing → quoted → closed_won/closed_lost/archived) and
-- means something the line-item vocabulary never did.

UPDATE public.job_request_items SET status = 'pending'     WHERE status = 'sourcing';
UPDATE public.job_request_items SET status = 'available'   WHERE status = 'confirmed';
UPDATE public.job_request_items SET status = 'unavailable' WHERE status = 'cancelled';

ALTER TABLE public.job_request_items
  DROP CONSTRAINT job_request_items_status_check;

ALTER TABLE public.job_request_items
  ADD CONSTRAINT job_request_items_status_check CHECK (status IN
    ('pending', 'available', 'alternative_proposed', 'unavailable'));

COMMENT ON COLUMN public.job_request_items.status IS
  'pending -> available, with alternative_proposed and unavailable as the other two endings. What is being done about a pending line lives in internal_notes, not in a status (migration 0058).';
