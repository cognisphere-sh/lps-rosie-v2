# job-requests — changelog

## 5.38.0 — 2026-09-23

- Chris's explicit feedback on his JR-69 UI edits at 10:51:47: customer-facing item notes should favor the concise verified offered-versus-requested fact, not an unsolicited customer-choice question. A verified clarification of an ambiguous original quantity/unit can merit a brief external note even where supply is available as requested. This changes note wording only; do not infer an offer, acceptance or stock from a short note, and do not copy his manual available-quantity edit into a general rule without clarification.

## 5.37.0 — 2026-09-23

- Chris's JR-69 internal-note brevity feedback: keep the factual current supplier, priced item/size and listed versus supplier price, received response and actual line change. `APS generic crossvine 1 G — list $8` suffices; omit `Chris approved provisional proxy`, approval/provenance chronology and unnecessary cultivar caveats. Retain required approval evidence in origin transcripts/handoffs and applicable structured records without conflating a list proxy with supplier confirmation.

## 5.36.0 — 2026-09-23

- Chris's Diff Size/Qty/Variant response workflow: on a safely matched submitted alternative, update the JR's current supplier evidence/brief internal note without automatically changing availability/status/source/offering or accepted pricing; research the exact alternative price and ask Chris whether to use it. If no supported price exists, obtain Chris's specific approval before supplier price outreach. Keep original demand and shared-job scopes separate.

## 5.35.0 — 2026-09-23

- Chris's JR-69 internal-note clarification: omit `AR response pending` and other obvious AR-status boilerplate; add a brief supplier response only after receipt, while retaining relevant current supplier/price and actual line-change facts.

## 5.34.0 — 2026-09-23

- Chris's JR-69 internal-note refinement: do not record rejected decisions or unused substitutions, such as `No 7G substitution`; retain only current supplier/price/response and actual implemented line changes or pricing-basis qualifications.

## 5.33.0 — 2026-09-23

- Relay Chris-accepted proxy seed prices as explicitly unmapped in the AR handoff for the original customer-requested plant/size, distinguishing them from verified exact inventory mappings and actual offering substitutions.

## 5.32.0 — 2026-09-23

- Chris's JR-69 internal-note feedback: retain only minimal current supplier, supplier price and response, plus current actual line-item changes/substitutions on the affected item. Identify catalogue/LPS proxy pricing as such, not a supplier quote or actual substitution. Replace stale facts; action/send/follow-up history belongs in workflow records and transcripts, not job/item notes.

## 5.31.0 — 2026-09-23

- Chris's JR-69 EDD clarification: populate `expected_install_date` from the customer's expected/requested pickup or delivery date, notwithstanding the legacy column name; ask for that date if absent, offer Unknown, and preserve nonblocking NULL where unknown. Do not use supplier actual fulfillment dates or invent a day.

## 5.30.0 — 2026-09-23

- Apply Chris's JR-69 customer-note audience restriction to job/item note writes: customer-facing notes cover approved alternatives for actual unavailability, meaningful actual size/quantity/variant differences, or orderable ETA/supplier details; availability as requested usually needs none. Keep cultivar/proxy caveats and supplier-directed availability questions internal, preserve existing useful external conditions and customer-origin notes, and keep pricing-only gaps out of customer notes.

## 5.29.0 — 2026-09-23

- Chris's JR-69 feedback: when the original plant has no listed price, retain the original plant/size in an approved APS availability ask rather than silently substituting or withholding the ask for lack of a catalogue price. Ask which price to use only when a genuinely very close same-size color/variant has a listed price; retain the price gap otherwise. Different sizes do not inherit that close-variant rule. Proxy pricing does not establish identity/stock or alter AR send and actual-substitution approvals.

## 5.27.0

- Remove the stored order-item AR pointer. Resolve related ARs through job-item allocations and supplier scope; document transient AR selection and quantity checks across direct and response-based orders.

## 5.26.0

- Apply Chris's job naming format, `Customer/Company Name | Slug`, to the stored job name. Prefer a known company name, otherwise the customer's name; derive a concise, readable slug from supplied site, project or other identifiable request details. Keep known components when information is incomplete and complete the name with guarded updates when details arrive.

## 5.25.0

- Use singular directional note fields: `note_from_customer`, `note_from_supplier`, `note_internal`, `note_for_customer`, and `note_for_supplier`, according to table and audience. Preserve customer/supplier authorship and restrict external rendering to the appropriate recipient.

## 5.24.0

- Apply the same simple note definitions to jobs and items: customer-supplied information, customer-facing quote notes and internal sourcing progress. Replace the older exception-only/AR-delivery eligibility restriction.
- Carry supplier-relevant customer notes into the matching AR header or line, and classify submitted supplier notes into external or sourcing notes by audience without changing offerings, availability or communication approvals.

## 5.23.1

- Use `job_request_items.demanded_quantity` for customer demand, intake, generated totals and approved supply scope. Keep allocation/order `quantity` fields unchanged.

## 5.23.0

- Keep AR reopening explicit and retire exclusive ARs on job deletion while retaining supplier snapshots.

## 5.22.0

- Resolve AR headers through `availability_request_jobs` after removal of the redundant `job_request_id` column.

## 5.21.0

- Align AR handoffs with `demanded_quantity`, junction-only job-item associations and separate LPS/supplier line notes.

## 5.20.0

- Replace the monolithic procedure with task references; preserve intake, approvals, lifecycle and concurrency rules. Read only the selected task and write discipline.

## 5.19.0 — 2026-09-22

- Use database-assigned per-job AR and Order record names; keep numbering stable and separate from supplier messages, which still use only job names and portal links.

## 5.18.0 — 2026-09-22

- Carry affected job names and the direct supplier-portal order link in change handoffs; reference the mandatory job-name/link format for Order and AR updates.

## 5.17.0 — 2026-09-22

- Require a brief, supplier-safe summary in orders.notes and a supplier notification whenever a placed order changes, including already-saved updates.
- Preserve existing notes and allocations, verify actual changes, and track note/send completion without duplicate messages or recursive notifications.

## 5.16.0 — 2026-09-21

- Add Chris's APS-only manual-input policy: an explicit manual price, size or supplier-useful note is a scoped APS quote/AR input while APS is exclusive, not supplier confirmation or a generic/proxy identity claim.
- Preserve requested identity and allocations; permit a manual APS AR seed price without an exact inventory mapping, but keep proxies/unverified matches unmapped and route safe correction/state handling through supplier coordination.

## 5.15.0 — 2026-09-18

- Create new job requests directly without searching existing jobs for matching plants, sizes, quantities or item lists, including requests from the same customer.
- Limit reuse to explicitly identified jobs, established job context and retries/continuations of the same known or reserved id. Keep order-allocation checks scoped to those identified job items; plant overlap does not prompt merging or duplicate-job questions.

## 5.14.0 — 2026-09-18

- Make Quote → Availability → Order the usual route with optional availability; already committed intake and accepted quotes create/reuse jobs/items and proceed directly to orders without a new quote or AR approval ask.
- Preserve supplied/accepted prices and offerings; fill only missing prices from APS. Carry exact commitment evidence, resolve material gaps and retain quick-quote stopping behavior until later acceptance.
- Replace the obsolete internal/admin support-AR workaround with migration 0100's `create_direct_order`, including exact allocations, retry checks and no invented availability. Align all order references to New → Processing → Order Ready while jobs remain Committed.

## 5.13.0 — 2026-09-17

- Chris approved the simpler default (JR-61 reviewed questionnaire): audience-specific additional notes only; supersedes every-APS-row research entries and mandatory summary-plus-supplier boilerplate.
- Job-wide context and admin override provenance appear once accessibly; preserve material source/proxy/cultivar/selection facts and supplier comparisons. Guard note-only cleanup, retain customer demand/agreements and shared exceptions, remove duplicate prices/statuses without operational changes.

## 5.12.0 — 2026-09-17

- Chris authorized a standing explicit no-AR order override: scoped job availability on his authority, plus necessary internal/admin support AR only if safely supported; provenance never supplier confirmation.
- Documented current no-internal-AR capability blocker, explicit publication gate, no fake submissions/create-then-hide or integrity bypass, and actual New-order/Committed-job result.

## 5.11.0 — 2026-09-17

- Chris clarified note ownership: customer notes contain only customer-origin requests/details; final/current Chris decisions belong in sourcing notes, never a trace of intermediate choices or exploration.
- Added mixed-note cleanup guards preserving original demand, phase membership, necessary evidence and unresolved constraints without changing operational fields.

## 5.10.0 — 2026-09-17

- Chris-authorized concise shared notes: only additional customer-useful exceptions; no phase labels, supplier/price-sheet references or pricing-identity explanations. Preserve phase grouping elsewhere.
- Replace fixed substitution sentences; approved dwarf loropetalum/Purple Pixie pricing retains demand identity. Availability/NA wording needs actual evidence, never missing catalogue pricing; other requested sizes carry supported prices or neutral pricing gaps.

## 5.9.0

- Chris authorized Can Order job-line updates to set schema-valid `need_to_order` and `available_quantity` together, using the approved whole-line demand or explicitly approved allocation rather than a shared supplier total.

## 5.8.0

- Capture EDD from ingestion evidence; ask for missing or ambiguous dates with an explicit Unknown option. Store unknown as NULL, continue independent intake work, and preserve existing dates on re-ingestion.

## 5.7.0

- Chris authorized sourcing notes to always reflect the latest status and information. The first overall row summary is now unlabelled plain text; retain compact latest supplier snapshots and replace superseded facts in place.

## 5.6.0

- Chris authorized quoted-offering fields to hold one actual offered plant and size only. Preserve original demand in customer context; every material difference uses `Substitute: <actual offering> instead of <original demand>`, without unavailable-price or rationale commentary.

## 5.4.1

- Replace the literal `Row:` heading in compact sourcing snapshots with `Outcome:` while preserving the same current-state summary and supplier entries.

## 5.4.0

- Chris changed multi-option pricing from smallest supported requested size to the cheapest supported requested option. Keep all other supported requested-option prices in customer-visible `external_notes` while preserving original demand and AR scope.

## 5.3.0

- Handle supplier AR responses only after explicit submission: saved local edits create no JR/Chris notification or sourcing-note update. Clarify that a submitted `available` AR answer carries the authoritative allocated-demand total but cannot automatically change its linked job item.

## 5.2.0

- Retire Confirmed from the Job Request lifecycle. Supplier confirmation still makes Orders Confirmed and records their dates; linked jobs stay Committed until explicit Won/Lost closure.

## 5.1.0

- Keep JR sourcing notes as one short current row outcome and one latest snapshot per supplier. Replace superseded updates, preserve current decisions/constraints, and leave event history in the changelog and transcript; add selected, pending-approval and quote-only examples.

## 5.0.0

- Replace Active with a quote-first APS workflow, stop explicit quick quotes, and require Chris approval before availability publication. Add Committed supplier orders, supplier confirmation, fulfillment fields and many-to-many job/AR/order allocations.

## 4.13.0

2026-09-11 — Aligned shared quote-note examples with Chris's minimum-word
feedback: size/price-only options, no “Quoted for” introductions or evident
selection restatements, and concise necessary variety questions/distinctions.
References quote-generation as format owner; sourcing notes, approval gates and
other operational procedures remain unchanged.

## 4.12.0

2026-09-11 — Chris authorized the smallest requested size with supported pricing
for multiple-size alternatives, without redundant clarification. Preserve original
options, save larger requested-size prices in shared item notes and distinguish
quote selection from stock confirmation or supplier AR scope.

## 4.11.0

2026-09-11 — Chris authorized direct supported pricing for likely equivalent
requested/catalogue plant names, with concise sourcing mapping/evidence instead
of alternative labels or unnecessary approvals. Includes his Agave naming
example; actual differences and unsupported equivalence retain alternative gates.

## 4.10.0

2026-09-11 — Chris authorized APS sourcing notes for every APS-scoped job row,
including quick quotes, priced matches and gaps. Record 1–2 closest supported
APS alternatives for gaps when found; require explicit action-specific Chris
confirmation in the original chat before alternative quotes or ARs. Preserve
research-only lookup behavior, Markdown format and original requested rows.

## 4.9.0

2026-09-11 — Chris clarified that quick quotes, including partial quotes and drafts, require create/reuse of the job, JR thread and every supplied item row before output. Pricing-only questions still create no job.

## 4.8.0

2026-09-11 — Surface supplier responses to Chris without automatic availability,
status or source-selection changes, including with multiple suppliers. Record
explicit supplier selections and other plant-sourcing decisions in the item's
notes. Separate Markdown entries with blank lines; remove divider lines.

## 4.7.0

2026-09-11 — Write sourcing notes as Markdown supplier entries: bold,
underlined names, then important keywords and tracking numbers. No tables,
pipe-delimited rows or full sentences. Retain `----` between suppliers and
the existing eligibility rule; store Markdown without a fenced wrapper.

## 4.6.0

2026-09-11 — Separate supplier entries in sourcing notes with exactly `----`
on its own line, using real newlines. Apply the same format when adding or
updating entries; retain the existing rule for when a sourcing note qualifies.

## 4.5.0

2026-09-11 — Add sourcing notes only for an availability request actually
sent/delivered, a concrete required supplier action or Chris's explicit note
instruction. Answer supplier lookups in chat first; catalogue matches and
candidate prices alone stay in chat. Apply this rule during intake, pricing,
alternative research and job/item note updates without blocking price writes.

## 4.4.0

2026-09-11 — Complete all independent actions before asking questions,
including job/thread creation, item rows, supported prices and sourcing
updates. Preserve missing fields and unresolved alternatives without guessing,
then apply clarification to existing records without duplication.

## 4.3.0

2026-09-11 — Investigate available records and pricing first, post findings,
then clarify any remaining order questions before generating the affected
quote or availability request, including automatic APS publication. Continue
independent work and avoid re-asking known details.

## 4.2.0

2026-09-11 — Clarify how demands mentioning multiple plants or sizes should
be handled before splitting/combining items or sending affected availability
asks. Distinguish separate requirements from alternatives and confirm quantity
allocation without duplicating totals or re-asking explicit instructions.

## 4.1.0

2026-09-11 — Restore Active, Quote, Availability, Confirmed, Won and Lost as distinct job stages. Align intake, delivery hooks, confirmation and non-regression rules with migration 0089.

## 4.0.0

2026-09-10 — Rationalise intake, short supplier rows and lifecycle hooks. Quick quotes create a job/thread without ARs; pricing questions create neither. APS is automatic/private by default; missing inventory prompts an offer to search others. Job reopening restores AR stages.

## 3.5.0

2026-08-31 (Chris, relayed by Lily) — Intake now keeps `job_requests.name`
NULL until a real job/site descriptor is known (residence name, street
number/name, PO, or named project/site). It must never store a combined
company/job title or an inferred generic description of the ask; `Company —
Job name` is display logic. This resolves §1's former ambiguity, which
permitted a fallback based on the shape of the ask while also warning against
invented names.

## 3.4.1

2026-08-26 (Bhoumik) — §5.2 sharpens what the availability ask must carry now
that the supplier thread *stores* the mapping
(`availability_request_items.mapped_inventory_id`, migration 0077): the
`inventory` **id** is the part that matters, and a near-miss must be named as
not mapping, so the other thread writes a note instead of a row. No change to
what this thread does otherwise.

## 3.4.0

2026-08-25 (Bhoumik, same day as 3.3.0) — generalised from *approval* to
**everything Chris-facing**: this thread is the **source for its order**
(`1-agent.md` rule 5). Every job-related approval, decision and question goes
to him here, never on the customer's or supplier's thread, and those threads
route their inputs back — supplier answers, customer replies, changed dates,
cut scope. One thread that knows the order's whole state; one place Chris has
to look.

## 3.3.0

2026-08-25 (Bhoumik) — **the jr thread is now where Chris is asked to approve
any communication about its order** (`1-agent.md` rule 5), customer contact
included. §7 changes from "message the customer thread what needs saying" to
draft here from customer-safe fields → approve here → route the approved text
verbatim for the customer thread to send. §5.2 does the same for outreach to a
non-Partner (a Partner's portal availability request still needs no approval).
One order, one place Chris is asked; the sending thread never edits an approved
draft.

## 3.2.0

2026-08-25 (Bhoumik). Migration 0073 dropped `customers.communication_notes`:
§2's append-only counter-example and §7's reference to the log are gone — the
customer's own thread carries the contact history (`customer-coordination`).

## 3.1.0

2026-08-24 (Chris, JR-9). Added the cultivar/color pricing convention: for
crape myrtles, plumbago and salvias, use Austin Plant Supply’s general line at
the matching size when its catalogue lacks the named variety/color. This is a
pricing basis, not a substitution; availability confirmation remains required.

## 3.0.1

2026-08-24 (harness 0.10.1). Description rephrased to the tightened spec —
"what's included" is a brief sketch rather than an exhaustive contents list,
and partial applicability moved under "use when". No procedural change.

## 3.0.0

2026-08-24 (Bhoumik). **`main` creates nothing; the jr thread writes the
rows.** §1 is restructured around that: `main` reserves the id
(`nextval('public.job_requests_id_seq')` — `id` is GENERATED ALWAYS, and an
unused reservation is a gap in the numbering, not a fault) and hands the ask
whole to `jr-<id>`; that thread reads its own row first, does the customer
find-or-create, then inserts the request **under its own thread's id**
(`OVERRIDING SYSTEM VALUE`) before the lines. The app's new **New job
request** button enters the same flow from the other end — it reserves an id
through `reserve_job_request_id()` (migration 0072) and opens the thread with
nothing behind it, so a thread whose `SELECT` comes back empty is a
reservation waiting for its ask, not an error.

## 2.1.0

2026-08-24 (Bhoumik). **The jr thread's web chat is the only webchat channel
to Chris about its job — nothing goes to `main`.** §5's round report and
§5.3's what-is-waiting message post on the jr thread itself (`webchat-cli
send`), where the notification reaches Chris; the `main` relay stays only as
the rare Telegram escalation for a critical blocker.

## 2.0.0

2026-08-23 (Bhoumik's rosie restructure). **Each request lives on its own
`jr-<id>` thread**, created at intake: `main` does only find-or-create the
customer + insert the request row, then hands the whole ask over; the jr
thread creates the items and runs the sourcing round (the
`…-§-[TASK]-§-jr-<id>-sourcing` task thread is retired). **Availability asks
go to rosie's own per-supplier threads** (`suppliers.rosie_thread_id`, the new
`supplier-coordination` skill) instead of daisy — she is no longer in the
order loop, and the ask's `supplier_messages` mirror-INSERT is gone with the
dropped table. §5.3's Chris gate moved with the channel: the supplier thread
creates the availability request as its standing job, and only unremembered
preferences (share customer details) go to Chris. §7 customer contact moved to
the customer's dedicated thread (`customers.rosie_thread_id`, the new
`customer-coordination` skill); the jr thread keeps the `quoted` status move.
Same-day additions: main routes any message about an existing request to its
jr thread; webchat acknowledgements carry the panel's
`[…](thread:jr-<id>)` button; §5.2's ask names the mapped `inventory`
rows (id + catalogued name/size/price) per line, which is what the supplier
thread seeds the availability request's prefill from; and every milestone is
posted to the jr thread's own web chat.

## 1.16.0

2026-08-19, from Chris, same day as 1.15.0. **The availability check takes
every line of the request, not the ones the catalogue couldn't answer.** §5.2
opened on "you ask her only for what your own look-up couldn't settle" — which
made the priced lines invisible to the very step that confirms them, and quietly
dropped the lines no price list matched. All of them go now: priced,
substituted and unmatched alike, with what the look-up found stated per line
(including "nothing on their list"), so daisy can raise one request for the
job. The only line left out is one Chris explicitly excluded, and his
instruction goes in its `sourcing_notes`. §5.3 names the two questions daisy
puts to him before it goes out — whether every line goes, and whether the
customer's name and address are shared — and the round's closing message to
Chris carries both.

## 1.15.0

2026-08-19, from Chris, after JR-5: rosie priced eleven lines off the Austin
Plant Supply list and marked them `available` — which 1.13.0's §5 rung 1 told
her to do in as many words. **A listing is not a confirmation.**

- **§5 opens on the rule.** The inventory tables are price lists someone
  published, Austin Plant Supply's included; a catalogue stock count is what
  the sheet claimed on ingest day. The ladder now settles which row *prices* a
  line, not whether it can be filled — every rung leaves the item `pending`.
- **New §5.3, "Confirming a line."** The only two things that move a line off
  `pending`: the supplier's own answer relayed by daisy (an availability
  request in their portal, or email/text — her channel, Chris's call), read
  through a table mapping their four answers onto the item statuses; or Chris
  saying to treat it as confirmed, recorded on the line. Ends on telling Chris
  what is waiting once the round is done.
- **§6 restates the vocabulary.** `available` and `alternative_proposed` are
  answers, not findings; a priced `pending` line is the correct shape of a
  sourced-but-unconfirmed line. §4.1/§4.2 follow: the `Substitute:` line goes
  in on proposal, the customer-visible `Quoted for …` note waits for the
  status move.
- **The round runs in a task thread** (`1-agent.md`), one per job request,
  spawned as the last step of intake (§1.4) — the look-ups, the item writes
  and the asks to daisy, off the thread Chris is on.

A third 1.14.0 was drafted earlier the same day — "availability requests are
rosie's, back from daisy" — and never applied: SKILL.md stayed at 1.13.0, the
skill stayed on daisy, and both agents' prompts and docs describe it there. It
is dropped.

## 1.14.0

2026-08-19, same-day follow-up: daisy's per-request task threads are gone —
every ask about a supplier, availability-request follow-ups included, goes to
the one `supplier-<id>` thread (§5.2).

## 1.13.0

2026-08-19, superseding 1.12.0's fork the same day: **rosie does not use the
portal channel herself** — daisy owns every supplier conversation, portal
included (Bhoumik). §5 rung 3 and §5.2 now route every supplier-side ask to
daisy, on the supplier's own thread (`supplier-<id>`, or the availability
request's task thread `supplier-<id>-§-[TASK]-§-ar-<arId>` for follow-ups;
`main` only when no supplier is in play yet), with the ask mirrored into
`supplier_messages` as an internal transcript row. The `availability-requests`
skill moved to daisy.

## 1.12.0

2026-08-19, alongside migration 0062 and the supplier portal. The sourcing
ladder's last rung forks on `suppliers.is_onboarded`: an onboarded supplier is
asked through an in-database availability request (the new
`availability-requests` skill), everyone else through daisy as before. §5
rung 3 and §5.2 name the fork; nothing else changes — pricing rules, the
sourcing-note line shape and the status vocabulary are untouched.

## 1.11.0

2026-08-19, from Bhoumik. **The shared note never mentions a supplier or a
price list unless someone explicitly asks for it.** §4.2 already ended on
"Supplier names and supplier pricing never appear either" — one sentence at the
tail of a paragraph about substitution reasons, easy to read as being only
about substitutions. It is now its own rule, and it names the whole category:
supplier names, supplier or catalogue pricing, price lists, stock counts, who
was asked and what came back. `Quoted for Muskogee Crape Myrtle 30 G.` is the
note; `APS quoted Muskogee at $265` is a `sourcing_notes` line typed into the
wrong column.

The rule now carries the exception it was missing: Chris or the customer can
ask for a supplier or a price to be named in what the customer sees, and then
it is written — that and nothing more, with who asked recorded in
`sourcing_notes` in the same task. A message that merely mentions a supplier is
not that instruction.

The §4 note table points at §4.2 so the rule is visible from the skim, and
`quote-generation` gained the same exception, since a quote's Comments cell is
filled from `external_notes`.

## 1.10.0

2026-08-19, from Bhoumik. **A sourcing-notes supplier line names what was
priced before the price, and says outright when it is a substitute.** New §4.1
gives the one shape every line follows:

```
<Supplier>: [Substitute: ]<the row they have> @ $<price>/unit[, <facts>]
```

`APS: $175/unit, Dwarf Sabal Minor/Silver Palmetto 15 G` made a reader work out
which half was the offer, and marked a swap — when it was one — with a trailing
`alternative` that is easy to miss at the end of ten lines. `APS: Dwarf Sabal
Minor/Silver Palmetto 15 G @ $175/unit` and `APS: Substitute: Thryallis 3 G @
$23/unit` read in the order the fact is thought, and the swap is the second
word of the line.

The catalogue row is named whenever its wording differs from the ask; when it
is word for word the ask the price alone carries it (`APS: $7/unit`). Naming it
is not restating the ask — it is *which row we priced*, which no column holds.
Nothing to price keeps its `@`-less form (`APS: no 30 G`), and so does a row
with no price on file.

`Substitute:` is the same test as the existing `external_notes` rule: the
prefix, a `Quoted for <offering>.` note and `alternative_proposed` are written
in the same task, and a catalogue that merely words the same plant differently
earns none of the three.

Every example in the skill moves to the new shape — §2's `E'…'` newline pair,
§4's sourcing sheet, §5.1's two blocks, §6's — and §5 rung 2, rung 3 and §5.2's
hand-back from daisy point at §4.1. §6's stray `30 gal` becomes `30 G` in the
same pass.


## 1.9.0

2026-08-18, from Bhoumik. Customer-facing substitution notes use `Quoted for
<offering>.`, and appear only when the offered plant or size differs from the
ask. A catalogue naming difference alone does not earn an `external_notes`
line.


## 1.8.0

2026-08-18, from Bhoumik. Normalize gallon notation in every
`job_request_items.size` value to `G` (`3 G`, never `3 gal`), including intake
and examples. This makes the job-request table agree with the inventory and
customer quote convention.


## 1.7.0

2026-08-18, from Bhoumik. **`unit_price` is an Austin Plant Supply price.** The
ladder already sent rung-3 lines to other suppliers; now what comes back stays
in `sourcing_notes` — supplier named, price included — and `unit_price` stays
NULL. §5 rung 3, §5.1 (new opening rule and a second note example) and §5.2's
hand-back from daisy all say the same thing: the column is theirs, the note
carries everyone else's.

The exception is the one that already existed. When Chris or the customer names
another supplier for the line (§5), that price goes in the column, and the note
says whose instruction put it there.

Why: the price column is read as one number in one currency of trust — what the
house yard charges. A rung-3 price silently sitting in it makes a quote out of a
lead, and Chris is the one who decides a line is worth buying in. Until he does,
the finding is a finding.

The description is rewritten short in the same bump — what the skill covers, in
a clause, plus when to use it. It had grown into a summary of the procedure and
was one edit away from pi's 1024-character cap.

## 1.6.0

2026-08-18, with migration 0061. Two changes from Chris.

**`internal_notes` is `sourcing_notes`.** Renamed on both job-request tables,
and throughout: the SQL patterns in §2, the notes table and both halves of §4,
the ladder in §5, the statuses in §6. ("Internal" said who may read it, which
the other two note columns already imply by contrast. The new name says what
goes in it.) `inventory.internal_notes` is daisy's and keeps its name.

**A customer-facing note names the change and stops.** §4's customer-visibility
rule no longer asks for an explanation: `external_notes` says what the customer
is being offered ("Substituting 3 G for the 5 G requested"), and the reason —
a price we don't hold, a grower who is out — stays a `sourcing_notes` line. A
note that argues its case invites a negotiation about the case. Sizes in either
note column are written `XX G`, the way the inventory prints them; only the
item's own `size` keeps the customer's verbatim wording. §5 and §6 follow.

## 1.5.1

2026-08-18. §2 spells out that a newline in psql is `E'…\n…'` — a plain
single-quoted `\n` stores a backslash and an `n`, which is how eleven item
notes came to read `APS: $23/unit, 3 G alternative\nVerde River: 5 G` on one
line in the app. One line per supplier only works if the breaks are real. The
three affected rows were repaired in place.

## 1.5.0

2026-08-18, with migration 0060. **`needs_attention` is gone** — the column is
dropped from both tables, the app's badges, filter and flag buttons are
removed, and §6 goes with them (Statuses and Contacting the customer renumber
to §6 and §7).

It was the weaker of two ways to say "a person has to look at this". The other
is `status`, which says it in a more specific word: `alternative_proposed` is a
substitution waiting on approval, `unavailable` is a line somebody must decide
about, `pending` is one nobody has answered. Only `available` needs no one — so
once the app derived its "Needs input" surface that way, the flag was marking
nearly every row, which marks nothing.

What replaces it, and was always the better record: the **status** for where a
line stands, and **`internal_notes`** for why. Where §5 used to say "set the
flag and let Chris pick", it now says the line keeps a status that says a
decision is open, with both options on its supplier lines.

## 1.4.0

2026-08-18, with migration 0059 and the matching app change. Three things from
Chris, all about what a note is for.

**`internal_notes` is free text, edited in place — not an append-only log.**
§2's fourth rule now splits the two columns that used to share one discipline:
`internal_notes` is a working sheet rewritten as things change (read it and
write it back in the same breath, keeping the lines you didn't come to change),
while `customers.communication_notes` stays append-only, stamped and signed,
because a contact happened at a time. The stamp-and-signature format added in
1.3.0 therefore applies to the contact log only — a supplier line that gets
rewritten can't carry an honest timestamp, and the changelog already holds who
changed what, when.

**Notes are terse.** §4 rewrites the item's sourcing sheet as a line per
supplier — `APS: $26/unit, availability requested` — with `APS` for Austin
Plant Supply, `$N/unit` for price, the line *updated* rather than added to, and
free text welcome for anything that isn't about a supplier. The request's own
`internal_notes` is now explicitly job-level only: what changed about the order
("Delivery date 8/22 → 8/29"), never a line's sourcing detail. Every example in
§5, §6 and §7 was rewritten this way.

**Requests get a name.** Intake now writes `job_requests.name` (migration
0059): what the job is called out loud, the site or project if the customer
named one, a few words otherwise — not the customer, not the id, and NULL
rather than an invented label.

## 1.3.0

2026-08-18. Two policy changes from Chris.

**Austin Plant Supply is the default source.** §5 is rewritten as a ladder:
price the line from Austin Plant Supply (`suppliers.id = 1`) — their catalogue
is in the database, so rosie looks it up herself; if they don't have the ask,
recommend their closest alternative; only when they can't cover it does the
line go to other suppliers, and then `internal_notes` must say why it left
Austin Plant Supply and whose price it now carries. Chris or the customer
naming (or excluding) a supplier overrides the ladder, recorded with who said
it. When an Austin substitute and another supplier's exact ask both exist,
both are recorded and `needs_attention` lets Chris pick. Asking daisy (§5.2) is
now explicitly the rung-3 step rather than the first move.

**Pricing writes one column.** New §5.1: `unit_price` only, from the row
sourced. `available_quantity` is never written by rosie — supply is settled by
people in the app — and `total` stays generated, `quantity * unit_price`, i.e.
the customer's *asked* quantity at our price. A `0` in an inventory row is not
a price.

**Notes are signed as well as stamped.** §2's entry format becomes
`[<stamp>] <Name>: <text>`, with a table of who a name means: `Rosie` for her
own work, `Chris`/`Bhoumik` for what they decided, `Daisy` for what came back
from her. Every example in §4, §5, §6 and §7 was rewritten in the new format.
Notes the app writes carry no name (it has no signed-in user); hers always do.

**needs_attention, against what the app now derives.** §6 states that the app
shows *Needs input* on any line whose status is not `available`, so a line off
rung 1 is already in front of the team; the column is for what the status
doesn't say — a choice only Chris can make, a price over budget, an ask that
couldn't be parsed.

The frontmatter description was tightened while being updated: it had been over
the 1024-character limit `create-skill` states since 1.1.0, and now fits.

## 1.2.0

2026-08-18, with migration 0058. `job_request_items.status` narrows from seven
words to four: `pending → available | alternative_proposed | unavailable`.
`sourcing` is gone because it described an activity rather than a state, and
the activity is already in `internal_notes` in more useful detail — §7 now says
so outright and shows the log entries that replace it. `confirmed` and
`cancelled` are gone: acceptance is a note plus `job_requests.status =
'closed_won'`, a dropped line is `unavailable` with the reason in the notes,
and a line entered in error is deactivated rather than statused.

## 1.1.0

2026-08-18. §4 now states what `customer_notes` is *for*: the remainder of what
a customer said, never a transcript. Everything a structured column already
holds — plant, size, quantity, address, identity — belongs in that column and
only there; the note column carries constraints, preferences, deadlines and
reasons that have nowhere else to live. Added a where-it-goes table, the rule
that restating the ask adds nothing, and the observation that a note
duplicating a column means the column was filled wrong. Intake step 3 now
points at the rule. Written alongside the app change that surfaces an item's
note as a sub-line under its name.

## 1.0.0

2026-08-17, with migration 0055 (which created `customers`, `job_requests`,
`job_request_items` and `job_request_changelog`). Initial version, written
alongside the rosie agent itself: intake incl. anonymous requests, the
concurrency discipline for UI-shared tables, the last-5-changelog fetch rule,
the three-notes split with the customer-visibility rule for quantity changes
and substitutions, sourcing via daisy by agent-message, `needs_attention`
conventions, both status lifecycles, and the Chris-approved customer-contact
flow.
