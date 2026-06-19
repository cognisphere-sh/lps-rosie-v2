# SOP — Customer Order Intake

Playbook for the per-customer sub-agent: turn an inbound customer order into a filed `job.json`, mapped against inventory. The orchestrator hands you this SOP plus the **verbatim** order data and the relevant paths; you do the file work and return a short structured summary.

## Steps

1. **Customer folder.** Create/locate `customers/<slug>/` + `customer.json` (structured profile, shape below — fill given details, blanks/empties for missing). `<slug>` is short kebab-case. Keep `customer.json` current whenever you learn a new contact detail. Can't place the customer yet → file under `customers/unknown/`.
2. **Create the job** at `customers/<slug>/jobs/<YYYY-MM-DD>-<slug>/job.json` (shape below). Extract each item — **plant name (no size)**, **size** (normalized, see §Conventions in 1-agent.md), **quantity**, per-item **customer comments** — plus job-level `created_at`, `customer_comments` (incl. EDD), `delivery_address`, `tax_pct`, `metadata`.
3. **Map each item against `workspace/inventory/`** (exact name match not required — same plant is enough): fill `price` and set `internal_notes` (format below). No price match → `price` null. Do **not** invent a price or silently auto-substitute — surface a close alternative for Chris to decide.
4. **Set the job to `pending`. Set each item's status:** `pending` if it mapped to a price; `price_missing` if `price` is null (the list carries no price for it — flag for Chris). Update `workspace/index.md` and `inventory/index.md` as needed.
5. **Return a short structured summary:** the items table (plant, size, qty, price, last-known status) + a list of anything missing / needing a price / ambiguous. Not a transcript.

## customer.json shape

The structured customer profile, one per `customers/<slug>/`. It is the durable record of who the customer is — the seller-side app reads it directly, so keep the field names exactly as below and the values structured (not prose). Update it the moment a contact detail changes.

```json
{
  "slug": "dior-goodwin",
  "name": "Dior Goodwin",
  "poc_name": "",
  "phones": [],
  "emails": [],
  "address": "",
  "notes": "Existing customer. Orders received by email.",
  "created_at": "2026-06-18T10:03:00-05:00"
}
```

- `slug` — the folder slug (kebab-case); matches `customers/<slug>/`.
- `name` — customer/company name as you'd address them.
- `poc_name` — primary point-of-contact person; blank if not known.
- `phones` / `emails` — arrays of strings; empty arrays if none.
- `address` — default billing/contact address (job-specific delivery addresses live on the job, not here); blank if none.
- `notes` — short free-text account notes (terms, quirks, how they order). Blank if none.
- `created_at` — ISO 8601 in APS's timezone, when the customer was first filed.

The job folder index lives in `customers/<slug>/index.md` (jobs pointers); `customer.json` holds the profile. There is no `customer.md` — don't recreate one (that would duplicate the same facts in two files).

## job.json shape

The job lives **inside** its customer folder, so it carries no customer id of its own.

```json
{
  "job_name": "Lot 42 Replant",
  "created_at": "2026-06-17T09:30:00-05:00",
  "updated_at": "2026-06-17T09:30:00-05:00",
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
      "status": "pending",
      "customer_facing_notes": "",
      "internal_notes": "15 G- Quercus virginiana: Available 2026-06-10"
    }
  ]
}
```

**Order/job level**

- `job_name` — short human-readable label (e.g. "Lot 42 Replant", "Spring restock"); derive one from the request if the customer didn't name it. The job folder name is its id (`<YYYY-MM-DD>-<slug>`); the job carries no id field.
- `created_at` — ISO 8601 in APS's timezone (§Conventions). Set **once** when the job is first filed; **never change it** on later edits.
- `updated_at` — ISO 8601 in APS's timezone. Equals `created_at` at creation; **set it to "now" every time you write any change to this file** (status, items, prices, notes, anything). This is what the seller-side app shows as "last updated", so it must reflect the actual last edit.
- `status` — one of: `pending` → `quote_sent` → `order_confirmed` → `closed_won` / `closed_lost` / `cancelled`. Starts `pending`; advance it as the order moves.
- `customer_comments` — order-level customer input: the **EDD** plus any other short relevant note. Blank if none.
- `delivery_address` — where it ships; blank if not given.
- `tax_pct` — tax percentage (number); `null` if not known yet.
- `metadata` — free key/value object for any other relevant info (PO number, sales rep, source channel, etc.). Empty object if none.

**Row items** (`items[]`)

**Ordering:** Items requiring attention (non-blank `internal_notes`) always come first in the array, followed by cleanly-mapped items. Apply this ordering whenever the job is created or edited.

- `id` — 8-char alphanumeric, stable for the life of the item. Preserve existing ids on edits; mint new ones only for genuinely new items.
- `plant_name` — the plant/item **as the customer demanded it** (no size).
- `customer_comments` — per-item note from the customer. **Terse — minimum words, no full sentences.** Blank if none.
- `size` — demanded size, normalized (§Conventions). Blank if not given.
- `quantity` — quantity demanded.
- `price` — unit price from the price list; `null` if no match / unpriced.
- `status` — `pending` (after mapping) · `available` · `unavailable` · `diff` (different size/qty/plant — describe in notes) · `can_order` (note lead time) · `price_missing` (no price in the list — `price` is null; flag for Chris). Set `price_missing` yourself at intake whenever `price` is null; Chris sets the other non-`pending` values on review.
- `customer_facing_notes` — note meant **for the customer** (goes in a reply/quote). Customer-appropriate only.
- `internal_notes` — **free internal field**, not shown to the customer. **Only populate when the item needs Chris's attention.** Leave blank if the plant was straightforwardly found and mapped in the price list (even if a common-name alias was used). **Terse — minimum words, no full sentences, no source-file mention.** Populate only for:
  - Size/qty mismatch (closest available in a different size): `[Size Diff] <Available Size>- <Mapped Plant Name>: <Last Status>`.
  - Close alternate offered (demanded plant unavailable, suggesting similar): `[Alternate] <Size>- <Plant Name>: <Last Status>`. Only if genuinely close.
  - Not in inventory at all: `Not Found`.
  - Any other flag needing Chris's attention (ambiguous qty, cultivar confirmation needed, etc.): short plain note.

## On Chris's review (same sub-agent, `-c`)

Chris sets each item's `status` (`available` / `unavailable` / `can_order` / `diff`) and notes. Apply his decisions: update `job.json` (item statuses, `internal_notes` for internal detail, `customer_facing_notes` for anything to relay back; advance job `status`, e.g. → `quote_sent` / `order_confirmed`) **and reconcile inventory** — append each matching entry's `comment` with the status + today's date (`unavailable` → "Unavailable as of <date>"; `can_order` + lead time → record it). Do **not** change prices unless Chris changed them. **Set `updated_at` to "now"** since you're editing the file. Return a one-line confirmation.
