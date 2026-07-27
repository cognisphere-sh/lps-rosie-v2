-- Split what we know about a supplier from what we've said to them.
--
-- `suppliers.notes` was carrying both durable profile facts and ad-hoc contact
-- history, which meant neither could be trusted: appending a contact log buried
-- the quirks, and rewriting the quirks lost the history.
--
-- `communication_notes` is an append-only contact log; `notes` keeps the
-- durable profile facts. Nullable text with no default, so this is a catalogue
-- change only — no table rewrite and no backfill over the ~910 rows.

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS communication_notes text;

COMMENT ON COLUMN public.suppliers.communication_notes IS
  'Append-only log of contact with this supplier: one timestamped entry per contact (channel, what, why, thread/message id). Distinct from notes, which holds durable profile facts.';

COMMENT ON COLUMN public.suppliers.notes IS
  'Durable profile facts about the supplier that have no dedicated column: quirks, preferences, price-list format, ordering constraints. Not a communication log.';
