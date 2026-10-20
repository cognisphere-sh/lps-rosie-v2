-- 0148 — a reserved job's chat is tagged once its row is written (2026-10-20)
--
-- New job request reserves the job's id (`reserve_job_request_id()`, 0072)
-- and opens its `jr-<id>` chat before Rosie writes the row. 0147's FK on
-- thread_messages.job_request_id then rejected every message sent there
-- (JR-127, 2026-10-20: "webchat request failed ... violates foreign key
-- constraint thread_messages_job_request_id_fkey", a 500 in the app). The
-- webchat plugin now stores such a message untagged, with its
-- origin_thread_id `jr-<id>`; this trigger tags those messages when the job
-- row is inserted, so the job's party tabs find them.
--
-- Ids come from the sequence and are never reused, so an untagged `jr-<id>`
-- message from a deleted job (SET NULL) is never claimed by another job.
-- Additive only.

CREATE FUNCTION public.tag_reserved_job_messages() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  UPDATE public.thread_messages
     SET job_request_id = NEW.id
   WHERE origin_thread_id = 'jr-' || NEW.id
     AND job_request_id IS NULL;
  RETURN NULL;
END $function$;

CREATE TRIGGER job_requests_tag_reserved_messages AFTER INSERT ON public.job_requests
  FOR EACH ROW EXECUTE FUNCTION public.tag_reserved_job_messages();
