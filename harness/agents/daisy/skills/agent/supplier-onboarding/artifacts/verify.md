## 5. QA before you finish

- **Every new contact has at least one active link**, no person was duplicated at
  a sister location that already had them, and every location has at most one
  active primary:
  ```sql
  SELECT supplier_id, count(*) FROM supplier_contacts
  WHERE is_active AND is_primary AND supplier_id = ANY(ARRAY[<locations>])
  GROUP BY supplier_id HAVING count(*) > 1;   -- expect zero rows
  ```
- **No person landed in `suppliers.notes`** — no name, email or phone in prose on
  the supplier row.
- **`daisy_thread_id` and `rosie_thread_id` are set** (same value) — a new
  company carries this thread's id; a new
  location carries its head branch's values, identical across the company's rows.
- **A new location points at the right head branch**, and the company's location
  set now reads the way you expect: re-run [identify](identify.md)'s sister-location query and confirm
  the new row appears once, under the head branch you intended.
- **Category is defensible**: it is one of the four allowed values only when
  multiple consistent facts support the location's primary model/customer reach;
  otherwise it is null. A category does not alter the one-row-per-location,
  shared-head-branch model.

## Timestamps

ISO 8601, America/Chicago. "Now" is the latest inbound message's Timestamp.
`updated_at` is maintained by trigger on UPDATE.

## Record the outcome

**When `availability-ingestion` sent you**, this becomes its *Onboarding*
block — folded into that skill's outcome record so there is one record.

**Otherwise** write it as a **compact structured record** into this thread's
`notes.md` plus a brief daily-note entry (that is what the 9 AM summary
reads); message it back to `main` or a coordinator only when one of them asked
for the onboarding.

- **Onboarding**: new `supplier_id`, its `head_branch_id` when the row is a
  location of a known company, and — when you decided a farm was new rather than
  an existing row — the evidence for that call. State the category set (or that
  it was left null/why) and the multiple facts supporting it; `Other` needs the
  evidence that excluded the three defined categories.
- **Enrichment**: fields set via browser research, including which of the
  availability-source columns you set and on what evidence, and which you left
  null. Newsletter subscribed (or why not). **A plant-photo gallery on their
  site, with its URL**, if you saw one — you didn't catalogue it, and this is how
  it gets scheduled.
- **Contacts**: `contacts` rows added and the `supplier_contacts` links you made
  — which locations each covers, on what evidence, and which one you made primary
  where.
- **Follow-up questions**: anything you need to finish (an ambiguous location, a
  credential, a decision). If you stopped early because of one, say exactly where
  you stopped and what remains.
- **Flags needing Chris**: a suspected unrecorded company or head-branch problem,
  two existing rows that look like one route, anything that needs a human call.
- **Errors/issues faced** and how you resolved them.
- **Learnings**: supplier quirks you wrote into `suppliers.notes` (or still
  need to); anything
  incorrect or redundant found in SCHEMA.md, this skill, or other docs;
  **suggested skill/script/database changes** (you never change this skill — they
  go to the daily summary for Chris's/Bhoumik's approval).
