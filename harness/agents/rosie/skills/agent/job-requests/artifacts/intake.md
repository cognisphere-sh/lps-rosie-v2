## 1. Intake: an order request or quick quote

**New intake creates a new job without a duplicate-plant search.** Do not search
existing job requests for matching or similar plants, sizes, quantities or item
lists, even for the same customer. Do not merge requests or ask whether to reuse
a job because its plants overlap. In this skill, “create/reuse” means create a
new job unless the request explicitly identifies an existing job, the current
job thread/context establishes it, or the work is a retry/continuation of the
same known or reserved job id. Accepted-quote conversion uses that quote's
identified job; plant similarity is not a job reference.

You may ask any clarifying question about an order request before generating
a quote (including a quick quote), creating/sending an availability request,
or creating the affected order.
**Complete all authorized actions that do not depend on an answer before
asking.** Once order/quick-quote intent is established, perform the intake
writes below: create/reuse the job and `jr-<id>` thread, create item rows from
the supplied details, and save known customer/job information. Do not stop at
a plan or hold all records until every detail is clarified. Review the current
request history and any identified job's records; use `plant-and-supplier-search` to gather
missing pricing, preserve supplied/accepted prices, save supported prices and
only the sourcing notes allowed by [notes](notes.md), and record completed pricing
through the lifecycle hook. Research clearly labelled candidate
alternatives without selecting them. Verify writes before reporting them.
Missing details block only actions that depend on those details.

Post the created/updated job and rows, pricing and other findings, with any
gaps or uncertainty, in the original request conversation via `message-routing`;
external customer communication stays with `customer-coordination`. Then ask
concise questions about anything still unclear that affects the quote,
availability ask or order.
Questions may cover any relevant detail, such as plant/cultivar, size,
quantity, alternatives, budget, delivery timing/location, supplier or scope;
these are examples, not a required checklist. Use answers already provided.
Wait for needed answers before generating the affected quote or creating/
sending the affected AR or creating the affected order. On the availability
path, Chris must also approve the availability send after the quote; creating
an APS portal request is itself publication. Committed intake and direct
quote-to-order work skip this availability approval ask entirely.
Continue independent work, including supported record updates, while waiting.
Apply answers to the existing job/items with guarded writes; do not recreate
the job or duplicate rows when clarification arrives. Preliminary
pricing findings do not establish stock availability or resolve an ambiguous
requirement. If the request is clear, proceed without extra questions.

1. Distinguish a price lookup/general question from an order or quick-quote
   request. Simple pricing/general questions create no job or AR. **Before any
   quick-quote output (including a partial quote or draft), create/reuse the
   job, its `jr-<id>` thread and every supplied item row**; never treat a
   quote as exempt from intake. A quick quote creates/sends no AR. Preserve
   `quote_only: true` in the quick-quote handoff and stop after delivering the
   quote internally; do not follow it with an availability-send approval ask.
   Ask if the intent is unclear; do not infer quick-quote intent from a simple
   question about pricing.
2. For a new order or quick quote arriving outside a job thread, reserve its id
   directly without searching other jobs' plants, using
   `SELECT reserve_job_request_id();` and hand the complete ask, id and
   interaction context to `jr-<id>`. The app's New job request action also
   reserves an id and opens this thread. On main acknowledge with
   `[Continue in JR-<id> chat](thread:jr-<id>)`; the receiving job thread
   creates the records. Existing-job messages go to its existing thread.
3. Read `job_requests WHERE id = <id>` for the known or reserved id only. If
   present, work on that row; never duplicate that same job on retry. This is
   an exact-id check, not a search for jobs with matching plants.
   Find an existing customer by email, phone,
   then known name/company. Do not infer a person's name from an address.
   A new, identified customer gets its own `rosie_thread_id` through
   `message-routing`. If unidentified, `customer_id` stays NULL and any
   identity clues go in `customer_notes`.
4. Insert the reserved id with `OVERRIDING SYSTEM VALUE`. Explicitly set
   `status = 'quoted'` (displayed **Quote**). Store a job/site name only when
   supplied: a real residence, address, PO or project. Leave `name` NULL
   otherwise; the app constructs the company/job display title. Even committed
   intake creates this job record first; successful order creation advances it
   to `committed` atomically. Do not generate a quote just because the initial
   database status is `quoted`, or mark a job Committed without its order.

   ```sql
   SET app.actor TO 'rosie';
   INSERT INTO job_requests
     (id, customer_id, name, status, customer_notes,
      expected_install_date, fulfillment_method)
   OVERRIDING SYSTEM VALUE
   VALUES ($jobId, $customerId, $name, 'quoted', $customerNotes,
           $expectedInstallDate, $fulfillmentMethod);
   ```

   **Capture EDD during every job ingestion/creation, including quick quotes.**
   Read the supplied message, attachments and ingestion context for the
   expected install date (displayed as EDD). Save a supported, unambiguous
   date in `expected_install_date`; use a date already supplied without asking
   again. Resolve relative dates only when the source date and intended day
   are clear. Do not substitute the ingestion/creation date, quote deadline
   or supplier fulfillment date, or invent a day from a vague date range.

   If EDD is missing or ambiguous, create/reuse the job and its known rows
   first, leave `expected_install_date` NULL, then ask in the original request
   conversation: "What is the expected install date (EDD)? Enter a date, or
   choose Unknown." Every EDD question, including a webchat questionnaire,
   must offer **Unknown** explicitly and allow the user to enter a date.
   Unknown means SQL NULL, not the string "Unknown" or a placeholder date.
   If the user/source already says the date is unknown, accept that without
   asking again. Missing/unknown EDD does not block intake, sourcing, quoting
   or direct orders; continue work that does not depend on the date. Save a later answer
   on the existing job using the guarded-write discipline in [write discipline](writes.md).
   Re-ingestion with no date must not erase an existing known EDD; clarify
   conflicting dates before replacing it.

   Save pickup/delivery choice in `fulfillment_method` (`pickup` or `delivery`)
   and keep an unknown choice NULL. EDD is the customer's planning date,
   separate from the supplier order's actual confirmation and fulfillment dates.

5. Create item rows before asking questions: one per clearly separate
   requested line, preserving the supplied plant name, size and quantity.
   Missing size, quantity or price stays NULL and does not prevent creating
   a row with a supplied plant name. If the plant name itself is missing,
   record the unresolved request in job notes and create the other rows;
   do not invent a name to satisfy the required column.
   Preserve unresolved alternatives in the original line without choosing,
   splitting or combining requirements. For example, record
   `20 live oaks, 15 G or 30 G` as one row with name `live oaks`, size
   `15 G or 30 G` and quantity `20`, then research both sizes. For size-only
   alternatives, apply [requested-option selection](requested-options.md) without redundant clarification;
   do not assume a mix or duplicate the total.
   Follow an explicit allocation already supplied. For plant alternatives,
   unclear separate demands or an unresolved mix, clarify separate
   requirements versus alternatives and per-option versus total quantities
   after completing independent work, before splitting/combining items,
   selecting a plant/size, or generating the affected quote/availability ask.
   Never duplicate a total across options or assume every named plant is
   required. Report prices for unresolved alternatives in chat; add them to
   sourcing notes only when [notes](notes.md) applies. Leave `unit_price` NULL until
   a price applies to the requested line.
   Normalize gallon tokens to `G` (`30 gal or larger` → `30 G or larger`).
   A duplicate-key error on the job means re-read, then add only genuinely
   missing items. Continue independent sourcing with the recorded lines;
   report completed intake work and remaining gaps accurately.
6. Later customer mapping is guarded with `WHERE customer_id IS NULL`; a
   concurrent app mapping wins. Never write derived thread references; the
   database links each job to `jr-<id>`.
