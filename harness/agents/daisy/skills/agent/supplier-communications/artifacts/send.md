## Chris's email style

Chris rejected a draft as "too wordy" (2026-08-20) and rewrote it. Match his
shape whenever you draft to a supplier: **two to three short, casual lines**, a
concrete question, no preamble or fluff, no restating what they already know —
and **don't mention Texas to a supplier that serves nowhere else**. Assume the
supplier knows what's being asked.

## The Sales & Use Tax permit

Chris stored the **LPS Texas Sales and Use Tax permit** (2026-08-20; `lps`
bucket, `business-documents/local-plant-supply-texas-sales-and-use-tax-permit.pdf`)
to attach to onboarding / account-creation emails: it adds credibility and some
accounts require it. Attach it only on a reviewed, approved send — an attachment is
never a reason to skip the draft-and-approve step.

## Approved light-touch initial outreach — Texas wholesale nursery only

Chris approved this reusable **initial relationship-outreach** template on
2026-08-21. It is **not an availability-list demand**. Use it only for a
**Texas wholesale nursery**, and only after Chris or Bhoumik explicitly
authorizes contacting that particular supplier; template approval does not
replace the standing no-unbidden-email rule. Keep the approved wording except
for `[Name]`, and use the artifact
[`artifacts/texas-wholesale-nursery-initial-outreach.txt`](texas-wholesale-nursery-initial-outreach.txt):


Follow the composing/sending steps below and [transcript recording](transcript.md) for any authorized use.

## Composing and sending (on the supplier's thread)

1. **Reread the most recent messages in the Gmail thread** so the reply fits the
   latest sender and conversation state.
2. **Draft first, send second.** Put the draft to Chris **on this thread's own
   web panel** (`webchat-cli send`, never `--portal`) and wait for his
   approval of that exact text. This is a minor approval and it belongs here —
   not on `main`, which is for urgent escalations over Telegram only.
3. Send **as Chris** (not Daisy), with Chris's approved signature. When including
   the approved transparent LPS logo, render it **250px wide** so it roughly
   matches the width of "Chris Runyon".
4. Keep it plain-text and short.
5. **Reply in the same Gmail thread** — never start a new thread for an existing
   topic.
6. Record the contact with [transcript format](transcript.md) in the same task.
7. The quoted send on this thread's panel (step 6) is the report — `main`
   hears nothing about a routine exchange.

Sending as Chris rather than Daisy is Chris's instruction (2026-07-14); the
250px logo width is his correction of 2026-07-25.

### How the supplier's reply comes back

**Don't add `gws` routing rules from this thread** — rule management is the
`router` thread's job ([supplier-email-routing: routes](../../supplier-email-routing/artifacts/routes.md): it keeps the catch-all
last, since first matching rule wins and `routes add` appends). The reply
reaches this thread either as the router's forward or directly, when a rule
already routes this supplier's sender here.

**A reply is direct communication, so it is quoted in full to this thread's
web panel** the moment it lands — subject as a Gmail link, sender, complete
text — and a short numeric close goes up when you have dealt with it
([transcript format](transcript.md)). Internal: **no
`--portal`**, or the supplier reads the team's notes about them.
