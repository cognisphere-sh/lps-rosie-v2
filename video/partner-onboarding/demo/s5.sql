-- Checkpoint S5 (chapter 6): S2 plus a new request, Zilker Courtyard, to answer from the chat.
do $$
declare j bigint; a bigint;
begin
  insert into public.job_requests (customer_id, name, expected_install_date, fulfillment_method, shipping_address, shipping_city, shipping_state, shipping_zip)
    select id, 'Zilker Courtyard', current_date + 15, 'delivery', '2100 Barton Springs Rd', 'Austin', 'TX', '78704'
    from public.customers where name = 'Luis Ortega' returning id into j;
  insert into public.availability_requests (supplier_id, job_request_id, status, share_customer_details) values (2, j, 'new', false) returning id into a;
  perform demo.ask(a, demo.line(j, 'Cedar Elm', '15 G', 8), 'Cedar Elm', '15 G', 110.00, null);
  perform demo.ask(a, demo.line(j, 'Texas Sage ''Compacta''', '5 G', 30), 'Texas Sage ''Compacta''', '5 G', 24.00, null);
  perform demo.ask(a, demo.line(j, 'Mexican Feathergrass', '1 G', 50), 'Mexican Feathergrass', '1 G', 7.50, null);
  perform demo.ask(a, demo.line(j, 'Live Oak', '30 G', 2), 'Live Oak', '30 G', 245.00, 'Matched pair');
  perform demo.ask(a, demo.line(j, 'Gulf Muhly', '3 G', 20), 'Gulf Muhly', '3 G', 14.00, null);
  update public.availability_requests set created_at = now() - interval '2 hours' where id = a;
end $$;
