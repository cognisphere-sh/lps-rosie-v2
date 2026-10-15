---
name: quote-generation
description: Produce a copy-ready text quote from a job's saved lines. Includes the quote-job helper, the standard format, the no-totals bid format, the ✅/❌ availability list and partial quotes. Use when Chris asks for a quote, quick quote, bid, availability list or a quote copy. (v4.2.1)
metadata:
  author: lps
  version: "4.2.1"
---

# Quote generation

Only when a quote is asked for. Ordinary requests can go to an AR without a
quote.

1. The job and all its lines must already be saved (`job-requests` →
   intake). A price question needs no quote and no job.
2. Prices and notes come from the saved lines (`job-requests` → pricing and
   notes). A plant or size the customer didn't ask for is quoted only when
   that candidate is selected (by Chris, or by his standing selection rule);
   don't ask. Never reprice accepted
   terms.
3. Render with `skills/agent/quote-generation/scripts/quote-job <jobId>`
   and the right [format](artifacts/format.md) variant. It reads the saved
   rows and does the math. It doesn't approve or send anything.
4. Post the block in the origin chat. Quick quote: stop here, no AR offer.
5. Sending it to the customer is `customer-coordination` (needs Chris's
   approval). Record `quote_shared` only after the customer actually got it.
   Quote files for sharing go in storage under `lps/rosie_shared/YYYY-MM-DD/`
   (`database-access` → storage); scratch files go in `/tmp`.

A quote says nothing about stock, supplier confirmation or customer
commitment.
