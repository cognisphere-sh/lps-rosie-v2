## 1. Select the channel and preserve preferences

Check the job thread's workflow path first. For already committed intake or an
accepted quote moving directly to order, use [orders](orders.md) and skip AR preparation,
creation and availability approval asks. The job thread creates/reuses the
direct order; do not create a support AR or ask the supplier to complete one.
The channel rules below apply when an availability request is actually needed.

- `is_lps_partner = true`: availability requests reach the supplier's private
  portal. This flag is derived from portal logins; do not change it.
- Non-partner: create an availability request with a public URL and send
  the approved ask as **HTML email including that URL**. Lack of a private
  portal does not mean skipping the structured request.
- Read `suppliers.notes` for customer-details sharing, contact/channel and
  framing preferences. Preserve existing preferences. With no remembered
  customer-details decision, ask Chris through `message-routing`, record
  his answer and leave `share_customer_details = false` while waiting.
  The [job-name rule](supplier-links.md) separately authorizes naming the affected job in
  order/AR update messages; do not ask again for that name-only disclosure.
  Do not expose customer identity while that decision is pending.
- **APS is the exclusive current supplier. For an ordinary non-quick-quote
  availability request, obtain APS pricing and Chris's specific approval
  before creating/publishing the AR; a completed quote is not required.**
  The job thread asks in the original request chat unless Chris explicitly
  approved that exact send already. A quick-quote-only handoff stops at quote:
  do not create an AR or send a follow-up availability approval ask. Require
  workflow path, pricing/gap evidence, scoped send approval and any alternative
  approval in the handoff, not quote-completion evidence. An APS portal insert
  is publication, so it is behind this gate too. Preserve remembered
  customer-details sharing choices; private is the default. An explicit Chris
  exception is needed for another supplier, including combined grower asks.
- **Alternatives require explicit Chris confirmation to request availability
  for the specific plant/size before creation or send**, including hints in
  supplier-visible `note_for_supplier`. Approval to quote it is not AR authorization.
  Creating a portal request is not permission for an additional email.
