-- Keep established stored values and audit history: sourcing displays Active,
-- quoted displays Quote, alternative_proposed displays Different Sz/Qnty/Sub.
-- Archived remains a readable legacy terminal value, absent from new choices.
BEGIN;

ALTER TABLE public.job_requests DROP CONSTRAINT job_requests_status_check;
ALTER TABLE public.job_requests ADD CONSTRAINT job_requests_status_check CHECK (
  status IN ('sourcing', 'quoted', 'availability', 'confirmed', 'closed_won', 'closed_lost', 'archived')
);

ALTER TABLE public.job_request_items DROP CONSTRAINT job_request_items_status_check;
ALTER TABLE public.job_request_items ADD CONSTRAINT job_request_items_status_check CHECK (
  status IN ('available', 'unavailable', 'alternative_proposed', 'need_to_order', 'arriving_soon', 'pending')
);

COMMENT ON COLUMN public.job_requests.status IS
  'Sales stage: sourcing (Active), quoted (Quote), availability, confirmed, closed_won, closed_lost. Archived is legacy history only. Default remains sourcing.';
COMMENT ON COLUMN public.job_request_items.status IS
  'Plant status: available, unavailable, alternative_proposed (Different Sz/Qnty/Sub), need_to_order, arriving_soon, pending. Default pending. Status changes do not place orders.';
COMMENT ON COLUMN public.availability_request_items.status IS
  'Supplier plant status: available, unavailable, diff_size_qty_sub (Different Sz/Qnty/Sub), can_order (Need to Order), arriving_soon, NULL (Pending, not answered). Pending preserves quantity, price and notes and does not count as an answer. Status changes do not place orders.';

-- Sales work can move through Quote, Availability and Confirmed while the
-- supplier continues answering. Only terminal/deactivated jobs revoke links.
CREATE OR REPLACE FUNCTION public.close_ar_on_job_status_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('closed_won', 'closed_lost', 'archived') OR NOT NEW.is_active THEN
    UPDATE public.availability_requests SET status = 'closed', public_token = NULL
    WHERE job_request_id = NEW.id AND is_active AND status <> 'closed';
  END IF;
  RETURN NEW;
END;
$$;

COMMIT;
