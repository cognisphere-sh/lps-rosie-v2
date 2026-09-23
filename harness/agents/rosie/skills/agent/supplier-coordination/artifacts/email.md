## 3. HTML email for a non-partner

1. Draft a short, plain-language ask using an HTML body: greeting, useful
   job/delivery context, a compact table of plant/size/requested quantity
   (and this supplier's price when useful), and a clearly labelled link to
   answer the request. Use the same plants/sizes/quantities as the AR.
   Include a visible clickable public URL so the recipient can open it.
   HTML-escape inserted text and attributes. Never include internal sourcing
   notes or other suppliers' pricing.
2. Present the **complete recipient, subject, rendered/content-equivalent
   HTML and public link** for any required approval using `message-routing`.
   Preserve supplier preferences. Send exactly the approved draft; material
   changes need review again. A past draft/template is not standing approval.
3. Send from `chris@localplantsupply.com` as Christopher Runyon on this
   supplier thread. `gws gmail +send ... --body <approved-html> --html`
   supports HTML; inspect `+send --help` / `+reply --help` for the installed
   command before use. Reply in the existing Gmail thread for the same ask.
   Quote shell arguments safely, especially literal currency `$` values.
4. Check the send result. If uncertain, search Sent before retrying. Record
   the full sent content and metadata on this thread's internal web chat.
   Add a Gmail-thread route back here with the `route-email` skill, keeping
   `router-all` last. Only confirmed delivery marks `availability_sent`.

Email authentication/configuration failure is a blocker to report in the
original Chris interaction. Do not switch to another agent's mailbox or
claim the request was emailed. The prepared draft/link remains reviewable.
