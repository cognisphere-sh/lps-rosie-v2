---
name: quote-generation
description: Produce quick inventory quotes and customer-ready text, HTML or PDF quotes. Covers job/item creation and independent pricing work before clarification, order clarification before generation, APS/named-supplier pricing without availability requests, the exact default size/plant/unit-price text format in a copyable code block, the approved APS template, customer-safe fields, rendering and delivery handoff. Use when Chris asks for a quote, quick quote, text quote or quote document; quick quotes create a job/thread without an AR; simple pricing questions create neither. (v2.3.0)
metadata:
  author: lps
  version: "2.3.0"
---

# Quote generation

This is the single quote procedure, including the default text format.
`job-requests` owns job data and lifecycle; `customer-coordination` owns
customer delivery; `message-routing` owns any required approval routing.

## 1. Select the quoting path

Before generating any quote, follow the intake guidance in `job-requests`:
create/reuse its job/thread and item rows from supplied details, gather
pricing and other relevant information, and save supported prices and
sourcing updates. Complete every authorized action that does not depend on
clarification before asking; an unresolved detail must not delay independent
record creation or updates. Post completed work, findings and remaining gaps
to the requester. You may ask any clarifying question about the order, including
for a quick quote. Resolve remaining uncertainty that affects the quote
before generating it; continue research and preparation for unambiguous
lines while waiting. Do not ask again for supplied details or require fields
the requested format does not need (for example, quantity for a unit-price
text quote). A clear request needs no extra clarification.

- **Quick quote:** create a job and its `jr-<id>` thread through
  `job-requests` intake, or reuse the existing job. Carry `quote_only: true`.
  Use APS inventory or the explicitly named supplier through
  `plant-and-supplier-search`. Do not create/send an AR or contact suppliers.
  Inventory pricing is enough; supplier-confirmed availability is not
  required. Record completed pricing through the `job-requests` hook to move
  Active → Quote, even for a no-match lookup. Quick quotes skip the job’s
  Availability stage. Keep item availability pending; do not imply a reservation.
- **Simple price lookup/general question:** answer using the same search
  evidence without creating a job or AR. Do not interpret a pricing question
  as a quick-quote request when the intent is unclear.
- **Existing job:** read its current rows and recent changelog. A quick quote
  for that job also skips ARs; record completed pricing through the job hook.
  Ordinary job quotes use the selected offering and customer-facing price;
  clearly resolve material unconfirmed substitutions or missing prices with
  Chris before treating them as a firm offering.
- **Unknown identity, size or price:** do not guess. Investigate first, then
  clarify remaining gaps while preparing unambiguous lines. Keep unsupported
  lines out of a final priced quote and state that gap separately to Chris.

Quotes contain the requested/approved offered plant, size, customer price
and (when required by the chosen format) quantity. Never copy sourcing notes,
supplier comparisons, supplier cost commentary, internal agent messages or
unapproved substitutions. Keep original plant order unless instructed
otherwise. Source pricing evidence belongs in internal notes, not each
customer-facing quote row.

## 2. Default text quote

Present the complete text quote inside a fenced code block using triple
backticks and the `text` language tag, ready to copy. Include only the quote
in that block; any explanation or question for Chris belongs outside it.
Apply this rule to any other text prepared for copying, including message
drafts, and to text quotes with a custom format.

Unless Chris specifies another format, output **one line per size/plant,
unit price only**, in this exact shape:

```text
15 G Wax myrtle — $105.00
15 G Mountain laurel — $175.00
30 G Mountain laurel — $375.00
15 G Arizona cypress — $165.00
30 G Arizona cypress — $395.00
5 G Carolina jasmine — $30.00
3 G Texas sage — $21.00
5 G Texas sage — $25.00
3 G Red yucca — $21.00
5 G Agave — $22.00
5 G Twisted yucca — $22.00
5 G Pale leaf — $27.00
1 G Cactus/succulents — $14.00
3 G Golden Barrel — $45.00
```

These are formatting examples, **not a price list**. Fetch actual prices.
Use `G` for gallons, one space between size and name, a spaced em dash
(` — `), `$` and exactly two decimal places. Preserve meaningful non-gallon
size/form specifications rather than converting them without evidence.
No heading, quantity prefix, `x`, pipes, line totals, subtotal, commentary or
supplier names in the quote block. Only an explicit format instruction
changes this. Quantity is not required for a unit-price text quote.

## 3. HTML / PDF quote

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
3. Show a customer-safe note when an approved offered plant/size differs:
   `Quoted for Muskogee Crape Myrtle 30 G.` A catalogue spelling difference
   alone needs no note. Missing address fields stay visibly blank.
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
the shared link in customer-visible job notes. This advances Active → Quote,
leaves Availability/Confirmed unchanged, and never reopens Won/Lost.
A quote draft does not confirm
an order; actual customer acceptance triggers `customer_confirmed` through
`job-requests`.
