-- 0060_drop_needs_attention.sql
-- Applied 2026-08-18 via the Supabase MCP at Bhoumik's request, one step
-- recorded in the Supabase history as `drop_needs_attention`.
--
-- Drops `needs_attention` from `job_requests` and `job_request_items`.
--
-- WHY. The flag was one of two ways a line said "somebody has to look at
-- this", and the weaker of the two. The other is `status`, which says the same
-- thing in a more specific word: `alternative_proposed` is a substitution
-- waiting to be approved, `unavailable` is a line somebody has to decide
-- about, `pending` is one nobody has answered. Only `available` needs no one.
--
-- Earlier the same day the app's "Needs input" surface was derived that way —
-- flag OR status <> 'available' — and the result made the case for deleting
-- the flag rather than keeping it: with the derivation right, the marker
-- appeared on nearly every row, which is a marker that distinguishes nothing.
-- The badges came off the rows, then the toolbar filter, and this is the end
-- of that: a column nothing reads and nothing writes is worse than no column,
-- because the next reader assumes it means something.
--
-- WHAT REPLACES IT. `status` for where a line stands, and `internal_notes` for
-- why — free text, a line per supplier, which is where the reason for needing
-- a human was always written anyway (`job-requests` skill).
--
-- No data lost: both tables were empty when this was applied. The prior values
-- of any row that ever carried the flag remain in `job_request_changelog`,
-- which is untouched — the trigger diffs `to_jsonb(NEW)` and simply stops
-- seeing a column that no longer exists.

ALTER TABLE public.job_requests      DROP COLUMN IF EXISTS needs_attention;
ALTER TABLE public.job_request_items DROP COLUMN IF EXISTS needs_attention;

NOTIFY pgrst, 'reload schema';

-- The two partial indexes over it (`job_requests_attention_idx`,
-- `job_request_items_attention_idx`, both `WHERE needs_attention AND
-- is_active`, from 0055) go with the column — Postgres drops an index that
-- depends on a dropped column, no separate statement needed.
--
-- ------------------------------------------------------------ post-apply --
-- Verified 2026-08-18: the column is gone from both tables (18 and 15 columns
-- remain); the two attention indexes are gone with it, and the six others on
-- these tables are untouched; PostgREST no longer exposes the column after the
-- reload.
