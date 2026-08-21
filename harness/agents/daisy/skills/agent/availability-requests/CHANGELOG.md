# Changelog — availability-requests

## 1.4.0

2026-08-19, from Chris. **A request carries the whole job, and two questions
go to him before it does.** §2's snapshot defaults to *every active line* of
the job request rather than a chosen few — a line missing from the supplier's
published list is the one they are most likely to surprise us on, and they can
only say so if it is in front of them; a subset is now Chris's instruction,
never an inference. §1 gains the two things the request cannot default and
that he answers in the same breath as the go-ahead: **does every line go**
(named by count), and **are the customer's details shared** — with a
four-line message shape to ask both. Nothing is inserted until he has
answered; the lines stay pending meanwhile.

## 1.3.0

2026-08-19, from Bhoumik. **Prefill the price when we already know it.** §2
seeds `availability_request_items.unit_price` from the supplier's own
`inventory` row — the one rosie's sourcing note names, or the one the look-up
found — so the supplier confirms or corrects a number instead of typing one,
and a price that has moved reads as a correction. Only a price that can be
pointed at a row, at that supplier, in the size asked for; `status`,
`available_quantity` and `notes` are never seeded. §3 says the consequence:
`status` is the only column that says they answered, so a NULL-status line is
unconfirmed whatever price sits beside it. The app's *Availability request*
button does the same prefill.

## 1.2.0

2026-08-19, same-day follow-up: **one chat per supplier — the per-request
(task-thread) conversation is gone.** Every supplier-events notification lands
on `supplier-<id>`; portal replies are supplier-level `app` messages
(`availability_request_id` NULL — name the request in the text); and the
portal's button is **Save** (status `submitted` renders as *Answered*; each
save re-notifies).

## 1.1.0 — 2026-08-19

Two rules from Bhoumik, same day:

- **Never mark or relay a plant as available before the supplier confirms it
  or Chris explicitly says so.** Inventory tables are listings, not
  confirmations; until a submission (or an email/text reply) lands, lines are
  relayed to rosie as listings and stay pending. §3's relay now names which
  lines the submission confirmed and which stay pending.
- **Raising an availability request needs Chris's go-ahead** — the portal is
  no longer standing-authorized per request. Unless Chris asked for one (or
  created it himself in the app), daisy confirms with him first: supplier,
  job, lines, then waits. §1 retitled "When to use the portal — Chris
  decides"; §2 opens on his go-ahead.

## 1.0.0 — 2026-08-19

Initial version. This skill briefly lived on rosie earlier the same day;
Bhoumik then ruled that **rosie never communicates with a supplier — daisy
owns every supplier conversation, the portal included** — so it moved here,
rewritten for daisy: the `is_onboarded` gate, creating a request with
snapshotted lines (reading the customer tables, never writing them), handling
`availability_submitted` / `supplier_message` events on the request's task
thread (`supplier-<id>-§-[TASK]-§-ar-<arId>`), replying in the portal thread
as Daisy on the `app` channel, relaying answers to rosie in her
sourcing-notes shape, the escalate-to-Chris rules, and the
`new`/`submitted`/`closed` lifecycle.
