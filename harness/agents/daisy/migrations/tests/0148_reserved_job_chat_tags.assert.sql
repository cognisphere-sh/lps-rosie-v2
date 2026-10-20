-- Run after 0148 inside a transaction that is rolled back (live rehearsal):
-- BEGIN; <0148 body>; <this file>; ROLLBACK;
-- 99480 stands in for a reserved id (a real reserve would burn a sequence
-- value the rollback cannot return).
DO $$
DECLARE jr_thread bigint; sup_thread bigint; own bigint; tab bigint; other bigint;
BEGIN
  -- Messages sent while the id is only reserved are stored untagged.
  jr_thread := public.link_thread('rosie', 'jr-99480');
  sup_thread := public.link_thread('rosie', 'supplier-test-0148');
  INSERT INTO public.thread_messages(thread_id, seq, role, text, sender_kind, origin_thread_id)
    VALUES (jr_thread, 1, 'user', 'New job: 10 Red Oak', 'lps', 'jr-99480') RETURNING id INTO own;
  INSERT INTO public.thread_messages(thread_id, seq, role, text, sender_kind, origin_thread_id)
    VALUES (sup_thread, 1, 'user', 'Ask them about Red Oak', 'lps', 'jr-99480') RETURNING id INTO tab;
  INSERT INTO public.thread_messages(thread_id, seq, role, text, sender_kind, origin_thread_id)
    VALUES (sup_thread, 2, 'user', 'Not about this job', 'lps', 'main') RETURNING id INTO other;

  -- The tag still has to name a job that exists.
  BEGIN
    UPDATE public.thread_messages SET job_request_id = 99480 WHERE id = own;
    RAISE EXCEPTION 'tag to an unwritten job accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  -- Rosie writes the row with the reserved id: its messages get tagged.
  INSERT INTO public.job_requests(id, name, status) OVERRIDING SYSTEM VALUE VALUES (99480, 'Test 0148', 'availability');
  IF (SELECT count(*) FROM public.thread_messages WHERE id IN (own, tab) AND job_request_id = 99480) <> 2 THEN
    RAISE EXCEPTION 'reserved job messages not tagged on insert';
  END IF;
  IF (SELECT job_request_id FROM public.thread_messages WHERE id = other) IS NOT NULL THEN
    RAISE EXCEPTION 'message for another thread tagged';
  END IF;

  -- 0147's delete behaviour is unchanged.
  DELETE FROM public.job_requests WHERE id = 99480;
  IF NOT EXISTS (SELECT 1 FROM public.thread_messages WHERE id = tab AND job_request_id IS NULL) THEN
    RAISE EXCEPTION 'supplier message lost or still tagged after job delete';
  END IF;
END $$;
