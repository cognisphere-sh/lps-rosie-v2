---
name: text-quote-format
description: Format a concise plain-text plant quote from a confirmed, priced job request. Covers customer-safe source selection, one-line item formatting, subtotal calculation and validation, and the Chris-approval gate before customer delivery. Use when drafting a quote as plain text for internal review or a customer after approval. (v1.0.1)
metadata:
  author: rosie
  version: "1.0.1"
---

# Plain-text quote format

Use this skill only after the source item data is priced and confirmed under the `job-requests` rules. A catalogue listing alone is not confirmation.

## Draft the quote

1. Read the current request and item rows. Use only customer-safe fields: requested or customer-approved item name, customer-facing size/form, quantity, and unit price. Do not include supplier names, supplier pricing/listings, `sourcing_notes`, internal messages, or other internal fields.
2. Confirm every line included has a valid quantity and unit price. Calculate each line extension as `quantity × unit price`, then calculate the subtotal as the sum of those extensions. Use decimal currency math and validate the subtotal before sharing the draft.
3. Put one item on each line in this exact general shape:

   ```text
   25 x 5 G Iceberg Rose | $27.00
   ```

   - Use `x` between quantity and size/form.
   - Put the customer-facing plant/item description after the size/form.
   - Show the unit price to exactly two decimal places with `$`.
   - Do not add supplier information, sourcing commentary, availability claims, or a line total unless explicitly requested and customer-safe.
4. Put exactly one blank line between the final item line and the subtotal:

   ```text
   25 x 5 G Iceberg Rose | $27.00

   Subtotal: $9026.70
   ```

   Format the subtotal with `$` and exactly two decimal places. Do not label it as tax, delivery, or a grand total unless those values are explicitly approved and included.

## Approval and delivery

This output is an internal/customer draft. Before any customer send, follow the applicable `job-requests` customer-contact process: Chris must explicitly approve that specific draft. Until then, keep it internal and do not email or otherwise contact the customer unbidden.
