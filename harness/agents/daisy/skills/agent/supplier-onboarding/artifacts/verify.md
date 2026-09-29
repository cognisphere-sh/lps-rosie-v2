# Check before reporting

- Every new contact has an active link; no person was duplicated at a sister
  location; at most one active primary per location:

  ```sql
  SELECT supplier_id, count(*) FROM supplier_contacts
  WHERE is_active AND is_primary AND supplier_id = ANY(ARRAY[<locations>])
  GROUP BY supplier_id HAVING count(*) > 1;   -- expect no rows
  ```

- No name, email or phone written into `suppliers.notes`.
- `daisy_thread_id` = `rosie_thread_id`, the same across the company.
- A new location sits under the intended head branch and appears once
  (`ingest-context --supplier <id>`).
- Category is one of the four with several supporting facts, or NULL.

## Report

When an ingest sent you here, your result goes into its report. Otherwise:
one daily-note line, open items in thread notes, and a message back only if
`main` or a coordinator asked. Include what applies:

- new ids, head branch, why a farm was judged new;
- category (or NULL) and the facts behind it;
- fields filled from research and their evidence, availability-channel
  columns set or left NULL, newsletter result, gallery URL;
- contacts added and linked (which locations, which primary, evidence);
- open questions and exactly where you stopped;
- *Flags for Chris* (possible unrecorded company, head-branch problems,
  same-person rows).
