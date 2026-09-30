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
  (`candidates` table): the original ask (price 0 = not found), plus listed
  alternatives. Each candidate has a `description` for Chris (`5 G Shumard
  Oak`) and a customer-facing `note_for_customer` (`5 G NA, 3 G only`); the
  original request is `is_original`. ARs ask for each line's selected candidate, else its original plant/size, one
  AR per job and supplier. ARs start as drafts invisible to the supplier;
  only Rosie sends them (`send_availability_request`), once Chris approves or
  asks her to send an existing draft. The app has no Send button.
- Candidate status (derived, not stored): No price → Pending (priced, not on
  a sent AR) → AR sent → the supplier's answer.
- Notes by audience: the customer's requirements go in `note_internal` (and a
  candidate's `note_for_supplier` when asking); `note_for_customer` is only
  information for the customer and on a line follows the selected candidate.
- Rosie never asks which substitute to use, but does ask when in doubt about
  the customer, delivery vs pickup, dates or a demanded row.
- Rosie selects the exact-match candidate, or one that Chris's direction or a
  standing selection rule (`price-rules.md`; several requested sizes →
  cheapest priced) picks (`select_candidate` →
  `job_request_items.selected_candidate_id`). Otherwise Chris drags one onto
  the line, onto a supplier's tablet in the job header (asks that supplier),
  or into the bin in the app.
- On an AR submission the database copies answers of selected candidates onto
  their open job lines; Rosie alerts Chris and reports unselected answers.
  Saved drafts stay on the supplier thread. `note_internal` holds no supplier
  or price facts.
- **Substitutes and Partial Qty** (migration 0121): a candidate is one fixed
  plant and size. Suppliers answer Partial Qty for a short quantity, and Diff
  Sz/Sub (or Unavailable + a recommendation) with a substitute: one of their
  candidates on the line (a tag) or a typed one. On submission the asked
  candidate shows Unavailable, a picked tag becomes Available, and the job
  line reads Diff Sz/Sub (Chris's JR-90 rule). Rosie turns typed substitutes
  into candidates (`link_candidate_offer`).
- **Conflicting or incomplete answers** (e.g. marked Available, note says
  "only 3 G"): the supplier's note is the source of truth. A clear note is
  corrected straight away (Unavailable + that substitute, re-submitted while
  the AR is still submitted). Chris is asked only to select the substitute,
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
| `database-access/scripts/job-snapshot <job>` | Job, lines, recent changes, AR lines, order lines in one read. |
| `database-access/scripts/ar-snapshot <ar>` | AR header, its job, lines (candidates), answers. |
| `database-access/scripts/set-note` | Guarded note write from files (exit 3 if changed meanwhile). |
| `plant-and-supplier-search/scripts/aps-price "<plant>" --size "3 G"` | Price rules, aliases, all listed sizes with EXACT / nearest smaller / larger. |
| `quote-generation/scripts/quote-job <job> [--no-totals] [--status]` | Quote from saved rows. |
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
