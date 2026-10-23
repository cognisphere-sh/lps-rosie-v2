-- Local demo schema for the onboarding videos: the production STRUCTURE (no rows),
-- rebuilt on 2026-10-23 from the live catalog and the latest migration text.
-- Function bodies match production by md5(prosrc) except plant_photo_reclaimable,
-- search_inventory and search_query_groups (admin plant search; unused by the portal).
create extension if not exists moddatetime with schema extensions;
create extension if not exists pg_trgm with schema public;
create extension if not exists pgroonga with schema public;
create extension if not exists pgcrypto with schema extensions;
set check_function_bodies = off;
CREATE OR REPLACE FUNCTION public.normalize_plant_key(txt text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select regexp_replace(lower(coalesce(txt, '')), '[^a-z]', '', 'g')
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_search_text(txt text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select regexp_replace(
           regexp_replace(
             regexp_replace(lower(coalesce(txt, '')), '[^a-z0-9\s]', ' ', 'g'),
             '([a-z])([0-9])', '\1 \2', 'g'),
           '([0-9])([a-z])', '\1 \2', 'g')
$function$
;

CREATE OR REPLACE FUNCTION public.normalize_size(s text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select nullif(ltrim(btrim(regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(
    regexp_replace(s, '(^|[^0-9.])0+([0-9])', '\1\2', 'g'),
      '([0-9.]+)\s*(gallons?|gal|ga|g)\y\.?', '\1 G', 'gi'),
      '#\s*([0-9.]+)\y', '\1 G', 'g'),
      '([0-9.]+)\s*#', '\1 G', 'g'),
      '([0-9.]+)\s*(ft|feet|foot)\y\.?', '\1''', 'gi'),
      '([0-9.]+)\s*(inches|inch|in)\y\.?', '\1"', 'gi'),
      '\s*-?\s*\(([0-9][-0-9. ]*(''|"|G))\)', '/\1', 'g'),
      '\s*/\s*', '/', 'g'),
      '([0-9.]+)\s+([''"])', '\1\2', 'g'),
      '\s+', ' ', 'g')), '/'), '');
$function$
;

CREATE OR REPLACE FUNCTION public.app_users_parent_supplier()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  if new.supplier_id is not null then
    if not exists (
      select 1 from public.suppliers s
      where s.id = new.supplier_id and s.head_branch_id = s.id
    ) then
      raise exception
        'app_users.supplier_id % is a branch; portal accounts attach to the head branch',
        new.supplier_id;
    end if;
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_supplier_lps_partner()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  target bigint;
begin
  foreach target in array (
    select array_agg(distinct v) from unnest(array[
      case when tg_op in ('UPDATE', 'DELETE') then old.supplier_id end,
      case when tg_op in ('UPDATE', 'INSERT') then new.supplier_id end
    ]) as v where v is not null
  )
  loop
    update public.suppliers s
       set is_lps_partner = exists (
             select 1 from public.app_users a
              where a.supplier_id = s.id and a.role = 'partner'
           )
     where s.id = target
       and s.is_lps_partner is distinct from exists (
             select 1 from public.app_users a
              where a.supplier_id = s.id and a.role = 'partner'
           );
  end loop;
  return null;
end;
$function$
;
-- add_candidates_to_availability_request from 0136_demand_on_job_line.sql
CREATE OR REPLACE FUNCTION public.add_candidates_to_availability_request(p_request_id bigint, p_candidate_ids bigint[])
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests; attached bigint;
BEGIN
  IF coalesce(cardinality(p_candidate_ids), 0) = 0 THEN RAISE EXCEPTION 'Candidates are required'; END IF;
  SELECT * INTO ar FROM public.availability_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Availability request not found'; END IF;
  IF ar.status IN ('submitted', 'processing', 'closed') THEN
    RAISE EXCEPTION 'AR-% is %: reopen it before adding candidates', ar.id, ar.status;
  END IF;
  UPDATE public.candidates c SET availability_request_id = ar.id,
      status = CASE WHEN c.answered_at IS NOT NULL THEN NULL ELSE c.status END,
      available_quantity = CASE WHEN c.answered_at IS NOT NULL THEN NULL ELSE c.available_quantity END,
      answered_at = NULL
    FROM public.job_request_items ji JOIN public.job_requests j ON j.id = ji.job_request_id
    WHERE c.id = ANY(p_candidate_ids) AND c.is_active AND c.availability_request_id IS NULL
      AND c.supplier_id = ar.supplier_id AND ji.id = c.job_request_item_id AND ji.is_active
      AND ji.job_request_id = ar.job_request_id
      AND j.is_active AND j.status NOT IN ('closed_won', 'closed_lost', 'archived');
  GET DIAGNOSTICS attached = ROW_COUNT;
  IF attached <> cardinality(ARRAY(SELECT DISTINCT unnest(p_candidate_ids))) THEN
    RAISE EXCEPTION 'Each candidate must be active, unasked, on an open line of this request''s job and for its supplier';
  END IF;
  RETURN ar.id;
END $function$;

-- advance_linked_job_on_partner_request from 0127_ar_publish_and_retention.sql
CREATE OR REPLACE FUNCTION public.advance_linked_job_on_partner_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.job_request_id IS NOT NULL AND NEW.status NOT IN ('draft', 'closed')
    AND (TG_OP = 'INSERT' OR OLD.status = 'draft') AND EXISTS (
    SELECT 1 FROM public.suppliers s WHERE s.id = NEW.supplier_id AND s.is_active AND s.is_lps_partner) THEN
    PERFORM public.record_job_workflow_event(NEW.job_request_id, 'availability_sent');
  END IF;
  RETURN NULL;
END $function$;

-- answer_availability_request from 0130_job_lines_from_selected_candidate.sql
CREATE OR REPLACE FUNCTION public.answer_availability_request(p_request_id bigint, p_supplier_id bigint,
  p_item_id bigint DEFAULT NULL::bigint, p_changes jsonb DEFAULT NULL::jsonb, p_submit boolean DEFAULT false)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests; cur public.candidates; k text; next_status text;
  next_offer bigint; next_description text; has_offer boolean; typed boolean; prev_typed boolean;
  offer_changed boolean; qty numeric; demand numeric;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE id = p_request_id AND supplier_id = p_supplier_id  AND status <> 'closed'
      AND (status <> 'draft' OR current_setting('lps.ar_admin_edit', true) = 'on') FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = ar.supplier_id AND is_active) THEN
    RAISE EXCEPTION 'This request is closed, draft or unavailable';
  END IF;
  IF p_submit THEN
    UPDATE public.availability_requests SET status = 'submitted', submitted_at = now() WHERE id = ar.id;
    RETURN ar.id;
  END IF;
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb THEN
    RAISE EXCEPTION 'Changes are required';
  END IF;
  -- offer_unit_price / offer_quantity are still accepted but ignored: a
  -- substitute's price and quantity are its own (sent as unit_price /
  -- available_quantity, which go to it).
  FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
    IF k NOT IN ('status', 'available_quantity', 'unit_price', 'note_from_supplier',
        'offered_candidate_id', 'offer_description', 'offer_unit_price', 'offer_quantity')
      OR jsonb_typeof(p_changes->k) <> 'string' THEN
      RAISE EXCEPTION 'Invalid answer field';
    END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['available_quantity', 'unit_price', 'offer_unit_price', 'offer_quantity'] LOOP
    IF p_changes ? k AND nullif(trim(p_changes->>k), '')::numeric::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'Answer numbers must be finite';
    END IF;
  END LOOP;
  SELECT * INTO cur FROM public.candidates
    WHERE id = p_item_id AND availability_request_id = ar.id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Line not found'; END IF;
  -- A substitute is answered through the asked row that offers it.
  IF EXISTS (SELECT 1 FROM public.candidates
      WHERE offered_candidate_id = cur.id AND availability_request_id = ar.id AND is_active) THEN
    RAISE EXCEPTION 'This is a substitute: answer the line that offers it';
  END IF;
  prev_typed := cur.offered_candidate_id IS NOT NULL AND cur.offer_description IS NOT NULL;

  next_status := CASE WHEN p_changes ? 'status' THEN nullif(trim(p_changes->>'status'), '') ELSE cur.status END;
  next_description := CASE WHEN p_changes ? 'offer_description'
    THEN nullif(btrim(p_changes->>'offer_description'), '') ELSE cur.offer_description END;
  -- {status: 'unavailable'} alone keeps the substitute already offered.
  next_offer := CASE WHEN p_changes ? 'offered_candidate_id'
    THEN nullif(trim(p_changes->>'offered_candidate_id'), '')::bigint ELSE cur.offered_candidate_id END;
  -- A typed substitute owns the candidate made for it; a tag has no description.
  typed := next_description IS NOT NULL AND (next_offer IS NULL OR (prev_typed AND next_offer = cur.offered_candidate_id));
  IF NOT typed THEN next_description := NULL; END IF;
  -- Editing a typed substitute keeps its candidate; a new one gets its own.
  IF typed THEN next_offer := CASE WHEN prev_typed THEN cur.offered_candidate_id END; END IF;
  has_offer := next_offer IS NOT NULL OR typed;
  -- A substitute makes the asked candidate Unavailable; Diff Sz/Sub needs one.
  -- A legacy Diff Sz/Sub answer without one is kept while neither is changed.
  IF next_status IN ('unavailable', 'diff_size_sub') AND has_offer THEN
    next_status := 'unavailable';
  ELSIF next_status = 'diff_size_sub' AND (p_changes ? 'status'
      OR p_changes ? 'offered_candidate_id' OR p_changes ? 'offer_description') THEN
    RAISE EXCEPTION 'Pick or describe the substitute';
  END IF;
  IF next_status IS DISTINCT FROM 'unavailable' THEN next_offer := NULL; next_description := NULL; typed := false; has_offer := false; END IF;
  IF next_offer IS NOT NULL AND NOT typed THEN
    IF NOT EXISTS (SELECT 1 FROM public.candidates o
        WHERE o.id = next_offer AND o.id <> cur.id AND o.is_active AND o.supplier_id = cur.supplier_id
          AND o.job_request_item_id IS NOT DISTINCT FROM cur.job_request_item_id
          AND cur.job_request_item_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Offered candidate must be another candidate of this line and supplier';
    END IF;
    -- A row asked on this request in its own right keeps its own answer.
    IF next_offer IS DISTINCT FROM cur.offered_candidate_id AND EXISTS (SELECT 1 FROM public.candidates
        WHERE id = next_offer AND availability_request_id = ar.id) THEN
      RAISE EXCEPTION 'That candidate is asked on this request: answer it on its own line';
    END IF;
  END IF;
  IF typed AND cur.job_request_item_id IS NULL THEN RAISE EXCEPTION 'This line has no job line for a substitute'; END IF;

  -- The previous substitute, if it is being replaced or cleared.
  IF cur.offered_candidate_id IS NOT NULL AND cur.offered_candidate_id IS DISTINCT FROM next_offer THEN
    PERFORM public.release_candidate_offer(cur.id);
  END IF;
  -- A typed substitute: a placeholder named with the text (price unknown,
  -- Rosie enriches it after submission), or the one already made for it.
  IF typed AND next_offer IS NULL THEN
    INSERT INTO public.candidates(supplier_id, job_request_item_id, availability_request_id, name, description,
        is_original, unit_price, demanded_quantity, status, note_from_supplier, answered_at)
      VALUES (cur.supplier_id, cur.job_request_item_id, ar.id, next_description, next_description,
        false, NULL, cur.demanded_quantity, 'diff_size_sub', next_description, now())
      RETURNING id INTO next_offer;
  ELSIF typed AND next_description IS DISTINCT FROM cur.offer_description THEN
    -- Only a changed text renames it, so Rosie's enrichment survives other edits.
    UPDATE public.candidates SET name = next_description, description = next_description WHERE id = next_offer;
  END IF;
  offer_changed := has_offer AND next_offer IS DISTINCT FROM cur.offered_candidate_id;

  -- Available below demand is Partial Qty; Partial Qty at full demand is Available.
  qty := nullif(trim(p_changes->>'available_quantity'), '')::numeric;
  demand := coalesce(cur.demanded_quantity,
    (SELECT demanded_quantity FROM public.job_request_items WHERE id = cur.job_request_item_id));
  IF NOT has_offer AND qty IS NOT NULL AND demand IS NOT NULL THEN
    IF next_status = 'available' AND qty > 0 AND qty < demand THEN next_status := 'partial_qty';
    ELSIF next_status = 'partial_qty' AND qty >= demand THEN next_status := 'available';
    END IF;
  END IF;

  -- The asked row. With a substitute, its price, quantity and reply belong
  -- to the substitute (the AR row shows them from there).
  UPDATE public.candidates SET
    status = next_status,
    -- Unavailable zeroes the quantity; a status never changes the price (0122).
    available_quantity = CASE WHEN next_status = 'unavailable' THEN 0
      WHEN p_changes ? 'available_quantity' THEN qty ELSE available_quantity END,
    unit_price = CASE WHEN NOT has_offer AND p_changes ? 'unit_price'
      THEN nullif(trim(p_changes->>'unit_price'), '')::numeric ELSE unit_price END,
    note_from_supplier = CASE WHEN has_offer THEN NULL WHEN p_changes ? 'note_from_supplier'
      THEN nullif(trim(p_changes->>'note_from_supplier'), '') ELSE note_from_supplier END,
    offered_candidate_id = next_offer,
    offer_description = next_description,
    offer_unit_price = NULL,
    offer_quantity = NULL,
    answered_at = now()
  WHERE id = cur.id;
  IF has_offer THEN
    -- A new substitute, or the row newly answered with it, (re)applies it;
    -- a later edit leaves the substitute's own quantity as set.
    IF offer_changed OR cur.status IS DISTINCT FROM 'unavailable' THEN
      PERFORM public.apply_candidate_offer(cur.id);
    END IF;
    IF p_changes ?| ARRAY['unit_price', 'available_quantity', 'note_from_supplier'] THEN
      UPDATE public.candidates SET
        unit_price = CASE WHEN p_changes ? 'unit_price'
          THEN nullif(trim(p_changes->>'unit_price'), '')::numeric ELSE unit_price END,
        available_quantity = CASE WHEN p_changes ? 'available_quantity' THEN qty ELSE available_quantity END,
        note_from_supplier = CASE WHEN p_changes ? 'note_from_supplier'
          THEN nullif(trim(p_changes->>'note_from_supplier'), '') ELSE note_from_supplier END,
        answered_at = now()
      WHERE id = next_offer;
    END IF;
  END IF;
  -- A supplier answer marks the AR Processing; an LPS edit keeps its status.
  IF ar.status <> 'draft' AND current_setting('lps.ar_admin_edit', true) IS DISTINCT FROM 'on' THEN
    UPDATE public.availability_requests SET status = 'processing' WHERE id = ar.id;
  END IF;
  RETURN ar.id;
END $function$;

-- answer_public_availability from 0127_ar_publish_and_retention.sql
CREATE OR REPLACE FUNCTION public.answer_public_availability(p_token uuid, p_item_id bigint DEFAULT NULL::bigint, p_changes jsonb DEFAULT NULL::jsonb, p_submit boolean DEFAULT false)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE ar public.availability_requests;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE public_token = p_token  AND status NOT IN ('closed', 'draft') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This link is no longer available'; END IF;
  RETURN public.answer_availability_request(ar.id, ar.supplier_id, p_item_id, p_changes, p_submit);
END $function$;

-- apply_candidate_offer from 0136_demand_on_job_line.sql
CREATE OR REPLACE FUNCTION public.apply_candidate_offer(p_candidate_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE src public.candidates; offered public.candidates; demand numeric;
BEGIN
  SELECT * INTO src FROM public.candidates
    WHERE id = p_candidate_id AND is_active AND status = 'unavailable' AND offered_candidate_id IS NOT NULL;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO offered FROM public.candidates WHERE id = src.offered_candidate_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  demand := coalesce((SELECT demanded_quantity FROM public.job_request_items WHERE id = offered.job_request_item_id),
    offered.demanded_quantity, src.demanded_quantity);
  UPDATE public.candidates SET
    availability_request_id = src.availability_request_id,
    status = 'diff_size_sub',
    available_quantity = demand,
    hide_from_lps = false,
    answered_at = now()
  WHERE id = offered.id;
END $function$;

-- apply_submitted_candidates from 0132_answer_followups.sql
CREATE OR REPLACE FUNCTION public.apply_submitted_candidates() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  UPDATE public.job_request_items ji SET selected_candidate_id = s.id
    FROM public.candidates c, public.candidates s, public.job_requests j
    WHERE c.id = ji.selected_candidate_id AND c.availability_request_id = NEW.id AND c.is_active
      AND c.status = 'unavailable' AND c.answered_at > coalesce(OLD.submitted_at, '-infinity'::timestamptz)
      AND s.id = c.offered_candidate_id AND s.is_active AND s.job_request_item_id = ji.id
      AND ji.is_active AND j.id = ji.job_request_id AND j.is_active AND j.status IN ('quoted', 'availability');
  PERFORM public.hide_submitted_alternatives(NEW.id);
  RETURN NULL;
END $function$;

-- candidate_status_quantity from 0132_answer_followups.sql
CREATE OR REPLACE FUNCTION public.candidate_status_quantity() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE demand numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  demand := coalesce(NEW.demanded_quantity,
    (SELECT demanded_quantity FROM public.job_request_items WHERE id = NEW.job_request_item_id));
  IF NEW.status = 'available' THEN
    NEW.available_quantity := coalesce(demand, NEW.available_quantity);
  ELSIF NEW.status = 'unavailable' THEN
    NEW.available_quantity := 0;
  ELSIF NEW.status = 'diff_size_sub' AND NEW.available_quantity IS NULL THEN
    NEW.available_quantity := demand;
  ELSIF NEW.status IS NULL AND TG_OP = 'UPDATE' THEN
    NEW.available_quantity := NULL;
  END IF;
  RETURN NEW;
END $function$;

-- cascade_source_deactivation from 0048_cascade_source_deactivation.sql
create or replace function public.cascade_source_deactivation()
returns trigger
language plpgsql
as $function$
begin
  update public.inventory
    set is_active = false
    where source_id = new.id and is_active = true;
  return new;
end;
$function$;

-- cascade_supplier_deactivation from 0034_contact_supplier_links.sql
create or replace function public.cascade_supplier_deactivation()
returns trigger
language plpgsql
as $function$
begin
  update public.inventory
    set is_active = false
    where supplier_id = new.id and is_active = true;
  update public.inventory_sources
    set is_active = false
    where supplier_id = new.id and is_active = true;
  update public.supplier_contacts
    set is_active = false
    where supplier_id = new.id and is_active = true;
  update public.contacts c
    set is_active = false
    where c.is_active = true
      and exists (select 1 from public.supplier_contacts sc
                   where sc.contact_id = c.id and sc.supplier_id = new.id)
      and not exists (select 1 from public.supplier_contacts sc
                       where sc.contact_id = c.id and sc.is_active);
  return new;
end;
$function$;

-- close_ar_on_job_status_change from 0127_ar_publish_and_retention.sql
CREATE OR REPLACE FUNCTION public.close_ar_on_job_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Job reopening never restores ARs. Deleted ARs retain their saved state.
  IF NEW.is_active AND NEW.status NOT IN ('closed_won', 'closed_lost', 'archived') THEN RETURN NEW; END IF;
  UPDATE public.availability_requests SET status = 'closed', public_token = NULL
    WHERE job_request_id = NEW.id AND (status <> 'closed' OR public_token IS NOT NULL);
  RETURN NEW;
END $function$;

-- close_order from 0146_order_per_job_supplier.sql
CREATE OR REPLACE FUNCTION public.close_order(p_order_id bigint, p_status text)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE job_id bigint;
BEGIN
  IF p_status IS NULL OR p_status NOT IN ('closed_won', 'closed_lost') THEN RAISE EXCEPTION 'Choose Won or Lost'; END IF;
  SELECT o.job_request_id INTO job_id FROM public.orders o WHERE o.id = p_order_id;
  PERFORM 1 FROM public.job_requests WHERE id = job_id FOR UPDATE;
  UPDATE public.orders SET status = p_status WHERE id = p_order_id AND is_active
    AND (status IN ('new', 'processing', 'order_ready') OR status = p_status);
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is unavailable or already closed with a different outcome'; END IF;
  -- The job closes with its last open order: Won if any of its orders was won.
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE job_request_id = job_id AND is_active
      AND status IN ('new', 'processing', 'order_ready')) THEN
    UPDATE public.job_requests SET status = CASE WHEN EXISTS (SELECT 1 FROM public.orders
        WHERE job_request_id = job_id AND is_active AND status = 'closed_won') THEN 'closed_won' ELSE 'closed_lost' END
      WHERE id = job_id AND is_active AND status NOT IN ('closed_won', 'closed_lost', 'archived');
  END IF;
  RETURN p_order_id;
END $function$;

-- close_orphaned_availability_on_job_delete from 0146_order_per_job_supplier.sql
CREATE OR REPLACE FUNCTION public.close_orphaned_availability_on_job_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE
  ar_ids bigint[] := '{}'; order_ids bigint[] := '{}';
  ar_count bigint := 0; ar_items bigint := 0; order_count bigint := 0; order_items_count bigint := 0;
  item_count bigint; history_count bigint; thread_count bigint; row_id bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('deleted-job:jr-' || OLD.id, 0));
  FOR row_id IN SELECT id FROM public.orders WHERE job_request_id=OLD.id ORDER BY id FOR UPDATE LOOP
    order_ids := array_append(order_ids,row_id);
  END LOOP;
  FOR row_id IN SELECT id FROM public.availability_requests WHERE job_request_id=OLD.id ORDER BY id FOR UPDATE LOOP
    ar_ids := array_append(ar_ids,row_id);
  END LOOP;
  SELECT count(*) INTO item_count FROM public.job_request_items WHERE job_request_id=OLD.id;
  SELECT count(*) INTO history_count FROM public.job_request_changelog WHERE job_request_id=OLD.id;
  SELECT count(*) INTO order_items_count FROM public.order_items WHERE order_id=ANY(order_ids);
  SELECT count(*) INTO thread_count FROM public.threads WHERE agent='rosie' AND thread_id='jr-'||OLD.id;
  SELECT count(*) INTO ar_items FROM public.candidates WHERE availability_request_id=ANY(ar_ids);
  DELETE FROM public.orders WHERE id=ANY(order_ids);
  GET DIAGNOSTICS order_count=ROW_COUNT;
  DELETE FROM public.job_request_items WHERE job_request_id=OLD.id;
  PERFORM set_config('lps.ar_delete', 'on', true);
  DELETE FROM public.availability_requests WHERE id=ANY(ar_ids);
  GET DIAGNOSTICS ar_count=ROW_COUNT;
  PERFORM set_config('lps.ar_delete', '', true);
  INSERT INTO public.deleted_job_threads(agent,thread_id,job_request_id,deleted_counts)
    VALUES ('rosie','jr-'||OLD.id,OLD.id,jsonb_build_object('items',item_count,'changelog',history_count,
      'availabilityRequests',ar_count,'availabilityRequestItems',ar_items,'orders',order_count,
      'orderItems',order_items_count,'threads',thread_count,'answers',0));
  RETURN OLD;
END $function$;

-- compose_plant_name from 0043_dash_delimited_plant_name.sql
CREATE OR REPLACE FUNCTION public.compose_plant_name(
  common_name text,
  botanical_name text,
  cultivar_variety_trade_name text
) RETURNS text
LANGUAGE sql IMMUTABLE AS $function$
  SELECT nullif(
           array_to_string(
             array_remove(ARRAY[
               nullif(btrim(coalesce(common_name, '')), ''),
               nullif(btrim(coalesce(botanical_name, '')), ''),
               nullif(btrim(coalesce(cultivar_variety_trade_name, '')), '')
             ], NULL),
             ' - '),
           '')
$function$;

-- confirm_order from 0149_order_additional_details.sql
CREATE OR REPLACE FUNCTION public.confirm_order(p_order_id bigint, p_supplier_id bigint, p_confirmation_date date DEFAULT CURRENT_DATE)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  PERFORM public.update_partner_order(p_order_id, p_supplier_id, jsonb_build_object('status', 'processing'));
  IF p_confirmation_date IS NOT NULL THEN
    UPDATE public.orders SET confirmation_date = p_confirmation_date WHERE id = p_order_id;
  END IF;
  RETURN p_order_id;
END $function$;

-- create_availability_request from 0127_ar_publish_and_retention.sql
CREATE OR REPLACE FUNCTION public.create_availability_request(p_supplier_id bigint, p_candidate_ids bigint[], p_share_customer_details boolean DEFAULT false, p_public_token uuid DEFAULT NULL::uuid)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE request_id bigint; job_id bigint; job_count bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND is_active) THEN
    RAISE EXCEPTION 'Active supplier required';
  END IF;
  SELECT min(ji.job_request_id), count(DISTINCT ji.job_request_id) INTO job_id, job_count
    FROM public.candidates c JOIN public.job_request_items ji ON ji.id = c.job_request_item_id
    WHERE c.id = ANY(p_candidate_ids);
  IF job_count <> 1 THEN RAISE EXCEPTION 'An availability request asks for one job''s candidates'; END IF;
  -- Lock customer demand before the supplier request, the same order as closure.
  PERFORM 1 FROM public.job_requests WHERE id = job_id FOR UPDATE;
  INSERT INTO public.availability_requests(supplier_id, job_request_id, status, share_customer_details, public_token)
    VALUES (p_supplier_id, job_id, 'draft', p_share_customer_details, p_public_token) RETURNING id INTO request_id;
  RETURN public.add_candidates_to_availability_request(request_id, p_candidate_ids);
END $function$;

-- create_job_line_default from 0143_zero_price_is_a_price.sql
CREATE OR REPLACE FUNCTION public.create_job_line_default() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  -- Unpriced (NULL) until Rosie prices it; 0 is a $0 price.
  INSERT INTO public.candidates(supplier_id, is_original, job_request_item_id, name, size,
      description, unit_price)
    VALUES (1, true, NEW.id, NEW.name, NEW.size,
      btrim(concat_ws(' ', NEW.size, NEW.name)), NULL)
    RETURNING id INTO NEW.default_candidate_id;
  NEW.selected_candidate_id := coalesce(NEW.selected_candidate_id, NEW.default_candidate_id);
  RETURN NEW;
END $function$;

-- create_order from 0151_order_details_json.sql
CREATE OR REPLACE FUNCTION public.create_order(p_job_request_id bigint, p_supplier_id bigint, p_job_request_item_ids bigint[],
    p_additional_details jsonb DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE job public.job_requests; line public.job_request_items; c public.candidates;
  v_order bigint; v_item bigint; taken bigint; qty numeric;
  details jsonb := nullif(nullif(p_additional_details, 'null'::jsonb), '[]'::jsonb);
BEGIN
  IF p_job_request_item_ids IS NULL OR cardinality(p_job_request_item_ids) = 0 THEN
    RAISE EXCEPTION 'Choose at least one job line to order';
  END IF;
  IF NOT public.is_order_details(details) THEN
    RAISE EXCEPTION 'Additional details must be a list of {"field", "value"} texts';
  END IF;
  -- The job row lock serialises orders for the job.
  SELECT * INTO job FROM public.job_requests WHERE id = p_job_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job request not found'; END IF;
  IF NOT job.is_active OR job.status IN ('closed_won', 'closed_lost', 'archived') THEN
    RAISE EXCEPTION 'This job request is closed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = p_supplier_id AND is_active) THEN
    RAISE EXCEPTION 'Active supplier required';
  END IF;
  -- One open order per job and supplier: more lines go onto it.
  SELECT id INTO v_order FROM public.orders
    WHERE job_request_id = job.id AND supplier_id = p_supplier_id AND is_active
      AND status IN ('new', 'processing', 'order_ready')
    FOR UPDATE;
  IF v_order IS NULL THEN
    INSERT INTO public.orders(job_request_id, supplier_id, additional_details)
      VALUES (job.id, p_supplier_id, details)
      RETURNING id INTO v_order;
  END IF;
  FOREACH v_item IN ARRAY (SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(p_job_request_item_ids) x) LOOP
    SELECT * INTO line FROM public.job_request_items
      WHERE id = v_item AND job_request_id = job.id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Job line % is not an active line of JR-%', v_item, job.id; END IF;
    SELECT * INTO c FROM public.candidates WHERE id = line.selected_candidate_id FOR UPDATE;
    IF c.supplier_id <> p_supplier_id THEN
      RAISE EXCEPTION '% is selected from another supplier', line.name;
    END IF;
    SELECT oi.order_id INTO taken FROM public.order_items oi WHERE oi.candidate_id = c.id;
    IF FOUND THEN
      RAISE EXCEPTION '% is already on order O-%', coalesce(c.description, c.name), taken;
    END IF;
    -- The quantity the job line shows available, else its Qty.
    qty := coalesce(nullif(least(c.available_quantity, line.demanded_quantity), 0), line.demanded_quantity);
    IF qty IS NULL THEN RAISE EXCEPTION 'Set a quantity for % before ordering', line.name; END IF;
    INSERT INTO public.order_items(order_id, candidate_id, name, size, quantity, unit_price, status,
        note_for_supplier, note_from_supplier)
      VALUES (v_order, c.id, c.name, coalesce(c.size, line.size), qty, c.unit_price,
        CASE WHEN c.status IS NULL THEN 'pending' WHEN c.status = 'can_order' THEN 'need_to_order' ELSE c.status END,
        nullif(btrim(c.note_for_supplier), ''), nullif(btrim(c.note_from_supplier), ''));
  END LOOP;
  UPDATE public.job_requests SET status = 'committed' WHERE id = job.id AND status IN ('quoted', 'availability');
  RETURN v_order;
END $function$;

-- customers_link_threads from 0078_threads_and_thread_messages.sql
create or replace function public.customers_link_threads()
returns trigger language plpgsql as $$
begin
  new.rosie_thread_ref := public.link_thread('rosie', new.rosie_thread_id);
  return new;
end $$;

-- dedupe_plant_aliases from 0050_drop_other_names_and_alias_type.sql
CREATE OR REPLACE FUNCTION public.dedupe_plant_aliases()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  nk text := public.normalize_plant_key(new.name);
  ok text := public.normalize_plant_key(new.other_name);
BEGIN
  IF nk = '' OR ok = '' OR nk = ok
     OR EXISTS (
       SELECT 1 FROM public.plant_aliases p
       WHERE ( (p.name_key = nk AND p.other_name_key = ok)
            OR (p.name_key = ok AND p.other_name_key = nk) )
     )
  THEN
    RETURN NULL;
  END IF;
  RETURN new;
END;
$function$;

-- delete_candidate from 0130_job_lines_from_selected_candidate.sql
CREATE OR REPLACE FUNCTION public.delete_candidate(p_candidate_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.job_request_items WHERE default_candidate_id = p_candidate_id) THEN
    RAISE EXCEPTION 'The line''s default candidate can''t be deleted';
  END IF;
  -- Lines selecting it fall back to their default (candidates_reselect_default).
  UPDATE public.candidates SET is_active = false WHERE id = p_candidate_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Candidate not found'; END IF;
END $function$;

-- delete_job_request from 0097_job_delete_dependents.sql
CREATE OR REPLACE FUNCTION public.delete_job_request(p_job_request_id bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE affected bigint; result jsonb;
BEGIN
  DELETE FROM public.job_requests WHERE id=p_job_request_id;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected=0 THEN RETURN NULL; END IF;
  SELECT deleted_counts INTO result FROM public.deleted_job_threads WHERE agent='rosie' AND thread_id='jr-'||p_job_request_id;
  RETURN result;
END $$;

-- delete_job_request_item from 0130_job_lines_from_selected_candidate.sql
CREATE OR REPLACE FUNCTION public.delete_job_request_item(p_job_request_id bigint, p_job_request_item_id bigint)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE found_item bigint; ar_item_count bigint := 0; history_count bigint := 0; unasked bigint[];
BEGIN
  SELECT id INTO found_item FROM public.job_request_items
    WHERE id = p_job_request_item_id AND job_request_id = p_job_request_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*) INTO history_count FROM public.job_request_changelog WHERE item_id = p_job_request_item_id;
  SELECT count(*) FILTER (WHERE availability_request_id IS NOT NULL),
      coalesce(array_agg(id) FILTER (WHERE availability_request_id IS NULL), '{}')
    INTO ar_item_count, unasked
    FROM public.candidates WHERE job_request_item_id = p_job_request_item_id;
  DELETE FROM public.job_request_items WHERE id = p_job_request_item_id;
  DELETE FROM public.candidates WHERE id = ANY(unasked);
  RETURN jsonb_build_object('items', 1, 'availabilityRequests', 0,
    'availabilityRequestItems', ar_item_count, 'changelog', history_count, 'answers', 0);
END $function$;

-- delete_order_item from 0102_job_and_order_line_delete.sql
CREATE OR REPLACE FUNCTION public.delete_order_item(p_order_id bigint, p_order_item_id bigint)
RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  removed bigint;
BEGIN
  PERFORM 1 FROM public.orders
    WHERE id = p_order_id AND is_active AND status NOT IN ('closed_won', 'closed_lost')
    FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  DELETE FROM public.order_items WHERE id = p_order_item_id AND order_id = p_order_id;
  GET DIAGNOSTICS removed = ROW_COUNT;
  IF removed = 0 THEN RETURN false; END IF;
  -- An empty order is not useful operational history.  Its line allocations
  -- have already cascaded with the deleted order item.
  DELETE FROM public.orders WHERE id = p_order_id
    AND NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_order_id);
  RETURN true;
END $$;

-- edit_availability_request from 0127_ar_publish_and_retention.sql
CREATE OR REPLACE FUNCTION public.edit_availability_request(p_request_id bigint, p_supplier_id bigint,
  p_item_id bigint, p_changes jsonb)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE result bigint;
BEGIN
  PERFORM set_config('lps.ar_admin_edit', 'on', true);
  result := public.answer_availability_request(p_request_id, p_supplier_id, p_item_id, p_changes, false);
  PERFORM set_config('lps.ar_admin_edit', 'off', true);
  RETURN result;
END $function$;

-- guard_ar_public_link from 0130_job_lines_from_selected_candidate.sql
CREATE OR REPLACE FUNCTION public.guard_ar_public_link() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status NOT IN ('closed', 'draft') AND NOT EXISTS (
    SELECT 1 FROM public.job_requests j WHERE j.id = NEW.job_request_id AND j.is_active
      AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')
  ) THEN RAISE EXCEPTION 'All linked job requests are closed'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status IN ('processing', 'submitted') THEN
    RAISE EXCEPTION 'Publish the draft before recording supplier progress';
  END IF;
  IF NEW.status = 'draft' THEN NEW.submitted_at := NULL; END IF;
  IF NEW.status IN ('closed', 'draft') THEN
    NEW.public_token := NULL;
  ELSIF NEW.public_token IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.suppliers WHERE id = NEW.supplier_id AND is_active
  ) THEN RAISE EXCEPTION 'Public requests require an active supplier'; END IF;
  -- Reopening an AR is explicit. Entering Submitted is a new submission.
  IF NEW.status = 'submitted' AND (TG_OP = 'INSERT' OR OLD.status <> 'submitted') THEN
    NEW.submitted_at := now();
  END IF;
  RETURN NEW;
END $function$;

-- guard_candidate_write from 0130_job_lines_from_selected_candidate.sql
CREATE OR REPLACE FUNCTION public.guard_candidate_write() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests;
BEGIN
  IF NEW.availability_request_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO ar FROM public.availability_requests
    WHERE id = NEW.availability_request_id FOR UPDATE;
  IF NOT FOUND OR (ar.status = 'closed' AND current_setting('lps.lps_override', true) IS DISTINCT FROM 'on') THEN
    RAISE EXCEPTION 'This request is closed or unavailable';
  END IF;
  IF ar.supplier_id <> NEW.supplier_id THEN
    RAISE EXCEPTION 'Candidate supplier must match the request supplier';
  END IF;
  IF NEW.job_request_item_id IS NOT NULL AND ar.job_request_id IS DISTINCT FROM
    (SELECT job_request_id FROM public.job_request_items WHERE id = NEW.job_request_item_id) THEN
    RAISE EXCEPTION 'Candidate must be asked on its own job''s request';
  END IF;
  RETURN NEW;
END $function$;

-- guard_one_ar_per_job_supplier from 0130_job_lines_from_selected_candidate.sql
CREATE OR REPLACE FUNCTION public.guard_one_ar_per_job_supplier() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE existing bigint;
BEGIN
  IF NEW.job_request_id IS NULL THEN RETURN NEW; END IF;
  -- Serialize concurrent creates for the job, the same lock create_availability_request takes.
  PERFORM 1 FROM public.job_requests WHERE id = NEW.job_request_id FOR UPDATE;
  SELECT id INTO existing FROM public.availability_requests
    WHERE job_request_id = NEW.job_request_id AND supplier_id = NEW.supplier_id
    ORDER BY id DESC LIMIT 1;
  IF existing IS NOT NULL THEN
    RAISE EXCEPTION 'JR-% already has AR-% with this supplier; add candidates to it (reopen it first if it is submitted, processing or closed)',
      NEW.job_request_id, existing;
  END IF;
  RETURN NEW;
END $function$;

-- guard_order_public_link from 0114_public_orders.sql
CREATE OR REPLACE FUNCTION public.guard_order_public_link() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('closed_won', 'closed_lost') OR NOT NEW.is_active THEN
    NEW.public_token := NULL;
  ELSIF NEW.public_token IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.suppliers WHERE id = NEW.supplier_id AND is_active
  ) THEN
    RAISE EXCEPTION 'Public orders require an active supplier';
  END IF;
  RETURN NEW;
END $$;

-- hide_submitted_alternatives from 0132_answer_followups.sql
CREATE OR REPLACE FUNCTION public.hide_submitted_alternatives(p_request_id bigint)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests; hidden bigint;
BEGIN
  SELECT * INTO ar FROM public.availability_requests WHERE id = p_request_id;
  UPDATE public.candidates c SET hide_from_lps = true
    FROM public.job_request_items ji, public.job_requests j
    WHERE c.supplier_id = ar.supplier_id AND c.is_active AND NOT c.hide_from_lps AND NOT c.is_original
      AND (c.availability_request_id = ar.id OR c.availability_request_id IS NULL)
      AND ji.id = c.job_request_item_id AND ji.is_active
      AND EXISTS (SELECT 1 FROM public.candidates a WHERE a.job_request_item_id = ji.id AND a.availability_request_id = ar.id)
      AND c.id <> ji.default_candidate_id AND c.id <> ji.selected_candidate_id
      AND j.id = ji.job_request_id AND j.is_active AND j.status IN ('quoted', 'availability')
      AND NOT EXISTS (SELECT 1 FROM public.candidates o
        WHERE o.job_request_item_id = ji.id AND o.supplier_id = ar.supplier_id AND o.is_original
          AND o.is_active AND o.offered_candidate_id = c.id);
  GET DIAGNOSTICS hidden = ROW_COUNT;
  RETURN hidden;
END $function$;

-- inventory_derive_identity from 0041_multi_name_cultivar_keys.sql
CREATE OR REPLACE FUNCTION public.inventory_derive_identity()
RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  composed text;
BEGIN
  -- Blank is not a value: an empty part must not key to '' and match everything.
  new.common_name                 := nullif(btrim(new.common_name), '');
  new.botanical_name              := nullif(btrim(new.botanical_name), '');
  new.cultivar_variety_trade_name := nullif(btrim(new.cultivar_variety_trade_name), '');

  composed := public.compose_plant_name(
                new.common_name, new.botanical_name, new.cultivar_variety_trade_name);
  -- A row with no parts at all keeps whatever `name` it was given — that is
  -- every pre-0040 row, and every hand-entered one.
  IF composed IS NOT NULL THEN
    new.name := composed;
  END IF;

  new.common_name_key    := nullif(public.normalize_plant_key(new.common_name), '');
  new.botanical_name_key := nullif(public.normalize_plant_key(new.botanical_name), '');

  -- One key per name the column carries, so a row naming a cultivar *and* a
  -- trade name is reachable by either. Splitting on `,` is what the SOP writes;
  -- `;` and `|` are accepted so a stray separator costs a tidy cell, not a
  -- silently unmatched row. Never `-` or `/` — those occur inside real names.
  new.cultivar_keys := (
    SELECT array_agg(DISTINCT k)
    FROM (
      SELECT nullif(public.normalize_plant_key(part), '') AS k
      FROM regexp_split_to_table(
             coalesce(new.cultivar_variety_trade_name, ''), '\s*[,;|]\s*') AS part
    ) s
    WHERE k IS NOT NULL
  );
  RETURN new;
END;
$function$;

-- is_order_details from 0151_order_details_json.sql
CREATE OR REPLACE FUNCTION public.is_order_details(p jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $function$
DECLARE e jsonb;
BEGIN
  IF p IS NULL THEN RETURN true; END IF;
  IF jsonb_typeof(p) <> 'array' OR jsonb_array_length(p) NOT BETWEEN 1 AND 50 THEN RETURN false; END IF;
  FOR e IN SELECT value FROM jsonb_array_elements(p) LOOP
    IF jsonb_typeof(e) <> 'object' THEN RETURN false; END IF;
    IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(e) k) IS DISTINCT FROM ARRAY['field', 'value'] THEN RETURN false; END IF;
    IF jsonb_typeof(e->'field') <> 'string' OR jsonb_typeof(e->'value') <> 'string' THEN RETURN false; END IF;
    IF btrim(e->>'field') = '' OR btrim(e->>'value') = ''
      OR length(e->>'field') > 100 OR length(e->>'value') > 2000 THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END $function$;

-- job_requests_close_thread from 0080_threads_closed_at.sql
create or replace function public.job_requests_close_thread()
returns trigger language plpgsql as $$
begin
  if new.rosie_thread_ref is null then return new; end if;
  if new.status in ('closed_won', 'closed_lost', 'archived') or not new.is_active then
    update public.threads set closed_at = now()
     where id = new.rosie_thread_ref and closed_at is null;
  else
    update public.threads set closed_at = null
     where id = new.rosie_thread_ref and closed_at is not null;
  end if;
  return new;
end $$;

-- job_requests_drop_thread from 0097_job_delete_dependents.sql
CREATE OR REPLACE FUNCTION public.job_requests_drop_thread() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  DELETE FROM public.threads WHERE agent='rosie' AND thread_id='jr-'||OLD.id;
  RETURN OLD;
END $$;

-- job_requests_link_threads from 0078_threads_and_thread_messages.sql
create or replace function public.job_requests_link_threads()
returns trigger language plpgsql as $$
begin
  new.rosie_thread_ref := public.link_thread('rosie', 'jr-' || new.id);
  return new;
end $$;

-- link_thread from 0078_threads_and_thread_messages.sql
create or replace function public.link_thread(p_agent text, p_thread_id text)
returns bigint language plpgsql as $$
declare v_id bigint;
begin
  if p_thread_id is null or p_thread_id = '' then return null; end if;
  insert into public.threads (agent, thread_id) values (p_agent, p_thread_id)
  on conflict (agent, thread_id) do update set agent = excluded.agent
  returning id into v_id;
  return v_id;
end $$;

-- log_job_request_changes from 0078_threads_and_thread_messages.sql
create or replace function public.log_job_request_changes()
returns trigger language plpgsql as $$
declare
  req_id bigint;
  itm_id bigint;
  diff jsonb;
begin
  if tg_table_name = 'job_request_items' then
    req_id := new.job_request_id;
    itm_id := new.id;
  else
    req_id := new.id;
    itm_id := null;
  end if;

  if tg_op = 'INSERT' then
    select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
      into diff
    from jsonb_each(to_jsonb(new))
    where key not in ('created_at', 'updated_at', 'rosie_thread_ref')
      and value <> 'null'::jsonb;
  else
    select coalesce(jsonb_object_agg(key,
             jsonb_build_object('old', o.value, 'new', n.value)), '{}'::jsonb)
      into diff
    from jsonb_each(to_jsonb(new)) as n
    join jsonb_each(to_jsonb(old)) as o using (key)
    where key not in ('updated_at', 'rosie_thread_ref')
      and n.value is distinct from o.value;
    if diff = '{}'::jsonb then
      return null;
    end if;
  end if;

  insert into public.job_request_changelog
    (job_request_id, item_id, actor, action, changes)
  values
    (req_id, itm_id,
     coalesce(nullif(btrim(coalesce(current_setting('app.actor', true), '')), ''),
              current_user),
     lower(tg_op), diff);
  return null;
end $$;

-- plant_photo_document from 0051_plant_photo_catalogue.sql
CREATE OR REPLACE FUNCTION public.plant_photo_document(
  name text, size text, caption text, tags text[], notes text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT coalesce($1, '') || ' ' || coalesce($2, '') || ' ' || coalesce($3, '')
      || ' ' || coalesce(array_to_string($4, ' '), '') || ' ' || coalesce($5, '');
$function$;

-- plant_photo_reclaimable from 0054_plant_photo_reclaimable.sql
CREATE OR REPLACE FUNCTION public.plant_photo_reclaimable(older_than_days integer DEFAULT 30)
RETURNS TABLE(
  object_name text,
  reason text,
  age_days integer,
  byte_size bigint,
  photo_id uuid,
  photo_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $function$
  SELECT
    o.name,
    CASE WHEN p.id IS NULL THEN 'orphan' ELSE 'retired' END,
    floor(
      extract(epoch FROM now() - coalesce(p.updated_at, o.created_at)) / 86400
    )::integer,
    (o.metadata->>'size')::bigint,
    p.id,
    p.name
  FROM storage.objects o
  LEFT JOIN public.plant_photos p
    ON p.storage_bucket = o.bucket_id AND p.storage_path = o.name
  WHERE o.bucket_id = 'plant-photos'
    -- The safety rule. An object with a live row is never a candidate.
    AND (p.id IS NULL OR NOT p.is_active)
    -- Age from when the photo was retired, or from the object itself when
    -- there is no row to ask. `greatest(…, 0)` stops a negative argument from
    -- turning the grace period into a licence to delete the future.
    AND coalesce(p.updated_at, o.created_at)
        < now() - make_interval(days => greatest(coalesce(older_than_days, 30), 0))
  ORDER BY coalesce(p.updated_at, o.created_at);
$function$;

-- plant_photos_derive_identity from 0051_plant_photo_catalogue.sql
CREATE OR REPLACE FUNCTION public.plant_photos_derive_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  composed text;
BEGIN
  new.common_name                 := nullif(btrim(new.common_name), '');
  new.botanical_name              := nullif(btrim(new.botanical_name), '');
  new.cultivar_variety_trade_name := nullif(btrim(new.cultivar_variety_trade_name), '');

  composed := public.compose_plant_name(
                new.common_name, new.botanical_name, new.cultivar_variety_trade_name);
  IF composed IS NOT NULL THEN
    new.name := composed;
  END IF;

  new.common_name_key    := nullif(public.normalize_plant_key(new.common_name), '');
  new.botanical_name_key := nullif(public.normalize_plant_key(new.botanical_name), '');

  new.cultivar_keys := (
    SELECT array_agg(DISTINCT k)
    FROM (
      SELECT nullif(public.normalize_plant_key(part), '') AS k
      FROM regexp_split_to_table(
             coalesce(new.cultivar_variety_trade_name, ''), '\s*[,;|]\s*') AS part
    ) s
    WHERE k IS NOT NULL
  );

  new.tags := coalesce((
    SELECT array_agg(DISTINCT t ORDER BY t)
    FROM (
      SELECT nullif(btrim(lower(tag)), '') AS t
      FROM unnest(coalesce(new.tags, '{}'::text[])) AS tag
    ) s
    WHERE t IS NOT NULL
  ), '{}'::text[]);

  RETURN new;
END;
$function$;

-- plant_word_distance from 0142_alias_typo_partial_match.sql
CREATE OR REPLACE FUNCTION public.plant_word_distance(a text, b text)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE STRICT PARALLEL SAFE
AS $function$
declare
  la int := char_length(a);
  lb int := char_length(b);
  prev2 int[];
  prev int[];
  cur int[];
  i int;
  j int;
begin
  if la = 0 or lb = 0 then
    return la + lb;
  end if;
  -- prev[j + 1] is the distance from a's first i - 1 letters to b's first j.
  prev := array(select generate_series(0, lb));
  for i in 1 .. la loop
    cur := array[i];
    for j in 1 .. lb loop
      cur := cur || least(prev[j + 1] + 1, cur[j] + 1,
        prev[j] + case when substr(a, i, 1) = substr(b, j, 1) then 0 else 1 end);
      if i > 1 and j > 1 and substr(a, i, 1) = substr(b, j - 1, 1)
         and substr(a, i - 1, 1) = substr(b, j, 1) then
        cur[j + 1] := least(cur[j + 1], prev2[j - 1] + 1);
      end if;
    end loop;
    prev2 := prev;
    prev := cur;
  end loop;
  return prev[lb + 1];
end
$function$;

-- prevent_availability_request_delete from 0139_drop_candidate_demand.sql
CREATE OR REPLACE FUNCTION public.prevent_availability_request_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('lps.ar_delete', true) = 'on' THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Availability requests cannot be deleted. Move the request to Draft to hide it from the supplier.';
END $function$;

-- protect_default_candidate from 0130_job_lines_from_selected_candidate.sql
CREATE OR REPLACE FUNCTION public.protect_default_candidate() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.job_request_items WHERE default_candidate_id = OLD.id) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'The line''s default candidate can''t be deleted';
  END IF;
  IF NEW.hide_from_lps OR NOT NEW.is_active OR NOT NEW.is_original
    OR NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
    OR NEW.job_request_item_id IS DISTINCT FROM OLD.job_request_item_id THEN
    RAISE EXCEPTION 'The line''s default candidate stays its active, visible APS original';
  END IF;
  RETURN NEW;
END $function$;

-- record_job_workflow_event from 0093_remove_job_confirmed_status.sql
CREATE OR REPLACE FUNCTION public.record_job_workflow_event(p_job_request_id bigint, p_event text)
RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE job public.job_requests; next_status text;
BEGIN
  IF p_event IS NULL OR p_event NOT IN
    ('pricing_fetched', 'availability_sent', 'quote_shared', 'customer_confirmed', 'supplier_confirmed') THEN
    RAISE EXCEPTION 'Unknown job workflow event';
  END IF;
  SELECT * INTO job FROM public.job_requests WHERE id = p_job_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job request not found'; END IF;
  -- Supplier confirmation belongs to Orders. Accept the legacy event without
  -- changing the job stage so older callers and confirm_order remain compatible.
  IF job.is_active AND job.status NOT IN ('closed_won', 'closed_lost', 'archived') THEN
    IF p_event = 'customer_confirmed' AND job.status IN ('quoted', 'availability') THEN
      next_status := 'committed';
    ELSIF p_event = 'availability_sent' AND job.status = 'quoted' THEN
      next_status := 'availability';
    END IF;
    IF next_status IS NOT NULL THEN
      UPDATE public.job_requests SET status = next_status WHERE id = job.id;
      RETURN next_status;
    END IF;
  END IF;
  RETURN job.status;
END $$;

-- reject_deleted_job_thread from 0097_job_delete_dependents.sql
CREATE OR REPLACE FUNCTION public.reject_deleted_job_thread() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.agent = 'rosie' AND NEW.thread_id ~ '^jr-[0-9]+$' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('deleted-job:' || NEW.thread_id, 0));
    IF EXISTS (SELECT 1 FROM public.deleted_job_threads WHERE agent=NEW.agent AND thread_id=NEW.thread_id) THEN
      RAISE EXCEPTION 'This job chat has been deleted';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- release_candidate_offer from 0130_job_lines_from_selected_candidate.sql
CREATE OR REPLACE FUNCTION public.release_candidate_offer(p_candidate_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE src public.candidates;
BEGIN
  SELECT * INTO src FROM public.candidates WHERE id = p_candidate_id FOR UPDATE;
  IF src.offered_candidate_id IS NULL THEN RETURN; END IF;
  IF src.offer_description IS NOT NULL THEN
    UPDATE public.candidates SET is_active = false WHERE id = src.offered_candidate_id AND is_active;
  ELSE
    UPDATE public.candidates SET status = NULL, available_quantity = NULL, note_from_supplier = NULL,
        answered_at = NULL,
        availability_request_id = CASE WHEN availability_request_id = src.availability_request_id
          THEN NULL ELSE availability_request_id END
      WHERE id = src.offered_candidate_id AND is_active;
  END IF;
  UPDATE public.candidates SET offered_candidate_id = NULL, offer_description = NULL,
      offer_unit_price = NULL, offer_quantity = NULL
    WHERE id = src.id;
END $function$;

-- reopen_availability_request from 0130_job_lines_from_selected_candidate.sql
CREATE OR REPLACE FUNCTION public.reopen_availability_request(p_request_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE ar public.availability_requests;
BEGIN
  SELECT * INTO ar FROM public.availability_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Availability request not found'; END IF;
  IF ar.status NOT IN ('submitted', 'processing', 'closed') THEN
    RAISE EXCEPTION 'Only a submitted, processing or closed request can be reopened';
  END IF;
  UPDATE public.availability_requests SET status = 'new',
      public_token = CASE WHEN public_token IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.suppliers WHERE id = ar.supplier_id AND is_lps_partner) THEN gen_random_uuid()
        ELSE public_token END
    WHERE id = ar.id;
END $function$;

-- reselect_default_on_deactivate from 0130_job_lines_from_selected_candidate.sql
CREATE OR REPLACE FUNCTION public.reselect_default_on_deactivate() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  UPDATE public.job_request_items SET selected_candidate_id = default_candidate_id
    WHERE selected_candidate_id = NEW.id;
  RETURN NULL;
END $function$;

-- reserve_job_request_id from 0072_reserve_job_request_id.sql
CREATE OR REPLACE FUNCTION public.reserve_job_request_id()
RETURNS bigint
LANGUAGE sql
VOLATILE
AS $$ SELECT nextval('public.job_requests_id_seq'); $$;

-- reset_customer_note_on_reply from 0132_answer_followups.sql
CREATE OR REPLACE FUNCTION public.reset_customer_note_on_reply() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF nullif(btrim(NEW.note_from_supplier), '') IS NOT NULL
    AND NEW.note_from_supplier IS DISTINCT FROM OLD.note_from_supplier
    AND NEW.note_for_customer IS NOT DISTINCT FROM OLD.note_for_customer THEN
    NEW.note_for_customer := NULL;
  END IF;
  RETURN NEW;
END $function$;

-- select_candidate from 0152_line_status_as_given_select_unhides.sql
CREATE OR REPLACE FUNCTION public.select_candidate(p_job_request_item_id bigint, p_candidate_id bigint) RETURNS void
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  PERFORM 1 FROM public.job_request_items ji JOIN public.job_requests j ON j.id = ji.job_request_id
    WHERE ji.id = p_job_request_item_id AND ji.is_active AND j.is_active
      AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')
    FOR UPDATE OF ji;
  IF NOT FOUND THEN RAISE EXCEPTION 'Open job line not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.candidates
    WHERE id = p_candidate_id AND job_request_item_id = p_job_request_item_id AND is_active) THEN
    RAISE EXCEPTION 'Candidate not found for this line';
  END IF;
  -- 0152: selecting a hidden candidate shows it again.
  UPDATE public.candidates SET hide_from_lps = false WHERE id = p_candidate_id AND hide_from_lps;
  UPDATE public.job_request_items SET selected_candidate_id = p_candidate_id WHERE id = p_job_request_item_id;
END $function$;

-- send_availability_request from 0127_ar_publish_and_retention.sql
CREATE OR REPLACE FUNCTION public.send_availability_request(p_request_id bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE ar public.availability_requests;
BEGIN
  SELECT * INTO ar FROM public.availability_requests WHERE id = p_request_id  FOR UPDATE;
  IF NOT FOUND OR ar.status <> 'draft' THEN RAISE EXCEPTION 'Only a draft request can be published'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.candidates WHERE availability_request_id = ar.id AND is_active) THEN
    RAISE EXCEPTION 'Add at least one candidate before publishing';
  END IF;
  UPDATE public.availability_requests SET status = 'new',
      public_token = CASE WHEN public_token IS NULL AND NOT EXISTS (
        SELECT 1 FROM public.suppliers WHERE id = ar.supplier_id AND is_lps_partner) THEN gen_random_uuid()
        ELSE public_token END
    WHERE id = ar.id;
  RETURN ar.id;
END $function$;

-- submit_availability_request_note from 0130_job_lines_from_selected_candidate.sql
CREATE OR REPLACE FUNCTION public.submit_availability_request_note(p_request_id bigint, p_supplier_id bigint, p_note text)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF length(p_note) > 10000 THEN RAISE EXCEPTION 'Supplier note must be 10000 characters or fewer'; END IF;
  -- Existing submission locks and verifies the active request and supplier,
  -- rejects closed requests, and stamps submitted_at in this transaction.
  PERFORM public.answer_availability_request(p_request_id, p_supplier_id, p_submit => true);
  UPDATE public.availability_requests SET note_for_supplier = nullif(btrim(p_note), '') WHERE id = p_request_id;
  RETURN p_request_id;
END $function$;

-- submit_public_availability_note from 0127_ar_publish_and_retention.sql
CREATE OR REPLACE FUNCTION public.submit_public_availability_note(p_token uuid, p_note text)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE ar public.availability_requests;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE public_token = p_token  AND status NOT IN ('closed', 'draft') FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This link is no longer available'; END IF;
  RETURN public.submit_availability_request_note(ar.id, ar.supplier_id, p_note);
END $function$;

-- suppliers_head_branch from 0049_supplier_head_branch.sql
create or replace function public.suppliers_head_branch()
returns trigger language plpgsql as $$
begin
  if new.head_branch_id is null then
    new.head_branch_id := new.id;
  end if;

  if new.head_branch_id <> new.id then
    if not exists (select 1 from public.suppliers
                    where id = new.head_branch_id and head_branch_id = id) then
      raise exception
        'supplier % cannot take supplier % as its head branch: that row is '
        'itself a branch, and head_branch_id must not chain',
        new.id, new.head_branch_id;
    end if;

    if exists (select 1 from public.suppliers
                where head_branch_id = new.id and id <> new.id) then
      raise exception
        'supplier % is the head branch of other locations and cannot become a '
        'branch itself; move its locations first',
        new.id;
    end if;
  end if;

  return new;
end;
$$;

-- suppliers_link_threads from 0078_threads_and_thread_messages.sql
create or replace function public.suppliers_link_threads()
returns trigger language plpgsql as $$
begin
  new.rosie_thread_ref := public.link_thread('rosie', new.rosie_thread_id);
  new.daisy_thread_ref := public.link_thread('daisy', new.daisy_thread_id);
  return new;
end $$;

-- sync_job_line_default from 0144_line_edits_leave_candidates.sql
CREATE OR REPLACE FUNCTION public.sync_job_line_default() RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE prior text;
BEGIN
  -- A line's name and size are the customer's ask only (0144): a candidate's
  -- price is for its own plant and size, so they never follow onto it.
  IF NEW.demanded_quantity IS DISTINCT FROM OLD.demanded_quantity THEN
    UPDATE public.candidates SET available_quantity = NEW.demanded_quantity
      WHERE id = NEW.default_candidate_id AND availability_request_id IS NULL AND status = 'available';
  END IF;
  IF NEW.demanded_quantity IS DISTINCT FROM OLD.demanded_quantity AND NEW.demanded_quantity IS NOT NULL THEN
    prior := current_setting('lps.lps_override', true);
    PERFORM set_config('lps.lps_override', 'on', true);
    UPDATE public.candidates SET status = CASE WHEN status = 'available' THEN 'partial_qty' ELSE 'available' END
      WHERE job_request_item_id = NEW.id AND is_active AND (
        (status = 'available' AND available_quantity > 0 AND available_quantity < NEW.demanded_quantity)
        OR (status = 'partial_qty' AND available_quantity >= NEW.demanded_quantity));
    PERFORM set_config('lps.lps_override', coalesce(prior, ''), true);
  END IF;
  RETURN NULL;
END $function$;

-- thread_messages_update_preview from 0078_threads_and_thread_messages.sql
create or replace function public.thread_messages_update_preview()
returns trigger language plpgsql as $$
begin
  update public.threads
     set last_seq = new.seq, last_at = new.created_at, last_role = new.role,
         last_sender = new.sender_name, last_text = left(new.text, 120)
   where id = new.thread_id and (last_seq is null or last_seq < new.seq);
  return new;
end $$;

-- unselect_candidate from 0130_job_lines_from_selected_candidate.sql
CREATE OR REPLACE FUNCTION public.unselect_candidate(p_job_request_item_id bigint)
RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  PERFORM 1 FROM public.job_request_items ji JOIN public.job_requests j ON j.id = ji.job_request_id
    WHERE ji.id = p_job_request_item_id AND ji.is_active AND j.is_active
      AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')
    FOR UPDATE OF ji;
  IF NOT FOUND THEN RAISE EXCEPTION 'Open job line not found'; END IF;
  UPDATE public.job_request_items SET selected_candidate_id = default_candidate_id
    WHERE id = p_job_request_item_id AND selected_candidate_id <> default_candidate_id;
END $function$;

-- update_job_line from 0152_line_status_as_given_select_unhides.sql
CREATE OR REPLACE FUNCTION public.update_job_line(p_item_id bigint, p_changes jsonb) RETURNS void
LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE line public.job_request_items; c public.candidates; k text; next_status text;
  qty numeric; demand numeric;
BEGIN
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb THEN
    RAISE EXCEPTION 'Changes are required';
  END IF;
  -- 0145: a line's size and name are its own columns; a candidate's are the candidate's.
  IF p_changes ?| ARRAY['size', 'name'] THEN
    RAISE EXCEPTION 'Size and name are not line values: update job_request_items for the ask, or the candidate itself';
  END IF;
  FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
    IF k NOT IN ('status', 'unit_price', 'available_quantity', 'note_for_customer')
      OR jsonb_typeof(p_changes->k) NOT IN ('string', 'number', 'null') THEN
      RAISE EXCEPTION 'Invalid line field';
    END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['unit_price', 'available_quantity'] LOOP
    IF nullif(trim(p_changes->>k), '')::numeric::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'Line numbers must be finite';
    END IF;
  END LOOP;
  SELECT * INTO line FROM public.job_request_items WHERE id = p_item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job line not found'; END IF;
  SELECT * INTO c FROM public.candidates WHERE id = line.selected_candidate_id FOR UPDATE;
  demand := line.demanded_quantity;
  qty := CASE WHEN p_changes ? 'available_quantity'
    THEN nullif(trim(p_changes->>'available_quantity'), '')::numeric ELSE c.available_quantity END;
  next_status := c.status;
  IF p_changes ? 'status' THEN
    IF (p_changes->>'status') IS NULL OR (p_changes->>'status') NOT IN
        ('pending', 'available', 'partial_qty', 'unavailable', 'diff_size_sub', 'need_to_order', 'arriving_soon') THEN
      RAISE EXCEPTION 'Choose a valid line status';
    END IF;
    next_status := CASE p_changes->>'status' WHEN 'pending' THEN NULL
      WHEN 'need_to_order' THEN 'can_order' ELSE p_changes->>'status' END;
    -- 0152: an original answered with a live offer keeps it (the sub carries
    -- Diff Sz/Sub); any other selection stores the status as given.
    IF next_status = 'diff_size_sub' AND c.is_original AND c.status = 'unavailable'
        AND EXISTS (SELECT 1 FROM public.candidates WHERE id = c.offered_candidate_id AND is_active) THEN
      next_status := 'unavailable';
    END IF;
  END IF;
  IF p_changes ? 'status' AND NOT p_changes ? 'available_quantity'
    AND next_status IN ('available', 'can_order', 'arriving_soon', 'diff_size_sub') THEN
    qty := coalesce(demand, qty);
  END IF;
  IF p_changes ? 'available_quantity' AND qty IS NOT NULL AND demand IS NOT NULL THEN
    IF next_status = 'available' AND qty > 0 AND qty < demand THEN next_status := 'partial_qty';
    ELSIF next_status = 'partial_qty' AND qty >= demand THEN next_status := 'available';
    END IF;
  END IF;
  PERFORM set_config('lps.lps_override', 'on', true);
  IF c.offered_candidate_id IS NOT NULL AND c.status = 'unavailable' AND next_status IS DISTINCT FROM 'unavailable' THEN
    PERFORM public.release_candidate_offer(c.id);
  END IF;
  UPDATE public.candidates SET
    status = next_status,
    unit_price = CASE WHEN p_changes ? 'unit_price'
      THEN nullif(trim(p_changes->>'unit_price'), '')::numeric ELSE unit_price END,
    available_quantity = qty,
    note_for_customer = CASE WHEN p_changes ? 'note_for_customer'
      THEN p_changes->>'note_for_customer' ELSE note_for_customer END
  WHERE id = c.id;
  PERFORM set_config('lps.lps_override', '', true);
END $function$;

-- update_partner_order from 0151_order_details_json.sql
CREATE OR REPLACE FUNCTION public.update_partner_order(p_order_id bigint, p_supplier_id bigint, p_patch jsonb)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
DECLARE current_order public.orders; next_status text; next_details jsonb; next_log text; next_reply text;
BEGIN
  IF jsonb_typeof(p_patch) IS DISTINCT FROM 'object' OR p_patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'Order update is required'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_patch) key
    WHERE key NOT IN ('status', 'additional_details', 'change_log', 'note_from_supplier')) THEN
    RAISE EXCEPTION 'Unsupported order update'; END IF;
  -- Job before order, as create_order and close_order lock.
  PERFORM 1 FROM public.job_requests j JOIN public.orders o ON o.job_request_id = j.id
    WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id FOR UPDATE OF j;
  SELECT o.* INTO current_order FROM public.orders o JOIN public.suppliers s ON s.id = o.supplier_id
    WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id AND o.is_active AND s.is_active FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is unavailable'; END IF;
  IF current_order.status NOT IN ('new', 'processing', 'order_ready') OR NOT EXISTS (
    SELECT 1 FROM public.job_requests j WHERE j.id = current_order.job_request_id AND j.is_active
      AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')) THEN
    RAISE EXCEPTION 'Closed orders cannot be changed'; END IF;
  next_status := current_order.status;
  IF p_patch ? 'status' THEN
    next_status := p_patch->>'status';
    IF next_status IS NULL OR NOT (
      (current_order.status = 'new' AND next_status = 'processing') OR
      (current_order.status = 'processing' AND next_status = 'order_ready')
    ) THEN RAISE EXCEPTION 'Orders move from New to Processing to Order Ready'; END IF;
  END IF;
  next_details := current_order.additional_details;
  IF p_patch ? 'additional_details' THEN
    next_details := nullif(nullif(p_patch->'additional_details', 'null'::jsonb), '[]'::jsonb);
    IF NOT public.is_order_details(next_details) THEN
      RAISE EXCEPTION 'Additional details must be a list of {"field", "value"} texts'; END IF;
  END IF;
  next_log := current_order.change_log;
  IF p_patch ? 'change_log' THEN
    IF jsonb_typeof(p_patch->'change_log') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'Change log must be text'; END IF;
    IF length(p_patch->>'change_log') > 10000 THEN
      RAISE EXCEPTION 'Change log must be 10000 characters or fewer'; END IF;
    next_log := nullif(btrim(p_patch->>'change_log'), '');
  END IF;
  next_reply := current_order.note_from_supplier;
  IF p_patch ? 'note_from_supplier' THEN
    IF jsonb_typeof(p_patch->'note_from_supplier') NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'Note from supplier must be text'; END IF;
    IF length(p_patch->>'note_from_supplier') > 10000 THEN
      RAISE EXCEPTION 'Note from supplier must be 10000 characters or fewer'; END IF;
    next_reply := nullif(btrim(p_patch->>'note_from_supplier'), '');
  END IF;
  UPDATE public.orders SET status = next_status, additional_details = next_details, change_log = next_log,
    note_from_supplier = next_reply,
    confirmation_date = CASE WHEN current_order.status = 'new' AND next_status = 'processing'
      THEN coalesce(current_order.confirmation_date, CURRENT_DATE) ELSE confirmation_date END
    WHERE id = p_order_id;
  RETURN p_order_id;
END $function$;

-- update_partner_order_item from 0146_order_per_job_supplier.sql
CREATE OR REPLACE FUNCTION public.update_partner_order_item(p_order_id bigint, p_supplier_id bigint, p_order_item_id bigint,
    p_status text, p_note_from_supplier text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SET search_path TO 'public' AS $function$
BEGIN
  IF p_status = 'diff_size_qty_sub' THEN p_status := 'diff_size_sub'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('pending', 'available', 'partial_qty', 'unavailable', 'diff_size_sub', 'need_to_order', 'arriving_soon') THEN
    RAISE EXCEPTION 'Choose a valid plant status';
  END IF;
  IF length(p_note_from_supplier) > 10000 THEN
    RAISE EXCEPTION 'Note from supplier must be 10000 characters or fewer';
  END IF;
  PERFORM 1 FROM public.orders o JOIN public.suppliers s ON s.id = o.supplier_id
    WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id AND o.is_active AND s.is_active
      AND o.status NOT IN ('closed_won', 'closed_lost') FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is unavailable'; END IF;
  -- NULL keeps the supplier's note; '' clears it.
  UPDATE public.order_items SET status = p_status,
    note_from_supplier = CASE WHEN p_note_from_supplier IS NULL THEN note_from_supplier
      ELSE nullif(btrim(p_note_from_supplier), '') END
    WHERE id = p_order_item_id AND order_id = p_order_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order line is unavailable'; END IF;
  RETURN p_order_item_id;
END $function$;

-- update_partner_order_item_price from 0113_partner_order_item_price.sql
CREATE OR REPLACE FUNCTION public.update_partner_order_item_price(p_order_id bigint, p_supplier_id bigint,
  p_order_item_id bigint, p_unit_price numeric)
RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF p_unit_price IS NOT NULL AND (p_unit_price <= 0 OR p_unit_price >= 100000000 OR p_unit_price <> round(p_unit_price, 2)) THEN
    RAISE EXCEPTION 'Enter a positive price with at most two decimal places';
  END IF;
  PERFORM 1 FROM public.orders o JOIN public.suppliers s ON s.id = o.supplier_id
    WHERE o.id = p_order_id AND o.supplier_id = p_supplier_id AND o.is_active AND s.is_active
      AND o.status NOT IN ('closed_won', 'closed_lost') FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order is unavailable'; END IF;
  UPDATE public.order_items SET unit_price = p_unit_price
    WHERE id = p_order_item_id AND order_id = p_order_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order line is unavailable'; END IF;
  RETURN p_order_item_id;
END $$;

-- search_inventory from 0142_alias_typo_partial_match.sql
CREATE OR REPLACE FUNCTION public.search_inventory(search text DEFAULT ''::text,
                                        fuzzy_ratio real DEFAULT 0.34)
RETURNS TABLE(id uuid, name text, common_name text, botanical_name text,
              cultivar_variety_trade_name text, cultivar_keys text[],
              size text, size_std text, unit_price numeric, quantity numeric,
              supplier_id bigint, image_url text, notes text, internal_notes text,
              height text, width text, caliper text, is_active boolean,
              source_id uuid, source text,
              created_at timestamp with time zone, updated_at timestamp with time zone,
              supplier_name text, supplier_category text,
              supplier_state text, supplier_city text,
              height_std double precision, width_std double precision,
              caliper_std double precision, relevance real)
LANGUAGE plpgsql
STABLE
AS $function$
declare
  raw_search text := regexp_replace(
    search, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  exact_mode boolean := char_length(raw_search) >= 2
    and left(raw_search, 1) = '"' and right(raw_search, 1) = '"';
  exact_text text;
  exact_pattern text;
  q text := btrim(regexp_replace(public.normalize_search_text(search), '\s+', ' ', 'g'));
  -- One entry per alternative spelling of each query group.
  alt_text  text[] := '{}';
  alt_grp   int[]  := '{}';
  alt_size  bool[] := '{}';  -- a size phrase, matched whole
  alt_typed bool[] := '{}';  -- the user's own words, not an alias of them
  n_groups int := 0;
  n_docs bigint;
begin
  -- A phrase wrapped by one outer pair of straight double quotes opts into
  -- literal substring mode. Trim only its outside whitespace; whitespace and
  -- punctuation inside the phrase remain data. One-sided quotes stay on the
  -- established broad discovery path rather than being guessed at.
  if exact_mode then
    exact_text := regexp_replace(
      substring(raw_search from 2 for char_length(raw_search) - 2),
      '^[[:space:]]+|[[:space:]]+$', '', 'g');
    if exact_text = '' then
      return;
    end if;

    -- Escape LIKE's three metacharacters in data order: the escape character
    -- first, then `%` and `_`. Quotes need no treatment because the phrase is a
    -- PL/pgSQL value, never interpolated into SQL text.
    exact_pattern := '%' ||
      replace(
        replace(
          replace(exact_text, E'\\', E'\\\\'),
          '%', E'\\%'),
        '_', E'\\_') || '%';

    -- The joined identity string is what inventory_identity_trgm_idx indexes.
    -- A phrase inside one part is inside the join, so it only narrows; the
    -- per-part test below still decides, and a match across a newline is not
    -- one.
    return query
    select inv.id, inv.name, inv.common_name, inv.botanical_name,
           inv.cultivar_variety_trade_name, inv.cultivar_keys,
           inv.size, inv.size_std, inv.unit_price, inv.quantity, inv.supplier_id,
           inv.image_url, inv.notes, inv.internal_notes,
           inv.height, inv.width, inv.caliper, inv.is_active, inv.source_id,
           src.file_path as source, inv.created_at, inv.updated_at,
           s.name as supplier_name, s.category as supplier_category,
           s.state as supplier_state, s.city as supplier_city,
           inv.height_std, inv.width_std, inv.caliper_std,
           1::real as relevance
    from public.inventory inv
    join public.suppliers s on s.id = inv.supplier_id
    left join public.inventory_sources src on src.id = inv.source_id
    where inv.is_active
      and (inv.source_id is null or src.is_active)
      and (coalesce(inv.name, '') || E'\n' || coalesce(inv.common_name, '') || E'\n' ||
           coalesce(inv.botanical_name, '') || E'\n' ||
           coalesce(inv.cultivar_variety_trade_name, '')) ilike exact_pattern escape E'\\'
      and (coalesce(inv.name, '') ilike exact_pattern escape E'\\'
        or coalesce(inv.common_name, '') ilike exact_pattern escape E'\\'
        or coalesce(inv.botanical_name, '') ilike exact_pattern escape E'\\'
        or coalesce(inv.cultivar_variety_trade_name, '') ilike exact_pattern escape E'\\')
    order by relevance desc, inv.updated_at desc, inv.name asc;
    return;
  end if;

  if q = '' then
    return;
  end if;

  select count(*) into n_docs from public.inventory inv where inv.is_active;

  -- Sizes and aliases (exact, close or partial): search_query_groups.
  select coalesce(array_agg(qg.t order by qg.k), '{}'),
         coalesce(array_agg(qg.g order by qg.k), '{}'),
         coalesce(array_agg(qg.is_size order by qg.k), '{}'),
         coalesce(array_agg(qg.typed order by qg.k), '{}'),
         coalesce(max(qg.g), 0)
  into alt_text, alt_grp, alt_size, alt_typed, n_groups
  from public.search_query_groups(search)
    with ordinality qg(g, span, t, is_size, typed, alias_match, alias_ids, k);

  return query
  with alt as (
    select a.k, a.g, a.t, a.is_size, a.typed,
           case when a.is_size then array[a.t] else string_to_array(a.t, ' ') end as w
    from unnest(alt_text, alt_grp, alt_size, alt_typed)
      with ordinality a(t, g, is_size, typed, k)
  ),
  -- Retrieval, per alternative. The word index matches whole words, falls back
  -- to pgroonga's fuzzy match for a word absent from its vocabulary, and takes
  -- word starts for a lone word of three letters or more (`g*` would be 69% of
  -- rows, all tied). The bigram index adds words of five letters or more
  -- found inside longer ones (`myrtle` in `crapemyrtle`); shorter ones only
  -- pull in noise (`ash` in `washington`). The typed words
  -- may match any of them; a size or alias is looked up as its whole phrase,
  -- which is all it is scored on.
  alt_q as (
    select alt.k,
      case
        when not alt.typed then '"' || alt.t || '"'
        when cardinality(alt.w) = 1 and alt.t ~ '^[a-z]{3}' then alt.t || ' OR ' || alt.t || '*'
        else array_to_string(alt.w, ' OR ')
      end as word_q,
      case
        when not alt.typed or alt.t ~ '^[0-9 ]+$'
          or char_length(replace(alt.t, ' ', '')) < 5 then null
        else array_to_string(alt.w, ' OR ')
      end as gram_q
    from alt
  ),
  hit as (
    select h.k, h.id, bool_or(h.by_word) as by_word
    from (
      select aq.k, m.id, true as by_word
      from alt_q aq
      cross join lateral (
        select inv.id from public.inventory inv
        where inv.is_active
          and public.normalize_search_text(
                coalesce(inv.name,'') || ' ' || coalesce(inv.size,'') || ' ' || coalesce(inv.notes,''))
              &@~ pgroonga_condition(aq.word_q, index_name => 'inventory_search_word_idx',
                                     fuzzy_max_distance_ratio => fuzzy_ratio)
      ) m
      union all
      select aq.k, m.id, false
      from (select * from alt_q where gram_q is not null) aq
      cross join lateral (
        select inv.id from public.inventory inv
        where inv.is_active
          and public.normalize_search_text(
                coalesce(inv.name,'') || ' ' || coalesce(inv.size,'') || ' ' || coalesce(inv.notes,''))
              &@~ pgroonga_condition(aq.gram_q, index_name => 'inventory_search_ngram_idx')
      ) m
    ) h
    group by h.k, h.id
  ),
  -- Each hit with its row's text: name and size are the plant's identity,
  -- notes are scored apart from them. A size only qualifies a plant: when the
  -- query names one, rows matching the size alone (10,000 for `1 g`) cannot
  -- pass the minimum match, so they are not normalized and scored. The text is
  -- fetched per hit by primary key; joining two CTEs by id instead lets the
  -- planner, which expects few pgroonga rows, pick a quadratic nested loop.
  doc as materialized (
    select h.k, h.id, h.by_word,
      ' ' || btrim(regexp_replace(public.normalize_search_text(
        coalesce(inv.name,'') || ' ' || coalesce(inv.size,'')), '\s+', ' ', 'g')) || ' ' as idoc,
      ' ' || btrim(regexp_replace(public.normalize_search_text(inv.notes), '\s+', ' ', 'g')) || ' ' as ndoc
    from (
      select hit.k, hit.id, hit.by_word,
             bool_or(not alt.is_size) over (partition by hit.id) as names_plant
      from hit join alt on alt.k = hit.k
    ) h
    join public.inventory inv on inv.id = h.id
    where h.names_plant or not exists (select 1 from alt where not alt.is_size)
  ),
  -- Credit for each typed word in each retrieved row. A retrieved word that is
  -- not in the text as typed was matched fuzzily by pgroonga, and earns its
  -- trigram closeness (`cyprus` is nearer cypress than cedrus); the words of a
  -- multi-word name are retrieved with OR, so for those a missing word is
  -- checked for a typo against the identity instead. A name scales by the
  -- share of its words found.
  alt_score as (
    select alt.g, doc.id,
           sum(c.credit) / cardinality(alt.w)
             * count(*) filter (where c.credit > 0) / cardinality(alt.w) as credit,
           bool_and(c.credit > 0) as complete
    from doc
    join alt on alt.k = doc.k and alt.typed
    cross join lateral unnest(alt.w) as w(t)
    cross join lateral (select case
        when position(' ' || w.t || ' ' in doc.idoc) > 0 then 1.0
        when position(' ' || w.t || ' ' in doc.ndoc) > 0 then 0.4
        when w.t ~ '^[0-9]' then 0          -- a number is a whole word or nothing
        when position(' ' || w.t in doc.idoc) > 0 then 0.45
        when position(' ' || w.t in doc.ndoc) > 0 then 0.2
        when doc.by_word and cardinality(alt.w) = 1 then 0.6 * word_similarity(w.t, doc.idoc)
        when char_length(w.t) >= 4 and word_similarity(w.t, doc.idoc) >= 0.6
          then 0.6 * word_similarity(w.t, doc.idoc)
        when char_length(w.t) >= 5 and position(w.t in doc.idoc) > 0 then 0.45
        when position(w.t in doc.ndoc) > 0 then 0.1
        else 0 end as credit) c
    group by alt.k, alt.g, alt.w, doc.id
  ),
  -- Sizes and aliases are names: they count only whole, as the phrase, so the
  -- alias `white salvia` no longer matches "White Flame ... Salvia".
  phrase_score as (
    select alt.g, doc.id,
           case when position(' ' || alt.t || ' ' in doc.idoc) > 0 then 1.0 else 0.4 end as credit,
           true as complete
    from doc
    join alt on alt.k = doc.k and not alt.typed
    where position(' ' || alt.t || ' ' in doc.idoc) > 0
       or position(' ' || alt.t || ' ' in doc.ndoc) > 0
  ),
  -- Word breaks differ between lists: `feathergrass` must find "Mexican
  -- Feather Grass", `crape myrtle` must find "Crapemyrtle". Checked for the
  -- typed words against every retrieved row's identity with spaces removed.
  joined as (
    select alt.g, doc.id, 0.9 as credit, true as complete
    from alt
    join doc on position(replace(alt.t, ' ', '') in replace(doc.idoc, ' ', '')) > 0
    where alt.typed and char_length(replace(alt.t, ' ', '')) >= 6
  ),
  grp_score as (
    select s.g, s.id, max(s.credit) as credit, bool_or(s.complete) as complete
    from (select * from alt_score union all select * from phrase_score
          union all select * from joined) s
    group by s.g, s.id
  ),
  -- IDF over rows holding every word of some alternative of the group. A
  -- size's rows were not all scored, but its phrase hits are exact already.
  grp_df as (
    select gs.g, count(*) as df from grp_score gs
    where gs.complete and gs.g not in (select alt.g from alt where alt.is_size)
    group by gs.g
    union all
    select alt.g, count(distinct hit.id) from hit join alt on alt.k = hit.k
    where alt.is_size
    group by alt.g
  ),
  grp_idf as (
    select gg.g, ln(1.0 + (n_docs - coalesce(d.df, 0) + 0.5) / (coalesce(d.df, 0) + 0.5)) as idf
    from generate_series(1, n_groups) gg(g)
    left join grp_df d on d.g = gg.g
  ),
  scored as (
    select gs.id, sum(gs.credit * gi.idf)::real as rel
    from grp_score gs
    join grp_idf gi on gi.g = gs.g
    group by gs.id
    having sum(gs.credit * gi.idf) > 0
  ),
  visible as materialized (
    select inv.id, inv.name, inv.common_name, inv.botanical_name,
           inv.cultivar_variety_trade_name, inv.cultivar_keys,
           inv.size, inv.size_std, inv.unit_price, inv.quantity, inv.supplier_id,
           inv.image_url, inv.notes, inv.internal_notes,
           inv.height, inv.width, inv.caliper, inv.is_active, inv.source_id,
           src.file_path as source, inv.created_at, inv.updated_at,
           s.name as supplier_name, s.category as supplier_category,
           s.state as supplier_state, s.city as supplier_city,
           inv.height_std, inv.width_std, inv.caliper_std,
           sc.rel
    from scored sc
    join public.inventory inv on inv.id = sc.id
    join public.suppliers s on s.id = inv.supplier_id
    left join public.inventory_sources src on src.id = inv.source_id
    where inv.source_id is null or src.is_active
  )
  -- Minimum match: half the best row's relevance. Enough for a row missing the
  -- least selective group (usually the size) or found by a typo; not enough
  -- for one matching only the size, only in its notes, or only by a word
  -- start when whole words matched elsewhere.
  select v.id, v.name, v.common_name, v.botanical_name,
         v.cultivar_variety_trade_name, v.cultivar_keys,
         v.size, v.size_std, v.unit_price, v.quantity, v.supplier_id,
         v.image_url, v.notes, v.internal_notes, v.height, v.width, v.caliper,
         v.is_active, v.source_id, v.source, v.created_at, v.updated_at,
         v.supplier_name, v.supplier_category, v.supplier_state, v.supplier_city,
         v.height_std, v.width_std, v.caliper_std, v.rel
  from visible v
  where v.rel >= 0.5 * (select max(x.rel) from visible x)
  order by v.rel desc, v.updated_at desc, v.name asc;
end
$function$;

-- search_plant_photos from 0052_plant_photos_name_key.sql
CREATE OR REPLACE FUNCTION public.search_plant_photos(
  search text DEFAULT ''::text,
  fuzzy_ratio real DEFAULT 0.34
)
RETURNS TABLE(
  id uuid,
  storage_bucket text, storage_path text, mime_type text, byte_size bigint,
  image_width integer, image_height integer, sha256 text,
  supplier_id bigint, supplier_name text, supplier_category text,
  supplier_city text, supplier_state text,
  name text, name_key text, common_name text, botanical_name text,
  cultivar_variety_trade_name text, cultivar_keys text[],
  size text, size_std text, height text, width text, caliper text,
  tags text[], caption text, notes text, source text,
  captured_at timestamp with time zone, is_active boolean,
  created_at timestamp with time zone, updated_at timestamp with time zone,
  relevance real)
LANGUAGE plpgsql
STABLE
AS $function$
declare
  q text := btrim(regexp_replace(public.normalize_search_text(search), '\s+', ' ', 'g'));
  words text[];
  n_words int;
  cur int;
  span_len int;
  span_txt text;
  span_k text;
  span_alts text[];
  span_is_size boolean;
  size_num text;
  alt_text text[] := '{}';
  alt_grp  int[]  := '{}';
  alt_pad  bool[] := '{}';
  grp_idf  real[] := '{}';
  n_groups int := 0;
  grp_query text;
  all_query text;
  n_docs bigint;
  df bigint;
  took boolean;
  i int;
begin
  if q = '' then
    return;
  end if;

  words := regexp_split_to_array(q, ' ');
  n_words := cardinality(words);
  select count(*) into n_docs from public.plant_photos p where p.is_active;

  if n_docs = 0 then
    return;
  end if;

  cur := 1;
  while cur <= n_words loop
    took := false;
    for span_len in reverse least(6, n_words - cur + 1) .. 1 loop
      span_txt := array_to_string(words[cur : cur + span_len - 1], ' ');

      span_is_size := false;
      size_num := substring(span_txt from '^[0-9]+(?:\.[0-9]+)?');
      if span_txt ~ '^[0-9]+(\.[0-9]+)? (g|gal|gallon|gallons)$' then
        span_is_size := true;
        span_alts := array[size_num || ' g', size_num || ' gal',
                           size_num || ' gallon', size_num || ' gallons'];
      elsif span_txt ~ '^[0-9]+(\.[0-9]+)? ((in|inch|inches) )?box$' then
        span_is_size := true;
        span_alts := array[size_num || ' box', size_num || ' inch box',
                           size_num || ' in box'];
      end if;

      if span_is_size then
        n_groups := n_groups + 1;
        for i in 1 .. cardinality(span_alts) loop
          alt_text := alt_text || span_alts[i];
          alt_grp  := alt_grp  || n_groups;
          alt_pad  := alt_pad  || true;
        end loop;
        cur := cur + span_len;
        took := true;
        exit;
      end if;

      span_k := nullif(public.normalize_plant_key(span_txt), '');
      span_alts := '{}';
      if span_k is not null then
        span_alts := array(
          select distinct btrim(regexp_replace(public.normalize_search_text(e.v), '\s+', ' ', 'g'))
          from public.plant_aliases pa
          cross join lateral (values
            (case when pa.name_key = span_k then pa.other_name end),
            (case when pa.other_name_key = span_k then pa.name end)
          ) e(v)
          where pa.is_active and e.v is not null
            and btrim(regexp_replace(public.normalize_search_text(e.v), '\s+', ' ', 'g')) <> ''
        );
      end if;
      if cardinality(span_alts) > 0 or span_len = 1 then
        n_groups := n_groups + 1;
        alt_text := alt_text || span_txt;
        alt_grp  := alt_grp  || n_groups;
        alt_pad  := alt_pad  || false;
        for i in 1 .. cardinality(span_alts) loop
          if span_alts[i] <> span_txt then
            alt_text := alt_text || span_alts[i];
            alt_grp  := alt_grp  || n_groups;
            alt_pad  := alt_pad  || false;
          end if;
        end loop;
        cur := cur + span_len;
        took := true;
        exit;
      end if;
    end loop;
    if not took then
      cur := cur + 1;
    end if;
  end loop;

  for i in 1 .. n_groups loop
    select string_agg(case when a.p then '"' || a.t || '"' else '(' || a.t || ')' end, ' OR ')
      into grp_query
    from unnest(alt_text, alt_grp, alt_pad) a(t, g, p) where a.g = i;

    select count(*) into df
    from public.plant_photos p
    where p.is_active
      and ( public.normalize_search_text(
              public.plant_photo_document(p.name, p.size, p.caption, p.tags, p.notes))
            &@~ pgroonga_condition(grp_query, index_name => 'plant_photos_search_ngram_idx',
                                   fuzzy_max_distance_ratio => fuzzy_ratio)
         or public.normalize_search_text(
              public.plant_photo_document(p.name, p.size, p.caption, p.tags, p.notes))
            &@~ pgroonga_condition(grp_query, index_name => 'plant_photos_search_word_idx',
                                   fuzzy_max_distance_ratio => fuzzy_ratio) );

    grp_idf := grp_idf || ln(1.0 + (n_docs - df + 0.5) / (df + 0.5))::real;
  end loop;

  select string_agg(case when a.p then '"' || a.t || '"' else '(' || a.t || ')' end, ' OR ')
    into all_query
  from unnest(alt_text, alt_pad) a(t, p);

  return query
  with cand as materialized (
    select p.id, p.storage_bucket, p.storage_path, p.mime_type, p.byte_size,
           p.image_width, p.image_height, p.sha256,
           p.supplier_id, s.name as supplier_name, s.category as supplier_category,
           s.city as supplier_city, s.state as supplier_state,
           p.name, p.name_key, p.common_name, p.botanical_name,
           p.cultivar_variety_trade_name, p.cultivar_keys,
           p.size, p.size_std, p.height, p.width, p.caliper,
           p.tags, p.caption, p.notes, p.source,
           p.captured_at, p.is_active, p.created_at, p.updated_at,
           btrim(regexp_replace(public.normalize_search_text(
             public.plant_photo_document(p.name, p.size, p.caption, p.tags, p.notes)),
             '\s+', ' ', 'g')) as sdoc
    from public.plant_photos p
    left join public.suppliers s on s.id = p.supplier_id
    where p.is_active
      and ( public.normalize_search_text(
              public.plant_photo_document(p.name, p.size, p.caption, p.tags, p.notes))
            &@~ pgroonga_condition(all_query, index_name => 'plant_photos_search_ngram_idx',
                                   fuzzy_max_distance_ratio => fuzzy_ratio)
         or public.normalize_search_text(
              public.plant_photo_document(p.name, p.size, p.caption, p.tags, p.notes))
            &@~ pgroonga_condition(all_query, index_name => 'plant_photos_search_word_idx',
                                   fuzzy_max_distance_ratio => fuzzy_ratio) )
  )
  select c.id, c.storage_bucket, c.storage_path, c.mime_type, c.byte_size,
         c.image_width, c.image_height, c.sha256,
         c.supplier_id, c.supplier_name, c.supplier_category,
         c.supplier_city, c.supplier_state,
         c.name, c.name_key, c.common_name, c.botanical_name,
         c.cultivar_variety_trade_name, c.cultivar_keys,
         c.size, c.size_std, c.height, c.width, c.caliper,
         c.tags, c.caption, c.notes, c.source,
         c.captured_at, c.is_active, c.created_at, c.updated_at,
         coalesce(sc.rel, 0)::real
  from cand c
  left join lateral (
    select sum(m.idf)::real as rel
    from (
      select distinct a.g, grp_idf[a.g] as idf
      from unnest(alt_text, alt_grp, alt_pad) a(t, g, p)
      where (a.p and position(' ' || a.t || ' ' in ' ' || c.sdoc || ' ') > 0)
         or (not a.p and (position(a.t in c.sdoc) > 0
                          or word_similarity(a.t, c.sdoc) >= 0.6))
    ) m
  ) sc on true
  order by coalesce(sc.rel, 0) desc, c.captured_at desc nulls last,
           c.created_at desc, c.name asc;
end
$function$;

-- search_query_groups from 0142_alias_typo_partial_match.sql
CREATE OR REPLACE FUNCTION public.search_query_groups(search text)
RETURNS TABLE(g int, span text, t text, is_size boolean, typed boolean,
              alias_match text, alias_ids bigint[])
LANGUAGE plpgsql
STABLE
AS $function$
declare
  q text := btrim(regexp_replace(public.normalize_search_text(search), '\s+', ' ', 'g'));
  words text[];
  n_words int;
  cur int;
  span_len int;
  span_txt text;
  span_k text;
  size_num text;
  how text;
  alts text[];
  alt_ids text[];  -- each alternative's pair ids, comma-joined
  -- Each alias word a query word matches: query word m_qi (m_qn counting
  -- no stray `s`) is word m_pos of side m_side (0 name, 1 other_name) of
  -- pair m_id, a name of m_slen words; m_typo when it matched as a typo,
  -- m_pre when only as an unfinished word.
  m_qi int[];
  m_qn int[];
  m_id bigint[];
  m_side int[];
  m_pos int[];
  m_slen int[];
  m_typo boolean[];
  m_pre boolean[];
  n_name_words int;  -- the query's words outside sizes
  span_n int;        -- the span's words, less any stray `s`
  took boolean;
  i int;
begin
  g := 0;
  if q = '' then
    return;
  end if;

  words := regexp_split_to_array(q, ' ');
  n_words := cardinality(words);
  select count(*) into n_name_words
  from unnest(words) u(w)
  where u.w !~ '[0-9]'
    and u.w not in ('s', 'g', 'gal', 'gallon', 'gallons', 'box', 'in', 'inch', 'inches');

  -- Matched once per query against the alias vocabulary, then reused by every
  -- span. A word with a digit is never part of an alias.
  select coalesce(array_agg(x.qi), '{}'), coalesce(array_agg(x.qn), '{}'),
         coalesce(array_agg(x.id), '{}'),
         coalesce(array_agg(x.side), '{}'), coalesce(array_agg(x.pos), '{}'),
         coalesce(array_agg(x.slen), '{}'), coalesce(array_agg(x.typo), '{}'),
         coalesce(array_agg(x.pre), '{}')
  into m_qi, m_qn, m_id, m_side, m_pos, m_slen, m_typo, m_pre
  from (
    with side_word as (
      select pa.id, s.side, cardinality(s.w) as slen, u.w, u.pos::int as pos
      from public.plant_aliases pa
      cross join lateral (values
        (0, array_remove(string_to_array(btrim(regexp_replace(public.normalize_search_text(pa.name), '\s+', ' ', 'g')), ' '), 's')),
        (1, array_remove(string_to_array(btrim(regexp_replace(public.normalize_search_text(pa.other_name), '\s+', ' ', 'g')), ' '), 's'))
      ) s(side, w)
      cross join lateral unnest(s.w) with ordinality u(w, pos)
      where pa.is_active
    ),
    -- Materialized, so its per-word work runs once, not per vocabulary word.
    query_word as materialized (
      select u.w, u.qi::int as qi,
             (u.qi - (select count(*) from unnest(words[1 : u.qi]) p(w) where p.w = 's'))::int as qn,
             case when char_length(u.w) >= 8 then 2 when char_length(u.w) >= 5 then 1
                  else 0 end as edits
      from unnest(words) with ordinality u(w, qi)
      where u.w !~ '[0-9]' and u.w <> 's'
    ),
    vocab_match as (
      select vm.qi, vm.qn, vm.w, vm.typo and not vm.typed as typo,
             not (vm.typed or vm.typo) as pre
      from (
        select qw.qi, qw.qn, v.w, v.w = qw.w as typed,
               qw.edits > 0
               and abs(char_length(v.w) - char_length(qw.w)) <= qw.edits
               and similarity(v.w, qw.w) >= 0.2
               and public.plant_word_distance(v.w, qw.w) <= qw.edits as typo,
               qw.qi = n_words and char_length(qw.w) >= 3
               and left(v.w, char_length(qw.w)) = qw.w as unfinished
        from query_word qw
        cross join (select distinct side_word.w from side_word) v
      ) vm
      where vm.typed or vm.typo or vm.unfinished
    )
    select vm.qi, vm.qn, sw.id, sw.side, sw.pos, sw.slen, vm.typo, vm.pre
    from vocab_match vm
    join side_word sw on sw.w = vm.w
  ) x;

  cur := 1;
  while cur <= n_words loop
    took := false;
    for span_len in reverse least(6, n_words - cur + 1) .. 1 loop
      span_txt := array_to_string(words[cur : cur + span_len - 1], ' ');

      -- A typed size becomes ONE phrase group rather than two junk tokens.
      -- `15g` normalizes to `15 g`, and alone those are the least selective
      -- terms in the corpus: `g` is in 63% of rows, `15` matches any 15
      -- anywhere. As a phrase it is selective (df ~5,200) and earns a real
      -- weight, so a 15 G row outranks a 200 G one without anything being
      -- filtered out.
      --
      -- The alternatives are the spellings a *document* can contain, not the
      -- ones a user types: sizes are stored canonically, so the corpus only
      -- ever prints `15 g` and `24" Box` (-> `24 box`). Someone typing
      -- `15 gal` or `24 inch box` has to reach those.
      alts := null;
      size_num := substring(span_txt from '^[0-9]+(?:\.[0-9]+)?');
      if span_txt ~ '^[0-9]+(\.[0-9]+)? (g|gal|gallon|gallons)$' then
        alts := array[size_num || ' g', size_num || ' gal',
                      size_num || ' gallon', size_num || ' gallons'];
      elsif span_txt ~ '^[0-9]+(\.[0-9]+)? ((in|inch|inches) )?box$' then
        alts := array[size_num || ' box', size_num || ' inch box',
                      size_num || ' in box'];
      end if;

      if alts is not null then
        g := g + 1;
        span := span_txt;
        is_size := true;
        typed := false;
        alias_match := null;
        alias_ids := null;
        foreach t in array alts loop
          return next;
        end loop;
        cur := cur + span_len;
        took := true;
        exit;
      end if;

      -- Alias expansion. A span with a number in it is never an alias:
      -- normalize_plant_key drops digits, so `salvia greggii 1` would
      -- otherwise pass for `salvia greggii` and strand the size's unit as a
      -- word of its own.
      alts := '{}';
      how := null;
      span_n := span_len - cardinality(array_positions(words[cur : cur + span_len - 1], 's'));
      if span_txt !~ '(^| )[0-9]' then
        -- Exact: the span's letters are an alias name; the other name is added.
        span_k := nullif(public.normalize_plant_key(span_txt), '');
        if span_k is not null then
          select coalesce(array_agg(e.v order by e.v), '{}'),
                 coalesce(array_agg(e.ids order by e.v), '{}')
          into alts, alt_ids
          from (
            select btrim(regexp_replace(public.normalize_search_text(o.v), '\s+', ' ', 'g')) as v,
                   string_agg(distinct pa.id::text, ',') as ids
            from public.plant_aliases pa
            cross join lateral (values
              (case when pa.name_key = span_k then pa.other_name end),
              (case when pa.other_name_key = span_k then pa.name end)
            ) o(v)
            where pa.is_active and o.v is not null
            group by 1
          ) e
          where e.v <> '';
          how := 'exact';
        end if;

        -- Close, then partial: the span's words aligned, in order, to
        -- consecutive words of an alias name. Close covers the whole name;
        -- partial a run inside a longer one. The fewest extra words win, then
        -- the fewest typos; partial gives up past three pairs. An unfinished
        -- word, a partial match or a one-word typo needs the span to be the
        -- whole plant name. Both names are added.
        if cardinality(alts) = 0 and span_n > 0 then
          with aligned as (
            select x.id, x.slen - span_n as extra,
                   count(*) filter (where x.typo) as typos
            from unnest(m_qi, m_qn, m_id, m_side, m_pos, m_slen, m_typo, m_pre)
              x(qi, qn, id, side, pos, slen, typo, pre)
            where x.qi between cur and cur + span_len - 1
            group by x.id, x.side, x.slen, x.pos - x.qn
            having count(*) = span_n
               and (span_n = n_name_words
                    or (x.slen = span_n and not bool_or(x.pre)
                        and (span_n > 1 or not bool_or(x.typo))))
          ),
          best as (
            select a.id, a.extra from aligned a
            where (a.extra, a.typos) = (select b.extra, b.typos from aligned b
                                        order by b.extra, b.typos limit 1)
          ),
          chosen as (
            select distinct b.id, case when b.extra = 0 then 'close' else 'partial' end as kind
            from best b
            where b.extra = 0
               or ((span_n > 1 or char_length(span_txt) >= 4)
                   and (select count(distinct c.id) from best c) <= 3)
          )
          select coalesce(array_agg(e.v order by e.v), '{}'),
                 coalesce(array_agg(e.ids order by e.v), '{}'),
                 min(e.kind)
          into alts, alt_ids, how
          from (
            select btrim(regexp_replace(public.normalize_search_text(o.v), '\s+', ' ', 'g')) as v,
                   string_agg(distinct c.id::text, ',') as ids, min(c.kind) as kind
            from chosen c
            join public.plant_aliases pa on pa.id = c.id
            cross join lateral (values (pa.name), (pa.other_name)) o(v)
            group by 1
          ) e
          where e.v <> '';
        end if;
      end if;

      if cardinality(alts) > 0 or span_len = 1 then
        g := g + 1;
        span := span_txt;
        is_size := false;
        t := span_txt;
        typed := true;
        alias_match := null;
        alias_ids := null;
        return next;
        typed := false;
        alias_match := how;
        for i in 1 .. cardinality(alts) loop
          if alts[i] <> span_txt then
            t := alts[i];
            alias_ids := string_to_array(alt_ids[i], ',')::bigint[];
            return next;
          end if;
        end loop;
        cur := cur + span_len;
        took := true;
        exit;
      end if;
    end loop;
    if not took then
      cur := cur + 1;
    end if;
  end loop;
end
$function$;

-- search_suppliers from 0074_rename_is_onboarded_to_is_lps_partner.sql
CREATE OR REPLACE FUNCTION public.search_suppliers(
  search text DEFAULT ''::text,
  category_filter text DEFAULT NULL::text,
  fuzzy_ratio real DEFAULT 0.34,
  sort_column text DEFAULT NULL::text,
  sort_direction text DEFAULT NULL::text
)
RETURNS TABLE(
  id bigint, name text, address text, city text, state text, zip text,
  primary_contact_name text, primary_contact_email text, primary_contact_phone text,
  website text, latitude double precision, longitude double precision,
  notes text, category text,
  created_at timestamp with time zone, updated_at timestamp with time zone,
  availability_source_type text, availability_update_days integer,
  hosted_availability_url text, is_lps_partner boolean
)
LANGUAGE plpgsql
STABLE
AS $function$
declare
  q text := public.normalize_search_text(search);
  q_star text := case
    when length(substring(btrim(q) from '[a-z0-9]*$')) >= 3
      then btrim(q) || '*'
    else q
  end;
  trgm_ids bigint[] := '{}';
  contact_ids bigint[] := '{}';
  dir text := case when lower(coalesce(sort_direction, '')) = 'desc' then 'desc' else 'asc' end;
  col text := case sort_column
    when 'name'                          then 's.name'
    when 'category'                      then 's.category'
    when 'primary_contact_name'          then 'pc.name'
    when 'primary_contact_email'         then 'pc.email'
    when 'primary_contact_phone'         then 'pc.phone'
    when 'website'                       then 's.website'
    when 'address'                       then 's.address'
    when 'city'                          then 's.city'
    when 'state'                         then 's.state'
    when 'zip'                           then 's.zip'
    when 'notes'                         then 's.notes'
    when 'availability_source_type'      then 's.availability_source_type'
    when 'availability_update_days'      then 's.availability_update_days'
    when 'hosted_availability_url'       then 's.hosted_availability_url'
    when 'created_at'                    then 's.created_at'
    when 'updated_at'                    then 's.updated_at'
    else null
  end;
  order_extra text := case when col is null then '' else ', ' || col || ' ' || dir end;
begin
  if q <> '' then
    trgm_ids := array(
      select s.id
      from public.suppliers s
      where q <% public.normalize_search_text(
              coalesce(s.name, '') || ' ' || coalesce(s.address, '') || ' ' ||
              coalesce(s.city, '') || ' ' || coalesce(s.state, '') || ' ' ||
              coalesce(s.zip, '') || ' ' || coalesce(s.category, '') || ' ' ||
              coalesce(s.notes, ''))
    );

    contact_ids := array(
      select distinct sc.supplier_id
      from public.contacts c
      join public.supplier_contacts sc on sc.contact_id = c.id and sc.is_active
      where c.is_active
        and (
          public.normalize_search_text(
            coalesce(c.name, '') || ' ' || coalesce(c.email, '') || ' ' ||
            coalesce(c.phone, '') || ' ' || coalesce(c.title_department, ''))
            &@~ pgroonga_condition(q, fuzzy_max_distance_ratio => fuzzy_ratio)
          or public.normalize_search_text(
            coalesce(c.name, '') || ' ' || coalesce(c.email, '') || ' ' ||
            coalesce(c.phone, '') || ' ' || coalesce(c.title_department, ''))
            &@~ q_star
        )
    );
  end if;

  return query execute format($q$
    select s.id, s.name, s.address, s.city, s.state, s.zip,
           pc.name, pc.email, pc.phone, s.website, s.latitude, s.longitude,
           s.notes, s.category, s.created_at, s.updated_at,
           s.availability_source_type, s.availability_update_days,
           s.hosted_availability_url, s.is_lps_partner
    from suppliers s
    left join lateral (
      select c.name, c.email, c.phone
      from public.supplier_contacts sc
      join public.contacts c on c.id = sc.contact_id and c.is_active
      where sc.supplier_id = s.id and sc.is_active
      order by sc.is_primary desc, c.id asc
      limit 1
    ) pc on true
    where s.is_active
      and ($1 is null or s.category = $1)
      and (
        $2 = ''
        or public.normalize_search_text(
             coalesce(s.name, '') || ' ' || coalesce(s.address, '') || ' ' ||
             coalesce(s.city, '') || ' ' || coalesce(s.state, '') || ' ' ||
             coalesce(s.zip, '') || ' ' || coalesce(s.category, '') || ' ' ||
             coalesce(s.notes, ''))
           &@~ pgroonga_condition($2, fuzzy_max_distance_ratio => $3)
        or public.normalize_search_text(
             coalesce(s.name, '') || ' ' || coalesce(s.address, '') || ' ' ||
             coalesce(s.city, '') || ' ' || coalesce(s.state, '') || ' ' ||
             coalesce(s.zip, '') || ' ' || coalesce(s.category, '') || ' ' ||
             coalesce(s.notes, ''))
           &@~ $5
        or s.id = any($4)
        or s.id = any($6)
      )
    order by
      case when $2 = '' then 0
           else pgroonga_score(s.tableoid, s.ctid) end desc%s,
      s.updated_at desc,
      s.name asc
  $q$, order_extra)
  using category_filter, q, fuzzy_ratio, trgm_ids, q_star, contact_ids;
end
$function$;

CREATE OR REPLACE FUNCTION public.guard_ar_public_link()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status NOT IN ('closed', 'draft') AND NOT EXISTS (
    SELECT 1 FROM public.job_requests j WHERE j.id = NEW.job_request_id AND j.is_active
      AND j.status NOT IN ('closed_won', 'closed_lost', 'archived')
  ) THEN RAISE EXCEPTION 'All linked job requests are closed'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'draft' AND NEW.status IN ('processing', 'submitted') THEN
    RAISE EXCEPTION 'Publish the draft before recording supplier progress';
  END IF;
  IF NEW.status = 'draft' THEN NEW.submitted_at := NULL; END IF;
  IF NEW.status IN ('closed', 'draft') THEN
    NEW.public_token := NULL;
  ELSIF NEW.public_token IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.suppliers WHERE id = NEW.supplier_id AND is_active
  ) THEN RAISE EXCEPTION 'Public requests require an active supplier'; END IF;
  IF NEW.status = 'submitted' AND (TG_OP = 'INSERT' OR OLD.status <> 'submitted') THEN
    NEW.submitted_at := now();
  END IF;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.guard_one_ar_per_job_supplier()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE existing bigint;
BEGIN
  IF NEW.job_request_id IS NULL THEN RETURN NEW; END IF;
  PERFORM 1 FROM public.job_requests WHERE id = NEW.job_request_id FOR UPDATE;
  SELECT id INTO existing FROM public.availability_requests
    WHERE job_request_id = NEW.job_request_id AND supplier_id = NEW.supplier_id
    ORDER BY id DESC LIMIT 1;
  IF existing IS NOT NULL THEN
    RAISE EXCEPTION 'JR-% already has AR-% with this supplier; add candidates to it (reopen it first if it is submitted, processing or closed)',
      NEW.job_request_id, existing;
  END IF;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.inventory_derive_identity()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  composed text;
BEGIN
  new.common_name                 := nullif(btrim(new.common_name), '');
  new.botanical_name              := nullif(btrim(new.botanical_name), '');
  new.cultivar_variety_trade_name := nullif(btrim(new.cultivar_variety_trade_name), '');

  composed := public.compose_plant_name(
                new.common_name, new.botanical_name, new.cultivar_variety_trade_name);
  IF composed IS NOT NULL THEN
    new.name := composed;
  END IF;

  new.common_name_key    := nullif(public.normalize_plant_key(new.common_name), '');
  new.botanical_name_key := nullif(public.normalize_plant_key(new.botanical_name), '');

  new.cultivar_keys := (
    SELECT array_agg(DISTINCT k)
    FROM (
      SELECT nullif(public.normalize_plant_key(part), '') AS k
      FROM regexp_split_to_table(
             coalesce(new.cultivar_variety_trade_name, ''), '\s*[,;|]\s*') AS part
    ) s
    WHERE k IS NOT NULL
  );
  RETURN new;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.submit_availability_request_note(p_request_id bigint, p_supplier_id bigint, p_note text)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF length(p_note) > 10000 THEN RAISE EXCEPTION 'Supplier note must be 10000 characters or fewer'; END IF;
  PERFORM public.answer_availability_request(p_request_id, p_supplier_id, p_submit => true);
  UPDATE public.availability_requests SET note_for_supplier = nullif(btrim(p_note), '') WHERE id = p_request_id;
  RETURN p_request_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.apply_candidate_offer(p_candidate_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE src public.candidates; offered public.candidates; demand numeric;
BEGIN
  SELECT * INTO src FROM public.candidates
    WHERE id = p_candidate_id AND is_active AND status = 'unavailable' AND offered_candidate_id IS NOT NULL;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO offered FROM public.candidates WHERE id = src.offered_candidate_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  demand := (SELECT demanded_quantity FROM public.job_request_items WHERE id = offered.job_request_item_id);
  UPDATE public.candidates SET
    availability_request_id = src.availability_request_id,
    status = 'diff_size_sub',
    available_quantity = demand,
    hide_from_lps = false,
    answered_at = now()
  WHERE id = offered.id;
END $function$
;

CREATE OR REPLACE FUNCTION public.candidate_status_quantity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE demand numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  demand := (SELECT demanded_quantity FROM public.job_request_items WHERE id = NEW.job_request_item_id);
  IF NEW.status = 'available' THEN
    NEW.available_quantity := coalesce(demand, NEW.available_quantity);
  ELSIF NEW.status = 'unavailable' THEN
    NEW.available_quantity := 0;
  ELSIF NEW.status = 'diff_size_sub' AND NEW.available_quantity IS NULL THEN
    NEW.available_quantity := demand;
  ELSIF NEW.status IS NULL AND TG_OP = 'UPDATE' THEN
    NEW.available_quantity := NULL;
  END IF;
  RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.delete_candidate(p_candidate_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.job_request_items WHERE default_candidate_id = p_candidate_id) THEN
    RAISE EXCEPTION 'The line''s default candidate can''t be deleted';
  END IF;
  UPDATE public.candidates SET is_active = false WHERE id = p_candidate_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Candidate not found'; END IF;
END $function$
;

CREATE OR REPLACE FUNCTION public.answer_availability_request(p_request_id bigint, p_supplier_id bigint, p_item_id bigint DEFAULT NULL::bigint, p_changes jsonb DEFAULT NULL::jsonb, p_submit boolean DEFAULT false)
 RETURNS bigint
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE ar public.availability_requests; cur public.candidates; k text; next_status text;
  next_offer bigint; next_description text; has_offer boolean; typed boolean; prev_typed boolean;
  offer_changed boolean; qty numeric; demand numeric;
BEGIN
  SELECT * INTO ar FROM public.availability_requests
    WHERE id = p_request_id AND supplier_id = p_supplier_id  AND status <> 'closed'
      AND (status <> 'draft' OR current_setting('lps.ar_admin_edit', true) = 'on') FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.suppliers WHERE id = ar.supplier_id AND is_active) THEN
    RAISE EXCEPTION 'This request is closed, draft or unavailable';
  END IF;
  IF p_submit THEN
    UPDATE public.availability_requests SET status = 'submitted', submitted_at = now() WHERE id = ar.id;
    RETURN ar.id;
  END IF;
  IF p_changes IS NULL OR jsonb_typeof(p_changes) <> 'object' OR p_changes = '{}'::jsonb THEN
    RAISE EXCEPTION 'Changes are required';
  END IF;
  FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
    IF k NOT IN ('status', 'available_quantity', 'unit_price', 'note_from_supplier',
        'offered_candidate_id', 'offer_description', 'offer_unit_price', 'offer_quantity')
      OR jsonb_typeof(p_changes->k) <> 'string' THEN
      RAISE EXCEPTION 'Invalid answer field';
    END IF;
  END LOOP;
  FOREACH k IN ARRAY ARRAY['available_quantity', 'unit_price', 'offer_unit_price', 'offer_quantity'] LOOP
    IF p_changes ? k AND nullif(trim(p_changes->>k), '')::numeric::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'Answer numbers must be finite';
    END IF;
  END LOOP;
  SELECT * INTO cur FROM public.candidates
    WHERE id = p_item_id AND availability_request_id = ar.id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Line not found'; END IF;
  IF EXISTS (SELECT 1 FROM public.candidates
      WHERE offered_candidate_id = cur.id AND availability_request_id = ar.id AND is_active) THEN
    RAISE EXCEPTION 'This is a substitute: answer the line that offers it';
  END IF;
  prev_typed := cur.offered_candidate_id IS NOT NULL AND cur.offer_description IS NOT NULL;
  next_status := CASE WHEN p_changes ? 'status' THEN nullif(trim(p_changes->>'status'), '') ELSE cur.status END;
  next_description := CASE WHEN p_changes ? 'offer_description'
    THEN nullif(btrim(p_changes->>'offer_description'), '') ELSE cur.offer_description END;
  next_offer := CASE WHEN p_changes ? 'offered_candidate_id'
    THEN nullif(trim(p_changes->>'offered_candidate_id'), '')::bigint ELSE cur.offered_candidate_id END;
  typed := next_description IS NOT NULL AND (next_offer IS NULL OR (prev_typed AND next_offer = cur.offered_candidate_id));
  IF NOT typed THEN next_description := NULL; END IF;
  IF typed THEN next_offer := CASE WHEN prev_typed THEN cur.offered_candidate_id END; END IF;
  has_offer := next_offer IS NOT NULL OR typed;
  IF next_status IN ('unavailable', 'diff_size_sub') AND has_offer THEN
    next_status := 'unavailable';
  ELSIF next_status = 'diff_size_sub' AND (p_changes ? 'status'
      OR p_changes ? 'offered_candidate_id' OR p_changes ? 'offer_description') THEN
    RAISE EXCEPTION 'Pick or describe the substitute';
  END IF;
  IF next_status IS DISTINCT FROM 'unavailable' THEN next_offer := NULL; next_description := NULL; typed := false; has_offer := false; END IF;
  IF next_offer IS NOT NULL AND NOT typed THEN
    IF NOT EXISTS (SELECT 1 FROM public.candidates o
        WHERE o.id = next_offer AND o.id <> cur.id AND o.is_active AND o.supplier_id = cur.supplier_id
          AND o.job_request_item_id IS NOT DISTINCT FROM cur.job_request_item_id
          AND cur.job_request_item_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Offered candidate must be another candidate of this line and supplier';
    END IF;
    IF next_offer IS DISTINCT FROM cur.offered_candidate_id AND EXISTS (SELECT 1 FROM public.candidates
        WHERE id = next_offer AND availability_request_id = ar.id) THEN
      RAISE EXCEPTION 'That candidate is asked on this request: answer it on its own line';
    END IF;
  END IF;
  IF typed AND cur.job_request_item_id IS NULL THEN RAISE EXCEPTION 'This line has no job line for a substitute'; END IF;
  IF cur.offered_candidate_id IS NOT NULL AND cur.offered_candidate_id IS DISTINCT FROM next_offer THEN
    PERFORM public.release_candidate_offer(cur.id);
  END IF;
  IF typed AND next_offer IS NULL THEN
    INSERT INTO public.candidates(supplier_id, job_request_item_id, availability_request_id, name, description,
        is_original, unit_price, status, note_from_supplier, answered_at)
      VALUES (cur.supplier_id, cur.job_request_item_id, ar.id, next_description, next_description,
        false, NULL, 'diff_size_sub', next_description, now())
      RETURNING id INTO next_offer;
  ELSIF typed AND next_description IS DISTINCT FROM cur.offer_description THEN
    UPDATE public.candidates SET name = next_description, description = next_description WHERE id = next_offer;
  END IF;
  offer_changed := has_offer AND next_offer IS DISTINCT FROM cur.offered_candidate_id;
  qty := nullif(trim(p_changes->>'available_quantity'), '')::numeric;
  demand := (SELECT demanded_quantity FROM public.job_request_items WHERE id = cur.job_request_item_id);
  IF NOT has_offer AND qty IS NOT NULL AND demand IS NOT NULL THEN
    IF next_status = 'available' AND qty > 0 AND qty < demand THEN next_status := 'partial_qty';
    ELSIF next_status = 'partial_qty' AND qty >= demand THEN next_status := 'available';
    END IF;
  END IF;
  UPDATE public.candidates SET
    status = next_status,
    available_quantity = CASE WHEN next_status = 'unavailable' THEN 0
      WHEN p_changes ? 'available_quantity' THEN qty ELSE available_quantity END,
    unit_price = CASE WHEN NOT has_offer AND p_changes ? 'unit_price'
      THEN nullif(trim(p_changes->>'unit_price'), '')::numeric ELSE unit_price END,
    note_from_supplier = CASE WHEN has_offer THEN NULL WHEN p_changes ? 'note_from_supplier'
      THEN nullif(trim(p_changes->>'note_from_supplier'), '') ELSE note_from_supplier END,
    offered_candidate_id = next_offer,
    offer_description = next_description,
    offer_unit_price = NULL,
    offer_quantity = NULL,
    answered_at = now()
  WHERE id = cur.id;
  IF has_offer THEN
    IF offer_changed OR cur.status IS DISTINCT FROM 'unavailable' THEN
      PERFORM public.apply_candidate_offer(cur.id);
    END IF;
    IF p_changes ?| ARRAY['unit_price', 'available_quantity', 'note_from_supplier'] THEN
      UPDATE public.candidates SET
        unit_price = CASE WHEN p_changes ? 'unit_price'
          THEN nullif(trim(p_changes->>'unit_price'), '')::numeric ELSE unit_price END,
        available_quantity = CASE WHEN p_changes ? 'available_quantity' THEN qty ELSE available_quantity END,
        note_from_supplier = CASE WHEN p_changes ? 'note_from_supplier'
          THEN nullif(trim(p_changes->>'note_from_supplier'), '') ELSE note_from_supplier END,
        answered_at = now()
      WHERE id = next_offer;
    END IF;
  END IF;
  IF ar.status <> 'draft' AND current_setting('lps.ar_admin_edit', true) IS DISTINCT FROM 'on' THEN
    UPDATE public.availability_requests SET status = 'processing' WHERE id = ar.id;
  END IF;
  RETURN ar.id;
END $function$
;
create table public.app_users (
  id uuid not null,
  username text not null,
  role text not null,
  supplier_id bigint,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  must_change_password boolean default false not null
);
create table public.availability_requests (
  id bigint generated always as identity not null,
  supplier_id bigint not null,
  share_customer_details boolean default false not null,
  status text default 'new'::text not null,
  submitted_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  note_for_supplier text,
  public_token uuid,
  job_request_id bigint not null
);
create table public.candidates (
  id bigint generated always as identity not null,
  availability_request_id bigint,
  name text not null,
  size text,
  status text,
  available_quantity numeric,
  unit_price numeric(10,2),
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  note_for_supplier text,
  mapped_inventory_id uuid,
  supplier_id bigint not null,
  job_request_item_id bigint not null,
  note_from_supplier text,
  note_for_customer text,
  answered_at timestamp with time zone,
  description text,
  is_original boolean default false not null,
  offered_candidate_id bigint,
  offer_description text,
  offer_unit_price numeric,
  offer_quantity numeric,
  hide_from_lps boolean default false not null
);
create table public.contacts (
  id bigint generated always as identity not null,
  name text,
  email text,
  phone text,
  title_department text,
  notes text,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table public.customers (
  id bigint generated always as identity not null,
  name text not null,
  company text,
  email text,
  phone text,
  address text,
  city text,
  state text,
  zip text,
  notes text,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  rosie_thread_id text,
  rosie_thread_ref bigint,
  type text
);
create table public.deleted_job_threads (
  agent text not null,
  thread_id text not null,
  job_request_id bigint not null,
  deleted_at timestamp with time zone default now() not null,
  purged_at timestamp with time zone,
  deleted_counts jsonb default '{}'::jsonb not null
);
create table public.inventory (
  id uuid default gen_random_uuid() not null,
  name text not null,
  size text,
  unit_price numeric(10,2),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  image_url text,
  notes text,
  height text,
  width text,
  caliper text,
  supplier_id bigint,
  is_active boolean default true not null,
  source_id uuid,
  quantity numeric,
  name_key text generated always as (normalize_plant_key(name)) stored,
  height_std double precision,
  width_std double precision,
  caliper_std double precision,
  size_std text,
  internal_notes text,
  common_name text,
  botanical_name text,
  cultivar_variety_trade_name text,
  common_name_key text,
  botanical_name_key text,
  cultivar_keys text[]
);
create table public.inventory_sources (
  id uuid default gen_random_uuid() not null,
  supplier_id bigint not null,
  file_path text not null,
  notes text,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null
);
create table public.job_request_changelog (
  id bigint generated always as identity not null,
  job_request_id bigint not null,
  item_id bigint,
  actor text not null,
  action text not null,
  changes jsonb not null,
  created_at timestamp with time zone default now() not null
);
create table public.job_request_items (
  id bigint generated always as identity not null,
  job_request_id bigint not null,
  name text not null,
  size text,
  demanded_quantity numeric,
  unit_price numeric(10,2),
  total numeric(12,2) generated always as ((demanded_quantity * unit_price)) stored,
  status text default 'pending'::text not null,
  note_internal text,
  note_for_customer text,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  available_quantity numeric,
  selected_candidate_id bigint not null,
  default_candidate_id bigint not null
);
create table public.job_requests (
  id bigint generated always as identity not null,
  customer_id bigint,
  status text default 'quoted'::text not null,
  billing_address text,
  billing_city text,
  billing_state text,
  billing_zip text,
  shipping_address text,
  shipping_city text,
  shipping_state text,
  shipping_zip text,
  note_internal text,
  note_for_customer text,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  name text,
  rosie_thread_ref bigint,
  expected_install_date date,
  fulfillment_method text
);
create table public.order_items (
  id bigint generated always as identity not null,
  order_id bigint not null,
  name text not null,
  size text,
  quantity numeric not null,
  unit_price numeric(10,2),
  total numeric(12,2) generated always as ((quantity * unit_price)) stored,
  status text default 'pending'::text not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  note_for_supplier text,
  candidate_id bigint,
  note_from_supplier text
);
create table public.orders (
  id bigint generated always as identity not null,
  supplier_id bigint not null,
  status text default 'new'::text not null,
  confirmation_date date,
  additional_details jsonb,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  public_token uuid,
  job_request_id bigint not null,
  note_from_supplier text,
  change_log text
);
create table public.plant_aliases (
  id bigint generated always as identity not null,
  name text not null,
  other_name text not null,
  name_key text generated always as (NULLIF(normalize_plant_key(name), ''::text)) stored,
  other_name_key text generated always as (NULLIF(normalize_plant_key(other_name), ''::text)) stored,
  source_id uuid,
  source_line text,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table public.plant_photos (
  id uuid default gen_random_uuid() not null,
  storage_bucket text default 'plant-photos'::text not null,
  storage_path text not null,
  mime_type text,
  byte_size bigint,
  image_width integer,
  image_height integer,
  sha256 text,
  supplier_id bigint,
  common_name text,
  botanical_name text,
  cultivar_variety_trade_name text,
  name text,
  common_name_key text,
  botanical_name_key text,
  cultivar_keys text[],
  size text,
  size_std text,
  height text,
  width text,
  caliper text,
  tags text[] default '{}'::text[] not null,
  caption text,
  notes text,
  source text,
  captured_at timestamp with time zone,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  name_key text generated always as (normalize_plant_key(name)) stored
);
create table public.supplier_contacts (
  id bigint generated always as identity not null,
  supplier_id bigint not null,
  contact_id bigint not null,
  is_primary boolean default false not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);
create table public.suppliers (
  name text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  address text,
  city text,
  state text,
  zip text,
  notes text,
  id bigint generated by default as identity not null,
  category text,
  is_active boolean default true not null,
  website text,
  latitude double precision,
  longitude double precision,
  communication_notes text,
  availability_source_type text,
  availability_update_days integer,
  hosted_availability_url text,
  head_branch_id bigint not null,
  is_lps_partner boolean default false not null,
  daisy_thread_id text,
  rosie_thread_id text,
  rosie_thread_ref bigint,
  daisy_thread_ref bigint,
  short_name text
);
create table public.thread_messages (
  id bigint generated always as identity not null,
  thread_id bigint not null,
  seq integer not null,
  role text not null,
  text text default ''::text not null,
  files jsonb default '[]'::jsonb not null,
  sender_name text,
  portal boolean default false not null,
  created_at timestamp with time zone default now() not null,
  sender_kind text,
  origin_thread_id text,
  job_request_id bigint
);
create table public.threads (
  id bigint generated always as identity not null,
  agent text not null,
  thread_id text not null,
  web_read_id integer default 0 not null,
  portal_read_id integer default 0 not null,
  pending_since timestamp with time zone,
  last_seq integer,
  last_at timestamp with time zone,
  last_role text,
  last_sender text,
  last_text text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  closed_at timestamp with time zone
);
-- constraints
alter table public.app_users add constraint app_users_pkey PRIMARY KEY (id);
alter table public.availability_requests add constraint availability_requests_pkey PRIMARY KEY (id);
alter table public.candidates add constraint candidates_pkey PRIMARY KEY (id);
alter table public.contacts add constraint contacts_pkey PRIMARY KEY (id);
alter table public.customers add constraint customers_pkey PRIMARY KEY (id);
alter table public.deleted_job_threads add constraint deleted_job_threads_pkey PRIMARY KEY (agent, thread_id);
alter table public.inventory add constraint plants_pkey PRIMARY KEY (id);
alter table public.inventory_sources add constraint inventory_sources_pkey PRIMARY KEY (id);
alter table public.job_request_changelog add constraint job_request_changelog_pkey PRIMARY KEY (id);
alter table public.job_request_items add constraint job_request_items_pkey PRIMARY KEY (id);
alter table public.job_requests add constraint job_requests_pkey PRIMARY KEY (id);
alter table public.order_items add constraint order_items_pkey PRIMARY KEY (id);
alter table public.orders add constraint orders_pkey PRIMARY KEY (id);
alter table public.plant_aliases add constraint plant_aliases_pkey PRIMARY KEY (id);
alter table public.plant_photos add constraint plant_photos_pkey PRIMARY KEY (id);
alter table public.supplier_contacts add constraint supplier_contacts_pkey PRIMARY KEY (id);
alter table public.suppliers add constraint suppliers_pkey PRIMARY KEY (id);
alter table public.thread_messages add constraint thread_messages_pkey PRIMARY KEY (id);
alter table public.threads add constraint threads_pkey PRIMARY KEY (id);
alter table public.availability_requests add constraint availability_requests_public_token_key UNIQUE (public_token);
alter table public.job_request_items add constraint job_request_items_default_candidate_id_key UNIQUE (default_candidate_id);
alter table public.order_items add constraint order_items_candidate_id_key UNIQUE (candidate_id);
alter table public.orders add constraint orders_public_token_key UNIQUE (public_token);
alter table public.supplier_contacts add constraint supplier_contacts_supplier_contact_key UNIQUE (supplier_id, contact_id);
alter table public.thread_messages add constraint thread_messages_thread_id_seq_key UNIQUE (thread_id, seq);
alter table public.threads add constraint threads_agent_thread_id_key UNIQUE (agent, thread_id);
alter table public.app_users add constraint app_users_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'partner'::text])));
alter table public.app_users add constraint app_users_role_scope CHECK ((((role = 'partner'::text) AND (supplier_id IS NOT NULL)) OR ((role = 'admin'::text) AND (supplier_id IS NULL))));
alter table public.availability_requests add constraint availability_requests_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'new'::text, 'processing'::text, 'submitted'::text, 'closed'::text])));
alter table public.candidates add constraint candidates_available_quantity_check CHECK (((available_quantity IS NULL) OR (available_quantity >= (0)::numeric)));
alter table public.candidates add constraint candidates_offer_not_self CHECK ((offered_candidate_id IS DISTINCT FROM id));
alter table public.candidates add constraint candidates_offer_quantity_check CHECK (((offer_quantity IS NULL) OR ((offer_quantity >= (0)::numeric) AND (offer_quantity < 'Infinity'::numeric))));
alter table public.candidates add constraint candidates_offer_unit_price_check CHECK (((offer_unit_price IS NULL) OR ((offer_unit_price >= (0)::numeric) AND (offer_unit_price < 'Infinity'::numeric))));
alter table public.candidates add constraint candidates_status_check CHECK (((status IS NULL) OR (status = ANY (ARRAY['available'::text, 'partial_qty'::text, 'can_order'::text, 'diff_size_sub'::text, 'arriving_soon'::text, 'unavailable'::text]))));
alter table public.candidates add constraint candidates_unit_price_check CHECK (((unit_price IS NULL) OR (unit_price >= (0)::numeric)));
alter table public.customers add constraint customers_type_check CHECK ((type = ANY (ARRAY['Homeowner/Retail'::text, 'Landscape Professional'::text])));
alter table public.inventory add constraint inventory_size_std_check CHECK (((size_std IS NULL) OR (size_std ~ '^[0-9]+(\.[0-9]+)?G$'::text) OR (size_std ~ '^[0-9]+(\.[0-9]+)?" Pot$'::text) OR (size_std ~ '^[0-9]+" Box$'::text) OR (size_std = ANY (ARRAY['Bare Root'::text, 'Liners'::text, 'Plug'::text, 'Trays'::text, 'B&B'::text, 'Field Grown'::text, 'Grow Bags'::text, 'Root Pruned'::text, 'other'::text]))));
alter table public.job_request_changelog add constraint job_request_changelog_action_check CHECK ((action = ANY (ARRAY['insert'::text, 'update'::text])));
alter table public.job_request_items add constraint job_request_items_available_quantity_check CHECK (((available_quantity IS NULL) OR (available_quantity >= (0)::numeric)));
alter table public.job_request_items add constraint job_request_items_demanded_quantity_check CHECK (((demanded_quantity IS NULL) OR (demanded_quantity > (0)::numeric)));
alter table public.job_requests add constraint job_requests_fulfillment_method_check CHECK ((fulfillment_method = ANY (ARRAY['pickup'::text, 'delivery'::text])));
alter table public.job_requests add constraint job_requests_status_check CHECK ((status = ANY (ARRAY['quoted'::text, 'availability'::text, 'committed'::text, 'closed_won'::text, 'closed_lost'::text, 'archived'::text])));
alter table public.order_items add constraint order_items_quantity_check CHECK (((quantity > (0)::numeric) AND (quantity < 'Infinity'::numeric)));
alter table public.order_items add constraint order_items_status_check CHECK ((status = ANY (ARRAY['available'::text, 'partial_qty'::text, 'unavailable'::text, 'diff_size_sub'::text, 'need_to_order'::text, 'arriving_soon'::text, 'pending'::text])));
alter table public.order_items add constraint order_items_unit_price_check CHECK (((unit_price >= (0)::numeric) AND (unit_price < 'Infinity'::numeric)));
alter table public.orders add constraint orders_additional_details_check CHECK (is_order_details(additional_details));
alter table public.orders add constraint orders_status_check CHECK ((status = ANY (ARRAY['new'::text, 'processing'::text, 'order_ready'::text, 'closed_won'::text, 'closed_lost'::text])));
alter table public.plant_photos add constraint plant_photos_storage_path_not_blank CHECK ((btrim(storage_path) <> ''::text));
alter table public.suppliers add constraint suppliers_availability_source_type_check CHECK ((availability_source_type = ANY (ARRAY['Email'::text, 'Hosted'::text])));
alter table public.suppliers add constraint suppliers_availability_update_days_check CHECK ((availability_update_days > 0));
alter table public.suppliers add constraint suppliers_category_check CHECK ((category = ANY (ARRAY['Grower'::text, 'Wholesale Supplier'::text, 'Retail'::text, 'Broker/Platform'::text])));
alter table public.thread_messages add constraint thread_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'agent'::text])));
alter table public.thread_messages add constraint thread_messages_sender_kind_check CHECK (((sender_kind IS NULL) OR (sender_kind = ANY (ARRAY['lps'::text, 'agent'::text, 'supplier'::text, 'customer'::text]))));
alter table public.app_users add constraint app_users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.app_users add constraint app_users_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;
alter table public.availability_requests add constraint availability_requests_job_request_id_fkey FOREIGN KEY (job_request_id) REFERENCES job_requests(id) ON DELETE SET NULL;
alter table public.availability_requests add constraint availability_requests_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;
alter table public.candidates add constraint candidates_availability_request_id_fkey FOREIGN KEY (availability_request_id) REFERENCES availability_requests(id) ON DELETE CASCADE;
alter table public.candidates add constraint candidates_job_request_item_id_fkey FOREIGN KEY (job_request_item_id) REFERENCES job_request_items(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;
alter table public.candidates add constraint candidates_mapped_inventory_id_fkey FOREIGN KEY (mapped_inventory_id) REFERENCES inventory(id) ON DELETE SET NULL;
alter table public.candidates add constraint candidates_offered_candidate_id_fkey FOREIGN KEY (offered_candidate_id) REFERENCES candidates(id) ON DELETE SET NULL;
alter table public.candidates add constraint candidates_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
alter table public.customers add constraint customers_rosie_thread_ref_fkey FOREIGN KEY (rosie_thread_ref) REFERENCES threads(id) ON DELETE SET NULL;
alter table public.inventory add constraint inventory_source_id_fkey FOREIGN KEY (source_id) REFERENCES inventory_sources(id);
alter table public.inventory add constraint rate_charts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;
alter table public.inventory_sources add constraint inventory_sources_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;
alter table public.job_request_changelog add constraint job_request_changelog_item_id_fkey FOREIGN KEY (item_id) REFERENCES job_request_items(id) ON DELETE CASCADE;
alter table public.job_request_changelog add constraint job_request_changelog_job_request_id_fkey FOREIGN KEY (job_request_id) REFERENCES job_requests(id) ON DELETE CASCADE;
alter table public.job_request_items add constraint job_request_items_default_candidate_id_fkey FOREIGN KEY (default_candidate_id) REFERENCES candidates(id) ON DELETE RESTRICT;
alter table public.job_request_items add constraint job_request_items_job_request_id_fkey FOREIGN KEY (job_request_id) REFERENCES job_requests(id) ON DELETE CASCADE;
alter table public.job_request_items add constraint job_request_items_selected_candidate_id_fkey FOREIGN KEY (selected_candidate_id) REFERENCES candidates(id) ON DELETE RESTRICT;
alter table public.job_requests add constraint job_requests_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL;
alter table public.job_requests add constraint job_requests_rosie_thread_ref_fkey FOREIGN KEY (rosie_thread_ref) REFERENCES threads(id) ON DELETE SET NULL;
alter table public.order_items add constraint order_items_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL;
alter table public.order_items add constraint order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
alter table public.orders add constraint orders_job_request_id_fkey FOREIGN KEY (job_request_id) REFERENCES job_requests(id) ON DELETE CASCADE;
alter table public.orders add constraint orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
alter table public.plant_aliases add constraint plant_aliases_source_id_fkey FOREIGN KEY (source_id) REFERENCES inventory_sources(id);
alter table public.plant_photos add constraint plant_photos_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL;
alter table public.supplier_contacts add constraint supplier_contacts_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE;
alter table public.supplier_contacts add constraint supplier_contacts_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE;
alter table public.suppliers add constraint suppliers_daisy_thread_ref_fkey FOREIGN KEY (daisy_thread_ref) REFERENCES threads(id) ON DELETE SET NULL;
alter table public.suppliers add constraint suppliers_head_branch_id_fkey FOREIGN KEY (head_branch_id) REFERENCES suppliers(id);
alter table public.suppliers add constraint suppliers_rosie_thread_ref_fkey FOREIGN KEY (rosie_thread_ref) REFERENCES threads(id) ON DELETE SET NULL;
alter table public.thread_messages add constraint thread_messages_job_request_id_fkey FOREIGN KEY (job_request_id) REFERENCES job_requests(id) ON DELETE SET NULL;
alter table public.thread_messages add constraint thread_messages_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE;

-- indexes
CREATE INDEX app_users_supplier_id_idx ON public.app_users USING btree (supplier_id) WHERE (role = 'partner'::text);
CREATE UNIQUE INDEX app_users_username_key ON public.app_users USING btree (lower(username));
CREATE INDEX availability_requests_job_supplier_idx ON public.availability_requests USING btree (job_request_id, supplier_id);
CREATE INDEX availability_requests_job_idx ON public.availability_requests USING btree (job_request_id) WHERE (job_request_id IS NOT NULL);
CREATE INDEX availability_requests_supplier_idx ON public.availability_requests USING btree (supplier_id, created_at DESC);
CREATE INDEX candidates_offered_candidate_idx ON public.candidates USING btree (offered_candidate_id) WHERE (offered_candidate_id IS NOT NULL);
CREATE INDEX candidates_request_idx ON public.candidates USING btree (availability_request_id, is_active);
CREATE INDEX candidates_job_item_idx ON public.candidates USING btree (job_request_item_id) WHERE (job_request_item_id IS NOT NULL);
CREATE INDEX candidates_mapped_inventory_idx ON public.candidates USING btree (mapped_inventory_id) WHERE (mapped_inventory_id IS NOT NULL);
CREATE INDEX contacts_pgroonga_idx ON public.contacts USING pgroonga (normalize_search_text(((((((COALESCE(name, ''::text) || ' '::text) || COALESCE(email, ''::text)) || ' '::text) || COALESCE(phone, ''::text)) || ' '::text) || COALESCE(title_department, ''::text)))) WITH (tokenizer='TokenDelimit');
CREATE INDEX customers_rosie_thread_ref_idx ON public.customers USING btree (rosie_thread_ref);
CREATE INDEX customers_active_created_idx ON public.customers USING btree (is_active, created_at DESC);
CREATE INDEX customers_email_idx ON public.customers USING btree (email) WHERE (email IS NOT NULL);
CREATE INDEX rate_charts_supplier_active_idx ON public.inventory USING btree (supplier_id, is_active);
CREATE INDEX inventory_source_id_idx ON public.inventory USING btree (source_id);
CREATE INDEX inventory_supplier_height_std_idx ON public.inventory USING btree (supplier_id, height_std) WHERE (is_active AND (height_std IS NOT NULL));
CREATE INDEX inventory_name_key_idx ON public.inventory USING btree (name_key);
CREATE INDEX inventory_supplier_width_std_idx ON public.inventory USING btree (supplier_id, width_std) WHERE (is_active AND (width_std IS NOT NULL));
CREATE INDEX inventory_search_word_idx ON public.inventory USING pgroonga (normalize_search_text(((((COALESCE(name, ''::text) || ' '::text) || COALESCE(size, ''::text)) || ' '::text) || COALESCE(notes, ''::text)))) WITH (tokenizer='TokenDelimit');
CREATE INDEX inventory_identity_trgm_idx ON public.inventory USING gin ((((((((COALESCE(name, ''::text) || E'\n'::text) || COALESCE(common_name, ''::text)) || E'\n'::text) || COALESCE(botanical_name, ''::text)) || E'\n'::text) || COALESCE(cultivar_variety_trade_name, ''::text))) gin_trgm_ops) WHERE is_active;
CREATE INDEX inventory_search_ngram_idx ON public.inventory USING pgroonga (normalize_search_text(((((COALESCE(name, ''::text) || ' '::text) || COALESCE(size, ''::text)) || ' '::text) || COALESCE(notes, ''::text)))) WITH (tokenizer='TokenBigramSplitSymbolAlphaDigit');
CREATE INDEX inventory_common_name_key_idx ON public.inventory USING btree (common_name_key) WHERE (common_name_key IS NOT NULL);
CREATE INDEX inventory_botanical_name_key_idx ON public.inventory USING btree (botanical_name_key) WHERE (botanical_name_key IS NOT NULL);
CREATE INDEX inventory_cultivar_keys_idx ON public.inventory USING gin (cultivar_keys);
CREATE INDEX inventory_supplier_caliper_std_idx ON public.inventory USING btree (supplier_id, caliper_std) WHERE (is_active AND (caliper_std IS NOT NULL));
CREATE INDEX inventory_supplier_size_std_idx ON public.inventory USING btree (supplier_id, size_std) WHERE (is_active AND (size_std IS NOT NULL));
CREATE INDEX inventory_sources_supplier_id_idx ON public.inventory_sources USING btree (supplier_id);
CREATE INDEX job_request_changelog_item_idx ON public.job_request_changelog USING btree (item_id, created_at DESC) WHERE (item_id IS NOT NULL);
CREATE INDEX job_request_changelog_request_idx ON public.job_request_changelog USING btree (job_request_id, created_at DESC);
CREATE INDEX job_request_items_request_idx ON public.job_request_items USING btree (job_request_id, is_active);
CREATE INDEX job_request_items_selected_candidate_idx ON public.job_request_items USING btree (selected_candidate_id);
CREATE INDEX job_requests_status_idx ON public.job_requests USING btree (status) WHERE is_active;
CREATE INDEX job_requests_rosie_thread_ref_idx ON public.job_requests USING btree (rosie_thread_ref);
CREATE INDEX job_requests_customer_idx ON public.job_requests USING btree (customer_id, is_active);
CREATE INDEX order_items_candidate_idx ON public.order_items USING btree (candidate_id);
CREATE INDEX order_items_order_idx ON public.order_items USING btree (order_id);
CREATE INDEX orders_supplier_idx ON public.orders USING btree (supplier_id, is_active, created_at DESC);
CREATE UNIQUE INDEX orders_one_open_per_job_supplier ON public.orders USING btree (job_request_id, supplier_id) WHERE (is_active AND (status = ANY (ARRAY['new'::text, 'processing'::text, 'order_ready'::text])));
CREATE INDEX orders_job_request_idx ON public.orders USING btree (job_request_id);
CREATE INDEX plant_aliases_pgroonga_idx ON public.plant_aliases USING pgroonga (normalize_search_text(((name || ' '::text) || other_name))) WITH (tokenizer='TokenDelimit');
CREATE INDEX plant_aliases_other_key_idx ON public.plant_aliases USING btree (other_name_key);
CREATE UNIQUE INDEX plant_aliases_pair_key_idx ON public.plant_aliases USING btree (name_key, other_name_key);
CREATE INDEX plant_aliases_name_key_idx ON public.plant_aliases USING btree (name_key);
CREATE INDEX plant_photos_search_ngram_idx ON public.plant_photos USING pgroonga (normalize_search_text(plant_photo_document(name, size, caption, tags, notes))) WITH (tokenizer='TokenBigramSplitSymbolAlphaDigit');
CREATE INDEX plant_photos_active_created_idx ON public.plant_photos USING btree (is_active, created_at DESC);
CREATE INDEX plant_photos_search_word_idx ON public.plant_photos USING pgroonga (normalize_search_text(plant_photo_document(name, size, caption, tags, notes))) WITH (tokenizer='TokenDelimit');
CREATE UNIQUE INDEX plant_photos_object_idx ON public.plant_photos USING btree (storage_bucket, storage_path);
CREATE INDEX plant_photos_size_std_idx ON public.plant_photos USING btree (size_std) WHERE (is_active AND (size_std IS NOT NULL));
CREATE INDEX plant_photos_tags_idx ON public.plant_photos USING gin (tags);
CREATE INDEX plant_photos_name_key_idx ON public.plant_photos USING btree (name_key);
CREATE INDEX plant_photos_supplier_idx ON public.plant_photos USING btree (supplier_id, is_active);
CREATE INDEX plant_photos_cultivar_keys_idx ON public.plant_photos USING gin (cultivar_keys);
CREATE UNIQUE INDEX plant_photos_sha256_idx ON public.plant_photos USING btree (sha256) WHERE (sha256 IS NOT NULL);
CREATE UNIQUE INDEX supplier_contacts_one_primary_idx ON public.supplier_contacts USING btree (supplier_id) WHERE (is_primary AND is_active);
CREATE INDEX supplier_contacts_contact_idx ON public.supplier_contacts USING btree (contact_id, is_active);
CREATE INDEX supplier_contacts_supplier_idx ON public.supplier_contacts USING btree (supplier_id, is_active);
CREATE INDEX suppliers_daisy_thread_ref_idx ON public.suppliers USING btree (daisy_thread_ref);
CREATE INDEX suppliers_head_branch_idx ON public.suppliers USING btree (head_branch_id);
CREATE INDEX suppliers_rosie_thread_ref_idx ON public.suppliers USING btree (rosie_thread_ref);
CREATE INDEX suppliers_pgroonga_idx ON public.suppliers USING pgroonga (normalize_search_text(((((((((((((COALESCE(name, ''::text) || ' '::text) || COALESCE(address, ''::text)) || ' '::text) || COALESCE(city, ''::text)) || ' '::text) || COALESCE(state, ''::text)) || ' '::text) || COALESCE(zip, ''::text)) || ' '::text) || COALESCE(category, ''::text)) || ' '::text) || COALESCE(notes, ''::text)))) WITH (tokenizer='TokenDelimit');
CREATE INDEX thread_messages_job_request_idx ON public.thread_messages USING btree (job_request_id, thread_id) WHERE (job_request_id IS NOT NULL);

-- views
create view public.job_lines with (security_invoker=true) as  SELECT ji.id,
    ji.job_request_id,
    ji.name,
    ji.size AS requested_size,
    ji.demanded_quantity,
    ji.note_internal,
    ji.is_active,
    ji.created_at,
    ji.updated_at,
    ji.default_candidate_id,
    ji.selected_candidate_id,
    COALESCE(c.size, ji.size) AS size,
    c.unit_price,
    d.demand,
        CASE
            WHEN (c.available_quantity IS NOT NULL) THEN LEAST(c.available_quantity, d.demand)
            ELSE NULL::numeric
        END AS available_quantity,
    (ji.demanded_quantity * c.unit_price) AS total,
        CASE
            WHEN (c.note_for_customer IS NOT NULL) THEN NULLIF(btrim(c.note_for_customer), ''::text)
            ELSE NULLIF(btrim(c.note_from_supplier), ''::text)
        END AS note_for_customer,
    c.description AS candidate_description,
    c.name AS candidate_name,
    c.supplier_id AS candidate_supplier_id,
    (NOT c.is_original) AS is_substitute,
        CASE
            WHEN c.is_original THEN ji.name
            ELSE COALESCE(c.description, c.name)
        END AS quote_name,
    c.status AS candidate_status
   FROM ((job_request_items ji
     JOIN candidates c ON ((c.id = ji.selected_candidate_id)))
     CROSS JOIN LATERAL ( SELECT ji.demanded_quantity AS demand) d);

-- triggers
CREATE TRIGGER app_users_parent_supplier BEFORE INSERT OR UPDATE OF supplier_id ON public.app_users FOR EACH ROW EXECUTE FUNCTION app_users_parent_supplier();
CREATE TRIGGER app_users_sync_lps_partner AFTER INSERT OR DELETE OR UPDATE OF supplier_id, role ON public.app_users FOR EACH ROW EXECUTE FUNCTION sync_supplier_lps_partner();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.app_users FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
CREATE TRIGGER availability_requests_apply_selected AFTER UPDATE OF status ON public.availability_requests FOR EACH ROW WHEN (((new.status = 'submitted'::text) AND (old.status IS DISTINCT FROM 'submitted'::text))) EXECUTE FUNCTION apply_submitted_candidates();
CREATE TRIGGER availability_requests_no_delete BEFORE DELETE ON public.availability_requests FOR EACH ROW EXECUTE FUNCTION prevent_availability_request_delete();
CREATE TRIGGER availability_requests_no_truncate BEFORE TRUNCATE ON public.availability_requests FOR EACH STATEMENT EXECUTE FUNCTION prevent_availability_request_delete();
CREATE TRIGGER availability_requests_one_per_job_supplier BEFORE INSERT ON public.availability_requests FOR EACH ROW EXECUTE FUNCTION guard_one_ar_per_job_supplier();
CREATE TRIGGER availability_requests_progress AFTER INSERT OR UPDATE OF status ON public.availability_requests FOR EACH ROW EXECUTE FUNCTION advance_linked_job_on_partner_request();
CREATE TRIGGER guard_ar_public_link BEFORE INSERT OR UPDATE ON public.availability_requests FOR EACH ROW EXECUTE FUNCTION guard_ar_public_link();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.availability_requests FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
CREATE TRIGGER candidates_guard BEFORE INSERT OR UPDATE OF availability_request_id, supplier_id, name, size, status, available_quantity, unit_price, note_for_supplier, note_from_supplier, mapped_inventory_id, is_active ON public.candidates FOR EACH ROW EXECUTE FUNCTION guard_candidate_write();
CREATE TRIGGER candidates_protect_default BEFORE DELETE OR UPDATE OF hide_from_lps, is_active, is_original, supplier_id, job_request_item_id ON public.candidates FOR EACH ROW EXECUTE FUNCTION protect_default_candidate();
CREATE TRIGGER candidates_reselect_default AFTER UPDATE OF is_active ON public.candidates FOR EACH ROW WHEN ((old.is_active AND (NOT new.is_active))) EXECUTE FUNCTION reselect_default_on_deactivate();
CREATE TRIGGER candidates_reset_customer_note BEFORE UPDATE OF note_from_supplier ON public.candidates FOR EACH ROW EXECUTE FUNCTION reset_customer_note_on_reply();
CREATE TRIGGER candidates_status_quantity BEFORE INSERT OR UPDATE OF status ON public.candidates FOR EACH ROW EXECUTE FUNCTION candidate_status_quantity();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.candidates FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
CREATE TRIGGER customers_link_threads BEFORE INSERT OR UPDATE OF rosie_thread_id ON public.customers FOR EACH ROW EXECUTE FUNCTION customers_link_threads();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
CREATE TRIGGER trg_inventory_derive_identity BEFORE INSERT OR UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION inventory_derive_identity();
CREATE TRIGGER trg_cascade_source_deactivation AFTER UPDATE OF is_active ON public.inventory_sources FOR EACH ROW WHEN (((old.is_active = true) AND (new.is_active = false))) EXECUTE FUNCTION cascade_source_deactivation();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.job_request_items FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
CREATE TRIGGER job_request_items_create_default BEFORE INSERT ON public.job_request_items FOR EACH ROW EXECUTE FUNCTION create_job_line_default();
CREATE TRIGGER job_request_items_sync_default AFTER UPDATE OF name, size, demanded_quantity ON public.job_request_items FOR EACH ROW WHEN ((((new.name IS DISTINCT FROM old.name) OR (new.size IS DISTINCT FROM old.size)) OR (new.demanded_quantity IS DISTINCT FROM old.demanded_quantity))) EXECUTE FUNCTION sync_job_line_default();
CREATE TRIGGER trg_job_request_items_changelog AFTER INSERT OR UPDATE ON public.job_request_items FOR EACH ROW EXECUTE FUNCTION log_job_request_changes();
CREATE TRIGGER close_ar_on_job_status_change AFTER UPDATE OF status, is_active ON public.job_requests FOR EACH ROW EXECUTE FUNCTION close_ar_on_job_status_change();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.job_requests FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
CREATE TRIGGER job_requests_close_thread AFTER INSERT OR UPDATE OF status, is_active ON public.job_requests FOR EACH ROW EXECUTE FUNCTION job_requests_close_thread();
CREATE TRIGGER job_requests_drop_thread AFTER DELETE ON public.job_requests FOR EACH ROW EXECUTE FUNCTION job_requests_drop_thread();
CREATE TRIGGER job_requests_link_threads BEFORE INSERT ON public.job_requests FOR EACH ROW EXECUTE FUNCTION job_requests_link_threads();
CREATE TRIGGER job_requests_preserve_shared_availability BEFORE DELETE ON public.job_requests FOR EACH ROW EXECUTE FUNCTION close_orphaned_availability_on_job_delete();
CREATE TRIGGER trg_job_requests_changelog AFTER INSERT OR UPDATE ON public.job_requests FOR EACH ROW EXECUTE FUNCTION log_job_request_changes();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
CREATE TRIGGER guard_order_public_link BEFORE INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION guard_order_public_link();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.plant_aliases FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
CREATE TRIGGER trg_dedupe_plant_aliases BEFORE INSERT ON public.plant_aliases FOR EACH ROW EXECUTE FUNCTION dedupe_plant_aliases();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.plant_photos FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
CREATE TRIGGER trg_plant_photos_derive_identity BEFORE INSERT OR UPDATE ON public.plant_photos FOR EACH ROW EXECUTE FUNCTION plant_photos_derive_identity();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.supplier_contacts FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
CREATE TRIGGER set_head_branch BEFORE INSERT OR UPDATE OF head_branch_id ON public.suppliers FOR EACH ROW EXECUTE FUNCTION suppliers_head_branch();
CREATE TRIGGER suppliers_link_threads BEFORE INSERT OR UPDATE OF rosie_thread_id, daisy_thread_id ON public.suppliers FOR EACH ROW EXECUTE FUNCTION suppliers_link_threads();
CREATE TRIGGER trg_cascade_supplier_deactivation AFTER UPDATE OF is_active ON public.suppliers FOR EACH ROW WHEN (((old.is_active = true) AND (new.is_active = false))) EXECUTE FUNCTION cascade_supplier_deactivation();
CREATE TRIGGER thread_messages_preview AFTER INSERT ON public.thread_messages FOR EACH ROW EXECUTE FUNCTION thread_messages_update_preview();
CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.threads FOR EACH ROW EXECUTE FUNCTION moddatetime('updated_at');
CREATE TRIGGER threads_reject_deleted_jobs BEFORE INSERT OR UPDATE OF agent, thread_id ON public.threads FOR EACH ROW EXECUTE FUNCTION reject_deleted_job_thread();

-- row level security
alter table public.contacts enable row level security;
alter table public.inventory_sources enable row level security;
alter table public.app_users enable row level security;
alter table public.availability_requests enable row level security;
alter table public.candidates enable row level security;
alter table public.suppliers enable row level security;
alter table public.customers enable row level security;
alter table public.job_requests enable row level security;
alter table public.job_request_changelog enable row level security;
alter table public.orders enable row level security;
alter table public.job_request_items enable row level security;
alter table public.deleted_job_threads enable row level security;
alter table public.order_items enable row level security;
alter table public.threads enable row level security;
alter table public.thread_messages enable row level security;
alter table public.supplier_contacts enable row level security;
alter table public.plant_photos enable row level security;
alter table public.inventory enable row level security;
alter table public.plant_aliases enable row level security;

create policy "authenticated full access" on public.contacts as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy "Authenticated full access" on public.inventory_sources as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy "authenticated full access" on public.availability_requests as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy "authenticated full access" on public.candidates as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy "Anyone can read lps objects" on storage.objects as PERMISSIVE for SELECT to public using ((bucket_id = 'lps'::text));
create policy "Authenticated users can delete own lps objects" on storage.objects as PERMISSIVE for DELETE to authenticated using ((bucket_id = 'lps'::text));
create policy "Authenticated users can update own lps objects" on storage.objects as PERMISSIVE for UPDATE to authenticated using ((bucket_id = 'lps'::text));
create policy "Authenticated users can upload to lps" on storage.objects as PERMISSIVE for INSERT to authenticated with check ((bucket_id = 'lps'::text));
create policy "Users can delete their own chat attachments" on storage.objects as PERMISSIVE for DELETE to authenticated using (((bucket_id = 'chat-attachments'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "Users can upload chat attachments" on storage.objects as PERMISSIVE for INSERT to authenticated with check (((bucket_id = 'chat-attachments'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
create policy "Users can view chat attachments" on storage.objects as PERMISSIVE for SELECT to authenticated using ((bucket_id = 'chat-attachments'::text));
create policy "Users can delete rate cards" on public.suppliers as PERMISSIVE for DELETE to authenticated using (true);
create policy "Users can insert rate cards" on public.suppliers as PERMISSIVE for INSERT to authenticated with check (true);
create policy "Users can update rate cards" on public.suppliers as PERMISSIVE for UPDATE to authenticated using (true);
create policy "Users can view all rate cards" on public.suppliers as PERMISSIVE for SELECT to authenticated using (true);
create policy "authenticated full access" on public.customers as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy "authenticated full access" on public.job_requests as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy "authenticated full access" on public.job_request_changelog as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy "authenticated full access" on public.orders as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy "authenticated full access" on public.job_request_items as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy "authenticated full access" on public.order_items as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy "authenticated full access" on public.supplier_contacts as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy "authenticated full access" on public.plant_photos as PERMISSIVE for ALL to authenticated using (true) with check (true);
create policy "Users can delete plants" on public.inventory as PERMISSIVE for DELETE to authenticated using (true);
create policy "Users can insert plants" on public.inventory as PERMISSIVE for INSERT to authenticated with check (true);
create policy "Users can update plants" on public.inventory as PERMISSIVE for UPDATE to authenticated using (true);
create policy "Users can view all plants" on public.inventory as PERMISSIVE for SELECT to authenticated using (true);
create policy "Authenticated full access" on public.plant_aliases as PERMISSIVE for ALL to authenticated using (true) with check (true);

-- storage buckets and realtime
insert into storage.buckets (id, name, public) values ('chat-attachments', 'chat-attachments', true), ('lps', 'lps', true) on conflict do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('plant-photos', 'plant-photos', false, 8388608, array['image/webp']) on conflict do nothing;
alter publication supabase_realtime add table public.suppliers, public.customers, public.job_requests, public.job_request_items, public.availability_requests, public.candidates, public.threads, public.thread_messages, public.orders, public.order_items;
