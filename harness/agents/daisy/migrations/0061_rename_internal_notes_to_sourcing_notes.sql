-- 0061_rename_internal_notes_to_sourcing_notes.sql
-- Applied 2026-08-18 via the Supabase MCP at Bhoumik's request, one step
-- recorded in the Supabase history as `rename_internal_notes_to_sourcing_notes`.
--
-- Renames `internal_notes` → `sourcing_notes` on `job_requests` and
-- `job_request_items`.
--
-- WHY. "Internal" said who may read it, which the other two note columns
-- already imply by contrast — `customer_notes` is theirs, `external_notes` is
-- what we show them, so the third is ours by elimination. What it does not say
-- is what goes in it, and that is the question a person actually has in front
-- of the box. `sourcing_notes` answers it: who we asked, what they said, what
-- it costs — a line per supplier.
--
-- SCOPE. Only rosie's two tables. `inventory.internal_notes` is daisy's and
-- means something different (parse caveats on an ingested row), so it keeps its
-- name; the two were never the same column with the same job.
--
-- The request-level column is the looser fit — what belongs there is what
-- changed about the job, not who was asked — but one name across both tables
-- beats two names for one idea in the UI.
--
-- A rename keeps the data, the column's position and the changelog: entries
-- written before today name `internal_notes` in their `changes` jsonb and are
-- left exactly as they were, because they are a record of what happened and
-- the column was called that when it happened.

ALTER TABLE public.job_requests      RENAME COLUMN internal_notes TO sourcing_notes;
ALTER TABLE public.job_request_items RENAME COLUMN internal_notes TO sourcing_notes;

COMMENT ON COLUMN public.job_requests.sourcing_notes IS
  'Ours. Free text, edited in place. At request level: what changed about the job ("Delivery date 8/22 → 8/29"). A line''s sourcing detail belongs on the line.';

COMMENT ON COLUMN public.job_request_items.sourcing_notes IS
  'The sourcing sheet — free text, edited in place, a terse line per supplier ("APS: $26/unit, availability requested"). Updated rather than appended to; the changelog holds what a line said before.';

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------ post-apply --
-- Verified 2026-08-18: both columns renamed with their contents intact (11
-- item rows, none empty); no `internal_notes` remains on either table;
-- PostgREST serves the new name after the reload and the app's PATCH
-- whitelist accepts it.
