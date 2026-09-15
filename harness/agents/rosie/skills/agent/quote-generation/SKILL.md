---
name: quote-generation
description: Produce quick inventory quotes and customer-ready text, HTML or PDF quotes. Covers job/item creation and independent pricing work before clarification, order clarification before generation, APS price-list quoting first and Chris approval before any availability request, smallest-priced-requested-size quoting, minimal-word inline text-quote notes from existing shared notes and size/price options, likely equivalent catalogue-name pricing, mandatory APS job-row notes and approval-gated alternatives, mandatory job/item intake before any quick-quote output, the exact default quantity/size/plant/unit-price/line-total text format in a copyable code block, the approved APS template, customer-safe fields, rendering and delivery handoff. Use when Chris asks for a quote, quick quote, text quote or quote document; quick quotes create/reuse a job and item rows without an AR; simple pricing questions create neither. (v2.19.0)
metadata:
  author: lps
  version: "2.19.0"
---

# Quote generation

This is the single quote procedure, including the default text format.
`job-requests` owns job data and lifecycle; `customer-coordination` owns
customer delivery; `message-routing` owns any required approval routing.

## 1. Select the quoting path

Before generating any quote, follow the intake guidance in `job-requests`:
create/reuse its job/thread and item rows from supplied details, gather
pricing and other relevant information, and save supported prices. Add
sourcing notes only when `job-requests` section 3 permits them: a sent AR,
a concrete required supplier action, Chris's explicit note instruction or an
explicit supplier selection/plant-sourcing decision. Chris's standing APS
instruction in that section requires compact current snapshots on every
APS-scoped job item, including quick quotes. Follow its one-supplier-entry
and single-row-outcome format; replace superseded prices instead of appending
quote history. Include the supported price or gap, plus 1–2 closest supported
APS alternatives for gaps when found. Preserve requested lines and label
candidates `Alternative · Chris approval pending`; never invent alternatives
or overwrite a requested-line price with an unapproved candidate price.
Apply `plant-and-supplier-search` to likely same-plant naming equivalents
before treating a match as a candidate: use the supported applicable price
directly, retain the requested name and record a quick catalogue-name mapping/
evidence note in sourcing. No alternative label, substitution approval or
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
- **Ordinary new job:** generate the APS price-list quote before any
  availability request. After producing it, the job thread asks Chris whether
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

For clear requested size alternatives (`3 G / 5 G`), follow Chris's standing
rule: use the **smallest requested size with supported applicable positive
pricing**, not the cheapest price or assumed physical stock. No redundant
size-choice approval is needed. Quote that size explicitly; preserve the original
options in the job/customer context and record supported larger requested-size
prices in shared/customer-visible item `external_notes` (without supplier/cost
commentary). Do not add those alternatives as extra quote lines or duplicate
quantity. The default text block contains chosen lines, any applicable brief
inline notes and the subtotal; larger-size options belong in the item's note,
not extra priced demand lines. If no
requested size has a supported price, keep the gap and follow alternative gates;
never select an unrequested size or invent price/stock. Explicit allocations or
conflicting requirements still take precedence and may need clarification.

Quotes contain the requested/approved offered plant, size, customer price
and (when required by the chosen format) quantity. Never copy sourcing notes,
supplier comparisons, supplier cost commentary, internal agent messages or
unapproved substitutions. Keep original plant order unless instructed
otherwise. Keep source pricing evidence in the internal chat and, only when
the sourcing-note rule applies, the qualifying supplier entry. Do not include
it in customer-facing quote rows.

### Minimal-word quote notes

Chris's instruction (2026-09-11): keep quote notes as brief as possible.
This applies to customer-visible quote comments, shared size-option notes and
text/HTML/PDF quote notes, not unrelated operational notes.

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
  Do not remove a material substitution or caveat merely to shorten a note.
- Retain material qualifications such as unconfirmed availability or excluded
  tax/delivery; shorten wording, never remove necessary meaning. Do not alter
  approved template branding/layout or imply approval/availability from brevity.
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

## 3. HTML / PDF quote

For a compact HTML table to copy into Gmail, follow `html-quote` for its
email-safe template, copy controls, private preview and downloadable HTML.
This skill still owns intake, pricing/offer approval and customer-safe notes;
the email table does not replace the approved APS document template below.

Use `artifacts/austin-plant-supply-modern-quote-template.html` (relative to
this skill) for an APS document. Preserve its approved branding, logo and
print layout. Do not substitute the old APS or legacy LPS templates. A new
visual template needs Chris's review of the rendered result before first use.

1. Fill the template placeholders (`DATE`, `QUOTE_NUMBER`, customer/address,
   ship-to, item rows, total, notes) with customer-safe data and HTML escaping.
   Quote numbers use `JR<id>-<YYYYMMDD>`, including quick quotes: their
   job/thread is created before the document.
2. One row per included item. Gallons display as `G`. Document quantities
   and unit prices must be known before calculating line totals. Use decimal
   currency arithmetic and verify the sum. Job `total` is generated from
   requested quantity × customer unit price, never `available_quantity`.
3. Make an approved offered plant/size difference clear using the row and,
   only when necessary, a minimal customer-safe note. Do not add `Quoted for`
   or repeat an evident selection; retain necessary questions or distinctions
   under the minimal-word rule above. A catalogue spelling difference alone
   needs no note. Missing address fields stay visibly blank.
4. Write HTML to the thread's files, render PDF with
   `scripts/agent/agent-browser`, and verify page breaks, content and totals.
   Upload final files through `scripts/agent/supabase/upload` to
   `lps/rosie_shared/YYYY-MM-DD/`, obtain a link with
   `scripts/agent/supabase/sign-url`, and use the artifacts plugin when a
   live HTML link is requested. Treat published files as customer-visible.

## 4. Approval and delivery

Returning a requested draft/price quote to Chris is internal work; it is not
permission to deliver it to a customer. If customer delivery is requested,
hand the complete draft, recipient, attachments/links and interaction context
to the customer's thread. Follow `message-routing` for any required
approval in the original request thread. The customer thread sends exactly the
approved content and logs the actual contact.

For a job, only actual customer delivery triggers `quote_shared` and records
the shared link in customer-visible job notes. This keeps an initial job at
Quote, leaves Availability/Committed unchanged, and never reopens Won/Lost.
A quote draft does not confirm
an order; actual customer acceptance creates **Committed** supplier orders
through `job-requests`. Supplier confirmation makes an **Order Confirmed**;
the **Job Request remains Committed** and has no Confirmed stage.
