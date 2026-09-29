-- Migration shape and backfill.
DO $$
DECLARE b record; c public.candidates;
BEGIN
  IF to_regclass('public.availability_request_items') IS NOT NULL
    OR to_regclass('public.availability_request_item_jobs') IS NOT NULL
    OR to_regclass('public.availability_request_jobs') IS NOT NULL THEN
    RAISE EXCEPTION 'Old AR line tables remain';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace
    AND prosrc ~ '(availability_request_item_jobs|availability_request_items|availability_request_jobs|selected_availability_request_item_id)') THEN
    RAISE EXCEPTION 'Stale function reference';
  END IF;
  IF EXISTS (SELECT 1 FROM ar_jobs_before l JOIN public.availability_requests ar ON ar.id = l.availability_request_id
      WHERE ar.job_request_id IS DISTINCT FROM l.job_request_id)
    OR EXISTS (SELECT 1 FROM public.availability_requests ar WHERE ar.job_request_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM ar_jobs_before l WHERE l.availability_request_id = ar.id)) THEN
    RAISE EXCEPTION 'AR job backfill wrong';
  END IF;
  FOR b IN SELECT * FROM candidates_before LOOP
    SELECT * INTO c FROM public.candidates WHERE id = b.id;
    IF c.supplier_id IS DISTINCT FROM b.ar_supplier_id OR c.job_request_item_id IS DISTINCT FROM b.linked_item_id
      OR c.updated_at IS DISTINCT FROM b.updated_at THEN
      RAISE EXCEPTION 'Backfill wrong for line %', b.id;
    END IF;
    IF c.answered_at IS DISTINCT FROM (CASE WHEN b.status IS NULL THEN NULL ELSE b.updated_at END) THEN
      RAISE EXCEPTION 'answered_at wrong for line %', b.id;
    END IF;
    IF b.status IS NOT NULL AND nullif(btrim(b.note_for_supplier), '') IS NOT NULL THEN
      IF c.note_from_supplier IS DISTINCT FROM b.note_for_supplier OR c.note_for_supplier IS NOT NULL
        OR c.note_for_customer IS DISTINCT FROM btrim(b.note_for_supplier) THEN
        RAISE EXCEPTION 'Answered note not moved for line %', b.id;
      END IF;
    ELSIF c.note_for_supplier IS DISTINCT FROM b.note_for_supplier OR c.note_from_supplier IS NOT NULL THEN
      RAISE EXCEPTION 'Unanswered note changed for line %', b.id;
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM candidates_before WHERE status IS NOT NULL AND note_for_supplier IS NOT NULL)
    OR NOT EXISTS (SELECT 1 FROM candidates_before WHERE status IS NULL AND note_for_supplier IS NOT NULL) THEN
    RAISE EXCEPTION 'Fixture does not cover both note cases';
  END IF;
END $$;

-- Candidate lifecycle: select, ask, answer, submit, delete, order.
INSERT INTO public.job_requests(id, status) OVERRIDING SYSTEM VALUE VALUES (9000, 'quoted');
INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity, note_for_customer)
  OVERRIDING SYSTEM VALUE VALUES (9000, 9000, 'Oak', '3 G', 10, 'How many?'), (9001, 9000, 'Elm', '1 G', 4, NULL);
INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name, size, unit_price, note_for_customer)
  OVERRIDING SYSTEM VALUE VALUES
  (9000, 1, 9000, 'Oak', '3 G', 0, NULL),
  (9001, 1, 9000, 'Oak', '5 G', 23, '3 G NA, only 5 G'),
  (9002, 9002, 9000, 'Oak', '3 G', 20, NULL),
  (9003, 1, 9001, 'Elm', '1 G', 7, NULL);

DO $$
DECLARE ar1 bigint; ar2 bigint; ji public.job_request_items; c public.candidates;
BEGIN
  -- Explicit selection copies the candidate, including an empty note.
  PERFORM public.select_candidate(9000, 9000);
  SELECT * INTO ji FROM public.job_request_items WHERE id = 9000;
  IF ji.selected_candidate_id <> 9000 OR ji.size <> '3 G' OR ji.unit_price IS NOT NULL
    OR ji.status <> 'pending' OR ji.note_for_customer IS NOT NULL THEN RAISE EXCEPTION 'Original selection: %', ji; END IF;
  PERFORM public.select_candidate(9000, 9001);
  SELECT * INTO ji FROM public.job_request_items WHERE id = 9000;
  IF ji.size <> '5 G' OR ji.unit_price <> 23 OR ji.note_for_customer <> '3 G NA, only 5 G' THEN
    RAISE EXCEPTION 'Substitute selection: %', ji; END IF;
  BEGIN
    PERFORM public.select_candidate(9000, 9003);
    RAISE EXCEPTION 'selected another line''s candidate';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Candidate not found for this line' THEN RAISE; END IF;
  END;

  -- Asking: partner joins/opens a portal AR, non-partner gets a public link.
  ar1 := public.request_candidate_availability(9001);
  IF public.request_candidate_availability(9000) <> ar1 THEN RAISE EXCEPTION 'Did not join the open AR'; END IF;
  IF public.request_candidate_availability(9000) <> ar1 THEN RAISE EXCEPTION 'Not idempotent'; END IF;
  IF (SELECT public_token FROM public.availability_requests WHERE id = ar1) IS NOT NULL THEN RAISE EXCEPTION 'Partner got a public link'; END IF;
  IF (SELECT demanded_quantity FROM public.candidates WHERE id = 9001) <> 10 THEN RAISE EXCEPTION 'Demand not seeded'; END IF;
  IF (SELECT job_request_id FROM public.availability_requests WHERE id = ar1) IS DISTINCT FROM 9000 THEN
    RAISE EXCEPTION 'AR not linked to job'; END IF;
  IF (SELECT status FROM public.job_requests WHERE id = 9000) <> 'availability' THEN RAISE EXCEPTION 'Job not advanced'; END IF;
  ar2 := public.request_candidate_availability(9002);
  IF ar2 = ar1 OR (SELECT public_token FROM public.availability_requests WHERE id = ar2) IS NULL THEN
    RAISE EXCEPTION 'Non-partner AR wrong'; END IF;
  BEGIN
    PERFORM public.add_candidates_to_availability_request(ar1, ARRAY[9002::bigint]);
    RAISE EXCEPTION 'attached another supplier''s candidate';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Each candidate must be%' THEN RAISE; END IF;
  END;

  -- One AR per job: another job's candidate can neither join nor share one.
  INSERT INTO public.job_requests(id, status) OVERRIDING SYSTEM VALUE VALUES (9050, 'quoted');
  INSERT INTO public.job_request_items(id, job_request_id, name, demanded_quantity) OVERRIDING SYSTEM VALUE VALUES (9050, 9050, 'Oak', 1);
  INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name) OVERRIDING SYSTEM VALUE VALUES (9050, 1, 9050, 'Oak');
  BEGIN
    PERFORM public.add_candidates_to_availability_request(ar1, ARRAY[9050::bigint]);
    RAISE EXCEPTION 'joined another job''s AR';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'Each candidate must be%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.create_availability_request(1, ARRAY[9050::bigint, 9003]);
    RAISE EXCEPTION 'one AR spans two jobs';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'An availability request asks for one job''s candidates' THEN RAISE; END IF;
  END;
  IF public.request_candidate_availability(9050) = ar1 THEN RAISE EXCEPTION 'Drag reused another job''s AR'; END IF;

  -- Supplier answer: size and price editable; the job line waits for submit.
  PERFORM public.answer_availability_request(ar1, 1, 9001,
    '{"status":"diff_size_qty_sub","size":"7 G","unit_price":"65","available_quantity":"8","note_from_supplier":"Only 7 G"}');
  IF (SELECT unit_price FROM public.job_request_items WHERE id = 9000) <> 23 THEN RAISE EXCEPTION 'Draft answer leaked'; END IF;
  BEGIN
    PERFORM public.answer_availability_request(ar1, 1, 9001, '{"note_for_supplier":"x"}');
    RAISE EXCEPTION 'supplier wrote the LPS note';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Invalid answer field' THEN RAISE; END IF;
  END;
  PERFORM public.answer_availability_request(ar1, 1, 9000, '{"status":"unavailable","unit_price":"5","available_quantity":"3"}');
  SELECT * INTO c FROM public.candidates WHERE id = 9000;
  IF c.available_quantity <> 0 OR c.unit_price <> 0 THEN RAISE EXCEPTION 'Unavailable not zeroed: %', c; END IF;
END $$;

-- Separate transactions so submitted_at and updated_at advance like the app.
SELECT public.answer_availability_request((SELECT availability_request_id FROM public.candidates WHERE id = 9001), 1, p_submit => true);

DO $$
DECLARE ji public.job_request_items; ar1 bigint := (SELECT availability_request_id FROM public.candidates WHERE id = 9001);
BEGIN
  SELECT * INTO ji FROM public.job_request_items WHERE id = 9000;
  IF ji.size <> '7 G' OR ji.unit_price <> 65 OR ji.available_quantity <> 8
    OR ji.status <> 'alternative_proposed' OR ji.note_for_customer <> 'Only 7 G' THEN
    RAISE EXCEPTION 'Submission not applied: %', ji; END IF;
  IF (SELECT note_for_customer FROM public.candidates WHERE id = 9001) <> 'Only 7 G' THEN
    RAISE EXCEPTION 'Supplier reply did not become the candidate note'; END IF;
  -- Chris edits the selected line: price stays on the line, the note follows to the candidate.
  UPDATE public.job_request_items SET unit_price = 70, note_for_customer = 'Only 7 G, ready Friday' WHERE id = 9000;
  IF (SELECT note_for_customer FROM public.candidates WHERE id = 9001) <> 'Only 7 G, ready Friday' THEN
    RAISE EXCEPTION 'Line note not written back to the selected candidate'; END IF;
  IF (SELECT note_for_customer FROM public.candidates WHERE id = 9000) IS NOT NULL THEN
    RAISE EXCEPTION 'Line note leaked to an unselected candidate'; END IF;
END $$;

SELECT public.answer_availability_request((SELECT availability_request_id FROM public.candidates WHERE id = 9001), 1, p_submit => true);

DO $$
DECLARE ji public.job_request_items; ord bigint;
BEGIN
  SELECT * INTO ji FROM public.job_request_items WHERE id = 9000;
  IF ji.unit_price <> 70 OR ji.note_for_customer <> 'Only 7 G, ready Friday' THEN
    RAISE EXCEPTION 'Unchanged re-submit overwrote Chris''s edit: %', ji; END IF;

  -- An order draws from the answered candidate and snapshots both notes.
  UPDATE public.candidates SET note_for_supplier = 'Single trunk please' WHERE id = 9001;
  ord := public.create_order(1, '[{"candidate_id":9001,"allocations":[{"job_request_item_id":9000,"quantity":2}]}]',
    p_customer_confirmed => true);
  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = ord AND size = '7 G' AND unit_price = 65
    AND note_for_supplier = E'Single trunk please\n\nOnly 7 G') THEN RAISE EXCEPTION 'Order snapshot wrong'; END IF;

  -- Bin: soft delete, unselect, keep the line's values.
  PERFORM public.delete_candidate(9001);
  SELECT * INTO ji FROM public.job_request_items WHERE id = 9000;
  IF ji.selected_candidate_id IS NOT NULL OR ji.size <> '7 G' THEN RAISE EXCEPTION 'Delete wrong: %', ji; END IF;
  IF (SELECT is_active FROM public.candidates WHERE id = 9001) THEN RAISE EXCEPTION 'Candidate still active'; END IF;

  -- Deleting a line removes its candidates.
  PERFORM public.delete_job_request_item(9000, 9001);
  IF EXISTS (SELECT 1 FROM public.candidates WHERE id = 9003) THEN RAISE EXCEPTION 'Line candidates survived'; END IF;
END $$;

-- Closing a job closes its ARs.
UPDATE public.job_requests SET status = 'closed_lost' WHERE id = 9050;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.availability_requests WHERE job_request_id = 9050 AND status <> 'closed') THEN
    RAISE EXCEPTION 'Closing a job left its AR open'; END IF;
END $$;

-- Deleting a job keeps asked candidates as supplier history, drops unasked ones.
INSERT INTO public.job_requests(id, status) OVERRIDING SYSTEM VALUE VALUES (9100, 'quoted');
INSERT INTO public.job_request_items(id, job_request_id, name, demanded_quantity) OVERRIDING SYSTEM VALUE VALUES (9100, 9100, 'Ash', 2);
INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name) OVERRIDING SYSTEM VALUE VALUES
  (9100, 1, 9100, 'Ash'), (9101, 1, 9100, 'Ash');
SELECT public.request_candidate_availability(9100);
DELETE FROM public.job_requests WHERE id = 9100;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.candidates WHERE id = 9101) THEN RAISE EXCEPTION 'Unasked candidate survived job delete'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.candidates WHERE id = 9100 AND job_request_item_id IS NULL) THEN
    RAISE EXCEPTION 'Asked candidate lost on job delete'; END IF;
  IF EXISTS (SELECT 1 FROM public.availability_requests ar JOIN public.candidates c ON c.availability_request_id = ar.id
    WHERE c.id = 9100 AND (ar.is_active OR ar.job_request_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'Deleted job''s AR not retired'; END IF;
END $$;
