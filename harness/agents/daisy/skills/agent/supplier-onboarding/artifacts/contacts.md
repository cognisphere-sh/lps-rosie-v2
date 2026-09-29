# Contacts

The right person on file is how later requests reach a human, not a
switchboard. `contacts` has no `supplier_id`; a `supplier_contacts` link ties
a person to each location they cover. A contact without a link is invisible.

## Rows

- **Main line:** one contact for the general inbox/switchboard (`info@`,
  `sales@`, `orders@`, `avail@`) with `title_department = 'Main line'` and
  `name` NULL.
- **People:** `name`, `email`, `phone`, `title_department` from what the
  source shows (signature, contact page, the sender). `name` only if printed;
  never guess a name from an address (`dwinningham@` gives no first name).
  Email-only or phone-only contacts are fine.
- **No fax numbers.** (Bhoumik, 2026-08-05.)
- A broker or middleman is not the farm's contact; mark or demote them.

## Link, don't duplicate

Before inserting, look across every location of the company:

```sql
SELECT c.id, c.name, c.email, c.phone, sc.supplier_id, sc.is_primary
FROM contacts c JOIN supplier_contacts sc ON sc.contact_id = c.id AND sc.is_active
WHERE c.is_active AND sc.supplier_id IN (<all locations>)
  AND (lower(c.email) = lower('<email>') OR c.phone = '<phone>');
```

- Found → add a link. Not found → insert, then link:

  ```sql
  INSERT INTO contacts (name, email, phone, title_department, notes) VALUES (...) RETURNING id;
  INSERT INTO supplier_contacts (supplier_id, contact_id, is_primary)
  SELECT id, <contact id>, false FROM suppliers WHERE id = ANY(ARRAY[<locations they cover>]);
  ```

- Which locations they cover comes from the source ("Inside Sales — all
  farms" or a company-wide list → all; "Yard Manager, Bunnell" → one). Shown at
  one location only → link only that one. Note the evidence in
  `contacts.notes`.
- Re-linking: `UPDATE supplier_contacts SET is_active = true WHERE …`
  (`(supplier_id, contact_id)` is unique).
- Two existing rows with the same email **and** phone → report under
  *Flags for Chris*; don't merge. A shared inbox with different phones is two
  routes, not a duplicate.

## Primary

One active primary per location: the person who answers about availability
there. When duplicates or conflicting contacts appear, the one from the most
recent email wins. Promote by demoting first:

```sql
UPDATE supplier_contacts SET is_primary = false WHERE supplier_id = <id> AND is_active AND is_primary;
UPDATE supplier_contacts SET is_primary = true WHERE supplier_id = <id> AND contact_id = <new> AND is_active;
```

## Changes

- Moved role → update the row. Stopped covering one farm → deactivate that
  link. Left the company → deactivate every link and the contact. Never
  delete.
- Editing a contact changes it everywhere. Something true at one site only
  ("handles Bunnell pickups") goes in that supplier's `notes`.
