-- 0063_supplier_chat_transcript.sql
-- Applied 2026-08-19 via the Supabase MCP, one step recorded in the Supabase
-- history as `supplier_chat_transcript`.
--
-- The supplier communication log becomes a chat transcript (Bhoumik,
-- 2026-08-19): `supplier_messages` is now THE record of everything said with a
-- supplier, rendered as a chat view, and `suppliers.communication_notes` is
-- retired — kept as a read-only archive, never written again. (The customers'
-- `communication_notes` is untouched: the customer side keeps its log.)
--
-- Two changes:
--
-- 1. `supplier_messages.channel` gains **`internal`** — a message on the
--    thread that is not supplier-facing: Chris instructing daisy, another
--    agent's note on the supplier thread (rosie's sourcing ask), or an
--    agent's own note. The other three channels stay what they were: where a
--    supplier-facing exchange actually happened.
--
-- 2. Every existing `suppliers.communication_notes` entry is migrated into
--    `supplier_messages` as an `internal` note from the broker side: the
--    entries are prose *about* contacts ("Received the Everde newsletter…"),
--    not message bodies, so `internal` is the honest channel whatever channel
--    the entry names in its header — the header line (`email ·
--    gmailThreadId=…`) is kept as the first line of the body, so the
--    identifiers survive. `created_at` comes from the entry's stamp
--    (America/Chicago per the note convention), falling back to the
--    supplier's own `created_at` for unstamped text. Literal `\n` sequences
--    (the known single-quoted-newline writing bug) are normalized to real
--    newlines first, so those entries both split and read correctly.
--
-- The column itself is NOT dropped: it is evidence, the migration is a
-- transformation of it, and dropping it would make the transformation
-- unauditable. It is commented as a frozen archive instead.

-- ---- channel vocabulary -----------------------------------------------------
ALTER TABLE public.supplier_messages
  DROP CONSTRAINT IF EXISTS supplier_messages_channel_check;
ALTER TABLE public.supplier_messages
  ADD CONSTRAINT supplier_messages_channel_check
  CHECK (channel IN ('email', 'text', 'app', 'internal'));

COMMENT ON COLUMN public.supplier_messages.channel IS
  'app = typed in the portal or admin thread; email/text = a supplier-facing exchange that happened outside and is recorded here; internal = not supplier-facing (an instruction to daisy, another agent''s note, a broker-side note).';

-- ---- migrate the old log ----------------------------------------------------
WITH entries AS (
  SELECT
    s.id AS supplier_id,
    s.created_at AS fallback,
    btrim(e.entry) AS entry
  FROM public.suppliers s,
  LATERAL regexp_split_to_table(
    replace(s.communication_notes, '\n', E'\n'),  -- literal \n → newline
    E'\n\\s*\n'
  ) AS e(entry)
  WHERE s.communication_notes IS NOT NULL
    AND btrim(s.communication_notes) <> ''
    AND btrim(e.entry) <> ''
)
INSERT INTO public.supplier_messages
  (supplier_id, sender, sender_name, channel, body, created_at)
SELECT
  supplier_id,
  'broker',
  NULL,
  'internal',
  btrim(regexp_replace(entry, '^\[[^\]]*\]\s*', '')),
  COALESCE(
    (substring(entry FROM '^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})'))::timestamp
      AT TIME ZONE 'America/Chicago',
    fallback
  )
FROM entries
WHERE btrim(regexp_replace(entry, '^\[[^\]]*\]\s*', '')) <> '';

-- ---- retire the column ------------------------------------------------------
COMMENT ON COLUMN public.suppliers.communication_notes IS
  'RETIRED 2026-08-19 (migration 0063): frozen archive of the old contact log. The record is supplier_messages now — never write this column again.';

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------ post-apply --
-- Verified 2026-08-19: 196 entries migrated from the 92 suppliers that had a
-- log, zero literal `\n` sequences left in the migrated bodies, stamps parsed
-- (six pre-2026 stamps exist in the source data and were kept as written —
-- they are evidence). Both column comments in place.
