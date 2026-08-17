-- 0054_plant_photo_reclaimable.sql
-- Applied 2026-08-16 via the Supabase MCP at Bhoumik's request, one step
-- recorded in the Supabase history as `plant_photo_reclaimable`.
--
-- The last open piece of lever D in the photo cost plan: bucket objects that
-- nothing can ever show again. Two kinds accumulate, and they arrive
-- differently:
--
--   * **retired** — the photo was soft-deleted (from the `/photos` grid, or by
--     an agent). The row survives as a tombstone; its object is never reclaimed.
--   * **orphan** — no row at all. An upload whose insert then failed, which the
--     skill's own step order makes rare but not impossible.
--
-- An object belonging to an **active** row can never appear here. That is the
-- one property this function exists to guarantee, and it is why the sweep asks
-- the database rather than diffing two lists in a script.
--
-- WHY A FUNCTION AND NOT A QUERY IN THE SCRIPT
-- `storage.objects` is not exposed to PostgREST, so a script would otherwise
-- need a Postgres connection of its own — duplicating the pooler/direct
-- fallback that `scripts/agent/supabase/query` already solves. SECURITY DEFINER
-- lets the reclaim script stay a thin HTTP client like `upload` and `sign-url`,
-- and puts the safety rule in one reviewable place instead of in argv.
--
-- Granted to **service_role only**. `authenticated` must not be able to
-- enumerate bucket contents; the app has no reason to call this and does not.
--
-- ⚠ RECLAIMING MAKES RETIREMENT PERMANENT IN PRACTICE. The row keeps its
-- `storage_path`, so reactivating a photo whose bytes were swept gives a broken
-- image with no way back. The grace period is the whole protection, which is
-- why the default is deliberately long.

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

COMMENT ON FUNCTION public.plant_photo_reclaimable(integer) IS
  'Objects in the plant-photos bucket that no active catalogue row points at, older than the grace period: retired photos tombstoned by a soft delete, and true orphans whose insert failed. An object belonging to an active row can never be returned. Read by skills/agent/plant-photo-catalogue/scripts/reclaim-orphans.';

REVOKE EXECUTE ON FUNCTION public.plant_photo_reclaimable(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.plant_photo_reclaimable(integer) TO service_role;

NOTIFY pgrst, 'reload schema';

-- ------------------------------------------------------------ post-apply --
-- Verified 2026-08-16 (44 objects, one soft-deleted row retired that morning):
--   plant_photo_reclaimable(30)  -> 0 rows   (the one candidate is hours old)
--   plant_photo_reclaimable(0)   -> 1 row    retired, 171530 bytes,
--                                            the windmill palm label photo
--   every active photo's object is absent from both results
--   `authenticated` is refused; `service_role` may execute
