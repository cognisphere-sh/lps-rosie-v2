## 1. Route inbound messages by correspondent

1. Use trusted channel identity/page metadata and known sender contacts.
   **Supplier messages go to that supplier's thread and customer messages
   to that customer's thread, even when the subject names a job.** The
   contact thread relays job updates to `jr-<id>` after reading them.
   Never route an external conversation straight to a job thread because a
   subject contains `JR-...`.
2. Internal messages from Chris about an existing job go to that job thread;
   supplier/customer matters go to the matching entity thread. Preserve the
   human interaction context so work can report back and seek approval.
3. A new order **or quick quote** uses `job-requests` to reserve an id and
   hand off to a new `jr-<id>` thread. Set `quote_only: true` for quick quotes;
   they create a job but no AR. Simple pricing/general questions create no
   job/AR; use an existing relevant thread or a task thread for the lookup.
   An already committed order also creates/reuses its job and items; identify
   the committed intent and carry supplied pricing and acceptance evidence.
   An accepted quote reuses its existing job. Both can proceed directly to
   order with `skip_availability: true`; do not route them into an AR task.
   For new intake, reserve a new job id directly without searching existing
   jobs for the same or similar plants. Reuse only an explicitly identified job,
   an established job-thread context, or the same known/reserved id on retry.
   Plant overlap is not a reason to merge jobs or ask a duplicate-job question.
4. Supplier lifecycle messages (price lists/newsletters, onboarding, account
   setup, supplier-record corrections) go to Daisy's main/owning supplier
   thread. Order questions remain Rosie's. For a mixed message, relay the
   relevant parts to each owner without duplicating an external response.
5. If sender or intended job is uncertain, route to main for resolution;
   ask about ambiguous facts instead of guessing. Do not respond externally
   while merely routing.

Read the relevant schema with `database-access` before lookup. Thread ids come from
`suppliers.rosie_thread_id` or `customers.rosie_thread_id`. Reuse a non-NULL
id. For a missing value, mint `supplier-<slug>` / `customer-<slug>` from the
known name (lowercase, non-alphanumeric runs → `-`); append entity id on a
collision. Supplier locations use the head branch's shared value. Guard the
write with `WHERE rosie_thread_id IS NULL`, check the row count and re-read.
Use `app.actor = 'rosie'`; never write derived `*_thread_ref` fields.
