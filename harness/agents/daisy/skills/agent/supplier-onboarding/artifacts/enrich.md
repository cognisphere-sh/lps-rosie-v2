## 3. Enrich the row

- **Via the browser** (`scripts/agent/agent-browser`): google the supplier; find
  their **website** (store as a bare domain, e.g. `acostafarms.com` — the UI
  prepends `https://`), full **address / city / state / zip**, **phone**, and
  **latitude / longitude** (read coords off their Google Maps listing or geocode
  the address). UPDATE the row with what you confirm — **never invent values you
  couldn't verify.**
- **Subscribe to their availability newsletter — best effort** (Bhoumik,
  2026-08-20). While on their website, look for an availability / price-list
  newsletter signup (footer form, "join our mailing list", Mailchimp/Constant
  Contact embed). If found, subscribe with Daisy's email
  **`chris.r@localplantsupply.com`**: check a required marketing-consent box,
  complete ordinary fields, attempt a CAPTCHA the browser can normally solve.
  Record the terminal outcome — subscribed, held for a human (with the exact
  URL and blocker), or technical failure — never a bare "form found". Hand it
  to a human only after the attempt fails.
- **Record how their availability reaches us.** Three columns on `suppliers`
  capture it, and each is filled only from something you actually saw:
  - `availability_source_type` — `'Email'` when they send the list (a drop
    landing in the inbox is proof), `'Hosted'` when it lives on a page you
    fetched. A supplier can be both; record the one this drop came through.
  - `hosted_availability_url` — the page a hosted list sits on, when there is one.
  - `availability_update_days` — how often it refreshes, in whole days (7 =
    weekly), **only when the supplier states it** ("updated every Monday", "new
    availability weekly", a dated page footer). Never infer it from two drops
    happening to fall a week apart.

  Leave any of them null when you don't know — null means "not established yet",
  and a guess sends someone chasing a list that isn't there. For an existing
  supplier, fill a null column when a drop reveals it; don't overwrite an
  existing value without evidence it changed.

- **Note a plant-photo gallery; never download one.** Suppliers' sites often
  carry photographs of their stock. **We only hold photos someone hands us** —
  an image on their page stays on their page, and what we keep is the link.
  **Record the gallery's URL in your report** and move on. (`plant_photos` is
  for attached files; [availability-ingestion: photos](../../availability-ingestion/artifacts/photos.md) has the full rule and where a
  per-plant URL lands.)

Do the same enrichment and newsletter check for an **existing** supplier whose
row is missing website/address/coords — don't re-subscribe if their notes say
it's already done.
