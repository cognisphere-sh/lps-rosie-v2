-- Disposable PostgreSQL only.
\ir 0119_job_line_candidates.fixture.sql
\ir ../0119_job_line_candidates.sql
-- One unasked candidate pair on a line: the first is the original request.
INSERT INTO public.job_requests(id, status) OVERRIDING SYSTEM VALUE VALUES (9500, 'quoted');
INSERT INTO public.job_request_items(id, job_request_id, name, size, demanded_quantity) OVERRIDING SYSTEM VALUE
  VALUES (9500, 9500, 'Oak', '3 G', 4);
INSERT INTO public.candidates(id, supplier_id, job_request_item_id, name, size, unit_price) OVERRIDING SYSTEM VALUE
  VALUES (9500, 1, 9500, 'Oak', '3 G', 0), (9501, 1, 9500, 'Oak', '5 G', 23);
