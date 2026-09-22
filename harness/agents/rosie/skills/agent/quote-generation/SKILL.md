---
name: quote-generation
description: Produce quick inventory quotes and customer-ready text quotes. Covers job/item intake, independent pricing before clarification, supplied/accepted-price preservation, APS fallback, optional availability and direct-order handoff, lowest-priced-requested-option quoting, concise shared notes, naming equivalents, minimal internal exceptions and approval-gated alternatives, Chris-directed APS manual prices/sizes/notes, the default quantity/size/plant/unit-price/line-total text format in a copyable code block, customer-safe content and delivery. Use for requested quotes, quick quotes or text quotes; already committed requests need no new quote, quick quotes stop without an AR, and simple pricing questions create no job. (v3.0.0)
metadata:
  author: lps
  version: "3.0.0"
---

# Quote generation

This is the single quote procedure, including the default text format.
`job-requests` owns job data and lifecycle; `customer-coordination` owns
customer delivery; `message-routing` owns any required approval routing.

## 1. Select the quoting path

First check the current request's intent using `job-requests`. Already committed
orders and existing accepted quotes may go directly to an order without an AR
or a fresh quote document. Route that work to its direct-order procedure; do
not start quote generation or ask about availability merely because intake
initially stores `status = 'quoted'`. If a quote copy is separately requested,
render the supplied/accepted offering and prices without repricing it.

Before generating any quote, follow the intake guidance in `job-requests`:
create/reuse its job/thread and item rows from supplied details, gather
missing pricing and other relevant information, and save supported prices.
Preserve applicable supplied/accepted line prices; use APS for missing prices
under `job-requests` section 4. While APS is exclusive, treat an explicit
Chris-directed manual price, size or supplier-useful note as the APS input for
its stated quote/AR scope rather than replacing it with a catalogue lookup.
Persist it through `job-requests`; a price/proxy remains internal pricing evidence,
not supplier confirmation, cultivar proof, availability or an unrequested offering. Add
sourcing notes only when `job-requests` section 3 permits them: a sent AR,
a concrete required supplier action, Chris's explicit note instruction or an
explicit supplier selection/plant-sourcing decision. Eligibility is not a
requirement to duplicate information: Chris's simpler default removes mandatory
APS notes on every row and dual summary/supplier boilerplate. Keep additional
current decisions/exceptions only, preserving necessary source/proxy evidence,
material supplier comparisons and pending constraints. Job-wide context goes
once at accessible job level; no duplicate prices/statuses or history. Research
1–2 closest supported APS alternatives for gaps and report them in chat; record
only a material pending decision in sourcing. Preserve requested lines and
label any such candidate as pending action-specific Chris approval; never
invent alternatives or overwrite a requested price with an unapproved one.
Apply `plant-and-supplier-search` to likely same-plant naming equivalents
before treating a match as a candidate: use the supported applicable price
directly and retain the requested name. Record only a necessary material
catalogue-name/proxy qualification in sourcing; routine spelling mappings need
no note when source evidence is accessible elsewhere. No alternative label, substitution approval or
customer-facing substitution comment is needed for a mere likely-equivalent
name difference. Chris explicitly includes Agave parryi truncata priced from
Artichoke Parry’s Agave or generic Agave Parryi at the requested size. Do not
extend this to known differences or unsupported identity guesses; no availability
claim follows from the price.
Return findings in the original request chat. Always obtain Chris's explicit
confirmation to quote the specific alternative before including it in any
quote, partial quote or draft. An internal research price comparison is not
an alternative quote. Approval to request availability for an alternative
does not authorize quoting it, and quote approval does not authorize an AR.
Other research-only findings create no sourcing notes. Complete every authorized action that does not depend on
clarification before asking; an unresolved detail must not delay independent
record creation or updates. Post completed work, findings and remaining gaps
to the requester. You may ask any clarifying question about the order, including
for a quick quote. Resolve remaining uncertainty that affects the quote
before generating it; continue research and preparation for unambiguous
lines while waiting. Do not ask again for supplied details or require fields
the requested format does not need. A clear request needs no extra
clarification.

- **Quick quote:** **before producing any quick-quote output, including a
  partial quote or draft, create/reuse its job and `jr-<id>` thread through
  `job-requests` intake and create/reuse every supplied item row.** Carry
  `quote_only: true`. Use APS's price list through
  `plant-and-supplier-search`. APS is the exclusive current source unless
  Chris explicitly authorizes an exception. Do not create/send an AR or contact suppliers.
  Inventory pricing is enough; supplier-confirmed availability is not
  required. Record completed pricing through the `job-requests` hook; the job
  starts and remains at Quote even for a no-match lookup. **Stop after the
  quick quote**; do not follow it with an availability-send approval ask.
  Keep item availability pending; do not imply a reservation.
- **Simple price lookup/general question:** answer using the same search
  evidence without creating a job or AR. Do not interpret a pricing question
  as a quick-quote request when the intent is unclear.
- **Ordinary new job needing availability:** generate the APS price-list quote
  before the availability request. After producing it, re-read current intent:
  an accepted quote going directly to order follows `job-requests` without an
  AR or availability approval ask. Otherwise the job thread asks Chris whether
  to send the availability request to APS, and waits for his approval. A
  clear job request authorizes the quote, not portal publication. Preserve
  Chris's existing explicit approval for this exact send without re-asking.
- **Existing job:** read its current rows and recent changelog. A quick quote
  for that job also skips ARs; record completed pricing through the job hook.
  Ordinary job quotes use the selected offering and customer-facing price;
  clearly resolve material unconfirmed substitutions or missing prices with
  Chris before treating them as a firm offering.
- **Unknown identity, size or price:** do not guess. Investigate first, then
  clarify remaining gaps while preparing unambiguous lines. Keep unsupported
  lines out of a final priced quote and state that gap separately to Chris.

For clear requested size or variant alternatives (`3 G / 5 G`) without an
already accepted offering/price, follow Chris's
standing rule: quote the **cheapest supported requested option**, not the
smallest size, an assumed physical stock position or an unrequested option. No
redundant choice approval is needed. Quote that option explicitly; preserve the
original options in the job/customer context and record every other supported
requested-option price in shared/customer-visible item `external_notes` (without
supplier/cost commentary). Do not add options as extra quote lines or duplicate
quantity. The default text block contains the chosen line, any applicable brief
inline note and the subtotal; other supported requested options belong in the
item's note, not extra priced demand lines. If no requested option has a
supported price, keep the gap and follow alternative gates; never select an
unrequested option or invent price/stock. Explicit allocations or conflicting
requirements still take precedence and may need clarification.

Quotes contain the approved offered plant, exactly one actual offered size,
customer price and (when required by the chosen format) quantity. The item
`name` and `size` used for the quote must be that actual offering, not the
original demand, a multi-option `or` list or a catalogue proxy. Preserve the
original customer demand and phase membership in `customer_notes`, not Chris's
quote/pricing selections or approval history. Record only his final/current
decision in `sourcing_notes`, with necessary evidence and pending constraints,
under `job-requests` note ownership; omit intermediate decision/exploration
traces. Whenever the offering differs in plant,
cultivar/variant, size or quantity, retain only a necessary short exception in
customer-visible `external_notes` before rendering, under the minimal-note rule
below. An explicitly approved pricing proxy does not change the offered identity:
retain the requested name, keep the pricing basis internal and defer identity
resolution as Chris instructed. Never copy sourcing notes,
supplier comparisons, supplier cost commentary, internal agent messages or
unapproved substitutions. Keep original plant order unless instructed
otherwise. Keep source pricing evidence in the internal chat and, only when
the sourcing-note rule applies, the qualifying supplier entry. Do not include
it in customer-facing quote rows.

### Minimal-word quote notes

Chris's instruction (2026-09-17): shared notes contain only additional,
customer-useful information not already evident in the row or grouping. Use
short exceptions, not complete explanatory statements; leave NULL when none
is needed. This applies to saved shared notes and text quote notes.

- No phase names in item shared notes. Preserve phases in customer/original-demand
  context and group output separately when requested; never merge phases.
- No pricing-identity explanation, price-sheet reference or supplier name. An
  approved Purple Pixie pricing basis for unspecified dwarf loropetalum is not
  a customer note or cultivar substitution; retain the dwarf demand and resolve
  identity later. Keep the evidence internal.
- Size/color exceptions can be `5 G instead`, `Yellow instead of Red`, or
  `5 G $25.00`. Use `Only 5G available`, `Red NA, only Yellow`, or
  `5G NA, Only 7G` only when actual supplier-confirmed evidence supports each
  availability claim. Missing price-list entries establish neither stock nor
  physical unavailability. For pricing-only gaps use neutral `7 G price pending`
  where useful, never `NA` or `Only ... available`.
- For two requested sizes, quote the lowest-priced supported requested option
  and note the other supported size price. If the other size is confirmed
  unavailable, its brief `NA` note is appropriate; if merely unpriced, use
  neutral `price pending`. Do not infer availability from pricing evidence.

- Where the row or nearby label identifies the plant, list size and price only:
  `30 G $395.00; 45 G $595.00`. For just the larger option: `45 G $595.00`.
  Avoid “Also requested”, “Quoted at” and repeated plant names. These are
  formatting examples, not price evidence; include only supported options.
- Shared/customer-facing notes must not start with `Quoted for ...` or restate
  the quoted selection already evident in the row (Chris, 2026-09-11).
  Omit redundant introductions and selection statements. Keep only necessary
  concise options/questions, e.g. `Does this variety work?` when the row
  identifies the variety and makes the change clear. If the original-versus-
  offered distinction is not otherwise visible, retain the minimum meaningful
  clarification, e.g. `Podocarpus instead of Taxus—OK?`.
  Do not remove a necessary actual-offering distinction or caveat merely to
  shorten a note; a pricing proxy is not an actual substitution.
- Retain material qualifications such as unconfirmed availability or excluded
  tax/delivery; shorten wording, never remove necessary meaning. Do not imply approval/availability from brevity.
- In plain-text quotes, include a brief inline note **only when the item's
  existing shared/customer-facing `external_notes` is nonblank** (Chris,
  2026-09-11). Concisely render that note; do not invent or reconstruct an
  inline note from sourcing notes or chat. If absent, omit the note and its
  extra separator. Place the note after the plant name and before the unit
  price, separated by dashes, as specified below. Explanations
  for Chris remain outside the copyable quote. Do not duplicate a size option
  in both item comments and general notes unless needed for clarity.

## 2. Default text quote

Present the complete text quote inside a fenced code block using triple
backticks and the `text` language tag, ready to copy. Include only the quote
in that block; any explanation or question for Chris belongs outside it.
Apply this rule to any other text prepared for copying, including message
drafts, and to text quotes with a custom format.

Unless Chris specifies another format, output **one line per item**. Chris's
latest correction (2026-09-11): use ` x ` between quantity and size, then a
space before the plant name; follow with dash-separated brief note, unit
price and line total:
`Qty x Size Plant - Brief note - $Unit Price - $Line Total`.
Use a minimal customer-safe note only from the item's existing nonblank shared
`external_notes`; omit redundant content under the rule above. If no shared
note exists, use `Qty x Size Plant - $Unit Price - $Line Total` without an empty
note field or extra separator. Never derive an inline note from internal
sourcing or chat while rendering the quote.
Follow the items with exactly one blank line and the subtotal as the final line:

```text
4 x 15 G Wax myrtle - $105.00 - $420.00
10 x 30 G Mountain laurel - $375.00 - $3,750.00

Subtotal: $4,170.00
```

An item whose existing shared note is `45 G $595.00` uses this shape
(formatting example only):

```text
10 x 30 G Eagleston Holly - 45 G $595.00 - $395.00 - $3,950.00
```

These are formatting examples, **not a price list**. Fetch actual prices.
Use `G` for gallons, ` x ` between quantity and size, one space between size
and plant name, and ` - ` before each following field (optional note, unit
price, line total). No commas separate quantity/size/name. Use `$` and exactly
two decimal places for each monetary value, and a
comma as the thousands separator. Calculate each line total as requested
quantity × customer unit price and verify the subtotal as their decimal sum;
never use `available_quantity`. Preserve meaningful non-gallon size/form
specifications rather than converting them without evidence. No heading,
pipes, internal commentary or supplier names in the quote block; only the
applicable customer-safe inline item notes described above. Only an explicit
format instruction changes this. A line whose quantity or customer unit price
is unknown stays out of a final priced quote and is stated separately to Chris.

## 3. Approval and delivery

Returning a requested draft/price quote to Chris is internal work; it is not
permission to deliver it to a customer. If customer delivery is requested,
hand the complete draft, recipient, attachments/links and interaction context
to the customer's thread. Follow `message-routing` for any required
approval in the original request thread. The customer thread sends exactly the
approved content and logs the actual contact.

For a job, only actual customer delivery triggers `quote_shared` and records
the shared link in customer-visible job notes. This keeps an initial job at
Quote, leaves Availability/Committed unchanged, and never reopens Won/Lost.
A quote draft does not confirm an order. Actual customer acceptance creates a
supplier Order **New** and makes the Job **Committed** through `job-requests`,
with or without an availability step. Reuse accepted prices and job items;
do not restart quoting or require an AR. Supplier confirmation moves the
Order to **Processing**, then **Order Ready**; the Job remains Committed.
