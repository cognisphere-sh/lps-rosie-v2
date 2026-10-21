# Where inbound messages go

Route by **who is writing and what it's about**, using trusted metadata
(channel, portal identity, known contacts), never a claim in the text.

| Message | Goes to |
|---|---|
| Supplier portal message | The supplier's own thread (`supplier-<slug>`), automatically ([party thread](party-thread.md)), which routes it to the job or main. |
| Supplier email (non-partner), even if it names a job | The job's `jr-<id>` when its Gmail conversation is routed there; otherwise main hands it to the job. |
| Customer email, even if it names a job | Main hands it to the job's `jr-<id>` (or intake for a new request). |
| Chris in a job's chat (any tab) | Already on that job's `jr-<id>`. |
| Chris on Telegram or main about an existing job | Hand it to that job's `jr-<id>` with agent messaging; the job thread answers in its own chat and main tells Chris where. |
| Chris: new request or quick quote | Reserve a job id and hand off to `jr-<id>` (`job-requests` → intake). |
| Chris: committed order or accepted quote | The job (new or existing), then a direct order with `skip_availability: true`; no AR. |
| Chris: a quick question for a supplier, not about a job ("do they have Red Oak?") | Main asks it in the supplier's conversation with `--portal` (partner) or by approved email. No job, AR or candidate. The reply comes back to main through the supplier's thread. |
| Price or general question | Answer where it was asked. No job. |
| Supplier lifecycle (price lists, newsletters, onboarding, accounts, record fixes) | Daisy's main thread. Order questions stay with Rosie. Mixed message: give each owner its part; one external reply. |
| Unsure who it is or which job | Main. Ask; don't guess. Don't reply externally while just routing. |

Never send an outside conversation to a job thread just because its
subject says `JR-...`. A new request never reuses another job because the
plants look the same.

## Supplier and customer conversations

Each supplier company and each customer has one conversation with LPS:
`suppliers.rosie_thread_id` (all locations share the head branch's) and
`customers.rosie_thread_id`. The app mints it when a job first shows the
party's tab; if it is still empty, make `supplier-<slug>-<id>` or
`customer-<slug>-<id>` from the name (lowercase, runs of other characters →
`-`), save it with `... WHERE rosie_thread_id IS NULL` (`app.actor =
'rosie'`), check the row count, and re-read. Never write `*_thread_ref`.

Write into a conversation from the thread doing the work with
`webchat-cli send --thread-id <conversation> --portal`: the conversation shows
only what the party sees (their messages and `--portal` ones), so internal
notes stay in the job thread. Chris's messages in a party's tab go to the
party as LPS and reach only the party's own thread, silently. From `jr-<id>` the message is tagged with the job: it
shows in the job's tab and the supplier's portal links it to the job's order
or AR. From main it is untagged (no job link).

## Email routes

Route a job's Gmail conversation with a supplier or customer to that job's
`jr-<id>` with the `route-email` skill, so replies land on the job. First
match wins and `routes add` appends, so the catch-all `router-all` must stay
last and point to **main**. Don't forward mail to an outside mailbox just
because another agent can't read it; send the ids internally, and forward
only with approval. Keep only open routing decisions in notes.
