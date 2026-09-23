DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public'
    AND table_name='availability_requests' AND column_name IN ('status_before_close','was_public_before_close')) THEN
    RAISE EXCEPTION 'Closure-history columns survived';
  END IF;
  IF EXISTS (SELECT 1 FROM availability_headers_expected_0109 old FULL JOIN public.availability_requests a USING(id)
    WHERE old.contents-'updated_at' IS DISTINCT FROM to_jsonb(a)-'updated_at')
    OR EXISTS (SELECT 1 FROM availability_items_before_0109 old FULL JOIN public.availability_request_items ai USING(id)
      WHERE old.contents IS DISTINCT FROM to_jsonb(ai)) THEN RAISE EXCEPTION 'Migration changed saved AR data'; END IF;
  IF EXISTS ((SELECT * FROM availability_links_before_0109 EXCEPT SELECT * FROM public.availability_request_jobs)
    UNION ALL (SELECT * FROM public.availability_request_jobs EXCEPT SELECT * FROM availability_links_before_0109))
    OR EXISTS ((SELECT * FROM availability_allocations_before_0109 EXCEPT SELECT * FROM public.availability_request_item_jobs)
    UNION ALL (SELECT * FROM public.availability_request_item_jobs EXCEPT SELECT * FROM availability_allocations_before_0109)) THEN
    RAISE EXCEPTION 'Migration changed associations';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=4200 AND NOT is_active AND status='closed') THEN
    RAISE EXCEPTION 'Legacy hidden request became visible';
  END IF;
END $$;

SET ROLE service_role;
DO $$
DECLARE request_id bigint; line_id bigint; current_status text; saved jsonb; saved_item jsonb;
  token uuid; shared_id bigint; inactive_id bigint; counts jsonb;
BEGIN
  -- Historical closures remain closed when the job reopens.
  UPDATE public.job_requests SET status='quoted' WHERE id=4201;
  IF (SELECT status FROM public.availability_requests WHERE id=4201)<>'closed' THEN
    RAISE EXCEPTION 'Job reopening implicitly reopened its AR';
  END IF;
  UPDATE public.availability_requests SET status='new' WHERE id=4201;
  IF (SELECT public_token FROM public.availability_requests WHERE id=4201) IS NOT NULL THEN
    RAISE EXCEPTION 'Explicit reopening silently published the AR';
  END IF;

  FOREACH current_status IN ARRAY ARRAY['new','processing','submitted','closed'] LOOP
    token:=gen_random_uuid();
    request_id:=public.create_availability_request(1,
      '[{"name":"Preserved","demanded_quantity":6,"lps_notes":"Named variety","allocations":[{"job_request_item_id":4200,"quantity":6}]}]',false,token);
    SELECT id INTO line_id FROM public.availability_request_items WHERE availability_request_id=request_id;
    PERFORM public.answer_availability_request(request_id,1,line_id,'{"supplier_notes":"Friday pickup","status":"available","available_quantity":"6","unit_price":"10"}');
    UPDATE public.availability_requests SET status=current_status WHERE id=request_id;
    SELECT to_jsonb(a)-'is_active'-'updated_at' INTO saved FROM public.availability_requests a WHERE id=request_id;
    SELECT to_jsonb(ai) INTO saved_item FROM public.availability_request_items ai WHERE id=line_id;
    UPDATE public.availability_requests SET is_active=false WHERE id=request_id;
    IF NOT EXISTS (SELECT 1 FROM public.availability_requests a WHERE id=request_id AND NOT is_active
      AND to_jsonb(a)-'is_active'-'updated_at'=saved)
      OR NOT EXISTS (SELECT 1 FROM public.availability_request_items ai WHERE id=line_id AND to_jsonb(ai)=saved_item)
      OR NOT EXISTS (SELECT 1 FROM public.availability_request_item_jobs WHERE availability_request_item_id=line_id) THEN
      RAISE EXCEPTION 'Deletion changed state, token, timestamp, answers or allocations for %',current_status;
    END IF;
    BEGIN
      PERFORM public.answer_public_availability(token,p_submit=>true);
      RAISE EXCEPTION 'Deleted public link remained usable';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'This link is no longer available' THEN RAISE; END IF; END;
    BEGIN
      PERFORM public.answer_availability_request(request_id,1,line_id,'{"supplier_notes":"Stale portal"}');
      RAISE EXCEPTION 'Deleted request accepted portal answer';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'This request is closed, deleted or unavailable' THEN RAISE; END IF; END;
    BEGIN
      PERFORM public.submit_availability_request_note(request_id,1,'Stale note');
      RAISE EXCEPTION 'Deleted request accepted header note';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'This request is closed, deleted or unavailable' THEN RAISE; END IF; END;
    BEGIN
      UPDATE public.availability_request_items SET lps_notes='Late edit' WHERE id=line_id;
      RAISE EXCEPTION 'Deleted request accepted direct line edit';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'This request is closed or deleted' THEN RAISE; END IF; END;
    BEGIN
      PERFORM public.create_order(1,jsonb_build_array(jsonb_build_object('availability_request_item_id',line_id,
        'allocations',jsonb_build_array(jsonb_build_object('job_request_item_id',4200,'quantity',1)))),NULL,NULL,NULL,true);
      RAISE EXCEPTION 'Deleted request accepted an order';
    EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'Availability request is closed or belongs to another supplier' THEN RAISE; END IF; END;
    UPDATE public.job_requests SET status='closed_lost' WHERE id=4200;
    UPDATE public.job_requests SET status='quoted' WHERE id=4200;
    IF NOT EXISTS (SELECT 1 FROM public.availability_requests a WHERE id=request_id AND NOT is_active
      AND to_jsonb(a)-'is_active'-'updated_at'=saved) THEN RAISE EXCEPTION 'Job lifecycle changed deleted AR'; END IF;
    -- An explicitly restored request keeps its saved state and token.
    UPDATE public.availability_requests SET is_active=true WHERE id=request_id;
    IF NOT EXISTS (SELECT 1 FROM public.availability_requests a WHERE id=request_id AND is_active
      AND to_jsonb(a)-'is_active'-'updated_at'=saved) THEN RAISE EXCEPTION 'Restoration changed saved AR state'; END IF;
    IF current_status<>'closed' THEN
      PERFORM public.answer_public_availability(token,line_id,'{"supplier_notes":"Restored access"}');
    END IF;
    UPDATE public.availability_requests SET is_active=false WHERE id=request_id;
  END LOOP;
  BEGIN
    UPDATE public.availability_requests SET status='hidden' WHERE id=4200;
    RAISE EXCEPTION 'Hidden status still accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;

  -- Active shared requests close only after their last open job closes.
  shared_id:=public.create_availability_request(1,
    '[{"name":"Shared","demanded_quantity":10,"allocations":[{"job_request_item_id":4200,"quantity":6},{"job_request_item_id":4201,"quantity":4}]}]',false,gen_random_uuid());
  PERFORM public.answer_availability_request(shared_id,1,p_submit=>true);
  UPDATE public.job_requests SET status='closed_lost' WHERE id=4200;
  IF (SELECT status FROM public.availability_requests WHERE id=shared_id)<>'submitted' THEN
    RAISE EXCEPTION 'Closed shared AR while another job remained open'; END IF;
  UPDATE public.job_requests SET status='closed_won' WHERE id=4201;
  IF NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=shared_id AND is_active AND status='closed' AND public_token IS NULL) THEN
    RAISE EXCEPTION 'Final job closure did not close/revoke active AR'; END IF;
  UPDATE public.job_requests SET status='quoted' WHERE id=4201;
  IF (SELECT status FROM public.availability_requests WHERE id=shared_id)<>'closed' THEN
    RAISE EXCEPTION 'Shared AR reopened implicitly'; END IF;

  -- Whole-job deletion retires exclusive ARs, preserving their lines and state.
  INSERT INTO public.job_requests(id,status) VALUES (4300,'quoted'),(4301,'quoted');
  INSERT INTO public.job_request_items(id,job_request_id,quantity) VALUES (4300,4300,6),(4301,4301,4);
  inactive_id:=public.create_availability_request(1,
    '[{"name":"Retained history","demanded_quantity":6,"allocations":[{"job_request_item_id":4300,"quantity":6}]}]',false,gen_random_uuid());
  SELECT to_jsonb(a)-'is_active'-'updated_at' INTO saved FROM public.availability_requests a WHERE id=inactive_id;
  shared_id:=public.create_availability_request(1,
    '[{"name":"Surviving shared","demanded_quantity":10,"allocations":[{"job_request_item_id":4300,"quantity":6},{"job_request_item_id":4301,"quantity":4}]}]');
  counts:=public.delete_job_request(4300);
  IF counts->>'availabilityRequests'<>'1' OR counts->>'availabilityRequestItems'<>'0'
    OR NOT EXISTS (SELECT 1 FROM public.availability_requests a WHERE id=inactive_id AND NOT is_active AND to_jsonb(a)-'is_active'-'updated_at'=saved)
    OR NOT EXISTS (SELECT 1 FROM public.availability_request_items WHERE availability_request_id=inactive_id)
    OR NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=shared_id AND is_active) THEN
    RAISE EXCEPTION 'Job deletion lost AR history or retired another job request'; END IF;
  PERFORM public.delete_job_request(4301);
  IF NOT EXISTS (SELECT 1 FROM public.availability_requests WHERE id=shared_id AND NOT is_active)
    OR NOT EXISTS (SELECT 1 FROM public.availability_request_items WHERE availability_request_id=shared_id) THEN
    RAISE EXCEPTION 'Final source deletion lost shared history'; END IF;
END $$;
RESET ROLE;
SELECT 'AR soft deletion, retained tokens, explicit reopening and job deletion checks passed' AS result;
