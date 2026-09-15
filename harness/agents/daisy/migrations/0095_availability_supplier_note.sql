-- A supplier's request-wide response, saved atomically with explicit submission.
BEGIN;
ALTER TABLE public.availability_requests ADD COLUMN supplier_notes text;
COMMENT ON COLUMN public.availability_requests.supplier_notes IS
  'Supplier response note for the whole availability request. Separate from LPS instructions and per-line notes; submitted with answers.';

CREATE FUNCTION public.submit_availability_request_note(p_request_id bigint, p_supplier_id bigint, p_note text)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF length(p_note) > 10000 THEN RAISE EXCEPTION 'Supplier note must be 10000 characters or fewer'; END IF;
  -- Existing submission locks and verifies the active request and supplier,
  -- rejects closed requests, and stamps submitted_at in this transaction.
  PERFORM public.answer_availability_request(p_request_id, p_supplier_id, p_submit => true);
  UPDATE public.availability_requests SET supplier_notes = nullif(btrim(p_note), '') WHERE id = p_request_id;
  RETURN p_request_id;
END $$;

CREATE FUNCTION public.submit_public_availability_note(p_token uuid, p_note text)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE ar public.availability_requests;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE public_token = p_token AND is_active AND status <> 'closed' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This link is no longer available'; END IF;
  RETURN public.submit_availability_request_note(ar.id, ar.supplier_id, p_note);
END $$;
REVOKE ALL ON FUNCTION public.submit_availability_request_note(bigint,bigint,text),
  public.submit_public_availability_note(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_availability_request_note(bigint,bigint,text),
  public.submit_public_availability_note(uuid,text) TO service_role;
COMMIT;
