-- 0138 — drop job_lines.status (2026-10-15), contract
--
-- (Bhoumik 2026-10-15) Follows 0137. Apply only after the app and Rosie's
-- scripts read job_lines.candidate_status. A view column cannot be dropped in
-- place: job_lines is recreated without status (and without the substitute
-- join only status used), then its grants and comments are restored.
-- create_direct_order reads candidate_status since 0137. demand is the line's own
-- (no job-line candidate carries one since 0136), so this view does not read
-- candidates.demanded_quantity, which 0139 drops.
BEGIN;
SET LOCAL lock_timeout = '250ms';
SET LOCAL statement_timeout = '5s';

DROP VIEW public.job_lines;
CREATE VIEW public.job_lines WITH (security_invoker = true) AS
SELECT ji.id, ji.job_request_id, ji.name, ji.size AS requested_size, ji.demanded_quantity,
  ji.note_internal, ji.is_active, ji.created_at, ji.updated_at,
  ji.default_candidate_id, ji.selected_candidate_id,
  coalesce(c.size, ji.size) AS size,
  nullif(c.unit_price, 0) AS unit_price,
  d.demand,
  CASE WHEN c.available_quantity IS NOT NULL THEN least(c.available_quantity, d.demand) END AS available_quantity,
  ji.demanded_quantity * nullif(c.unit_price, 0) AS total,
  CASE WHEN c.note_for_customer IS NOT NULL THEN nullif(btrim(c.note_for_customer), '')
    ELSE nullif(btrim(c.note_from_supplier), '') END AS note_for_customer,
  c.description AS candidate_description, c.name AS candidate_name, c.supplier_id AS candidate_supplier_id,
  NOT c.is_original AS is_substitute,
  CASE WHEN c.is_original THEN ji.name ELSE coalesce(c.description, c.name) END AS quote_name,
  c.status AS candidate_status
FROM public.job_request_items ji
JOIN public.candidates c ON c.id = ji.selected_candidate_id
CROSS JOIN LATERAL (SELECT ji.demanded_quantity AS demand) d;
REVOKE ALL ON public.job_lines FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.job_lines TO authenticated, service_role;

COMMENT ON VIEW public.job_lines IS
  'Job lines as quoted: the line''s ask plus its selected candidate''s values. Read-only; edit through update_job_line (values, and the shown size/name) and job_request_items (the ask).';
COMMENT ON COLUMN public.job_lines.requested_size IS 'The customer''s size (job_request_items.size).';
COMMENT ON COLUMN public.job_lines.size IS 'The selected candidate''s size, else the requested one.';
COMMENT ON COLUMN public.job_lines.unit_price IS 'Selected candidate price; NULL = not priced (0 = not found).';
COMMENT ON COLUMN public.job_lines.demand IS 'The line''s demanded_quantity (candidates on a job line carry none, 0136).';
COMMENT ON COLUMN public.job_lines.available_quantity IS 'Selected candidate quantity capped at demand; NULL = not answered.';
COMMENT ON COLUMN public.job_lines.note_for_customer IS 'Effective customer note: the candidate''s override, else the supplier''s reply.';
COMMENT ON COLUMN public.job_lines.quote_name IS 'Name a quote prints: the line''s for an original, the substitute''s description otherwise.';
COMMENT ON COLUMN public.job_lines.candidate_status IS
  'The selected candidate''s status as stored (NULL = unanswered); the line''s status. Readers show NULL as pending and can_order as need_to_order.';
COMMIT;
