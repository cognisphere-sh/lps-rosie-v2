## Search and verify

1. For job sourcing or a quick quote, use Austin Plant Supply
   (`supplier_id = 1`), the exclusive current supplier, and its price list.
   Only Chris's explicit exception authorizes sourcing from another supplier.
   A general "which growers list this?" question can research all suppliers;
   that research does not authorize a quote from them, an AR or an order.
   For already committed requests and accepted quotes, preserve supplied or
   accepted prices and use APS only to fill missing line prices; do not replace
   an agreed offering or price with a catalogue match. While APS is exclusive,
   preserve an explicit Chris-directed manual APS price, size or supplier-useful
   note for its stated quote/AR scope; catalogue research may corroborate it but
   does not overwrite it. It is APS pricing/ask evidence only, never a supplier
   response, stock/cultivar confirmation or authorization to map a proxy. No AR or new quote is
   required for direct ordering. `job-requests` owns path selection and Chris
   approval when availability publication is needed. Quick-quote-only requests
   stop after the quote.
2. Prefer `search_inventory(search, fuzzy_ratio)` and `search_suppliers`.
   Apply supplier scope and sorting outside the RPC:

   ```sql
   SELECT id, supplier_id, supplier_name, name, size, size_std,
          unit_price, quantity, relevance
   FROM search_inventory('live oak 30 g')
   WHERE supplier_id = 1
   ORDER BY relevance DESC, unit_price, id
   LIMIT 20;
   ```

   This is a candidate page, not proof that no exact match exists. If it is
   full or contains only broad matches, narrow by identity/size or page further
   before declaring a gap. Return selected evidence rather than every candidate.
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
5. If no exact match appears, try common/botanical names, reordered name terms
   (e.g. `Southern Magnolia` ↔ `Magnolia Southern`), fewer terms and broader
   size/cultivar searches within the selected supplier. Check the full identity
   fields and requested size on the returned row; word order alone neither
   proves a cultivar match nor makes the row an alternative. If the requested
   botanical/common name still yields no supported price, research other names
   on the internet and search supplier pricing under those names, following
   [pricing equivalents](pricing-equivalents.md) for evidence and the
   confirmation gate before recording a `plant_aliases` relationship. Label
   alternatives explicitly. For actual APS job sourcing/quick quotes, return
   evidence for every requested row, including gaps, and research 1–2 closest
   supported APS alternatives where price or exact-match evidence is missing.
   Prefer the same plant in a nearby size, then defensible related cultivars/
   plants; verify identity and size rather than trusting relevance rank. Return
   fewer or none when evidence is insufficient; never invent options/prices.
   If APS has no match, offer to search other
   suppliers and wait for instruction. An explicit all-supplier question
   authorizes that broader search. `job-requests` owns sourcing decisions.
6. Treat the APS price list as a non-exhaustive indication of items the
   supplier carries, not a live availability list. An absent row or price
   does not mean APS cannot supply the original customer-requested plant/size;
   a listed row or quantity does not confirm it can. Price evidence must not
   narrow an approved AR from the original requested plant/size to a listed
   proxy. `supplier-coordination` owns the actual supplier ask.
7. Check positive price, source freshness and explicit stock-location notes.
   A supplier's headquarters does not prove where inventory sits. Verify
   farm/region/location evidence in the inventory row/source; distinguish
   head-office location from stock location. Separate locations can be
   supplier rows sharing a `head_branch_id`.

For custom identity queries compare normalized keys (`name_key`,
`common_name_key`, `botanical_name_key`, `cultivar_keys`) or
`normalize_plant_key()`, never raw text equality. A bad alias expansion goes
to Daisy rather than being silently treated as a match.
