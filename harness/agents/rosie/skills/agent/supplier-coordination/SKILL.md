---
name: supplier-coordination
description: Work with suppliers from the job's thread, writing in their conversation. Includes creating, adding to and publishing ARs, Chris's edits to open ARs, reading submitted answers, typing portal answers, quick MCQ questions, non-partner email, and order confirmations and change notices. Use in a jr-<id> thread for supplier work or events. (v6.1.0)
metadata:
  author: lps
  version: "6.1.0"
---

# Supplier coordination

Work in the job's thread, `jr-<id>`: it owns the job's ARs, orders and every
message with their suppliers. Write to a supplier in their **conversation**
(`suppliers.rosie_thread_id`, shared by all its locations and all jobs):
`webchat-cli send --thread-id <conversation> --portal` from `jr-<id>` tags the
job, so the message appears in the job's supplier tab and the portal links it
to the job's order or AR. A supplier's portal reply reaches this thread once
their own thread routes it ([party thread](../message-routing/artifacts/party-thread.md)).

| Task | Read |
|---|---|
| Create an AR, add lines to the job's existing AR, or publish one; Chris changes an open AR | [availability requests](artifacts/availability-requests.md) |
| AR saved/submitted events; relay answers; type a portal answer for the supplier | [responses](artifacts/responses.md) |
| Order handed over, supplier confirms, tell supplier about an order change | [orders](artifacts/orders.md) |
| Quick MCQ questions to a supplier (conflicting answers, missing price/quantity/ETA) | [questions](artifacts/questions.md) |
| Email a non-partner supplier; follow-ups; contact records | [email](artifacts/email.md) |
| AR note wording | `job-requests` → [notes](../job-requests/artifacts/notes.md) |

## Every message to a supplier

- Name the **job** (current `job_requests.name`, via the AR's or order's
  `job_request_id`), never JR/AR/order numbers. Missing name → ask the job
  thread first.
  Naming the job is always allowed; other customer details follow the
  supplier's sharing setting.
- Include a direct link to the record, using the configured app origin:
  order `/partner/<supplierId>/orders/<orderId>`, AR
  `/partner/<supplierId>/requests/<arId>`, non-partner AR
  `/public/availability/<token>`. Never the portal home, an admin page or an
  invented token.
- Shape: `<Job name>: <brief update>. View order: <URL>` (or `View
  availability request: <URL>`). Plain text: the full URL; HTML email: a link.
- No automatic email acknowledgements without email approval.
- Only `--portal` messages (and approved email) reach the supplier. Never put
  internal notes or approval requests in a `--portal` message. Chris's
  `@Supplier` messages reached the supplier already; don't repeat them.
- Routine clarifications on an open AR are fine. Anything about LPS prices,
  terms or new business needs Chris's approval (`message-routing`).

## Every task

Re-read the records and candidates before writing. Guarded writes with
`SET app.actor TO 'rosie'`. Reuse existing records on retry; never order a
candidate twice. Finish by posting the verified result in the job's chat.
