# Email to a non-partner supplier, and records

## Send an AR by email (needs Chris's approval)

1. Draft a short HTML email: greeting, useful job/delivery context, a small
   table of plant / size / quantity (and this supplier's price when useful),
   and a visible, clickable link to answer the AR. Same lines as the AR.
   Escape inserted text. No internal notes, no other suppliers' prices.
2. Get approval with `message-routing`: show recipient, subject, the full
   HTML (or equivalent) and the link. Send exactly what was approved. A real
   change needs a new approval. An old draft is not approval.
3. Send from `chris@localplantsupply.com` as Christopher Runyon on this
   supplier thread: `gws gmail +send ... --body <approved-html> --html`
   (check `+send --help` / `+reply --help` first). Reply in the existing
   Gmail thread for the same ask. Pass `$` amounts safely (file or single
   quotes).
4. Check the result. If unsure, search Sent before retrying. Post the full
   sent content and metadata in this thread's web chat. Add a Gmail route back
   to this thread with `route-email` (`router-all` stays last). Only a
   confirmed send counts as `availability_sent`.

Email sign-in or config failure: report it in Chris's original chat. Never
use another agent's mailbox or claim it was sent. The draft and link stay
ready.

## Follow-ups and records

- Batch open questions to the supplier on this thread and channel, with the
  same approval rules. Don't repeat ARs or messages for the same work.
- This thread's web chat is the contact history. Quote outside emails in
  full: sender, recipient, subject, link (Rosie's Gmail links use
  `authuser=chris@localplantsupply.com`). Portal messages are already there.
- Keep only open follow-ups in thread notes. Lasting supplier preferences go
  in `suppliers.notes`.
- Supplier lifecycle work (onboarding, accounts, price lists, record fixes)
  goes to Daisy via `message-routing`. Order coordination stays here.
