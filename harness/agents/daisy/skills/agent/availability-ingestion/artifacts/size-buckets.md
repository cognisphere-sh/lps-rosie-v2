### The standard bucket — `size_std`

`size` keeps the supplier's own spelling. `size_std` says which **one**
container that is, so the app can offer a single checkbox per real size instead
of one per spelling. Write it for every row that has a `size`.

**The vocabulary.** The database enforces the shape, not a fixed list:

| Bucket | Shape | Notes |
| --- | --- | --- |
| Pots | `<N>" Pot` | `4" Pot`, `8" Pot`, `3.5" Pot`. **Open set.** Only for diameters with no gallon equivalent — see rule 3 |
| Gallons | `<N>G` | `1G`, `15G`, `2G`, `35G`, `2.5G`. **Open set** — write the number the source printed. Never round to a "nicer" size |
| Boxes | `<N>" Box` | `24" Box`, `108" Box`. **Open set.** Always inches; `9' box` → `108" Box` |
| Word grades | `Bare Root`, `Liners`, `Plug`, `Trays`, `B&B`, `Field Grown`, `Grow Bags`, `Root Pruned` | exactly these strings |
| Catch-all | `other` | a real container the standard has no bucket for |

Anything else is rejected by `inventory_size_std_check`.

**Mapping, first rule that matches wins:**

1. **Says "box"** → `<N>" Box` from the box's inch number. `45 G/24" BOX` →
   `24" Box`: the box is the trade unit, the gallon figure is its volume.
   `Boxed` with no number is not a box → `other`.
2. **Has a gallon quantity** → `<N>G`. The pot-diameter half of a compound is
   dropped (`15 G/17"` → `15G`, `45 G/28"` → `45G`) and qualifiers are ignored
   (`6 G; Bush` → `6G`). Two different gallon sizes in one value (`3 G/5 G`) is
   a parse miss — split it into two rows per the [combined-size rule](values-notes.md),
   each with its own bucket.
3. **Names a burlapped root ball** — `B&B`, `BB`, `balled and burlapped` →
   `B&B`. The burlap *is* the container, so a height or caliper printed with it
   (`B&B; 3-4' HT`, `4 - 5'; B&B`) is the plant's size: bucket `B&B` and put the
   measurement in `height`/`caliper` with its `*_std`. A genuinely different
   container named alongside still wins by its own priority (`15 G B&B` → `15G`,
   `24" Box B&B` → `24" Box`).
4. **A bare diameter in inches** is one of three things, and the plant names
   decide which:
   - it **has a gallon equivalent** → that gallon, which is the pairing the
     trade prints: 6"→`1G`, 10"→`3G`, 12"→`5G`, 14"→`7G`, 17"→`15G`, 20"→`20G`,
     21"→`25G`, 28"→`45G`, 30"→`60G`, 32"→`65G`, 36"→`100G`, 42"→`150G`,
     48"→`200G`, 60"→`300G`;
   - it is an **unlabelled box** → `<N>" Box`. Desert and palm growers print a
     bare `24"`/`36"`/`48"` meaning a box; the supplier's other boxed rows and
     large specimen plant names give it away. Never write `36" Pot` for a boxed
     tree;
   - otherwise it is a **pot** → `<N>" Pot` (`4" Pot`, `8" Pot`, `3.5" Pot`).
     This is the annual / perennial / tropical end of the catalogue.

   A diameter attached to **merchandise** rather than a plant — the row names a
   planter, bowl, basket or tool — is `other`, never a pot.
5. **Word grades** map case- and plural-insensitively: `BR`/`bareroot` →
   `Bare Root`; `LNR`/`Rooted Liner` → `Liners`; anything naming a plug →
   `Plug`; cell trays and flats identified by a cell count or tray code
   (`128`, `1801`, `40 CEL`, `Flat`) → `Trays`; `FG`/`In Ground` →
   `Field Grown`; `Fabric Bag` → `Grow Bags`; `RP` → `Root Pruned`.
6. **Everything else that is still a container** → `other`. `Quart`,
   `Six Pack`, `10" Hanging Basket`, `Specimen` all land here. **`other` is a
   correct answer, not a failure** — it means "a real container the standard has
   no bucket for". Never invent a nearby bucket to avoid it.

`size_std` is `NULL` only when `size` is `NULL`. If the source printed no
container, both stay `NULL` — that is a fact, and [values and notes](values-notes.md) still holds.
