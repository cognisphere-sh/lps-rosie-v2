-- 0070: availability_request_items.lps_notes — LPS's brief note to the
-- supplier about a line, e.g. the substitute our sourcing mapped.
-- Applied 2026-08-23 (Bhoumik, via Supabase MCP).
--
-- Distinct from `notes`, which is the supplier's answer column: `lps_notes`
-- travels the other way. Written by rosie's supplier thread at share time
-- (a few words — "Substitute ok: Muskogee Crape Myrtle 30 G"); the supplier
-- portal renders it under the plant name; the portal PATCH whitelist does
-- not include it, so a supplier can never edit it.

ALTER TABLE public.availability_request_items ADD COLUMN lps_notes text;

COMMENT ON COLUMN public.availability_request_items.lps_notes IS
  'LPS''s brief note to the supplier about this line — a few words, e.g. the substitute our sourcing mapped ("Substitute ok: Muskogee Crape Myrtle 30 G"). Written by rosie at share time; the portal renders it under the plant name. Never supplier-writable — their note is `notes`.';
