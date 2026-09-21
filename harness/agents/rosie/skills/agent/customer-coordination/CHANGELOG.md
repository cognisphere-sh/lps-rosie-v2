# customer-coordination — changelog

## 3.3.0 — 2026-09-18

- Relay already committed requests and accepted quotes with exact commitment scope, supplied pricing and source messages/attachments so the job thread can order directly without a new quote or AR.
- Avoid asking for acceptance already established; use APS only for missing prices. Align order labels to New/Processing/Order Ready, with jobs Committed.

## 3.2.0

- Update customer-acceptance and quote-delivery guidance for Job Requests without a Confirmed stage; supplier confirmation remains an Order status.

## 3.1.0

- Relay scoped customer acceptance for Committed supplier orders, preserve multi-job allocation boundaries, and relay expected install and pickup/delivery details separately from supplier confirmation.

## 3.0.1

2026-09-11 — Align quote delivery and confirmation relays with the six-stage job vocabulary; Won/Lost remain explicit closure outcomes.

## 3.0.0

2026-09-10 — Keep every customer message on its customer thread, relay all job updates, and return required communication approvals to the original request chat.

## 2.3.0

2026-08-25 (Bhoumik, same day as 2.2.0) — a job-order question is **never put
to Chris here**; it goes to the `jr-<id>` thread, which decides and returns the
approved text (`1-agent.md` rule 5). Relaying to the jr thread widened from "an
answer you were waiting for" to everything touching the order — a changed date,
a cut scope, a complaint, a question you cannot settle.

## 2.2.0

2026-08-25 (Bhoumik) — **approval for an order-related message now happens on
the `jr-<id>` thread, not here** (`1-agent.md` rule 5). That thread drafts from
customer-safe fields and gets Chris's approval on its own web chat, then routes
the approved text; this thread sends it **exactly as approved**, and sends it
back for re-approval rather than editing an approved draft. A message with no
order behind it is still drafted and approved here.

## 2.1.0

2026-08-25 (Bhoumik) — **rosie has her own mailbox**
(`chris@localplantsupply.com`, as *Christopher Runyon*), so an approved
customer message now goes out with `gws gmail +send`/`+reply` from this thread
instead of waiting for Chris to send it himself; replies route back with a
`--gmail-thread-id` rule. Chris's per-draft approval is unchanged, and he can
still send something himself. Contact posted to the thread's web chat is now
the **complete text, quoted**, not a description of it.

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
