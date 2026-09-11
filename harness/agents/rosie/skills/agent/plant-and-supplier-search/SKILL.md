---
name: plant-and-supplier-search
description: Find plant pricing and suitable suppliers from inventory evidence. Covers APS or explicitly named supplier scoping, broad and literal search, cultivar/size matching, source dates and stock-location checks, and instructed wider supplier searches. Use for pricing questions, job sourcing and quick quotes; a search alone creates no job and confirms no availability. (v2.0.0)
metadata:
  author: lps
  version: "2.0.0"
---

# Plant and supplier search

Read `knowledge/files/SCHEMA.md`. Inventory, aliases and supplier records
belong to Daisy: read them and report data corrections to her. Do not repair
her tables during order sourcing.

## Search and verify

1. For job sourcing or a quick quote, start with Austin Plant Supply
   (`supplier_id = 1`) unless a supplier was explicitly named. A general
   "which growers list this?" question can search all suppliers.
2. Prefer `search_inventory(search, fuzzy_ratio)` and `search_suppliers`.
   Apply supplier scope and sorting outside the RPC:

   ```sql
   SELECT id, supplier_id, supplier_name, name, size, size_std,
          unit_price, quantity, relevance
   FROM search_inventory('live oak 30 g')
   WHERE supplier_id = 1
   ORDER BY relevance DESC, unit_price;
   ```

   Check the current schema's returned columns; inventory ids are UUIDs.
   Empty search returns nothing. To list rows, query `inventory` with an
   explicit order and limit instead.
3. Validate identity and size on every proposed match. Broad search is
   typo-tolerant and expands plant aliases; relevance ranks rows matching
   some query terms, so the top result is not proof of an exact cultivar.
   Read `common_name`, `botanical_name`, `cultivar_variety_trade_name` and
   size. `inventory.name` composes those identity parts.
4. When literal text really matters, wrap the entire search in straight
   double quotes, e.g. `"Italian Cypress"`. This searches a case-insensitive
   literal substring in plant identity only, not size or notes. It does not
   expand aliases or tolerate spelling/spacing changes. Literal hits have
   equal relevance; sort by the evidence the question needs.
5. If no exact match appears, try common/botanical names, fewer terms and
   broader size/cultivar searches within the selected supplier. Label
   alternatives explicitly. If APS has no match, offer to search other
   suppliers and wait for instruction. An explicit all-supplier question
   authorizes that broader search. `job-requests` owns sourcing decisions.
6. Check positive price, source freshness and explicit stock-location notes.
   A supplier's headquarters does not prove where inventory sits. Verify
   farm/region/location evidence in the inventory row/source; distinguish
   head-office location from stock location. Separate locations can be
   supplier rows sharing a `head_branch_id`.

For custom identity queries compare normalized keys (`name_key`,
`common_name_key`, `botanical_name_key`, `cultivar_keys`) or
`normalize_plant_key()`, never raw text equality. A bad alias expansion goes
to Daisy rather than being silently treated as a match.

## Report evidence

Return the useful matches: supplier, plant/cultivar, size, listed price and
relevant source date/location. A published stock count is what the list said
then, not a current reservation or confirmed supply. Unknown/zero prices
are unpriced; do not invent a price.

For jobs, return inventory UUIDs and findings to the owning `jr-<id>` thread
for its short supplier rows. Do not replace a later supplier answer with a
catalogue listing. For standalone questions, answer in the requesting
interaction without creating a job or contacting a supplier. Keep SQL and
internal tooling out of Chris's response.
