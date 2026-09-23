---
name: supplier-communications
description: Handle supplier lifecycle correspondence. Includes approved drafting/sending, transcript format, outreach template and durable facts. Use for supplier contact or recording an arriving drop. (v6.5.0)
metadata:
  author: lps
  version: "6.5.0"
---

# Supplier communications

Daisy owns onboarding, accounts, paperwork, supplier records and availability
channels from `chris.r@localplantsupply.com`. Rosie owns all job/order contact
from `chris@localplantsupply.com`. Route by subject. Preserve every known job/AR/
order reference and allocation in mixed messages; ingest the list and hand the
order portion to Rosie without sending a duplicate reply.

1. Work on `suppliers.daisy_thread_id`, shared by company locations. Other
   threads relay the exact request there. Resolve routing with
   `supplier-email-routing`; supplier threads do not manage Gmail routes.
2. **Record arrivals/contact:** [transcript](artifacts/transcript.md). Broadcasts
   get the header/first line only; direct exchanges get the full text. Post to
   the internal web panel, never `--portal`. [Records](artifacts/records.md)
   distinguishes durable supplier facts from open loops and contact history.
3. **Draft/send only when instructed by Chris/Bhoumik:** read
   [sending](artifacts/send.md), prepare the exact draft and get required
   approval on this supplier's internal panel. A template, missing price or
   incoming reply is not permission. Chris handles formal gated buyer accounts.
4. Verify the send, log full correspondence and maintain only open follow-ups.
   If delivery is uncertain, inspect Sent before retrying. Routine contact
   stays on the supplier panel; urgent blockers relay through main.

For order mail reaching this inbox, give Rosie the identifiers, mailbox, exact
relevant text and origin internally; she cannot read Daisy's mailbox. An actual
external email forward requires its applicable authorization. Never treat an
internal handoff as customer/supplier content.
