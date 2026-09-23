---
name: quote-generation
description: Render customer-safe quotes with decimal calculations. Includes text renderer and shared-note rules. Use for quick quotes, quote copies and customer delivery drafts. (v3.1.0)
metadata:
  author: lps
  version: "3.1.0"
---

# Quote generation

1. Follow `job-requests` intake before any quote/partial draft: the job, thread
   and supplied item rows must exist. A price lookup creates none. Committed
   intake or accepted quotes go directly to orders unless a quote copy is asked
   for; never reprice accepted terms.
2. Save supported offerings and customer prices first. `job-requests` owns
   pricing precedence, manual APS inputs and requested-option selection;
   `plant-and-supplier-search` owns evidence and approved pricing proxies.
   Resolve material uncertainty before the affected quote. Alternatives need
   Chris's action-specific quote approval, including internal drafts.
3. Read [shared notes](artifacts/shared-notes.md) only when preparing/changing
   `external_notes`. Keep original demand/phases in customer context and internal
   decisions in sourcing. Each quoted row names one actual offered plant/size;
   a pricing proxy retains requested identity. Never render internal notes.
4. For the default format run [the renderer](artifacts/rendering.md):

   ```sh
   skills/agent/quote-generation/scripts/render-quote --input /tmp/quote.json
   ```

   It validates persisted IDs and required values, computes decimal totals and
   emits the copyable block. It performs no database reads, approvals or sends.
   Supply current verified rows; a local ID is not proof of persistence. Fix
   rejected values from evidence. Do not silently drop unpriced lines. If Chris
   explicitly requests a different format, use [format rules](artifacts/text-format.md).
5. Return the draft to the original request chat. Quick-quote work stops here:
   no AR or availability approval ask. Ordinary availability work returns to
   `job-requests`; an accepted quote can move directly to an order.
6. Customer delivery belongs to `customer-coordination`. Send the complete
   draft, recipient, attachments and origin to that owner; `message-routing`
   obtains any required approval. Only verified customer delivery records
   `quote_shared` and the shared link; drafts and failed sends do not. Pricing
   never establishes stock, supplier confirmation or customer commitment.
