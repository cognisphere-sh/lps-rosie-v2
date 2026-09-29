# Enrich a supplier

Use `scripts/agent/agent-browser`. Write only what you confirmed.

- **Website** as a bare domain (`acostafarms.com`); **address, city, state,
  zip, phone** (phone → the main-line contact); **latitude/longitude** from
  their Google Maps listing or by geocoding the address.
- **Availability newsletter** (Bhoumik, 2026-08-20): look for a signup form
  (footer, "join our mailing list", Mailchimp/Constant Contact). Subscribe
  `chris.r@localplantsupply.com`: tick a required consent box, fill ordinary
  fields, try a CAPTCHA the browser can solve. Record the result: subscribed,
  held for a human (exact URL and blocker), or technical failure. Hand it to a
  human only after trying. Don't re-subscribe if `suppliers.notes` says done.
- **How their list reaches us**, only from what you saw:
  - `availability_source_type`: `Email` (they send it) or `Hosted` (a page you
    fetched);
  - `hosted_availability_url`: that page;
  - `availability_update_days`: only when they state it ("updated every
    Monday" → 7). Never infer it from two drops a week apart.
  Unknown → NULL. Fill a NULL when a drop shows it; change a set value only
  with evidence.
- **Photo gallery on their site:** record its URL in the report; never
  download the photos (`plant-photo-catalogue`).
- Existing suppliers missing website/address/coordinates get the same
  enrichment when you are working on them.
