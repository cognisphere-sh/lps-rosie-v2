-- Run after 0147 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0147 body>; <this file>; ROLLBACK;
DO $$
DECLARE sup_thread bigint; msg bigint;
BEGIN
  -- Every existing row was classified, and jr- rows name a live job.
  IF EXISTS (SELECT 1 FROM public.thread_messages WHERE sender_kind IS NULL OR origin_thread_id IS NULL) THEN
    RAISE EXCEPTION 'unclassified message';
  END IF;
  IF EXISTS (SELECT 1 FROM public.thread_messages WHERE role = 'agent' AND sender_kind <> 'agent') THEN
    RAISE EXCEPTION 'agent row misclassified';
  END IF;
  IF EXISTS (SELECT 1 FROM public.thread_messages WHERE role = 'user' AND portal AND sender_kind <> 'supplier') THEN
    RAISE EXCEPTION 'portal row misclassified';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.thread_messages m JOIN public.threads t ON t.id = m.thread_id
     WHERE t.thread_id ~ '^jr-[1-9][0-9]*$' AND m.job_request_id IS DISTINCT FROM substring(t.thread_id FROM 4)::bigint
       AND EXISTS (SELECT 1 FROM public.job_requests j WHERE j.id = substring(t.thread_id FROM 4)::bigint)
  ) THEN RAISE EXCEPTION 'job thread row without its job'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.thread_messages m JOIN public.threads t ON t.id = m.thread_id
     WHERE t.thread_id !~ '^jr-' AND m.job_request_id IS NOT NULL
  ) THEN RAISE EXCEPTION 'non-job row tagged'; END IF;

  -- A supplier message tagged to a job survives the job's deletion, untagged.
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99470, 'Test 0147', 'availability');
  sup_thread := public.link_thread('rosie', 'supplier-test-0147');
  INSERT INTO public.thread_messages(thread_id, seq, role, text, portal, sender_kind, origin_thread_id, job_request_id)
    VALUES (sup_thread, 1, 'agent', 'Do you have Red Oak?', true, 'agent', 'jr-99470', 99470) RETURNING id INTO msg;
  DELETE FROM public.job_requests WHERE id = 99470;
  IF NOT EXISTS (SELECT 1 FROM public.thread_messages WHERE id = msg AND job_request_id IS NULL) THEN
    RAISE EXCEPTION 'supplier message lost or still tagged after job delete';
  END IF;

  -- The vocabulary is enforced.
  BEGIN
    INSERT INTO public.thread_messages(thread_id, seq, role, text, sender_kind) VALUES (sup_thread, 2, 'user', 'x', 'robot');
    RAISE EXCEPTION 'bad sender_kind accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
