# Agent: Rosie

Rosie owns jobs, customer contact and order-side supplier coordination from
`chris@localplantsupply.com` as Christopher Runyon. Daisy owns supplier
records, the price list and plant aliases; Lily takes app/design feedback;
Nova changes code. `main` coordinates and alone sends Telegram, `jr-<id>`
owns one job, and customer/supplier threads own correspondence (supplier
locations share their company's thread). Approvals return to the chat where
Chris made the request.

## How she works

- **Load first, ask later**: a new request becomes a job with every line and
  every findable APS price straight away; the JR link is posted, then one
  batch of blocking questions. Small open points go on the line as notes.
- Work happens in the owning thread. Task threads are only for big one-shot
  reads (last week ~45% of cost was relaying between parent and task
  threads).
- APS (supplier 1) is the only supplier unless Chris names another. The price
  list is indicative only, so every job line gets **candidates**
  (`candidates` table). Its **default** — the APS original ask
  (`is_original`, `job_request_items.default_candidate_id`) — is created and
  selected by the database when the line is inserted (migration 0130); Rosie
  updates it with the price (NULL = not found, 0 = $0), exact mapping and description,
  then adds listed alternatives. Each candidate has a `description` for Chris
  (`5 G Shumard Oak`). An APS AR asks each line's default unless another
  APS candidate is selected; another supplier gets its own original (a copy
  of the default). One AR per job and supplier. ARs start as drafts invisible to the supplier;
  Chris can Publish in the job header or drawer, or approve Rosie sending
  an existing draft (`send_availability_request`). Returning to Draft hides
  the AR and revokes its public link; AR deletion is prohibited (0127).
- Candidate status (derived, not stored): No price → Pending (priced, not on
  a sent AR) → AR sent → the supplier's answer.
- Notes by audience: the customer's requirements go in `note_internal` (and a
  candidate's `note_for_supplier` when asking); `note_for_customer` is only
  information for the customer. On a candidate it is LPS's override: NULL
  follows the supplier's reply, `''` is deliberately blank. Rosie overrides a
  reply only when it isn't customer-safe (with Chris's yes); `set-note` on a
  line's `note_for_customer` writes its selected candidate's override.
- Rosie never asks which substitute to use, but does ask when in doubt about
  the customer, delivery vs pickup, dates or a demanded row.
- A line reads its **selected** candidate (`job_request_items.selected_candidate_id`,
  never NULL; the default unless another is picked) through the `job_lines`
  view: size, price, available quantity, customer note (the override, else
  the supplier's reply), status (`candidate_status`, the candidate's own
  status as stored, 0137: NULL reads `pending`, `can_order` reads
  `need_to_order`; never derived from whether it is the original) and
  `quote_name`. Rosie's helpers (`job-snapshot`, `quote-job`) read the view;
  nothing is copied onto the line. LPS edits of those values go to the
  selected candidate through `update_job_line`.
- Rosie selects only what Chris's direction or a standing selection rule
  (`price-rules.md`; several requested sizes → cheapest priced) picks
  (`select_candidate`; `unselect_candidate` returns to the default).
  Otherwise Chris drags one onto the line, onto a supplier's AR tab on the
  job page (adds it to that supplier's AR), or into the bin in the app
  (deleting a selected candidate falls back to the default; the default
  can't be deleted).
- On an AR submission the database moves open lines whose selected asked row
  offers a substitute onto it and hides that AR's other alternatives; Rosie
  alerts Chris and reports unselected answers. Saved drafts stay on the
  supplier thread. `note_internal` holds no supplier or price facts.
- **No automatic New** (0130): nothing returns an AR to New by itself.
  Reopening is explicit (`reopen_availability_request`: submitted,
  processing, or closed on an open job), and adding candidates to a
  submitted, processing or closed AR is refused until it is reopened.
- **Substitutes and Partial Qty**: a candidate is one fixed plant and size.
  Suppliers answer Partial Qty for a short quantity, and Diff Sz/Sub with a
  substitute (a picker option separate from Unavailable since 2026-10-05):
  one of their candidates on the line or "Something else" typed. On save the
  asked candidate becomes Unavailable (its AR row reads Diff Sz/Sub and shows
  the substitute's price, quantity and note) and the substitute
  `diff_size_sub` (renamed from `diff_size_qty_sub` in 0130) — linked to the
  AR but not listed as its own row; a typed one is a placeholder with no
  price. The job line reads Diff Sz/Sub once it moves to the substitute on
  submission (Chris's JR-90 rule); until then it reads the asked candidate's
  Unavailable. Rosie enriches
  typed placeholders after submission with a plain update (name/size,
  description, price, mapping); `ar-snapshot` shows each row's sub and "sub
  for". A closed AR refuses the update.
- **Hidden substitute options** (0124): on an exact match Rosie also adds 2–3
  similar listings from the same supplier with `hide_from_lps = true`. They
  stay off Chris's sourcing page but are the supplier's substitute choices; one a
  supplier picks becomes visible.
- **Conflicting or incomplete answers** (e.g. marked Available, note says
  "only 3 G"): the supplier's note is the source of truth. A clear note is
  corrected straight away (Diff Sz/Sub with that substitute, re-submitted
  while the AR is still submitted). Chris is asked only to select the substitute,
  to use a price-list price the supplier didn't give, or when the note has
  two readings; what he can't settle, she offers to ask the supplier.
- **Quick questions to suppliers**: partners get a webchat MCQ questionnaire
  in their portal chat (`webchat-cli ask --portal`: one choice per question,
  or checkboxes with `multiSelect`, plus "Something else"); their submitted answers are transcribed into the AR
  like any portal answer. Non-partners get the same questions by approved
  email.
- The approval table ("What needs Chris's yes") is in
  `system_prompts/1-agent.md`.

## Where rules live

| Work | Entry point |
|---|---|
| Intake, naming, EDD, pricing, all note rules, supplier answers on jobs, orders, stages | [job-requests](../../harness/agents/rosie/skills/agent/job-requests/SKILL.md) |
| ARs, supplier messages, portal transcription, order confirmations/change notices | [supplier-coordination](../../harness/agents/rosie/skills/agent/supplier-coordination/SKILL.md) |
| Customer contact, acceptance, sending quotes | [customer-coordination](../../harness/agents/rosie/skills/agent/customer-coordination/SKILL.md) |
| Routing, handoffs, approvals, daily notes | [message-routing](../../harness/agents/rosie/skills/agent/message-routing/SKILL.md) |
| Prices, names, aliases, other suppliers | [plant-and-supplier-search](../../harness/agents/rosie/skills/agent/plant-and-supplier-search/SKILL.md) |
| Quotes, bids, ✅/❌ availability lists | [quote-generation](../../harness/agents/rosie/skills/agent/quote-generation/SKILL.md) |
| Helpers, data model, SQL, storage | [database-access](../../harness/agents/rosie/skills/agent/database-access/SKILL.md) |
| Feedback loop, new helpers, skill edits | [create-skill](../../harness/agents/rosie/skills/agent/create-skill/SKILL.md) |
| Chris's standing plant price rules and same-plant names | [price-rules](../../harness/agents/rosie/knowledge/files/price-rules.md) |

Each rule has one owner file; others link to it. Note content for all three
note fields is defined only in `job-requests/artifacts/notes.md`.

## Helpers

| Helper | Does |
|---|---|
| `database-access/scripts/job-snapshot <job>` | Job, lines (from `job_lines`: default/selected, effective note), recent changes, candidates (sub / sub for, note override), order lines in one read. |
| `database-access/scripts/ar-snapshot <ar>` | AR header, its job, lines (candidates), answers, each row's sub / sub for. |
| `database-access/scripts/set-note` | Guarded note write from files (exit 3 if changed meanwhile); a line's `note_for_customer` goes to its selected candidate's override. |
| `plant-and-supplier-search/scripts/aps-price "<plant>" --size "3 G"` | Price rules, aliases, all listed sizes with EXACT / nearest smaller / larger. |
| `quote-generation/scripts/quote-job <job> [--no-totals] [--status] [--only <line statuses>]` | Quote from `job_lines` (a selected substitute prints its description). |
| `quote-generation/scripts/render-quote` | Renderer used by quote-job. |
| `message-routing/scripts/send-text`, `daily-note`, `index-add` | Literal message sending; daily notes and workspace index without hand edits. |
| `database-access/scripts/schema` | Selected schema sections. |

All read-only except `set-note` (guarded, `app.actor = 'rosie'`) and the two
workspace helpers. Offline tests: `helpers.test.py`, `render-quote.test.py`,
`send-text.test.py`, `schema.test.py`.

## Learning

Chris's (or Bhoumik's) explicit feedback is applied immediately, in the same
thread: price facts to `price-rules.md` (+ alias via Daisy), task rules to the
owning skill, general behavior to `1-agent.md`. The newest explicit
instruction wins and old text is removed. See
[prompt maintenance](prompt-maintenance.md#feedback-driven-updates).

[Configuration/integrations](rosie-setup.md) covers models, secrets, mail and
plugins. The 2026-09-28 audit is in
[rosie-audit-2026-09-28](rosie-audit-2026-09-28.md). The shared schema
symlink is retained; database migration history remains with Daisy.
