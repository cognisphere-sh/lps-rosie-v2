# supplier-coordination — changelog

## 6.4.0 — 2026-10-21

- Chris, JR-111: every Rosie Submit/re-submit requires his explicit confirmation; editing/correction approval is not re-submit approval. Removed automatic re-submit from correction examples.

## 6.3.0 — 2026-10-21

- Chris, JR-111: acknowledge supplier chat availability simply, never request Submit; relay to the job and confirm with Chris before any AR/JR changes from the response. Replaced automatic portal-chat transcription.

## 6.2.3 — 2026-10-21

- Migration 0150: change-log bullets go in `orders.change_log`; contact changes update `orders.additional_details`.

## 6.2.2 — 2026-10-21

- Order change-log entries are bullets; contact changes update their field.

## 6.2.1 — 2026-10-21

- Order change notices: only material changes get a change-log row in `orders.additional_details`; contact/address changes update their Field row; events get neither.

## 6.2.0 — 2026-10-21

- Migration 0149: order change lines go in the change log of `orders.additional_details`; pickup/delivery and the target date are the job's; a supplier who acknowledged in the portal sends changes through the chat.

## 6.1.0 — 2026-10-21

- Supplier tabs show only what the supplier sees (their whole history, every job), so sent email is recorded in their conversation with `--portal`. Portal replies are routed by the supplier's own thread (the router thread is gone).

## 6.0.0 — 2026-10-19

- Bhoumik: one thread per job handles its suppliers. All supplier work (ARs, answers, orders, questions, email) runs in `jr-<id>`; messages go into the supplier's shared conversation with `--thread-id <conversation>` and are tagged with the job, so the job's supplier tab and the portal's job link show them. Submissions and order events land on the job thread (no relay); emails are logged with `--log-as supplier`; Chris's `@Supplier` messages already reached the supplier.

## 5.9.0 — 2026-10-16

- Migration 0146: an order belongs to one job (`orders.job_request_id`) and one supplier; the supplier's notes are saved as `note_from_supplier` on the order and rows. Messages name the job from the order's own job; no allocations.

## 5.8.0 — 2026-10-15

- Migration 0143: a copied original's or seeded `unit_price` with no price found is NULL, not 0 (0 is a $0 price).

## 5.7.2 — 2026-10-15

- Migration 0139: no job-less ARs; `candidates.demanded_quantity` is dropped (the AR asks for the job line's Qty), and every AR line has a job line.

## 5.7.1 — 2026-10-15

- Migration 0136: the AR asks for the job line's demand; a candidate on a job line carries none, so a copied original no longer sets `demanded_quantity`.

## 5.7.0 — 2026-10-14

- Migration 0130 (Bhoumik 2026-10-13/14): APS ARs ask each line's default unless another APS candidate is selected, other suppliers their own original or a copy of the default; no automatic New — adding to a submitted, processing or closed AR needs `reopen_availability_request` first; `diff_size_sub` replaces `diff_size_qty_sub` as the substitute's status; transcription payloads per answer (Available sends no quantity, no `offer_unit_price` / `offer_quantity`; a candidate asked on the AR can't be picked as a substitute).

## 5.6.1 — 2026-10-05

- responses.md: the portal picker offers Unavailable and Diff Sz/Sub as separate options again (2026-10-05); Diff Sz/Sub is still stored as Unavailable naming a substitute.

## 5.6.0 — 2026-10-05

- One AR per job and supplier (Bhoumik 2026-10-05, migration 0128): later asks to a supplier for a job are added to its existing AR; the database refuses a second AR. A closed one is reopened with Chris's go-ahead. Adding to a published AR shows the lines to the supplier at once, so Chris approves that scope before the add, and the supplier is told which lines are new. Chris's drop target on the job page is now the supplier's AR tab.

## 5.5.0 — 2026-09-30

- Portal answers (2026-09-30): Diff Sz/Sub is no longer picked; Unavailable/Sub with a ticked or typed substitute reads Diff Sz/Sub. The substitute is not listed as its own AR row (0124); relay it from `ar-snapshot`.

## 5.4.0 — 2026-09-30

- Migration 0123 (Bhoumik 2026-09-30): a substitute is applied when the supplier saves: the asked candidate becomes Unavailable (`offered_candidate_id` set) and the substitute its own Available row on the AR; a typed substitute is created as a raw-named candidate that Rosie enriches after submission (name/size split, description, customer note, price if missing).

## 5.3.1 — 2026-09-30

- Migration 0122 (Bhoumik 2026-09-30): a status never changes a candidate's price; Unavailable (and a substitute answer) sets only the quantity to 0.

## 5.3.0 — 2026-09-30

- AR scope (Bhoumik 2026-09-30): each line asks its selected candidate; with none selected, its original-ask candidate. Replaces "always the original ask unless Chris picks".

## 5.2.0 — 2026-09-30

- Migration 0121: new answer `partial_qty`; Diff Sz/Sub always names a substitute (`offered_candidate_id` or `offer_description`, with `offer_unit_price`/`offer_quantity`), and Unavailable with one is saved as Diff Sz/Sub. Transcription keys drop `size`; relays name the substitute and flag typed ones for the job thread.

## 5.1.0 — 2026-09-29

- Conflicting or incomplete answers (Bhoumik 2026-09-29): relays flag an answer whose status, size or quantity disagrees with its note, with the note's reading; the job thread settles it with Chris, and a Chris-approved correction is the one exception to "never rewrite supplier answers".
- Quick questions (Bhoumik 2026-09-29): new `questions` artifact — partner suppliers get clarifying questions as a webchat MCQ questionnaire in their portal chat (`webchat-cli ask --portal`), their answers are transcribed like any portal answer; `multiSelect` questions take several choices (checkboxes); non-partners get the same questions in an approved email.

## 5.0.0 — 2026-09-29

- Candidates (migration 0119): AR lines are candidates. `create_availability_request($supplierId, candidate ids[], ...)` and `add_candidates_to_availability_request` replace the JSON line/allocation payload; the app's drag onto an AR runs `request_candidate_availability`. Candidates carry `note_for_supplier` (LPS ask) and `note_from_supplier` (reply); transcription writes `size`/`note_from_supplier`, and `unavailable` zeroes quantity and price. Relays match lines through `candidates.job_request_item_id`; the database copies selected candidates' answers onto job lines.
- No questions about substitutes or alternatives (Bhoumik 2026-09-29): customer-allowed options are candidates on one line and are not sent back to the job thread to resolve.
- One AR per job (Bhoumik 2026-09-29): never combine jobs in an AR; `create_availability_request` takes one job's candidates; submissions relay to the AR's job; partner ARs record `availability_sent` when sent.
- Draft ARs (migration 0120): ARs start as `draft` (invisible to the supplier); `send_availability_request` makes them `new` and gives non-partners their public link. Only Rosie sends (the app has no Create AR or Send button): she creates the draft with the candidates Chris chose and sends it once he approves, or when he asks her to send an existing draft. Chris asks a supplier by dropping a candidate on its tablet in the job header (newest non-closed AR for the job; a submitted one reopens as New). Candidates carry a required `description` (what it is) separate from `note_for_customer`.
- Notes by audience (Bhoumik 2026-09-29): a candidate's `note_for_supplier` carries the customer requirements (from `note_internal`) that matter to the supplier.

## 4.0.0 — 2026-09-28

- Rewrite in plain language. Artifacts merged to availability-requests (channels, create-request, manual-inputs), responses (transcription), orders (order-changes), email (records); supplier-links moved into SKILL.md. AR note wording now lives only in job-requests notes. Order change log uses `orders.note_for_supplier`.

## 3.35.0 — 2026-09-24

- Chris's explicit JR-78 webchat messages 33–34 (11:40 CDT): relay unambiguous submitted APS availability and the narrow Carolina Cherry Laurel 24-inch-box/30-G equivalence without unnecessary supplier clarification. Preserve exact linked allocations and original customer request; hand off Chris's explicit scoped instruction to the job owner. “Always do this” does not expand first-submission standing write authority to later responses or other jobs/suppliers.

## 3.34.0

- Merge customer requirements/outcomes into `note_for_customer` and supplier instructions/responses into `note_for_supplier` across headers and items. Preserve current sourcing constraints, exclude spacing and unrelated non-sourcing content, and use the new schema/RPC contract.

## 3.33.0 — 2026-09-24

- Chris's explicit JR-73 webchat feedback (message 5, 02:39:03 CDT): before publishing an ordinary approved AR, verify the job owner attempted pricing across all in-scope rows and return skipped rows for that pass. Unresolved prices or unanswered same-size color/variant proxy choices remain NULL; Chris chooses any proxy seed, and an approved original-plant AR is not indefinitely blocked by a genuine price gap.

## 3.32.0 — 2026-09-24

- Chris's explicit JR-72 webchat instruction (message 36, 01:49:21 CDT): hand off verified first explicit APS AR submissions with exact linked allocations and standing-authority flag so the job owner can update supported status, notes and alternative pricing without a repeat approval question. Draft edits, resubmissions, other suppliers, ambiguous allocations and outreach remain outside that authority.
- JR-72 webchat message 40 (01:53:06 CDT): supplier-response alerts lead with the result and next action, use bullets for multiple points and omit AR/job details already visible in the app; deployment prompt applies this to all Chris/supplier messages.

## 3.31.0 — 2026-09-24

- Chris's explicit JR-72 webchat feedback (messages 26–27, 01:39:23–01:39:32 CDT): trim supplier notes further. Bare cultivar options carry the sourcing meaning (`Atrosanguinea or Shalimar Red cultivar`); omit needless `acceptable` and accidental trailing characters. Live AR correction stays with supplier owner.

## 3.30.0 — 2026-09-24

- Chris's explicit JR-72 webchat feedback (message 23, 01:37:55 CDT): include only sourcing-required content in AR `note_for_supplier`. Do not repeat structured line plant/size/quantity/seed price (including `Please price Gilt Edge 15 G` for an unpriced line), or include project headings/customer names such as Radia/Wilkinson without a sourcing purpose. Leave redundant header/line notes blank; retain genuine supplier-relevant requirements/questions.

## 3.29.0 — 2026-09-24

- Chris's explicit JR-72 webchat feedback (message 17): remove quote-completion prerequisite for an ordinary non-quick-quote APS AR. Require supported pricing or explicit gaps, original ask, allocations and Chris's scoped approval before portal publication; quick quotes and committed/direct orders still skip AR.
- Chris's explicit JR-72 webchat feedback (message 20, 01:34:29 CDT): keep `note_for_supplier` brief and positive, limited to requested specs and supplier-facing questions; do not forbid other size/cultivar recommendations or negate ambiguous quantities. The supplier may recommend a difference without that becoming an approved alternate ask.

## 3.28.0 — 2026-09-23

- On an explicitly submitted Diff Size/Qty/Variant supplier line, relay actual alternative details to the job thread for note/evidence update, alternative price research and Chris's price decision. Supplier price follow-up requires specific Chris approval if no reliable price is found; unsubmitted edits or a different offering alone authorize no outreach or JR availability/status/source changes.

## 3.27.0 — 2026-09-23

- Chris's JR-69 accepted-proxy pricing instruction: seed an approved APS AR line with the price of a proxy Chris accepted for that scope, retaining the original customer plant/size/cultivar and NULL inventory mapping unless an exact match is independently verified. Distinguish price acceptance from actual substitution, stock evidence and supplier confirmation; no post-create answer-field price update.

## 3.26.0 — 2026-09-23

- Chris's JR-69 AR clarification: almost always ask availability of the original customer-requested plant and size unless he specifies otherwise, even if APS has no exact catalogue row or price. Its price list is non-exhaustive indicative sourcing evidence, not actual availability; do not substitute a listed proxy, omit an original line or infer stock. Preserve quote/send approval, original alternatives and exact mapping rules.

## 3.24.0

- Resolve order jobs and related ARs through the job-item mappings with supplier scope; remove instructions to inspect a nullable source AR pointer.

## 3.23.0

- Use singular directional note fields: `note_from_customer`, `note_from_supplier`, `note_internal`, `note_for_customer`, and `note_for_supplier`, according to table and audience. Preserve customer/supplier authorship and restrict external rendering to the appropriate recipient.

## 3.22.0

- Read job and item customer notes when preparing ARs; preserve supplier-useful requirements in header/line LPS notes with their allocation scope.
- Relay submitted supplier notes for audience-based updates to job/item external or sourcing notes, splitting mixed content and keeping unsubmitted edits local.

## 3.21.1

- Read job demand from `job_request_items.demanded_quantity` when building availability snapshots; retain per-job allocation `quantity`.

## 3.21.0

- Replace Hidden with AR soft deletion; preserve saved status/token, reject deleted-request work and require explicit AR reopening.

## 3.20.0

- Use `availability_request_jobs` for every AR header relationship; remove the legacy direct job hint and retain header history after line deletion.

## 3.19.0

- Separate line-level LPS instructions from supplier-authored responses; use `lps_notes` below the plant and `supplier_notes` in its own column. Preserve useful customer, variety and special-request details.
- Use `demanded_quantity` for the AR line total and junction allocations for every job-item association.

## 3.18.0

- Split supplier work by event/action; retain publication gates, submission-only relays, portal identity, allocation and send-verification rules.

## 3.17.0 — 2026-09-22

- Use database-assigned per-job AR and Order record names; keep numbering stable and separate from supplier messages, which still use only job names and portal links.

## 3.16.1 — 2026-09-22

- Use only job names in supplier-facing references; omit JR/AR/order numbers from subjects, messages and link labels while preserving valid portal URL targets.

## 3.16.0 — 2026-09-22

- Require job names and verified direct supplier-portal links in all Order/AR update messages, including acknowledgments and follow-ups. Cover shared jobs, authorized public AR links and scoped job-name disclosure.

## 3.15.0 — 2026-09-22

- Require actual supplier messages for verified post-placement order changes, with standing authorization for scoped portal/email notifications.
- Coordinate brief orders.notes summaries with the job owner, acknowledge supplier-originated changes, and verify delivery with retry/deduplication safeguards.

## 3.14.0 — 2026-09-21

- Add Chris's APS-only manual-input procedure for correcting an active unanswered AR's LPS-side size, seed price and supplier-useful notes without treating it as a supplier response.
- Preserve requested identity, allocations and exact-mapping boundaries; allow a manually directed APS price to remain unmapped when generic/proxy based, and restore New only when a field update mechanically advanced an otherwise unanswered request.

## 3.13.0 — 2026-09-18

- Skip AR preparation/publication for committed intake and direct quote-to-order handoffs; use the existing direct-order contract and its job allocations without requiring a source AR.
- Replace the obsolete support-AR/hidden-AR blocker, preserve acceptance and supplied-price evidence, and distinguish authorized order creation from separate message sends and availability overrides.
- Align supplier order lifecycle to New → Processing → Order Ready while jobs remain Committed.

## 3.12.0 — 2026-09-17

- Chris approved simpler JR notes: relay evidence for material current decisions/exceptions, not mandatory APS entries or dual summary/supplier boilerplate. Retain distinct supplier evidence and job-wide override provenance once; do not duplicate visible AR/order statuses or prices. Communication/submission gates unchanged.

## 3.11.0 — 2026-09-17

- Linked Chris-authorized no-AR order override to job-requests; preserve admin-vs-supplier provenance and original-chat publication approval.
- Captured verified hidden-AR creation/answer blocker; no automatic APS publication, temporary visibility, fake submission or unsupported order bypass.

## 3.10.0 — 2026-09-17

- Chris-authorized concise shared notes: only additional customer-useful exceptions; no phase labels, supplier/price-sheet references or pricing-identity explanations. Preserve phase grouping elsewhere.
- Replace fixed substitution sentences; approved dwarf loropetalum/Purple Pixie pricing retains demand identity. Availability/NA wording needs actual evidence, never missing catalogue pricing; other requested sizes carry supported prices or neutral pricing gaps.

## 3.9.0

- Chris authorized Can Order response handling: after his exact job-line approval, relay schema-valid `need_to_order` with the approved demand/allocation as `available_quantity`, never a shared supplier total.

## 3.8.0

- Include submitted request-wide supplier notes in AR response reads and job relays, keeping them separate from LPS instructions and line availability.

## 3.7.0

- Align JR sourcing-note relays with Chris's latest-status rule: send current facts for an unlabelled plain-text overall summary and replace stale supplier snapshots in place.

## 3.6.0

- Distinguish the JR’s single actual quoted offering from the preserved original-demand scope of supplier availability requests, and relay the exact customer-facing Substitute note without reasons or unavailable prices.

## 3.4.1

- Relay the canonical compact sourcing summary as `Outcome:` rather than the retired `Row:` label.

## 3.4.0

- Align AR preparation with Chris's cheapest-supported-requested-option quote rule while retaining all original requested alternatives and total demand unless AR scope is separately resolved.

## 3.3.0

- Keep local/saved supplier portal edits on the supplier thread until explicit submission; only submissions relay to linked jobs and Chris. Authorize safe transcription of trusted portal answers, store an `available` answer's quantity from the authoritative AR allocation total, and require the voice-response sequence: acknowledge, update, then ask the supplier to review and Submit.

## 3.2.0

- Distinguish supplier Order confirmation from the Job Request lifecycle: preserve Confirmed Orders and confirmation dates while linked jobs remain Committed. Remove Confirmed from open job-stage rules.

## 3.1.0

- Relay current supplier facts for the canonical compact JR snapshot and single row outcome; replace the previous supplier update instead of appending event history.

## 3.0.0

- Require APS quote completion and Chris approval before AR publication. Use atomic many-to-many AR allocations, relay shared answers to every job, and coordinate separate supplier order confirmations and fulfillment dates.

## 2.10.0

2026-09-11 — Clarify that smallest-priced-requested-size quote selection is not
physical availability or automatic narrowing of AR scope. Preserve original
size alternatives and one total quantity unless separately resolved; avoid
redundant quote-size questions while resolving genuinely ambiguous supplier asks.

## 2.9.0

2026-09-11 — Distinguish Chris-authorized likely catalogue-name pricing from
genuine substitutions and independently verified exact AR mappings. No needless
alternative approval for mere names; generic-label pricing permission alone
does not authorize exact AR mapping, seed price or availability claims.

## 2.8.0

2026-09-11 — Align with Chris-authorized mandatory APS job-row notes and
supported gap alternatives. Require explicit approval to request availability
for alternatives before AR creation/send or supplier-visible alternative hints,
including automatic APS portal requests. Quote approval and internal candidate
notes do not authorize an alternative availability ask.

## 2.7.0

2026-09-11 — Relay supplier responses to Chris and qualifying sourcing notes;
no automatic availability/status, AR-answer or submission writes from replies.
Require Chris's explicit instruction for agent-written changes. Preserve
supplier-entered portal answers and explicit plant-sourcing decisions.

## 2.6.0

2026-09-11 — Use the job skill's Markdown supplier-entry format for sourcing
notes: bold, underlined names and concise keywords/numbers, without tables.

## 2.5.0

2026-09-11 — Treat lookup-only handoffs as research for Chris's chat response,
not outreach. Apply the job skill's sourcing-note rule to preparation and
event relays; distinguish delivered requests from pending send actions.

## 2.4.0

2026-09-11 — Complete independent supplier/request lookups, inventory mapping
and price preparation before clarification; have the job owner persist known
records and sourcing updates. Hold only actions dependent on the answer.

## 2.3.0

2026-09-11 — Review available evidence first and relay pricing/findings to
the job thread for the requester. Clarify any remaining order uncertainty
before creating/sending an affected AR, including automatic APS requests;
continue independent preparation without re-asking supplied details.

## 2.2.0

2026-09-11 — Route unresolved multiple-plant/size demand handling and quantity
allocation back to the job thread before creating/sending affected requests.
Limit request/item LPS notes to brief, specific context or hints that help the
supplier respond; omit generic boilerplate, repeated details and empty filler.

## 2.1.0

2026-09-11 (Bhoumik approval relayed by Lily) — Supplier edits, submissions and
message/email answers now require an explicit safe match to the availability
request, job, supplier and requested plant/item before relay. The relay carries
factual response context and source; the job thread records the factual
sourcing row and gives Chris a concise supplier/plants/source alert. Ambiguous
input is surfaced for review rather than guessed. Supplier input remains
sourcing evidence only and never automatically changes Job/Order status,
selects an offer, contacts a customer or treats the order as accepted.

## 2.0.1

2026-09-11 — Actual availability delivery moves Active/Quote jobs to Availability; distinguish the job stage from supplier request statuses and preserve Confirmed/closed jobs.

## 2.0.0

2026-09-10 — Unify partner/private and non-partner/public requests with HTML email. Use atomic answer RPC, draft/submission events and closed/reopened lifecycle. Approvals return to the original request chat.

## 1.10.0

2026-08-29 (Bhoumik) — new **§3.6: the supplier answers a request in the
chat**. A portal message that states availability — text, a photo of a tag or
a list, a voice note — is an answer, and rosie is the pen: resolve the request
from `Page` (the request's own path) or by matching the lines of their open
requests, read what they sent, write `status` / `available_quantity` /
`unit_price` / `notes` on the lines they named — only what they said, never a
guess or a prefill confirmed by silence — move the request to `processing`,
confirm `--portal` in their terms, mark `submitted` when they say they're done
or the last line is answered, then run §3's relay to the jr thread (no
`availability_submitted` event fires for her own write). The §2 rule that the
answer columns are never *seeded* is unchanged — this writes them from the
supplier's own words, on the supplier's own thread.

## 1.9.0

2026-08-28 (Chris approval relayed by Lily) — §4 now gives the approved
plain-language style for every non-Partner availability email: a brief,
light, concrete question rather than an internal request form. It forbids
“LPS job” and “Please confirm your availability,” calls for useful
project/location context and a real availability question, limits photo asks
to when useful, and preserves supplier-specific preferences and the
per-draft Chris approval gate.

## 1.8.0

2026-08-26 (Bhoumik, same day as 1.7.0) — §2's mapping bullet catches up with
the app, and reverses what 1.7.0 said about who can see the column. The
**supplier's portal** has a **By item** view that groups their open asks by the
catalogue row each maps to — and lets them answer the group together, in the
same line table the request's own page uses — and they place a line by dragging
its job name onto one of their own rows. So `mapped_inventory_id` is supplier-visible *and*
supplier-writable — the only column of ours that is. Two consequences for this
thread: what you write at share time is what that view opens on, and **a
mapping the supplier set themselves stands** — it is better evidence than our
look-up was, so never overwrite one with a search of your own; ask them if it
looks wrong. Their *answer* is unchanged: `status`, `available_quantity`,
`unit_price`, `notes`, and nothing else.

## 1.7.0

2026-08-26 (Bhoumik, same day as 1.6.0) — §2 gains
**`availability_request_items.mapped_inventory_id`** (migration 0077): the
supplier's own catalogue row our look-up matched to a line is now *written
down*, not just used and discarded. It was already the thing `unit_price` was
seeded from — the pair is now **both or neither**, so a seeded price always
names the row it came from. A near-miss is still not a mapping (it is an
`lps_notes` sentence), and NULL stays the ordinary answer on the lines that
matter most. §3 reads each supplier answer against it: the same
`diff_size_qty_sub` means something different on a line that mapped than on
one that mapped nothing, and the answer never rewrites the mapping. Nothing
renders the column yet, by design.

## 1.6.0

2026-08-26 (Bhoumik) — §3 tracks the supplier portal's restructure. The
per-line vocabulary gains **`arriving_soon`** and renames `substitute` to
**`diff_size_qty_sub`** (migrations 0075/0076): the answer always covered a
different size or quantity as well as a different plant, and the stored value
now says so. The table also records what the portal writes alongside a status —
`available` fills `available_quantity` from the demand, `unavailable` clears it
— so a relayed answer is read the same way it was given. New paragraph on the
request's own `status`: `new` → `processing` → `submitted`, with `new` re-set
by the database whenever we add a line to a request the supplier had already
started. The button they press is **Submit** / **Re-Submit**, not Save.

## 1.5.0

2026-08-25 (Bhoumik, same day as 1.4.0) — *Judgment calls* becomes *Judgment
calls, and where Chris is asked*: **anything about a job order that needs Chris
goes to that order's `jr-<id>` thread**, not this thread's web chat — not just
approvals but decisions and trade-offs. Ask here only about matters with no
order behind them (channel, preferences, standing terms). Inputs route to the
jr thread: answers, prices, substitutes, dates — anything that moves the order.

## 1.4.0

2026-08-25 (Bhoumik) — **approval for an order-related ask now happens on the
`jr-<id>` thread, not here** (`1-agent.md` rule 5). The jr thread drafts and
gets Chris's approval, then routes the approved text; this thread sends it
**exactly as approved** and comes back for re-approval rather than editing it.
Outreach with no order behind it is still drafted and approved here.

## 1.3.0

2026-08-25 (Bhoumik) — **rosie has her own mailbox**
(`chris@localplantsupply.com`, as *Christopher Runyon*): §4 outreach to a
non-Partner is now drafted, Chris-approved and **sent by her**, replying in
the same Gmail thread and routing the answer back with a `--gmail-thread-id`
rule — no longer relayed through Chris or daisy's mailbox. **First contact
with a brand-new supplier stays daisy's** (part of onboarding); everything
after it is rosie's.

## 1.2.0

2026-08-25 (Bhoumik) — **the supplier thread's web chat is now its contact
history**, matching what `customer-coordination` has done for customers since
migration 0073. Every supplier contact is posted there in the same task:
direct communication (the ask as sent, their reply, a relayed text) quoted
**in full** with subject, from/to and a Gmail deep link where a message id is
known; a forwarded broadcast gets header-only treatment. Portal chat is
exempt — a supplier's portal message and a `--portal` reply are already rows
on this thread, so only contact that happened outside the panel gets quoted.
Milestones keep posting as before. `notes.md` no longer carries dated pointers per exchange —
only open follow-ups. Never `--portal`.

## 1.1.2

2026-08-25 (Bhoumik). `suppliers.is_onboarded` is now
`suppliers.is_lps_partner` (migration 0074) — §0 and §1 name the new column.
The flag never changed meaning; the column now says what everything reading it
already said, and no longer collides with daisy's sense of *onboarding* a
supplier into the database.

## 1.1.1

2026-08-24 (harness 0.10.1). Description rephrased to the tightened spec —
"what's included" is a brief sketch rather than an exhaustive contents list,
and partial applicability moved under "use when". No procedural change.

## 1.1.0

2026-08-24 (Bhoumik). Chris is asked **on this thread's own web chat** — the
share-details preference (§0/§2) and the non-Partner draft approval (§4) no
longer route via `main`; `main` remains only the Telegram escalation for a
critical blocker.

## 1.0.0

2026-08-23 — Initial version (Bhoumik's rosie restructure). Rosie takes over
order-side supplier coordination on one dedicated thread per supplier
(`suppliers.rosie_thread_id`, migration 0068): availability requests for LPS
Partners (`is_onboarded`) — creation absorbed from daisy's retired
`availability-requests` skill, minus the dropped `supplier_messages` mirror
and minus the per-request Chris go-ahead (creating the request is now the
thread's standing responsibility; only unremembered preferences go to Chris) —
per-supplier coordination preferences remembered in `suppliers.notes`
(`share_customer_details` first among them), `availability_submitted`
handling with relay to the `jr-<id>` thread, Chris-gated outreach through
Chris or daisy's mailbox for non-Partners, the supplier's portal chat
(§3.5 — `Channel: portal` inbound, `webchat-cli --portal` replies, which are
the only messages the portal shows), the panel's `ar:`/`thread:` action
buttons on webchat reports, `lps_notes` at request and line level (migrations
0070/0071 — the mapped substitute + price, special customer requests, job
context), and per-thread web-chat milestones.

(Restored 2026-08-23 after rosie's `skills/agent/` directory was wiped on
disk between harness restarts, same content.)
