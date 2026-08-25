# customer-coordination — changelog

## 2.0.0

2026-08-25 (Bhoumik). `customers.communication_notes` is **gone** (migration
0073) — the same move the supplier side made in 0063. This thread's own web
chat is the contact record now: every contact is posted there instead of
appended to a column, and the app's customer page opens the thread from a
Rosie button. `customers.notes` is unchanged.

## 1.1.1

2026-08-24 (harness 0.10.1). Description rephrased to the tightened spec —
"what's included" is a brief sketch rather than an exhaustive contents list,
and partial applicability moved under "use when". No procedural change.

## 1.1.0

2026-08-24 (Bhoumik). Draft approvals are asked **on this thread's own web
chat**, not via `main`; `main` remains only the Telegram escalation for a
critical blocker.

## 1.0.0

2026-08-23 — Initial version (Bhoumik's rosie restructure). One dedicated
thread per customer (`customers.rosie_thread_id`, migration 0068; minted on
first contact), carrying every conversation with them across all their job
requests: the draft → Chris-approves → Chris-sends flow moved here from
`job-requests` §7, the append-only `communication_notes` log, durable
preferences in `customers.notes`, relaying answers to the owning `jr-<id>`
thread, and per-thread web-chat milestones.

(Restored 2026-08-23 after rosie's `skills/agent/` directory was wiped on
disk between harness restarts, same content.)
