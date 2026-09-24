### Multiple requested options: standing quote rule

Chris's instruction (2026-09-15): for alternatives such as `3 G / 5 G`, quote/
use the price of the **cheapest supported requested option**, not the smallest
size, an assertion of physical stock or an unrequested option. Search every
requested option, skip options without a supported positive price, and use the
lowest supported price directly. Do not ask Chris to choose again unless the
instruction conflicts with an explicit allocation, plant identity or another
material requirement. No priced requested option means a price gap, not
permission to choose an unrequested option.

For an already accepted offering, preserve its selected size and price; this
quote-selection rule does not authorize changing committed order terms.

Preserve the original requested alternatives in the item demand/customer context
when recording the quoted size/variant and price. Put every other supported
requested-option price in shared/customer-visible item `note_for_customer`, e.g.
`5 G $25.00`. The item `name` and `size` are the customer-facing **quoted
offering**, so each must hold exactly the one actual quoted plant and size—never
an `or` list or source proxy name. An explicitly approved pricing proxy does
not relabel the requested offering or establish cultivar identity. Record its
basis internally, not as a shared substitution note. For actual approved
offering differences (plant, cultivar/variant, size or quantity), keep only the
necessary short exception in `note_for_customer`; follow `quote-generation` for
the canonical customer-useful outcome rule and confirmed-evidence-only
availability wording. Report unpriced options to Chris and track the gaps
internally; do not add a pricing-only caveat to customer notes. No phase labels, pricing-identity explanations,
supplier names or price-sheet references belong in notes for customer. Preserve
phases in customer/original-demand context and separate output grouping. Preserve the original
demand in `note_from_customer`; do not silently rewrite it. Use actual prices only,
without internal supplier/cost commentary or availability claims. State the
chosen quoted option clearly and include every other supported requested-option
price; no extra demand rows or duplicated quantities. An unrequested option
remains an approval-gated alternative. This rule authorizes quote sizing/pricing
only: supplier AR scope must still respect the original requested alternatives
and total quantity unless separately resolved.
