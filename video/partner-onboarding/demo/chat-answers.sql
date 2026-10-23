-- Chapter 6: the answers LPS enters from the supplier's chat (photo, text, voice note).
do $$
declare
  zilker bigint := (select a.id from public.availability_requests a join public.job_requests j on j.id = a.job_request_id where j.name = 'Zilker Courtyard');
  barton bigint := (select a.id from public.availability_requests a join public.job_requests j on j.id = a.job_request_id where j.name like 'Barton Hills%');
  mueller bigint := (select a.id from public.availability_requests a join public.job_requests j on j.id = a.job_request_id where j.name = 'Mueller Pocket Park');
  c record;
begin
  -- Photo of the printed Zilker sheet.
  perform demo.answer(zilker, (select id from public.candidates where availability_request_id = zilker and name = 'Cedar Elm'), '{"status":"available"}');
  perform demo.answer(zilker, (select id from public.candidates where availability_request_id = zilker and name = 'Texas Sage ''Compacta'''), '{"status":"available"}');
  perform demo.answer(zilker, (select id from public.candidates where availability_request_id = zilker and name = 'Mexican Feathergrass'),
    '{"status":"partial_qty","available_quantity":"35","note_from_supplier":"Rest in 2 weeks"}');
  perform demo.answer(zilker, (select id from public.candidates where availability_request_id = zilker and name = 'Live Oak'),
    '{"status":"unavailable","note_from_supplier":"None until December"}');
  perform demo.answer(zilker, (select id from public.candidates where availability_request_id = zilker and name = 'Gulf Muhly'), '{"status":"available"}');
  -- Text: Barton Hills, everything available except the Red Yucca.
  for c in select id, name from public.candidates where availability_request_id = barton and is_active loop
    perform demo.answer(barton, c.id, case when c.name = 'Red Yucca'
      then '{"status":"unavailable","note_from_supplier":"Out until spring"}'::jsonb else '{"status":"available"}'::jsonb end);
  end loop;
  -- Voice note: Mueller Pocket Park, feathergrass all available.
  perform demo.answer(mueller, (select id from public.candidates where availability_request_id = mueller and name = 'Mexican Feathergrass'), '{"status":"available"}');
end $$;
