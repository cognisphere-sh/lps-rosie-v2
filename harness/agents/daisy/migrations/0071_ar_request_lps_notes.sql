-- 0071: availability_requests.lps_notes — LPS's note to the supplier about
-- the whole request. Applied 2026-08-23 (Bhoumik, via Supabase MCP).
--
-- Sibling of the per-line lps_notes (0070), one level up: job context worth
-- the supplier's eyes — delivery window, site constraints, what matters
-- across the lines. Written by rosie at share time; the portal renders it on
-- the request card; not portal-writable. The same migration re-comments the
-- item column with its broadened semantics: the substitute and price our
-- inventory data mapped, a special request from the customer, or a customer
-- note worth the supplier's eyes.

ALTER TABLE public.availability_requests ADD COLUMN lps_notes text;

COMMENT ON COLUMN public.availability_requests.lps_notes IS
  'LPS''s note to the supplier about the whole request — job-level context worth their eyes: delivery window, site constraints, what matters across the lines. Written by rosie at share time; the portal renders it on the request card. Never supplier-writable.';

COMMENT ON COLUMN public.availability_request_items.lps_notes IS
  'LPS''s brief note to the supplier about this line — the substitute and price our inventory data mapped ("Substitute ok: Muskogee Crape Myrtle 30 G @ $265/unit"), a special request from the customer, or a customer note worth the supplier''s eyes. A few words; written by rosie at share time; rendered under the plant name in the portal. Never supplier-writable — their note is `notes`.';
