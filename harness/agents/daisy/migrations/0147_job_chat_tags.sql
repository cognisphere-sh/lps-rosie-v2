-- 0147 — chat messages carry who sent them and which job they belong to (2026-10-19)
--
-- (Bhoumik 2026-10-19) "A single thread per job. It handles communication
-- with suppliers, Chris [webchat] and customer ... On each job's chatbar there
-- should be chat tab selector [one main between Chris and Rosie, and one for
-- each supplier and one for customer] ... For supplier view: It should be only
-- a single thread. Just that all message to have a job tag Name and
-- hyperlink." Decided with him the same day: portal partners only (customer
-- and non-partner tabs log Rosie's email correspondence), every portal message
-- goes through Rosie's router-<supplier> thread, LPS shows to suppliers as one
-- "Local Plant Supply" identity, and in a supplier tab "@Supplier" goes to the
-- supplier while everything else goes to Rosie.
--
-- A supplier's (or customer's) conversation stays one transcript per company
-- (`threads` row (rosie, supplier-<slug>)); a job's supplier tab is that
-- transcript filtered to the job. So each message now records:
-- * sender_kind      — lps (a team member) | agent | supplier | customer.
--                       Bubbles are placed and labelled from it. NULL on rows
--                       written by a plugin build older than this migration;
--                       readers fall back to role/portal (backfilled here).
-- * origin_thread_id — the agent thread the message belongs to (`jr-<id>`,
--                       `main`, ...). For a supplier message it is set when
--                       Rosie's router decides where it goes.
-- * job_request_id   — the job, when origin_thread_id is `jr-<id>`. A deleted
--                       job leaves its messages in the supplier's conversation
--                       untagged (SET NULL); its own jr- thread still cascades.
-- Additive only; no existing column changes.

ALTER TABLE public.thread_messages
  ADD COLUMN sender_kind text,
  ADD COLUMN origin_thread_id text,
  ADD COLUMN job_request_id bigint REFERENCES public.job_requests(id) ON DELETE SET NULL;

ALTER TABLE public.thread_messages
  ADD CONSTRAINT thread_messages_sender_kind_check
  CHECK (sender_kind IS NULL OR sender_kind IN ('lps', 'agent', 'supplier', 'customer'));

COMMENT ON COLUMN public.thread_messages.sender_kind IS
  'Who wrote it: lps (team member), agent, supplier or customer. NULL only on rows from a pre-0147 plugin; read as agent when role = agent, supplier when portal, else lps.';
COMMENT ON COLUMN public.thread_messages.origin_thread_id IS
  'The agent thread this message belongs to (jr-<id>, main, ...). Supplier portal messages get it when Rosie''s router routes them; NULL = not routed yet.';
COMMENT ON COLUMN public.thread_messages.job_request_id IS
  'The job this message is about, when origin_thread_id is jr-<id>. A job''s supplier/customer chat tab is that party''s transcript filtered to this column.';

-- Existing rows: who wrote them follows from role and portal; each belonged
-- to the thread it is stored on; job threads name their job.
UPDATE public.thread_messages m
   SET sender_kind = CASE WHEN m.role = 'agent' THEN 'agent' WHEN m.portal THEN 'supplier' ELSE 'lps' END,
       origin_thread_id = t.thread_id,
       job_request_id = CASE
         WHEN t.thread_id ~ '^jr-[1-9][0-9]*$'
          AND EXISTS (SELECT 1 FROM public.job_requests j WHERE j.id = substring(t.thread_id FROM 4)::bigint)
         THEN substring(t.thread_id FROM 4)::bigint END
  FROM public.threads t
 WHERE t.id = m.thread_id;

CREATE INDEX thread_messages_job_request_idx
  ON public.thread_messages (job_request_id, thread_id)
  WHERE job_request_id IS NOT NULL;
