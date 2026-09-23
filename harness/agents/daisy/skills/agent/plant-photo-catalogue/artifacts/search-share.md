## 2. Searching the catalogue

```sql
select id, name, supplier_name, size, tags, relevance
from public.search_plant_photos('windmill palm')
order by relevance desc limit 20;
```

**It behaves exactly like `search_inventory`**, over a different document — read
the `plant-and-supplier-search` skill for how the ranking thinks. In short:

- The document is **name + size + caption + tags + notes**.
- Typo tolerant, matches **partially at both ends**, and expands your terms
  through `plant_aliases` — so `Chusan Palm` finds a photo catalogued as
  *Trachycarpus fortunei* even though those words appear nowhere on it.
- **Ranked, not filtered.** Results are everything matching *any* term; read
  `relevance` and the top of the list, don't report the row count as "how many
  photos we have".
- A typed size **ranks** rather than filters: `30g palm` puts 30 G palms on top
  without removing the others.
- **An empty `search` returns nothing.** To *list* rather than search, select
  from `plant_photos` directly with an `ORDER BY` and a `LIMIT`.

Two parameters, neither a filter. Scope and filter **over** the result — the
same columns the `/photos` page offers as dropdowns:

```sql
select * from public.search_plant_photos('maple')
where supplier_id = 1
  and size_std = '36" Box'
  and cultivar_keys && array['bloodgood']   -- normalized, never the display name
  and tags && array['nursery'];
```

The one difference from `search_inventory`: photos join `suppliers` **LEFT**,
so `supplier_name` is null on an unattributed photo rather than the photo being
missing. Never write `where supplier_name is not null` unless you mean it.

### Sharing a photo

The bucket is private, so paste a signed link — never a bucket URL, which will
not load:

```sh
scripts/agent/supabase/sign-url --bucket plant-photos \
  --path suppliers/1/2026/08/<uuid>.webp --expiry 604800
```

For a person already signed into the app, `https://<app>/photos?q=<plant>` is
better than a link to one file — it gives them the whole match set.

---
