# supplier-coordination — changelog

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
