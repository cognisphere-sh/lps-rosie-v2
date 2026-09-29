# Research an eligible supplier

Record for each: id, name, website, active contact emails, Texas-service
evidence, and every URL/message checked.

## A. 2026 email

`scripts/gws/email search 'in:anywhere after:2025/12/31 before:2027/01/01 from:<contact email>'`
(one contact at a time; a bounded `@domain` search if the domain is theirs)
with terms like availability, avail, price, price list, inventory. Open real
hits with `scripts/gws/email read`. Notifications and marketing aren't
evidence. Record message id, thread id, date, sender, usable or not.

A real 2026 list → "email availability found"; report it. Forward it to the
supplier's own thread for `availability-ingestion` only if it was never
processed. The coordinator never writes inventory itself.

## B. Public website

Normal public pages only (no logins, guessed URLs or gates). Look for
availability, inventory, price list, catalogue/download or newsletter pages;
record each URL and what it shows.

A public list — even static or undated — is loaded **once as a search
placeholder** (Chris, six times 2026-07-31 → 08-24: "use the hosted as a
placeholder"): send it to the supplier's thread as a manual current receipt
with the retrieval time, exact URL/file, location evidence and the
"confirmation needed" caveat. Before sending, compare the URL's date, headers
or hash with what is already recorded; unchanged → skip (Chris 2026-07-29:
don't spend on re-reading a static list). Record the source ids that thread
reports. Don't send when the supplier's scope/location is unclear, or when
Chris gave a supplier-specific instruction (e.g. County Line: "sign up and
wait").

## C. Newsletter

Every form found ends in one recorded result: `subscribed`, `held-human`
(exact URL and blocker) or `technical-failure` (URL and reason). Subscribe
`chris.r@localplantsupply.com`; tick a required consent box, fill ordinary
fields, try a solvable CAPTCHA. Hand to a human only after trying. Don't
repeat a failed submission; never resubscribe.

## D. No form: one unsent draft

Only if there is no signup form and there is a verified active contact email.
Search existing drafts/state first and reuse rather than duplicate. One
plain-text Gmail draft to that contact, no signature block or footer:

```
Hi <Name or "there">,

I'm Chris with Local Plant Supply. We'd love to keep up with what you have
available. Is your website the best place to check, or do you send a list by
email? And who's the best person to ask?

Thanks,
Chris
```

(Bhoumik's sample 2026-08-19 and Chris's "don't sound like AI data capturing
robots", 2026-08-17.) Store draft id, recipient, subject and body in run
state. No safe recipient → no draft; report it.
