# customer-coordination — changelog

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
