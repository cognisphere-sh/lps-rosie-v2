# Inventory index

Imported from `workspace/files/aps-pricing-2026.pdf` (APS Item Price List, April 16, 2026).

Total category files: 18
Total entries: 1598
Entries with null price: 86

## Category files

- `workspace/inventory/annual.json` — 43 entries — Annual flowering/seasonal plant inventory.
- `workspace/inventory/cactus.json` — 150 entries — Cactus, agave, yucca, and succulent inventory. (2 zero price)
- `workspace/inventory/chemicals.json` — 68 entries — Chemicals, fertilizers, pest/disease control products. (26 null price; 2 zero price)
- `workspace/inventory/fern.json` — 14 entries — Fern inventory.
- `workspace/inventory/grass.json` — 48 entries — Ornamental grass inventory. (2 zero price)
- `workspace/inventory/grncvr.json` — 56 entries — Groundcover inventory.
- `workspace/inventory/hardgood.json` — 8 entries — Hardgood inventory items. (3 zero price)
- `workspace/inventory/hardgoods.json` — 62 entries — Hardgoods, landscape supplies, stakes, edging, and related materials. (9 null price; 16 zero price)
- `workspace/inventory/indoor.json` — 17 entries — Indoor/houseplant inventory. (2 null price; 5 zero price)
- `workspace/inventory/lndorg.json` — 35 entries — Landscape/organic soils, mulches, amendments, and bulk materials. (12 null price; 1 zero price)
- `workspace/inventory/palms.json` — 50 entries — Palm and cycad inventory. (2 null price; 2 zero price)
- `workspace/inventory/peren.json` — 167 entries — Perennial plant inventory. (1 null price; 4 zero price)
- `workspace/inventory/pottery.json` — 109 entries — Pottery, planters, urns, and containers. (13 null price; 5 zero price)
- `workspace/inventory/shrub.json` — 400 entries — Shrub inventory. (9 null price; 4 zero price)
- `workspace/inventory/tool.json` — 56 entries — Tools and garden equipment. (8 null price; 2 zero price)
- `workspace/inventory/trees.json` — 253 entries — Tree inventory. (3 null price; 9 zero price)
- `workspace/inventory/tropicals.json` — 29 entries — Tropical plant inventory. (1 null price)
- `workspace/inventory/vines.json` — 33 entries — Vine/climber inventory.

## Import notes

- JSON files are pretty-printed arrays of inventory entries with `plant_name`, `size`, `unit_price`, `common_names`, `comment`, and `attachments`.
- Non-plant categories from the APS price list are included because Chris approved importing all categories.
- Rows with blank prices in the source PDF are preserved with `unit_price: null`.
