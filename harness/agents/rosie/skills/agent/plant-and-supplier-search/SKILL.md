---
name: plant-and-supplier-search
description: Find plant prices and supplier evidence. Includes scoped RPC search, identity/proxy rules and reporting. Use for lookups, quote sourcing or missing order prices. (v2.18.0)
metadata:
  author: lps
  version: "2.18.0"
---

# Plant and supplier search

1. Read the needed schema through `database-access` and [search](artifacts/search.md).
   Daisy owns inventory/alias/supplier corrections; report problems to her.
2. Use APS (supplier 1) for job pricing unless Chris explicitly selects another.
   General all-supplier research is allowed when asked, but authorizes no quote,
   AR, order or outreach. Preserve supplied/accepted and explicit manual prices.
3. For naming ambiguity or proxy pricing, read
   [pricing equivalents](artifacts/pricing-equivalents.md). For requested size
   options use `job-requests` → requested options. Genuine alternatives need
   action-specific quote/AR approval; supported pricing is not availability.
4. Return [evidence](artifacts/report.md) in the original chat. Keep queries
   scoped with explicit columns/limits; widen only when the evidence needs it.
   Research does not create a job. `job-requests` owns writes and can retain
   useful progress in an existing job's or item's internal notes.
