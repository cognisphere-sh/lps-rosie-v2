# Photo catalogue — storage and network cost plan

**Date:** 2026-08-16
**Status:** Plan only. Nothing here is implemented; each phase has a gate.
**Scope:** the `plant-photos` bucket and the `/photos` page. Not the `lps`
bucket (supplier source files), which has its own profile.

---

## 1. Where the cost actually is, measured

Live numbers, 2026-08-16:

| | |
|---|---|
| Catalogued photos | 44 (43 active, 1 soft-deleted) |
| Bucket size | **20 MB** across 44 objects |
| Average object | **459 kB** |
| Largest object | **4.5 MB** |
| Average dimensions | 797 × 823 px |
| Objects with no catalogue row | 0 |
| Catalogue rows with no object | 0 |

At this size **nothing here is worth doing yet.** 20 MB costs approximately
nothing and 43 photos fit in one batch. This plan exists so the trigger points
are decided before the numbers arrive, not after.

**The cost is not storage — it is egress, and it is one specific mistake.**
The grid renders every thumbnail from the **full-size original**. A card is
displayed at roughly 250 px wide and downloads 459 kB on average to fill it.

```
one /photos page view, full batch of 50
  today            50 × 459 kB   ≈ 23 MB
  with thumbnails  50 ×  20 kB   ≈  1 MB      ~95% less
```

The largest single object is 4.5 MB — one card, one image, 4.5 MB, to paint a
250 px square. That ratio is the whole problem, and it gets worse as photos
arrive from phones rather than Telegram (which recompresses on the way in).

**The second cost is round-trips, not bytes.** Every `<img>` points at
`/api/photos/<id>/image`, which does a database read to resolve the path, a
Supabase signing API call, and a 307 redirect. A full batch is therefore **50
app requests + 50 database reads + 50 signing calls** before a single image byte
moves. None of it is cacheable: the signature is minted per request, so the
redirect target changes every time and a revisit repeats all of it.

---

## 2. The four levers, in payoff order

### A. Serve derivatives, not originals — the ~95% win

The grid needs ~400 px WebP; the lightbox needs ~1600 px. Neither needs the
original. Two ways to get there, and they trade differently:

| | On-the-fly transforms | Pre-generated derivatives |
|---|---|---|
| How | Supabase Storage image transformation, requested through the existing signed URL (`transform: { width, resize }`) | Generate `thumb.webp` / `display.webp` at ingest, beside the original |
| Ingest work | **none** | new step in `plant-photo-catalogue`, plus a backfill of all existing photos |
| Extra storage | none | ~10% on top of originals |
| Recurring cost | billed per origin image transformed; CDN-cached after the first hit | none |
| Reversible | entirely — it is a URL parameter | needs a cleanup pass |

**Recommendation: transforms first.** It is a one-line change at the signing
call, needs no schema change, no ingest change and no backfill, and it is
reversible by deleting the parameter. Move to pre-generated derivatives only if
measured transform billing exceeds what storing thumbnails would cost — which
happens when the same photos are viewed by few people many times, and does not
happen at low traffic.

**Gate:** confirm current Supabase transformation pricing and that it applies to
signed URLs on a private bucket. If either fails, go straight to pre-generated.

### B. Sign in batches, not per image

`searchPhotos` already reads every row's `storage_path` to build the batch. It
could call `createSignedUrls` (plural — one API call for many paths) and return
the URLs in the same JSON, instead of handing the browser 50 redirect endpoints
to visit.

- **50 app requests + 50 DB reads + 50 signing calls → 1 of each.**
- Keep `/api/photos/<id>/image` as the route for the lightbox and as the
  fallback when a batch URL has expired.
- The signed URLs then live in a JSON response. That is acceptable — the whole
  app is behind the session gate and the JSON is already private — but it does
  mean the URL is visible to anyone who can already see the photo, which is the
  same set of people. No change in who can reach what.

**Trade-off to size before building:** a page left open past the TTL shows
broken images. Either lengthen the TTL (C) or re-fetch the batch on window
focus.

### C. Make the image response cacheable

Today: 1-hour TTL, minted per request, `NextResponse.redirect` with no cache
headers. A user who scrolls back up re-requests everything.

- Raise the signed TTL (24 h is reasonable for a private reference catalogue).
- Put `Cache-Control` on the redirect so the browser reuses it.
- **The invariant: cache lifetime must be shorter than the signed TTL.** A
  cached redirect pointing at an expired signature is a broken image that
  refreshing does not fix, which is worse than the extra request.

### D. Store less in the first place

- **Normalise originals at ingest.** A 4.5 MB phone photo at 4032 × 3024 is not
  a more useful reference than a 2048 px long-edge WebP at ~400 kB. Capping the
  long edge would cut storage roughly 4× for phone-sourced photos.
  **This is a policy decision, not a technical one** — Nova's catalogue plan
  says preserve originals privately, and this contradicts it. Decide explicitly:
  is the catalogue an *archive* (keep originals) or a *reference library* (keep
  what is useful)? If archive, this lever is off and A/B/C carry the load.
- **Strip EXIF** on anything stored. Smaller, and it removes GPS from photos
  taken at a supplier's site — a privacy win independent of cost.
- **Reclaim orphaned objects.** Soft-deleting a photo leaves its object in the
  bucket forever; nothing reclaims it. One such object exists today. It needs a
  periodic sweep — objects whose row is inactive or missing, older than a grace
  period — and a decision about how long a deleted photo's bytes are kept.
- Exact-duplicate bytes are **already** prevented by the unique `sha256` index.
  Near-duplicates are not, and re-sent photos are the common case; perceptual
  hashing is deferred (see the catalogue plan) and is a *storage* argument as
  well as a data-quality one.

---

## 3. What to measure first

No optimisation before numbers. Three of these are one query each:

- Bucket size, object count, average and p95 object size (the query in §1).
- Egress per month, from the Supabase dashboard — the number that decides
  whether any of this matters.
- Requests to `/api/photos/*/image` per day, and their p95 latency. This is the
  round-trip cost and it is currently unmeasured; it needs a counter.
- After any change: the same three, plus bytes per `/photos` page view from the
  browser's network panel. **23 MB → target under 2 MB** is the headline check.

---

## 4. Phases and their triggers

| Phase | Do | Trigger |
|---|---|---|
| **0 — Measure** | The four metrics above; write them down | Now. It is one query and one dashboard read |
| **1 — Thumbnails** | Lever A via transforms, for the grid only | **> ~300 photos**, or the first complaint about the page being slow on mobile data |
| **2 — Batch + cache** | Levers B and C together — they interact through the TTL | Same trigger as Phase 1; do it in the same piece of work if the page view already feels slow |
| **3 — Store less** | Lever D: the archive-vs-reference decision, EXIF stripping, the orphan sweep | **> ~2 GB stored**, or the first phone-sourced bulk drop |
| **4 — Near-duplicates** | Perceptual hashing, from the catalogue plan | When reviewers report seeing the same photo twice, or storage growth outpaces photo count |

**Phase 1 and 2 together are the whole of the practical win.** Phase 3 is
housekeeping that matters at scale, and Phase 4 is data quality that happens to
save space.

---

## 5. Rejected, and why

- **`next/image` for the grid.** It optimises images it can fetch at build or
  request time from a configured host. Ours come from a per-request signed
  redirect on a private bucket, which is exactly what its loader cannot cache.
  The transform-at-the-signing-call approach (A) does the same job without
  fighting it.
- **Making the bucket public to get CDN caching.** It would work and it is not
  worth it. Private storage with signed access is the property that makes the
  photo endpoint safe to expose at all, and the CDN already caches the signed
  object URL after the first fetch.
- **Infinite scroll instead of Load more.** Auto-loading on scroll multiplies
  exactly the cost this plan is about, and does it without the user asking. The
  explicit button is the cheaper default and stays.
- **Storage lifecycle tiering.** Supabase Storage exposes no cold tier, so the
  only storage lever is storing less (D).

---

## 6. Decisions needed before Phase 1

1. **Archive or reference library?** Whether originals are preserved as-is
   decides whether lever D exists at all.
2. **How long are a deleted photo's bytes kept** before the orphan sweep
   reclaims them?
3. **Transform billing vs thumbnail storage** — confirmed against current
   Supabase pricing, which decides A's implementation.
