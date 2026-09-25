---
name: supplier-coordination
description: Coordinate supplier ARs and orders on the supplier thread. Includes customer-to-AR notes, supplier-to-job/item note handoffs, creation, portal transcription, submitted replies and order changes. Use for order-side supplier work or events. (v3.35.0)
metadata:
  author: lps
  version: "3.35.0"
---

# Supplier coordination

Run on `suppliers.rosie_thread_id` (shared by company locations). Job threads
own job/items; this thread owns ARs and supplier correspondence. Use
`database-access` for the relevant schema and `message-routing` for origin and
approval evidence. Research alone authorizes no outreach.

Read only the selected task. Before any supplier-facing Order/AR update,
also read [job names and portal links](artifacts/supplier-links.md). Before
writing, reload records and allocations, guard changes, set `app.actor = 'rosie'`
and verify results. Reuse known records on retry; never duplicate shared demand.

| Task | Read |
|---|---|
| Create/publish an approved AR | [channels and approval](artifacts/channels.md), [create request](artifacts/create-request.md) |
| Carry customer notes into ARs or route supplier notes back to jobs/items | [note ownership and handoffs](artifacts/line-notes.md) |
| Correct Chris-directed APS ask fields | [manual inputs](artifacts/manual-inputs.md) |
| Send approved non-partner HTML email | [email](artifacts/email.md) |
| Handle availability event/submission | [responses](artifacts/responses.md) |
| Transcribe trusted portal text/voice | [transcription](artifacts/transcription.md) |
| Direct-order handoff or supplier confirmation | [orders](artifacts/orders.md) |
| Notify a saved order change | [order changes](artifacts/order-changes.md) |
| Record contact or follow up | [records](artifacts/records.md) |

Ordinary non-quick-quote availability work needs APS pricing and Chris's
specific AR approval, not a completed quote. Quick quotes stop without an AR;
committed/direct-order work skips AR preparation. Local unsubmitted AR edits
stay here; only explicit submission is relayed to job threads/Chris. Supplier
answers alone never authorize job availability/source changes; Chris's
first-APS-submission standing instruction is narrowly scoped under
[responses](artifacts/responses.md) and the job owner applies supported updates. Portal transcription
does not submit; voice responses follow acknowledge → save → review/Submit.

Finish with verified record/send results and exact affected allocations for
each owner. `job-requests` owns job/item note audiences and assigned record names;
contact history stays in this supplier's transcript. Internal messages never
use `--portal`.
