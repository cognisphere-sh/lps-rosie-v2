# SOP — Customer Order Intake

Playbook for the per-customer sub-agent: turn an inbound customer order into a filed `job.json`, mapped against inventory. The orchestrator hands you this SOP plus the **verbatim** order data and the relevant paths; you do the file work and return a short structured summary.

## Steps

1. **Customer folder.** Create/locate `customers/<slug>/` + `customer.md` (fill given details, blanks for missing). `<slug>` is short kebab-case. Can't place the customer yet → file under `customers/unknown/`.
2. **Create the job** at `customers/<slug>/jobs/<YYYY-MM-DD>-<slug>/job.json` (shape below). Extract each item — **plant name (no size)**, **size** (normalized, see §Conventions in 1-agent.md), **quantity**, per-item **customer comments** — plus job-level `created_at`, `customer_comments` (incl. EDD), `delivery_address`, `tax_pct`, `metadata`.
3. **Map each item against `workspace/inventory/`** (exact name match not required — same plant is enough): fill `price` and set `internal_notes` (format below). No price match → `price` null. Do **not** invent a price or silently auto-substitute — surface a close alternative for Chris to decide.
4. **Set every item and the job to `pending`.** Update `workspace/index.md` and `inventory/index.md` as needed.
5. **Return a short structured summary:** the items table (plant, size, qty, price, last-known status) + a list of anything missing / needing a price / ambiguous. Not a transcript.

## job.json shape

The job lives **inside** its customer folder, so it carries no customer id of its own.

```json
{
  "job_name": "Lot 42 Replant",
  "created_at": "2026-06-17T09:30:00-05:00",
  "status": "pending",
  "customer_comments": "EDD 2026-07-01. Needs delivery before the 4th.",
  "delivery_address": "4200 Bull Creek Rd, Austin, TX 78731",
  "tax_pct": 8.25,
  "metadata": {},
  "items": [
    {
      "id": "a1b2c3d4",
      "plant_name": "Live Oak",
      "customer_comments": "prefers multi-trunk",
      "size": "15 G",
      "quantity": 12,
      "price": 95,
      "quantity_available": null,
      "status": "pending",
      "customer_facing_notes": "",
      "internal_notes": "15 G- Quercus virginiana: Available 2026-06-10"
    }
  ]
}
```

**Order/job level**

- `job_name` — short human-readable label (e.g. "Lot 42 Replant", "Spring restock"); derive one from the request if the customer didn't name it. The job folder name is its id (`<YYYY-MM-DD>-<slug>`); the job carries no id field.
- `created_at` — ISO 8601 in APS's timezone (§Conventions).
- `status` — one of: `pending` → `quote_sent` → `order_confirmed` → `closed_won` / `closed_lost` / `cancelled`. Starts `pending`; advance it as the order moves.
- `customer_comments` — order-level customer input: the **EDD** plus any other short relevant note. Blank if none.
- `delivery_address` — where it ships; blank if not given.
- `tax_pct` — tax percentage (number); `null` if not known yet.
- `metadata` — free key/value object for any other relevant info (PO number, sales rep, source channel, etc.). Empty object if none.

**Row items** (`items[]`)

- `id` — 8-char alphanumeric, stable for the life of the item. Preserve existing ids on edits; mint new ones only for genuinely new items.
- `plant_name` — the plant/item **as the customer demanded it** (no size).
- `customer_comments` — per-item note from the customer. **Terse — minimum words, no full sentences.** Blank if none.
- `size` — demanded size, normalized (§Conventions). Blank if not given.
- `quantity` — quantity demanded.
- `price` — unit price from the price list; `null` if no match / unpriced.
- `quantity_available` — quantity APS can actually supply (from Chris / ground team); `null` until known.
- `status` — `pending` (after mapping) · `available` · `unavailable` · `diff` (different size/qty/plant — describe in notes) · `can_order` (note lead time). Chris sets the non-`pending` values on review.
- `customer_facing_notes` — note meant **for the customer** (goes in a reply/quote). Customer-appropriate only.
- `internal_notes` — **free internal field**, not shown to the customer. **Terse — minimum words, no full sentences, no source-file mention.** Format:
  - Mapped: `<Size>- <Mapped Plant Name>: <Last Status>` (status with date only if present, e.g. `15 G- Quercus virginiana: Available 2026-06-10`).
  - Close alternate offered (when demanded isn't available): add `[Alternate] <Size>- <Plant Name>: <Last Status>`. Only if it's genuinely close.
  - Not in inventory: `Not Found`.
  - Blank if there's nothing to note.

## On Chris's review (same sub-agent, `-c`)

Chris sets each item's `status` (`available` / `unavailable` / `can_order` / `diff`), `quantity_available`, and notes. Apply his decisions: update `job.json` (item statuses, `internal_notes` for internal detail, `customer_facing_notes` for anything to relay back; advance job `status`, e.g. → `quote_sent` / `order_confirmed`) **and reconcile inventory** — append each matching entry's `comment` with the status + today's date (`unavailable` → "Unavailable as of <date>"; `can_order` + lead time → record it). Do **not** change prices unless Chris changed them. Return a one-line confirmation.
