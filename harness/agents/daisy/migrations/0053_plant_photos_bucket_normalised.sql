-- 0053_plant_photos_bucket_normalised.sql
-- Applied 2026-08-16 via the Supabase MCP at Bhoumik's request, one step
-- recorded in the Supabase history as `plant_photos_bucket_normalised`.
-- Bucket configuration only — no table, index, function or row touched.
--
-- The catalogue is a **reference library, not an archive** (decided
-- 2026-08-16). Photos are normalised before upload — EXIF orientation baked
-- into the pixels, all metadata dropped, long edge capped at 2048px, re-encoded
-- to WebP — by `skills/agent/plant-photo-catalogue/scripts/prepare-photo`.
-- Measured on a 4032x3024 phone photo: 7.9 MB -> 819 kB, 89.6% smaller.
--
-- This makes that a rule the storage layer enforces rather than a convention a
-- skill describes:
--
--   allowed_mime_types  image/jpeg|png|webp|heic|heif  ->  image/webp
--   file_size_limit     25 MB                          ->  8 MB
--
-- **The narrowed type list is the actual enforcement.** An un-normalised upload
-- is by definition not a WebP we made, so it now fails at the API instead of
-- landing in the bucket and being discovered later. The wide list was right
-- when the bucket took whatever a supplier sent; it is wrong now that exactly
-- one process writes to it and that process always emits WebP. HEIC in
-- particular no longer belongs here — it is a *source* format that
-- `prepare-photo` reads (via pillow-heif) and converts, never something we
-- store.
--
-- The 8 MB limit is a backstop, not a target: a 2048px WebP is comfortably
-- under 1 MB, so anything approaching this ceiling means the normaliser was
-- skipped or its settings are wrong. The old 25 MB was sized for raw phone
-- originals, which we no longer keep.
--
-- ⚠ `allowed_mime_types` and `file_size_limit` gate **uploads only**. The 44
-- objects already in the bucket are JPEGs and are untouched by this — they stay
-- readable and their rows stay valid. They are not backfilled: re-encoding them
-- would destroy originals we still hold, to save roughly 13 MB, which is not a
-- trade worth making. Existing photos normalise if and when they are re-sent.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/webp'],
    file_size_limit = 8388608
WHERE id = 'plant-photos';

-- ------------------------------------------------------------ post-apply --
-- Verified 2026-08-16:
--   bucket reports allowed_mime_types {image/webp}, file_size_limit 8388608
--   the 44 existing image/jpeg objects still resolve and still render through
--     /api/photos/<id>/image
--   a JPEG upload is refused by the storage API; the same file normalised to
--     WebP by prepare-photo uploads cleanly
