## 3. Per-supplier evidence loop

For each supplier that passed [eligibility](eligibility.md), record supplier id/name, website, active
contact emails, Texas-service evidence, and all evidence/URLs checked.

### A. Search 2026 email, not notifications

Use `search-email` with `in:anywhere after:2025/12/31 before:2027/01/01` and
one known active contact email at a time; where a company domain is established,
use a bounded domain search too. Search likely availability terms (`availability`,
`avail`, `price`, `price list`, `inventory`) and inspect actual hits with
`scripts/gws/email read`, including attachments/links where necessary. A mailbox
notification or an unrelated marketing email is not evidence. Record message id,
Gmail thread id, received date, sender and why it is/is not usable availability.

If an actual 2026 availability drop is found, mark **email availability found**;
do not replay it merely because this cohort found it. Report it for review. If a
newly found, previously unprocessed current drop truly needs ingestion, forward
it to the supplier's dedicated thread (`daisy_thread_id`) to run
`availability-ingestion` with correct classification, not this coordinator's
own SQL.

### B. Review only ordinary public website material

Open the normal public website (not credentials, guessing URL paths, or bypassing
gates). Look for availability, inventory, pricing, catalog/download, dealer or
newsletter pages. Record each exact URL and what it establishes.

A public file/page is usable only when it clearly represents live or current
supplier availability/pricing and its supplier/location scope is safe. Before
any ingest, cheaply compare URL/page timestamp, HTTP metadata or a content hash
against evidence already recorded in state/source records; skip unchanged data.
Dispatch changed, usable data to the supplier's dedicated thread
(`daisy_thread_id`) to run `availability-ingestion`, with a
manual/current-receipt classification, retrieval timestamp, exact URL/file,
location evidence and confirmation-required caveat. That thread owns all
writes and may stop on ambiguity. Record its report/source IDs in the run state.
Otherwise mark hosted data as found-but-not-ingested and state why (static,
undated, gated, ambiguous, unchanged, or unusable).

### C. Newsletter / availability subscription

Locate a normal subscription form. **Detection is not an outcome:** every form
found must end in one recorded terminal state — `subscribed`, `held-human` with
an exact URL and blocker, or `technical-failure` with exact URL/reason. Make the
best safe effort to subscribe `chris.r@localplantsupply.com`: check a required
marketing-consent box, complete ordinary fields, and attempt a CAPTCHA normally
when the browser can solve it. Record each action and its observed result. A
CAPTCHA that remains unsolved, a technical failure, account/login barrier, or an
email-verification link requiring human access is a human hold only **after**
that attempt; do not merely detect it and stop. Do not blindly repeat a failed
form submission, and never retry a previously successful subscription.

### D. No form: create an unsent supplier-email draft

Only if no subscription form exists, locate a verified active supplier contact
email. Create **one** plain-text Gmail draft, addressed to that contact and sent
as Chris if later approved. Do not send it, do not add a signature/footer, and
specifically omit the Keep-me-in-To footer. Use a compact body such as:

```
Hello,

We are updating our supplier availability records. Is your website the best place
to find current availability and pricing, or do you send regular availability
updates by email? Also, who is the right contact for availability and pricing?

Thank you,
Chris Runyon
```

Use Gmail drafts creation (RFC 822 `To`, `Subject`, and plain-text body encoded
as the API requires); capture and store draft id, recipient, subject and exact
body in run state. Before creating, search existing drafts/state for the same
supplier and purpose; reuse/report it rather than duplicate it. If no safe
recipient exists, do not draft; report that as a blocker.
