SELECT public.submit_availability_request_note(1,7,'  Whole request conditions  ');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM availability_requests WHERE id=1 AND status='submitted'
    AND submitted_at IS NOT NULL AND supplier_notes='Whole request conditions') THEN RAISE EXCEPTION 'note/status were not submitted together'; END IF;
  IF (SELECT notes FROM availability_request_items WHERE id=11) <> 'Line-only note' THEN RAISE EXCEPTION 'line note changed'; END IF;
  BEGIN
    PERFORM public.submit_availability_request_note(1,8,'Wrong supplier');
    RAISE EXCEPTION 'ownership test failed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='ownership test failed' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.submit_availability_request_note(1,7,repeat('x',10001));
    RAISE EXCEPTION 'length test failed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='length test failed' THEN RAISE; END IF; END;
  IF (SELECT supplier_notes FROM availability_requests WHERE id=1) <> 'Whole request conditions' THEN RAISE EXCEPTION 'rejected write changed note'; END IF;
END $$;
SELECT public.submit_public_availability_note('00000000-0000-4000-8000-000000000001','Updated via public response');
DO $$ BEGIN
  IF (SELECT supplier_notes FROM availability_requests WHERE id=1) <> 'Updated via public response' THEN RAISE EXCEPTION 'public note not saved'; END IF;
END $$;
SELECT public.submit_availability_request_note(1,7,' ');
DO $$ BEGIN
  IF (SELECT supplier_notes FROM availability_requests WHERE id=1) IS NOT NULL THEN RAISE EXCEPTION 'blank note not cleared'; END IF;
END $$;
UPDATE availability_requests SET status='closed',supplier_notes='Preserve closed history' WHERE id=1;
DO $$ BEGIN
  BEGIN
    PERFORM public.submit_availability_request_note(1,7,'Change closed');
    RAISE EXCEPTION 'closed supplier test failed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='closed supplier test failed' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.submit_public_availability_note('00000000-0000-4000-8000-000000000001','Change closed');
    RAISE EXCEPTION 'closed public test failed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='closed public test failed' THEN RAISE; END IF; END;
  IF (SELECT supplier_notes FROM availability_requests WHERE id=1) <> 'Preserve closed history' THEN RAISE EXCEPTION 'closed history changed'; END IF;
  IF has_function_privilege('anon','submit_availability_request_note(bigint,bigint,text)','EXECUTE')
    OR has_function_privilege('authenticated','submit_public_availability_note(uuid,text)','EXECUTE')
    OR NOT has_function_privilege('service_role','submit_availability_request_note(bigint,bigint,text)','EXECUTE')
    THEN RAISE EXCEPTION 'RPC permissions incorrect'; END IF;
END $$;
UPDATE availability_requests SET public_token=NULL WHERE id=2;
DO $$ BEGIN
  BEGIN
    PERFORM public.submit_public_availability_note('00000000-0000-4000-8000-000000000002','Revoked');
    RAISE EXCEPTION 'revoked token test failed';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM='revoked token test failed' THEN RAISE; END IF; END;
END $$;
SELECT 'supplier-note migration checks passed' AS result;
