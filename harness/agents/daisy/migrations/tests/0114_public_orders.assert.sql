DO $$
DECLARE old_token uuid := gen_random_uuid(); new_token uuid := gen_random_uuid();
BEGIN
  IF EXISTS (SELECT 1 FROM public.orders WHERE public_token IS NOT NULL) THEN RAISE EXCEPTION 'Orders must start private'; END IF;
  UPDATE public.orders SET public_token = old_token WHERE id = 1;
  BEGIN
    UPDATE public.orders SET public_token = old_token WHERE id = 2;
    RAISE EXCEPTION 'Duplicate token accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  UPDATE public.orders SET public_token = NULL WHERE id = 1;
  UPDATE public.orders SET public_token = new_token WHERE id = 1;
  IF EXISTS (SELECT 1 FROM public.orders WHERE public_token = old_token) THEN RAISE EXCEPTION 'Old link revived'; END IF;
  UPDATE public.orders SET status = 'closed_won' WHERE id = 1;
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = 1 AND public_token IS NOT NULL) THEN RAISE EXCEPTION 'Closure retained token'; END IF;
  UPDATE public.orders SET public_token = gen_random_uuid() WHERE id = 2;
  UPDATE public.orders SET is_active = false WHERE id = 2;
  IF EXISTS (SELECT 1 FROM public.orders WHERE id = 2 AND public_token IS NOT NULL) THEN RAISE EXCEPTION 'Deactivation retained token'; END IF;
  BEGIN
    UPDATE public.orders SET public_token = gen_random_uuid() WHERE id = 3;
    RAISE EXCEPTION 'Inactive supplier accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Public orders require an active supplier' THEN RAISE; END IF;
  END;
END $$;
