# Identify the supplier — cheapest first

The preview already has `From`, subject, the first two lines and attachment
names. Go further only when needed:

1. Sender address, subject, attachment names — almost always enough.
2. Full body (`scripts/gws/email read <MessageId>`) — forwarded mail, a
   generic sender, a newsletter service.
3. Attachments — last resort, only to find the company name.

Lookup (contact details live on `contacts`, not `suppliers`):

```sql
SELECT s.id, s.name, s.head_branch_id, s.daisy_thread_id, c.email
FROM suppliers s
JOIN supplier_contacts sc ON sc.supplier_id = s.id AND sc.is_active
JOIN contacts c ON c.id = sc.contact_id AND c.is_active
WHERE lower(c.email) = lower('<from>');
```

- Nothing → the sender's domain (`c.email ILIKE '%@<domain>'`) → then
  `search_suppliers` with the display name and any company name in the
  subject or filenames.
- Several rows for one company are its locations; they share one
  `daisy_thread_id` — that is the answer.
- Newsletter services (Mailchimp, Constant Contact) hide the company behind
  their domain; the display name and subject usually name it. A shared
  newsletter domain never identifies a supplier on its own.
- `LLC`, `Inc` and similar suffix differences are the same company.
