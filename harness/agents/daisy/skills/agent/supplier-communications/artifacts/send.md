# Drafting and sending supplier email

## Style (Chris)

- Two or three short, casual lines with one concrete question. No preamble,
  no restating what they know, no "updating our records" or "supplier
  directory" talk; don't sound like a data-collection bot. ("too wordy",
  2026-08-20; "we dont want to sound like AI data capturing robots",
  2026-08-17.)
- Don't mention Texas to a supplier that only serves Texas.
- Say "plants" and "available inventory", not "offerings".
- **Never** add the "Keep me in To / if you need a reply" footer or any
  internal line (Chris 2026-07-15, Bhoumik 2026-07-15 and 2026-08-19).

Approved first-contact template for a Texas wholesale nursery (Chris,
2026-08-21), only after Chris/Bhoumik authorised contacting that supplier;
change only `[Name]`: [texas-wholesale-nursery-initial-outreach.txt](texas-wholesale-nursery-initial-outreach.txt).

## Steps

1. Re-read the latest messages in the Gmail thread.
2. Post the exact draft on this supplier's panel (`webchat-cli send`, never
   `--portal`) and wait for Chris's or Bhoumik's yes to that text. Not on
   `main`.
3. Send as Chris with his approved signature. The transparent LPS logo is
   250 px wide (Chris, 2026-07-25). Plain text.
4. Reply in the same Gmail thread (`gws gmail +reply --message-id …`); never
   start a new thread for an existing topic.
5. Attach the LPS Texas Sales and Use Tax permit
   (`lps` bucket, `business-documents/local-plant-supply-texas-sales-and-use-tax-permit.pdf`)
   to onboarding/account emails when approved; it never replaces approval.
6. Not sure it went? Check `scripts/gws/email search 'in:sent newer_than:1d'`
   before resending.
7. Post the sent text to the panel ([transcript](transcript.md)). That is
   the report; `main` hears nothing about a routine exchange.

Replies come back through the router or a direct route. Don't add Gmail
routing rules from a supplier thread; ask `router`.
