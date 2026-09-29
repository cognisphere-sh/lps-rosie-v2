# Finding and sharing photos

```sql
select id, name, supplier_name, size, tags, relevance
from public.search_plant_photos('windmill palm')
order by relevance desc limit 20;
```

It works like `search_inventory` (see `plant-and-supplier-search`), over name +
size + caption + tags + notes:

- Typo-tolerant, matches partial words, expands aliases (`Chusan Palm` finds
  *Trachycarpus fortunei*).
- Ranked, not filtered: read `relevance` and the top rows; the row count is not
  "how many photos we have". A typed size (`30g palm`) ranks, it doesn't filter.
- Height and caliper are not searched.
- An empty search returns nothing; to list, select from `plant_photos` with
  `ORDER BY` and `LIMIT`.
- Filter on the result, like the `/photos` dropdowns:
  `where supplier_id = 1 and size_std = '36" Box' and cultivar_keys && array['bloodgood'] and tags && array['nursery']`
  (cultivar keys are normalized, not display names).
- Photos join suppliers LEFT: `supplier_name` is NULL for unattributed photos.
- "Is there a photo of this exact inventory row?" → join on `name_key`
  (`ph.name_key = inv.name_key and ph.is_active`). "Any photo of this plant?"
  → part keys or `search_plant_photos`.

**Sharing:** the bucket is private, so send a signed link, never a bucket URL:

```sh
scripts/agent/supabase/sign-url --bucket plant-photos \
  --path suppliers/1/2026/08/<uuid>.webp --expiry 604800
```

For someone signed in to the app, `https://<app>/photos?q=<plant>` is better.
