# supplier-coordination — changelog

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
