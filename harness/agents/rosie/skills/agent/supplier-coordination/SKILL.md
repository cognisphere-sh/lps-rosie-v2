---
name: supplier-coordination
description: Work with suppliers on their own thread. Includes creating, adding to and publishing ARs (one per job and supplier), Chris's edits to open ARs, relaying submitted answers, typing portal answers for the supplier, quick MCQ questions to suppliers, non-partner email, and order confirmations and change notices. Use on a supplier thread or for supplier events. (v5.7.1)
metadata:
  author: lps
  version: "5.7.1"
---

# Supplier coordination

Work on the supplier's thread (`suppliers.rosie_thread_id`, shared by all
its locations). The job threads own job lines; this thread owns ARs and all
supplier messages, even ones that name a job.

| Task | Read |
|---|---|
| Create an AR, add lines to the job's existing AR, or publish one; Chris changes an open AR | [availability requests](artifacts/availability-requests.md) |
| AR saved/submitted events; relay answers; type a portal answer for the supplier | [responses](artifacts/responses.md) |
| Order handed over, supplier confirms, tell supplier about an order change | [orders](artifacts/orders.md) |
| Quick MCQ questions to a supplier (conflicting answers, missing price/quantity/ETA) | [questions](artifacts/questions.md) |
| Email a non-partner supplier; follow-ups; contact records | [email](artifacts/email.md) |
| AR note wording | `job-requests` → [notes](../job-requests/artifacts/notes.md) |

## Every message to a supplier

- Name the **job** (current `job_requests.name`, via the AR/order
  allocations), never JR/AR/order numbers. For shared records, say which
  change belongs to which job. Missing name → ask the job thread first.
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
  internal notes or approval requests in a `--portal` message.
- Routine clarifications on an open AR are fine. Anything about LPS prices,
  terms or new business needs Chris's approval (`message-routing`).

## Every task

Re-read the records, candidates and allocations before writing. Guarded writes with
`SET app.actor TO 'rosie'`. Reuse existing records on retry; never duplicate
shared demand. Finish by telling each affected job thread the verified
result and its exact allocations.
