## 0. Which location does each row belong to?

**One source file is not one supplier.** A company that grows or sells at
several sites is several `suppliers` rows — one per location — tied together by
`suppliers.head_branch_id`, which points at the company's head branch; a head
branch, and every single-site supplier, points at **itself**. Everde, Moon
Valley, Newton and thirteen others are stored that way, and they send **one
availability file covering several of their farms**. So the unit of mapping is
the **availability row**, not the file: every parsed offering gets its own
`supplier_id`, and one drop can legitimately write to five suppliers.

Read the `head_branch_id` / `supplier_contacts` sections of SCHEMA.md, then do
this **before parsing** — it decides where every row goes.

1. **Does this supplier have sister locations?** One query, from whatever
   supplier id the brief gave you:

   ```sql
   SELECT s.id, s.name, s.city, s.state
   FROM suppliers s
   WHERE s.head_branch_id = (SELECT head_branch_id FROM suppliers WHERE id = <supplier_id>)
     AND s.is_active
   ORDER BY s.id;
   ```

   One row back — the supplier itself — → single location, every offering maps
   to that one `supplier_id`. Carry on at [acquisition](acquisition.md).

   **If the router's forward said nothing matched** — this thread was minted
   for a brand-new supplier — there is nothing to map to yet: follow the
   **`supplier-onboarding`** skill to create the supplier (it sets
   `daisy_thread_id` to this thread), then come back here with the id.

2. **Where does the file say a location?** Look in the sheet header, a tab or
   page per farm, a "Ship from" / "Grown at" / "Farm" column, a section heading,
   the branch in the sender's signature, or the email body. Take the **most
   specific** statement that covers a given row — a per-row column beats a
   section heading, a section heading beats the file header:

   - **Per-row or per-column location** → map each row to the location named on
     it. Rows in the same file going to different `supplier_id`s is the normal
     shape here, not an error.
   - **Per-section / per-tab / per-page location** → treat each section as its
     own set of rows for its own location. A workbook with a tab per farm is
     the common shape; [acquisition](acquisition.md) says how to convert one without losing tabs. A tab
     carrying no offerings — `Terms`, `Legend`, `Price Key`, an empty or hidden
     leftover — is **not a location**, whatever it is named: skip it and say
     which tabs you skipped in your report.
   - **One location for the whole file** → every offering maps to that location,
     and to no other.
   - **No location named anywhere → every active location of that company gets
     its own copy of every offering.** Everde with five active locations means the
     same 900 offerings written five times, 4,500 rows, each with its own
     `supplier_id`, its own `inventory_sources` row ([provenance](provenance.md)) and its own upsert pass
     ([writes](writes.md)). That is what a company-wide availability list means: any of their
     sites can supply it.

   **A location you can't find is usually a spelling, not a new farm.** Resolve
   the name against the sister locations from step 1 before you conclude
   anything: match on **city and state**, not just the supplier row's name, and
   read the company's own locations page if it still resolves to nothing. A
   tab labelled `Ft Pierce`, `Bunnell Farm`, `Loc 3` or a bare farm code is
   routinely a row you already have. Onboarding a duplicate location splits
   that farm's catalogue across two `supplier_id`s permanently, and no later
   ingest can tell the halves apart.

   Only a site that is **genuinely absent** is a new location: **follow the
   `supplier-onboarding` skill** to create it as a new supplier with the same
   `head_branch_id`, come back here with its id, and say so in your report. If it
   could plausibly be either — a near-match on name, a code you can't tie to a
   city — it is ambiguous, so step 3 applies: ask, don't onboard.

3. **Never guess a location from the sender's address or the file name.** If the
   mapping is ambiguous — a location name that matches no row, two plausible
   matches, a sheet that looks per-farm but isn't labelled, some rows labelled
   and some not — **that is a critical blocker: message `main` and park those
   rows.** Don't fall back to "all
   locations" to resolve an ambiguity; that is a different claim from "the file
   named none". A row written to the wrong farm claims stock at a nursery that
   never offered it, and nothing downstream can tell.

4. **Suspect an unrecorded company?** If a supplier's list, signature or website
   shows sites the database doesn't have as rows, or shows that two existing
   rows are one company, don't tie them together yourself — report it under
   *Flags needing Chris* with the evidence. A wrong head branch multiplies wrong
   data by the number of locations under it.

Carry the resulting **row → `supplier_id` mapping** through [normalization](normalization.md) and [writes](writes.md); [qa](qa.md) checks
it. Report the per-location counts separately — one total hides a location that
silently got nothing.

**Contacts are not yours.** If the drop reveals a new person, a new phone number
or a rep who has left, that is [supplier-onboarding: contacts](../../supplier-onboarding/artifacts/contacts.md) — follow it for those
writes, or hand the detail back in your report if the ingest is the only thing
you were asked for.
