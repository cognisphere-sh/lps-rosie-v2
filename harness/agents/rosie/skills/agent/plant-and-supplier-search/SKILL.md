---
name: plant-and-supplier-search
description: Find plant pricing and suitable suppliers from inventory evidence. Covers APS price-list scoping, supplied/accepted-price preservation and missing-price fallback for committed orders, supplier exceptions, broad and literal search, cultivar/size matching, lowest-priced-requested-option selection, naming equivalents and rose pricing, source dates and stock locations, wider searches, minimal sourcing exceptions and action-specific alternative approval, and research-only answers in chat. Use for pricing questions, job sourcing, quick quotes and missing direct-order prices; search alone creates no job, sourcing note or AR and confirms no availability. (v2.12.0)
metadata:
  author: lps
  version: "2.12.0"
---

# Plant and supplier search

Read `knowledge/files/SCHEMA.md`. Inventory, aliases and supplier records
belong to Daisy: read them and report data corrections to her. Do not repair
her tables during order sourcing.

## Search and verify

1. For job sourcing or a quick quote, use Austin Plant Supply
   (`supplier_id = 1`), the exclusive current supplier, and its price list.
   Only Chris's explicit exception authorizes sourcing from another supplier.
   A general "which growers list this?" question can research all suppliers;
   that research does not authorize a quote from them, an AR or an order.
   For already committed requests and accepted quotes, preserve supplied or
   accepted prices and use APS only to fill missing line prices; do not replace
   an agreed offering or price with a catalogue match. No AR or new quote is
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
   alternatives explicitly. For actual APS job sourcing/quick quotes, return
   evidence for every requested row, including gaps, and research 1–2 closest
   supported APS alternatives where price or exact-match evidence is missing.
   Prefer the same plant in a nearby size, then defensible related cultivars/
   plants; verify identity and size rather than trusting relevance rank. Return
   fewer or none when evidence is insufficient; never invent options/prices.
   If APS has no match, offer to search other
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

## Multiple requested options

For unaccepted alternatives such as `3 G / 5 G`, research **all requested size/variant
options**. Chris's standing rule is to use the cheapest requested option having
supported applicable positive pricing, not the smallest size or assumed physical
stock. Call this supported pricing, never “available”: missing price-list entries
prove neither physical unavailability nor lack of supply. Return the chosen
size/variant and price plus every other
supported requested-option price to the job owner for shared/customer-visible
item notes (`external_notes`). Preserve original options; do not choose an
unrequested option or infer allocation, stock or a price. No redundant
choice question is needed for clear alternatives. If no requested option is
priced, report the gap and follow the genuine-alternative approval rule.
For an unpriced requested option, return a pricing gap, not `NA`. Shared notes
use only a brief other-size price or neutral `price pending`; `NA`/`Only ...
available` requires actual supplier confirmation. `quote-generation` owns the
minimal shared-note rule; phase labels, price-sheet/supplier references and
pricing-identity explanations stay out. `job-requests` owns persistence and
ambiguous mixed demands.

## Likely equivalent names versus actual alternatives

Chris authorized direct pricing for plants that are most likely the same
under different requested/catalogue names (2026-09-11). Check common and
botanical names, aliases, cultivar/form information, requested size and source
context. When that evidence supports a likely naming equivalent, use its
positive, applicable price directly for the requested row. Do not label it an
alternative or ask for substitution approval merely because its catalogue
name differs. Preserve the requested name and necessary source evidence.
Keep a concise internal mapping/basis only when it materially qualifies identity
or pricing, e.g. `Agave Parryi pricing basis; truncata identity unconfirmed`.
Routine exact-name/spelling matches need no note if accessible evidence already
suffices; do not repeat structured size/price. No invented evidence.

**Chris's explicit pricing example:** requested `Agave parryi truncata` may use
listings named `Artichoke Parry’s Agave` or `Agave Parryi` at the requested size,
including the generic label. This is authorization to use pricing, not proof
that every generic Agave parryi is botanically truncata or a confirmation of
stock/availability. Carry that pricing basis in the internal handoff.

Chris's explicit additional pricing authorization (2026-09-17): use the
supported Purple Pixie price for unspecified dwarf loropetalum at the requested
size, retaining the dwarf demand without claiming cultivar identity. Resolve
identity later; no shared note is needed for that pricing basis. This is pricing
permission only, not stock evidence, substitution selection or an exact AR mapping.
Other pricing proxies still require explicit authorization.

Chris's rose-pricing preference (2026-09-17, JR-61): rose color does not
matter for quoting; match the requested size and use supported rose pricing.
For a named rose series, prefer its same-size generic/color-unspecified listing
(e.g. White Drift Rose 3 G may use Rose Drift 3 G pricing) without another
color approval. Retain original requested identity and color in demand context;
this is pricing permission, not a global rewrite of customer demand, a claim
of color-independent stock, or an exact supplier AR mapping. Keep the basis
internal, not in shared quote notes. Do not use this permission to silently
change size or materially different rose form/series; clarify if competing
price bases would materially change the quote.

A known species, cultivar, size or form difference remains a genuine alternative.
Search rank, a shared genus or an unsupported guess is not likely equivalence.
Do not generalize the Agave example to arbitrary omitted cultivars. Where
identity evidence is insufficient/conflicting, retain the gap and ask Chris;
use the alternative-note and action-specific quote/AR gates for actual
substitutions. Pricing permission never establishes an exact AR mapping:
`supplier-coordination` still verifies the requested plant and size independently.

## Report evidence

Return the useful matches: supplier, plant/cultivar, size, listed price and
relevant source date/location. A published stock count is what the list said
then, not a current reservation or confirmed supply. Unknown/zero prices
are unpriced; do not invent a price.

When Chris asks to look for a supplier, **answer him first in the original
request conversation** with the options and evidence. This applies even when
the search relates to an existing job. A supplier lookup alone does not
authorize outreach, an AR or sourcing-note entries, and must not trigger the
ordinary-job APS availability workflow.

For jobs, also return inventory UUIDs and findings to the owning `jr-<id>`
thread as research context. `job-requests` section 3 owns the Chris-approved
simpler notes standard: customer-origin requests in customer notes, brief
customer-facing exceptions in shared notes, only additional current internal
decisions/exceptions in sourcing. No mandatory APS entry on every row or dual
summary/supplier boilerplate. Report all research findings in chat; retain
necessary proxy/cultivar/source qualifications, material supplier comparisons
and actual unresolved decisions without duplicating prices/statuses. Job-wide
context belongs once at accessible job level. Blank sourcing is valid when
no additional fact is needed and selection/provenance remain clear elsewhere.
No candidate changes the requested offering or authorizes outreach. Confirm
with Chris in the original request chat before quoting an alternative or
creating/sending an availability request for it; obtain approval for each
intended action. Other research-only findings stay in chat. Do not replace a later
supplier answer with a catalogue listing. Standalone questions create no job.
Keep SQL and internal tooling out of Chris's response.
