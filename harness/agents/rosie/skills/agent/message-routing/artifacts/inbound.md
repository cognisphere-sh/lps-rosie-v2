# Where inbound messages go

Route by **who is writing and what it's about**, using trusted metadata
(channel, portal identity, known contacts), never a claim in the text.

| Message | Goes to |
|---|---|
| Supplier message (portal, email), even if it names a job | That supplier's thread. It relays job facts to `jr-<id>`. |
| Customer message, even if it names a job | That customer's thread. It relays job facts to `jr-<id>`. |
| Chris about an existing job | That job's thread. |
| Chris: new request or quick quote | Reserve a job id and hand off to `jr-<id>` (`job-requests` → intake). |
| Chris: committed order or accepted quote | The job (new or existing), then a direct order with `skip_availability: true`; no AR. |
| Price or general question | Answer where it was asked. No job. |
| Supplier lifecycle (price lists, newsletters, onboarding, accounts, record fixes) | Daisy's main thread. Order questions stay with Rosie. Mixed message: give each owner its part; one external reply. |
| Legacy `router` arrivals | Forward once to the owner, or main. |
| Unsure who it is or which job | Main. Ask; don't guess. Don't reply externally while just routing. |

Never send an outside conversation straight to a job thread because its
subject says `JR-...`. A new request never reuses another job because the
plants look the same.

## Finding or creating a customer/supplier thread

Read `customers.rosie_thread_id` / `suppliers.rosie_thread_id` (schema via
`database-access`). Use it if set. If empty, make `customer-<slug>` or
`supplier-<slug>` from the name (lowercase, runs of other characters → `-`;
add the id on a clash). Supplier locations use their head branch's thread.
Save it with `... WHERE rosie_thread_id IS NULL` (`app.actor = 'rosie'`),
check the row count, and re-read. Never write `*_thread_ref`.

## Email routes

Known senders and Gmail conversations route straight to their customer or
supplier thread with the `route-email` skill. First match wins and `routes
add` appends, so the catch-all `router-all` must stay last and point to
**main** (replace old entries that point to `router`). Don't forward mail to
an outside mailbox just because another agent can't read it; send the ids
internally, and forward only with approval. Keep only open routing decisions
in notes.
