-- Fictional demo data for the partner onboarding video (local demo stack only).
-- Story: Hill Country Growers (supplier 2, login "jordan") and seven LPS jobs that
-- cover every request and order state. Dates are relative to now().
-- Needs the auth user jordan@demo.invalid to exist (record.mjs creates it).
create schema if not exists demo;

create or replace function demo.line(p_job bigint, p_name text, p_size text, p_qty numeric)
returns bigint language sql as $$
  insert into public.job_request_items (job_request_id, name, size, demanded_quantity)
  values (p_job, p_name, p_size, p_qty) returning id $$;

-- The supplier's asked candidate on an AR line (what the portal shows as a line).
create or replace function demo.ask(p_ar bigint, p_item bigint, p_name text, p_size text, p_price numeric, p_note text)
returns bigint language sql as $$
  insert into public.candidates (supplier_id, job_request_item_id, availability_request_id, name, size, description,
                                 is_original, unit_price, note_for_supplier, mapped_inventory_id)
  values (2, p_item, p_ar, p_name, p_size, p_size || ' ' || p_name, true, p_price, p_note,
          (select id from public.inventory where supplier_id = 2 and name = p_name and size = p_size))
  returning id $$;

-- An un-asked alternative the Diff Sz / Sub dialog offers.
create or replace function demo.alt(p_item bigint, p_name text, p_size text, p_price numeric)
returns bigint language sql as $$
  insert into public.candidates (supplier_id, job_request_item_id, name, size, description, is_original, unit_price, hide_from_lps)
  values (2, p_item, p_name, p_size, p_size || ' ' || p_name, false, p_price, true) returning id $$;

create or replace function demo.answer(p_ar bigint, p_cand bigint, p_changes jsonb)
returns void language sql as $$ select public.answer_availability_request(p_ar, 2, p_cand, p_changes) $$;

do $seed$
declare
  d date := current_date;
  c_maria bigint; c_sam bigint; c_priya bigint; c_luis bigint;
  j1 bigint; j2 bigint; j3 bigint; j4 bigint; j5 bigint; j6 bigint; j7 bigint;
  a1 bigint; a2 bigint; a3 bigint; a4 bigint; a5 bigint; a6 bigint; a7 bigint;
  o3 bigint; o4 bigint; o5 bigint; o6 bigint; o7 bigint;
  l bigint; c bigint; alt bigint; t bigint;
  lines bigint[];
begin
  -- Suppliers. id 1 is LPS's own yard: every job line's default candidate uses it.
  insert into public.suppliers (id, name, category, city, state, is_active)
    values (1, 'Austin Plant Supply', 'Wholesale Supplier', 'Austin', 'TX', true);
  insert into public.suppliers (id, name, short_name, category, address, city, state, zip, website, is_active, rosie_thread_id)
    values (2, 'Hill Country Growers', 'HCG', 'Grower', '1200 Ranch Rd 12', 'Dripping Springs', 'TX', '78620',
            'https://hillcountrygrowers.example.com', true, 'supplier-hill-country-growers');
  insert into public.suppliers (id, name, category, city, state, is_active)
    values (3, 'Blanco River Nursery', 'Grower', 'Wimberley', 'TX', true);
  perform setval(pg_get_serial_sequence('public.suppliers', 'id'), 3);

  -- The partner login (before any AR, so jobs advance and the portal opens).
  insert into public.app_users (id, username, role, supplier_id, must_change_password)
    select id, 'jordan', 'partner', 2, true from auth.users where email = 'jordan@demo.invalid';

  insert into public.inventory (name, size, size_std, unit_price, quantity, supplier_id) values
    ('Live Oak', '30 G', '30G', 245.00, 40, 2),
    ('Cedar Elm', '15 G', '15G', 110.00, 25, 2),
    ('Texas Redbud ''Oklahoma''', '15 G', '15G', 135.00, 12, 2),
    ('Dwarf Yaupon Holly', '5 G', '5G', 28.00, 120, 2),
    ('Mexican Feathergrass', '1 G', '1G', 7.50, 400, 2),
    ('Gulf Muhly', '3 G', '3G', 14.00, 220, 2),
    ('Red Yucca', '5 G', '5G', 26.00, 90, 2),
    ('Texas Sage ''Compacta''', '5 G', '5G', 24.00, 60, 2);

  insert into public.customers (name, company, email, phone, city, state, type) values
    ('Maria Delgado', 'Greenway Landscape Co.', 'maria@greenway.example.com', '512-555-0142', 'Austin', 'TX', 'Landscape Professional') returning id into c_maria;
  insert into public.customers (name, company, email, phone, city, state, type) values
    ('Sam Whitaker', 'Riverbend HOA', 'board@riverbend.example.com', '512-555-0177', 'Round Rock', 'TX', 'Landscape Professional') returning id into c_sam;
  insert into public.customers (name, company, email, phone, city, state, type) values
    ('Priya Natarajan', null, 'priya.n@example.com', '512-555-0119', 'Austin', 'TX', 'Homeowner/Retail') returning id into c_priya;
  insert into public.customers (name, company, email, phone, city, state, type) values
    ('Luis Ortega', 'Pecan Street Design Studio', 'luis@pecanstreet.example.com', '512-555-0163', 'Austin', 'TX', 'Landscape Professional') returning id into c_luis;

  insert into public.job_requests (customer_id, name, expected_install_date, fulfillment_method, shipping_address, shipping_city, shipping_state, shipping_zip)
    values (c_maria, 'Barton Hills Residence – Front Yard', d + 12, 'delivery', '2201 Barton Hills Dr', 'Austin', 'TX', '78704') returning id into j1;
  insert into public.job_requests (customer_id, name, expected_install_date, fulfillment_method, shipping_address, shipping_city, shipping_state, shipping_zip)
    values (c_luis, 'Mueller Pocket Park', d + 18, 'delivery', '1900 Aldrich St', 'Austin', 'TX', '78723') returning id into j2;
  insert into public.job_requests (customer_id, name, expected_install_date, fulfillment_method, shipping_address, shipping_city, shipping_state, shipping_zip)
    values (c_sam, 'Riverbend HOA Entry Refresh', d + 10, 'delivery', '100 Riverbend Blvd', 'Round Rock', 'TX', '78664') returning id into j3;
  insert into public.job_requests (customer_id, name, expected_install_date, fulfillment_method, shipping_address, shipping_city, shipping_state, shipping_zip)
    values (c_maria, 'Cedar Park Medical Plaza', d + 6, 'delivery', '1401 Medical Pkwy', 'Cedar Park', 'TX', '78613') returning id into j4;
  insert into public.job_requests (customer_id, name, expected_install_date, fulfillment_method)
    values (c_priya, 'Natarajan Backyard', d + 4, 'pickup') returning id into j5;
  insert into public.job_requests (customer_id, name, expected_install_date, fulfillment_method)
    values (c_luis, 'Dripping Springs Ranch Entry', d - 10, 'delivery') returning id into j6;
  insert into public.job_requests (customer_id, name, expected_install_date, fulfillment_method)
    values (c_priya, 'Hyde Park Bungalow', d - 20, 'pickup') returning id into j7;

  insert into public.availability_requests (supplier_id, job_request_id, status, share_customer_details) values (2, j1, 'new', true) returning id into a1;
  insert into public.availability_requests (supplier_id, job_request_id, status, share_customer_details) values (2, j2, 'new', false) returning id into a2;
  insert into public.availability_requests (supplier_id, job_request_id, status, share_customer_details) values (2, j3, 'new', true) returning id into a3;
  insert into public.availability_requests (supplier_id, job_request_id, status, share_customer_details) values (2, j4, 'new', true) returning id into a4;
  insert into public.availability_requests (supplier_id, job_request_id, status, share_customer_details) values (2, j5, 'new', false) returning id into a5;
  insert into public.availability_requests (supplier_id, job_request_id, status, share_customer_details) values (2, j6, 'new', false) returning id into a6;
  insert into public.availability_requests (supplier_id, job_request_id, status, share_customer_details) values (2, j7, 'new', false) returning id into a7;

  -- J1 Barton Hills: New and untouched; filmed in chapters 3 and 4.
  perform demo.ask(a1, demo.line(j1, 'Live Oak', '30 G', 2), 'Live Oak', '30 G', 245.00, 'Single trunk, 2.5 in+ caliper');
  perform demo.ask(a1, demo.line(j1, 'Cedar Elm', '15 G', 5), 'Cedar Elm', '15 G', 110.00, 'Matching canopies please');
  l := demo.line(j1, 'Texas Redbud ''Oklahoma''', '15 G', 3);
  perform demo.ask(a1, l, 'Texas Redbud ''Oklahoma''', '15 G', 135.00, 'Multi-trunk preferred');
  perform demo.alt(l, 'Texas Redbud ''Oklahoma''', '30 G', 210.00);
  perform demo.ask(a1, demo.line(j1, 'Dwarf Yaupon Holly', '5 G', 24), 'Dwarf Yaupon Holly', '5 G', 28.00, 'Full and round, no gaps');
  perform demo.ask(a1, demo.line(j1, 'Gulf Muhly', '3 G', 40), 'Gulf Muhly', '3 G', null, null);
  perform demo.ask(a1, demo.line(j1, 'Red Yucca', '5 G', 12), 'Red Yucca', '5 G', 26.00, 'Blooming size');
  perform demo.ask(a1, demo.line(j1, 'Mexican Feathergrass', '1 G', 60), 'Mexican Feathergrass', '1 G', 7.50, null);

  -- J2 Mueller Pocket Park: Processing, one of each answer.
  c := demo.ask(a2, demo.line(j2, 'Live Oak', '30 G', 4), 'Live Oak', '30 G', 245.00, null);
  perform demo.answer(a2, c, '{"status":"available","unit_price":"245.00","note_from_supplier":"Tagged in row 4"}');
  c := demo.ask(a2, demo.line(j2, 'Cedar Elm', '15 G', 6), 'Cedar Elm', '15 G', 110.00, null);
  perform demo.answer(a2, c, '{"status":"partial_qty","available_quantity":"4","note_from_supplier":"4 now, 2 more in spring"}');
  l := demo.line(j2, 'Texas Redbud ''Oklahoma''', '15 G', 3);
  c := demo.ask(a2, l, 'Texas Redbud ''Oklahoma''', '15 G', 135.00, null);
  alt := demo.alt(l, 'Texas Redbud ''Oklahoma''', '30 G', 210.00);
  perform demo.answer(a2, c, jsonb_build_object('status', 'diff_size_sub', 'offered_candidate_id', alt::text));
  perform demo.answer(a2, c, '{"note_from_supplier":"Only 30 G left this season"}');
  c := demo.ask(a2, demo.line(j2, 'Dwarf Yaupon Holly', '5 G', 24), 'Dwarf Yaupon Holly', '5 G', 28.00, null);
  perform demo.answer(a2, c, '{"status":"can_order","note_from_supplier":"Can pull from our Tyler farm, ~10 days"}');
  c := demo.ask(a2, demo.line(j2, 'Gulf Muhly', '3 G', 40), 'Gulf Muhly', '3 G', 14.00, null);
  perform demo.answer(a2, c, '{"status":"arriving_soon","note_from_supplier":"Truck lands next Tuesday"}');
  c := demo.ask(a2, demo.line(j2, 'Red Yucca', '5 G', 18), 'Red Yucca', '5 G', 26.00, null);
  perform demo.answer(a2, c, '{"status":"unavailable"}');
  perform demo.ask(a2, demo.line(j2, 'Mexican Feathergrass', '1 G', 60), 'Mexican Feathergrass', '1 G', 7.50, null);

  -- J3 Riverbend: Completed, order New.
  lines := '{}';
  l := demo.line(j3, 'Live Oak', '30 G', 3); c := demo.ask(a3, l, 'Live Oak', '30 G', 245.00, null);
  perform demo.answer(a3, c, '{"status":"available"}'); perform public.select_candidate(l, c); lines := lines || l;
  l := demo.line(j3, 'Gulf Muhly', '3 G', 40); c := demo.ask(a3, l, 'Gulf Muhly', '3 G', 14.00, null);
  perform demo.answer(a3, c, '{"status":"arriving_soon","note_from_supplier":"Truck lands Tuesday"}'); perform public.select_candidate(l, c); lines := lines || l;
  l := demo.line(j3, 'Dwarf Yaupon Holly', '5 G', 30); c := demo.ask(a3, l, 'Dwarf Yaupon Holly', '5 G', 28.00, null);
  perform demo.answer(a3, c, '{"status":"can_order","note_from_supplier":"From our Tyler farm"}'); perform public.select_candidate(l, c); lines := lines || l;
  l := demo.line(j3, 'Texas Sage ''Compacta''', '5 G', 12); c := demo.ask(a3, l, 'Texas Sage ''Compacta''', '5 G', 24.00, null);
  perform demo.answer(a3, c, '{"status":"available"}'); perform public.select_candidate(l, c); lines := lines || l;
  perform public.submit_availability_request_note(a3, 2, 'All tagged and ready. Can deliver Monday morning.');
  o3 := public.create_order(j3, 2, lines, '[
    {"field":"Customer","value":"Riverbend HOA (Sam Whitaker)"},
    {"field":"Delivery address","value":"100 Riverbend Blvd, Round Rock, TX 78664"},
    {"field":"Delivery contact","value":"Sam Whitaker, 512-555-0177"},
    {"field":"Site notes","value":"Unload at the north entrance island. Call 30 minutes before arrival."},
    {"field":"Payment","value":"Net 30 on LPS account"}]');

  -- J4 Cedar Park: Completed, order Processing with a change log.
  lines := '{}';
  l := demo.line(j4, 'Live Oak', '30 G', 4); c := demo.ask(a4, l, 'Live Oak', '30 G', 245.00, null);
  perform demo.answer(a4, c, '{"status":"available"}'); perform public.select_candidate(l, c); lines := lines || l;
  l := demo.line(j4, 'Cedar Elm', '15 G', 10); c := demo.ask(a4, l, 'Cedar Elm', '15 G', 110.00, null);
  perform demo.answer(a4, c, '{"status":"can_order"}'); perform public.select_candidate(l, c); lines := lines || l;
  l := demo.line(j4, 'Mexican Feathergrass', '1 G', 50); c := demo.ask(a4, l, 'Mexican Feathergrass', '1 G', 7.50, null);
  perform demo.answer(a4, c, '{"status":"arriving_soon"}'); perform public.select_candidate(l, c); lines := lines || l;
  perform public.submit_availability_request_note(a4, 2, 'Live oaks tagged. Elms coming from Tyler.');
  o4 := public.create_order(j4, 2, lines, '[
    {"field":"Customer","value":"Greenway Landscape Co. (Maria Delgado)"},
    {"field":"Delivery address","value":"1401 Medical Pkwy, Cedar Park, TX 78613"},
    {"field":"Delivery contact","value":"Maria Delgado, 512-555-0142"}]');
  perform public.update_partner_order(o4, 2, '{"status":"processing"}');
  perform public.update_partner_order_item(o4, 2, (select id from public.order_items where order_id = o4 and name = 'Live Oak'), 'available', 'Tagged');
  perform public.update_partner_order_item(o4, 2, (select id from public.order_items where order_id = o4 and name = 'Cedar Elm'), 'need_to_order', 'Coming from our Tyler farm');
  update public.orders set confirmation_date = d - 3,
    change_log = format(E'- %s: Live Oak qty 5 → 4\n- %s: Delivery moved to %s 7am', to_char(d - 4, 'MM/DD'), to_char(d - 2, 'MM/DD'), to_char(d + 6, 'Dy MM/DD'))
    where id = o4;

  -- J5 Natarajan: pickup order, Order Ready.
  lines := '{}';
  l := demo.line(j5, 'Texas Redbud ''Oklahoma''', '15 G', 2); c := demo.ask(a5, l, 'Texas Redbud ''Oklahoma''', '15 G', 135.00, null);
  perform demo.answer(a5, c, '{"status":"available"}'); perform public.select_candidate(l, c); lines := lines || l;
  l := demo.line(j5, 'Texas Sage ''Compacta''', '5 G', 8); c := demo.ask(a5, l, 'Texas Sage ''Compacta''', '5 G', 24.00, null);
  perform demo.answer(a5, c, '{"status":"available"}'); perform public.select_candidate(l, c); lines := lines || l;
  l := demo.line(j5, 'Red Yucca', '5 G', 10); c := demo.ask(a5, l, 'Red Yucca', '5 G', 26.00, null);
  perform demo.answer(a5, c, '{"status":"available"}'); perform public.select_candidate(l, c); lines := lines || l;
  perform public.submit_availability_request_note(a5, 2, null);
  o5 := public.create_order(j5, 2, lines, '[{"field":"Customer","value":"Priya Natarajan"},{"field":"Pickup","value":"Customer collects from the Dripping Springs yard"}]');
  perform public.update_partner_order(o5, 2, '{"status":"processing"}');
  perform public.update_partner_order(o5, 2, '{"status":"order_ready"}');
  update public.orders set confirmation_date = d - 2 where id = o5;

  -- J6 and J7: history (answered and submitted before their jobs close).
  lines := '{}';
  l := demo.line(j6, 'Live Oak', '30 G', 6); c := demo.ask(a6, l, 'Live Oak', '30 G', 245.00, null);
  perform demo.answer(a6, c, '{"status":"available"}'); perform public.select_candidate(l, c); lines := lines || l;
  l := demo.line(j6, 'Cedar Elm', '15 G', 8); c := demo.ask(a6, l, 'Cedar Elm', '15 G', 110.00, null);
  perform demo.answer(a6, c, '{"status":"available"}'); perform public.select_candidate(l, c); lines := lines || l;
  perform public.submit_availability_request_note(a6, 2, null);
  o6 := public.create_order(j6, 2, lines);
  perform public.close_order(o6, 'closed_won');
  lines := '{}';
  l := demo.line(j7, 'Gulf Muhly', '3 G', 25); c := demo.ask(a7, l, 'Gulf Muhly', '3 G', 14.00, null);
  perform demo.answer(a7, c, '{"status":"available"}'); perform public.select_candidate(l, c); lines := lines || l;
  l := demo.line(j7, 'Red Yucca', '5 G', 6); c := demo.ask(a7, l, 'Red Yucca', '5 G', 26.00, null);
  perform demo.answer(a7, c, '{"status":"available"}'); perform public.select_candidate(l, c); lines := lines || l;
  perform public.submit_availability_request_note(a7, 2, null);
  o7 := public.create_order(j7, 2, lines);
  perform public.close_order(o7, 'closed_lost');

  -- Backdate so lists read naturally.
  update public.availability_requests set created_at = now() - interval '1 day' where id = a1;
  update public.availability_requests set created_at = now() - interval '3 days' where id = a2;
  update public.availability_requests set created_at = now() - interval '6 days', submitted_at = now() - interval '5 days' where id = a3;
  update public.availability_requests set created_at = now() - interval '9 days', submitted_at = now() - interval '8 days' where id = a4;
  update public.availability_requests set created_at = now() - interval '7 days', submitted_at = now() - interval '6 days' where id = a5;
  update public.availability_requests set created_at = now() - interval '25 days' where id = a6;
  update public.availability_requests set created_at = now() - interval '35 days' where id = a7;
  update public.orders set created_at = now() - interval '1 day' where id = o3;
  update public.orders set created_at = now() - interval '4 days' where id = o4;
  update public.orders set created_at = now() - interval '3 days' where id = o5;

  -- Chat: the supplier's thread (created by the suppliers trigger).
  select rosie_thread_ref into t from public.suppliers where id = 2;
  insert into public.thread_messages (thread_id, seq, role, text, files, sender_name, portal, sender_kind, origin_thread_id, job_request_id, created_at) values
    (t, 1, 'agent', 'Welcome to the Local Plant Supply partner portal, Jordan! New availability requests will appear here.', '[]', null, true, 'agent', 'main', null, now() - interval '6 days'),
    (t, 2, 'user', 'We''ve just sent the Mueller Pocket Park request. Shout if any sizes are tight.', '[]', 'Chris', true, 'lps', 'jr-' || j2, j2, now() - interval '3 days'),
    (t, 3, 'user', 'Here''s the 30 G redbud we can swap in.', '[{"name":"portal-1761000000000-0123456789abcdef01234567.jpg","label":"redbud-30g.jpg","mime":"image/jpeg","size":200000,"dir":"inbox"}]', 'Hill Country Growers (portal)', true, 'supplier', 'jr-' || j2, j2, now() - interval '2 days'),
    (t, 4, 'agent', 'Thanks! The 30 G works. We''ll update the customer.', '[]', null, true, 'agent', 'jr-' || j2, j2, now() - interval '2 days' + interval '20 minutes'),
    (t, 5, 'agent', 'Cedar Park Medical Plaza: delivery is now Thursday at 7am. We''ve added it to the change log.', '[]', null, true, 'agent', 'jr-' || j4, j4, now() - interval '1 hour');
  update public.threads set portal_read_id = 4 where id = t;
end
$seed$;
