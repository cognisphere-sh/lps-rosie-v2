# supplier-coordination — changelog

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
