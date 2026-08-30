# Make plain-text quotes ready to copy and send

- Status: shipped
- Route: rosie
- Raised: 2026-08-29 by Chris (via rosie, JR-27)
- Updated: 2026-08-29

## Problem

The current plain-text quote output is not immediately usable by Chris: it omits line totals and can include agent commentary. Chris needs to copy the quote directly from Rosie and send it on, without reformatting or stripping explanation.

## Evidence

- 2026-08-29 feedback log, **Copy-ready quote output**: Chris called the format “terrible format, no utility” and explicitly requested quantity, size, plant, unit price, line total, and subtotal at the bottom, with no agent commentary.
- Rosie's current `text-quote-format` skill (v1.0.1) shows quantity/size/plant and unit price but says not to add a line total unless explicitly requested. Chris has now explicitly requested it.

## What it should do

When Rosie produces a plain-text quote for Chris to copy and paste, output only the quote itself: one line per item with quantity, size, plant, unit price, and line total; then the subtotal as the final line after one blank line. Do not prepend or append explanation, labels addressed to Chris, sourcing or availability commentary, or any other agent text.

## Acceptance criteria

- Every quoted item line contains quantity, size, plant description, unit price, and its quantity-times-unit-price line total.
- The subtotal is calculated from the displayed line totals and appears last, after exactly one blank line.
- The copy-ready output contains no commentary before or after the quote.
- Customer-safe field and Chris exact-draft approval rules remain unchanged.

## Out of scope

- Changing how prices or availability are confirmed.
- Sending a quote to a customer without Chris’s approval.
- HTML/PDF quote formatting.

## Assumptions

- A clear, simple delimiter or aligned plain-text columns may be used so long as all required values copy cleanly and no commentary is mixed in.

## Open questions

None.

## Handoff log

- 2026-08-29 — Routed to Rosie to update her `text-quote-format` skill. Chris’s direct correction is approval for this skill-format change.
- 2026-08-29 — Rosie confirmed `text-quote-format` v1.0.2 shipped: required validated line totals and commentary-free copy/paste output are in place; customer-safe checks and exact-draft approval remain intact.
