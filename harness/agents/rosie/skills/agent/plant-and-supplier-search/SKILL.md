---
name: plant-and-supplier-search
description: Find plant prices and supplier listings. Includes the aps-price helper (all sizes, nearest smaller/larger, rules, aliases), name matching, web research for other plant names, aliases, other-supplier search and how to report prices to Chris. Use for price questions, pricing job lines or finding suppliers. (v3.4.1)
metadata:
  author: lps
  version: "3.4.1"
---

# Plant and supplier search

1. Follow [search](artifacts/search.md): run `aps-price`, check the match,
   apply `knowledge/files/price-rules.md`.
2. Price from APS (supplier 1) unless Chris names another supplier. Prices
   Chris gave or the customer accepted always win.
3. Research alone creates no job, AR, order or message.

## Reporting a price to Chris

- Lead with the answer: `Giant Hesperaloe 15 G — $125`.
- Requested size not listed: say so and give the nearest smaller and larger
  listed sizes with prices, on that line: `7 G not listed; 5 G $39.95, 15 G
  $165`. If one side doesn't exist, say which.
- Don't add "availability not confirmed" or similar to price answers. Mention
  stock only if Chris asks about stock.
- Mention an identity or size difference only when it changes the answer.
- In a job, the job thread saves prices and the notes
  (`job-requests` → pricing). Keep SQL and tool names out of the reply.
