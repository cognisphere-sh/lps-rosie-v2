## The cheap-first rule

**Do not read the email body or download attachments to route it.** The
`email_received` preview already carries what routing needs: `From`, the
subject, the first two lines, and attachment *names*. Escalate only as far as
identification requires:

1. **Sender / subject / attachment names** — almost always enough.
2. **Full body** (`scripts/gws/email read <MessageId>`) — only when step 1
   leaves the supplier genuinely undetermined (a forwarded mail, a generic
   sender, a newsletter service address).
3. **Attachments** — last resort, only when the body still doesn't say. The
   dedicated thread is the one that reads them properly; you are only looking
   for a company name.

## 1. Identify the supplier

Read the relevant schema with `database-access` before querying. From the sender's address,
join through `contacts` (no contact info lives on `suppliers`):

```sql
SELECT s.id, s.name, s.head_branch_id, s.daisy_thread_id, c.email
FROM suppliers s
JOIN supplier_contacts sc ON sc.supplier_id = s.id AND sc.is_active
JOIN contacts c ON c.id = sc.contact_id AND c.is_active
WHERE lower(c.email) = lower('<from>');
```

Nothing? Widen to the sender's **domain** (`c.email ILIKE '%@<domain>'`) — a
supplier often mails from a colleague's address that isn't on file. Still
nothing? Try `search_suppliers` with the sender's display name and any company
name in the subject or attachment filenames (the `plant-and-supplier-search`
skill covers reading a result set). Several rows for one company is normal —
they are its locations and share one `daisy_thread_id`; that shared value is
your answer, whichever location matched.

Newsletter senders (Mailchimp, Constant Contact) hide the supplier behind a
service domain — the display name and subject usually carry the company; step
2's body read is the fallback.
