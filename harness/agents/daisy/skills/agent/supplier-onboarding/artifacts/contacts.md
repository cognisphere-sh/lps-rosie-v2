## 4. Contacts

Getting the right sales/contact person on file, on the right locations, matters —
it is how every later availability request reaches a human instead of a
switchboard.

### 4.1 The rows

- **INSERT a `contacts` row for the supplier's main line** — the general
  `info@`/`sales@` address and the switchboard number — with
  `title_department = 'Main line'` and `name` left null. That row is what makes
  the supplier findable by email next time.
- **INSERT a `contacts` row for each person you know**, with `name` / `email` /
  `phone` / `title_department` filled from what the source actually gives — a
  signature block, a "contact us" page, the sender of the availability email.
  **Leave `name` null unless the source actually names them** — never infer a
  name from the address itself. `bobby.green@` is a fair read, but
  `tynursery.orders@` and `treeoflife.gardencenter@` are not people, and
  `dwinningham@` cannot yield a first name without inventing one. A contact with
  only an email or phone is perfectly valid.
- For an **existing** supplier, check its linked contacts before inserting: add
  the person only if they are genuinely new, correct the existing row if they
  moved role, and retire whoever has left. Never delete.

**Then link them (the Linking subsection below).** `contacts` has **no `supplier_id`**: the tie to a
supplier is a `supplier_contacts` row, and a contact with no link is invisible to
every reader.

### 4.2 Linking — one person, however many locations

**A contact can be the point of contact for several nurseries.** That is the
normal shape at a multi-location company: one inside-sales rep quotes across
every farm, while a yard manager answers for one site only.

- **Link, don't duplicate.** Before inserting a person, look for them across
  every location of the company — the same email at a sister location is the
  same person:
  ```sql
  SELECT c.id, c.name, c.email, c.phone, sc.supplier_id, sc.is_primary
  FROM contacts c
  JOIN supplier_contacts sc ON sc.contact_id = c.id AND sc.is_active
  WHERE c.is_active
    AND sc.supplier_id IN (<every location of the company>)
    AND (lower(c.email) = lower('<email>') OR c.phone = '<phone>');
  ```
  Found → add a link, don't insert a second contact row. Not found → insert the
  contact, then link it. If you find two *existing* rows that are plainly the
  same route — same email **and** same phone — report them under *Learnings*;
  merging them is migration work (0036 did the first pass), not something to do
  here. **A shared inbox is not a duplicate person:** two rows on `info@…` with
  different phone numbers are two locations or two people, and merging them would
  delete a working number.
- **Work out how many locations they cover, from what the source says.** Their
  signature, title or the sheet header is the evidence: "Inside Sales — all
  farms" or a company-wide availability list is every location of the company;
  "Yard Manager, Bunnell" or a farm-specific sheet is that one. **When the source
  only shows them at one location, link only that one** — coverage is a fact to
  read, not to assume. Note the evidence in `contacts.notes`.
  ```sql
  INSERT INTO contacts (name, email, phone, title_department, notes)
  VALUES (...) RETURNING id;

  INSERT INTO supplier_contacts (supplier_id, contact_id, is_primary)
  SELECT s.id, <contact id>, false
  FROM suppliers s WHERE s.id = ANY(ARRAY[<the locations they cover>]);
  ```
  `(supplier_id, contact_id)` is unique, so re-linking someone is
  `UPDATE supplier_contacts SET is_active = true WHERE …`, never a second row.
- **`is_primary` is per location.** Flag the one who answers about availability
  *at that location*; **at most one active primary per location**, so promote by
  demoting the incumbent first:
  ```sql
  UPDATE supplier_contacts SET is_primary = false
  WHERE supplier_id = <id> AND is_active AND is_primary;
  UPDATE supplier_contacts SET is_primary = true
  WHERE supplier_id = <id> AND contact_id = <new primary> AND is_active;
  ```
- **Retiring is two different acts.** Someone who stopped covering one farm but
  still covers others: `UPDATE supplier_contacts SET is_active = false WHERE
  supplier_id = <id> AND contact_id = <id>`. Someone who left the company: retire
  every link **and** set `contacts.is_active = false`. Never delete.
- **Editing a contact row changes them everywhere.** A new phone number is right
  to write once. Something true only at one site — "handles the Bunnell pickup
  window" — belongs in that supplier's `notes`, not on the shared person.
