# supplier-coordination — changelog

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
