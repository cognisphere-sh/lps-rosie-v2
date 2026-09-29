# supplier-communications — changelog

## 7.0.0 — 2026-09-29

Plain-language rewrite (Daisy audit). Added `scripts/daily-note` and
`scripts/index-add` (copies of Rosie's tested helpers) so notes are appended
without reading 100 KB files (`workspace/index.md` was read 65 times last
week). Added from past feedback: never include the "Keep me in To" footer
(Chris 2026-07-15; Bhoumik 2026-07-15, 2026-08-19); approval may come from
Chris or Bhoumik (Bhoumik 2026-07-15); say "plants", not "offerings" (Chris
2026-08-05). Records table now covers daily note, index and memory.

## 6.5.0

- Make transcript and send procedures canonical, remove repeated lifecycle policy, and keep order mail handoffs internal unless forwarding is authorized.

## 6.4.0

- Clarify the order-message handoff: supplier confirmation makes Orders Confirmed and leaves Job Requests Committed; Rosie owns their separate lifecycles.

## 6.3.0

- Keep full supplier correspondence in its transcript and defer compact JR sourcing snapshots and row outcomes to Rosie's job-requests skill.

## 6.2.0

- Route consolidated multi-job availability and supplier-order messages to Rosie with full references; distinguish APS quote/availability/order stages from general inventory ingestion.

## 6.1.0

2026-08-25 (Bhoumik, same day as 6.0.0) — **the send approval is asked on the
supplier thread's own web panel**, not `main`. Draft approvals are minor
approvals and belong where the work is; `main` is now reserved for urgent
escalations over Telegram. The old step 7 ("report what was sent back to
`main`") is gone — the quoted send on the panel is the report, and `main`
hears nothing about a routine exchange.

## 6.0.0

2026-08-25 (Bhoumik) — **scoped to supplier lifecycle.** Rosie now has her own
mailbox (`chris@localplantsupply.com`) and owns every communication about an
order or a job request; this skill covers what daisy says about the supplier's
*lifecycle* — onboarding and account setup, paperwork, how availability
reaches us, record corrections, the drop itself — from
`chris.r@localplantsupply.com`. **The line is the subject, not the party**: a
lifecycle matter is daisy's even while rosie is mid-order with that supplier,
and an order matter is rosie's even on first contact. Order mail reaching
daisy's inbox is quoted to the supplier thread's panel and handed to rosie's
`router` by agent message (forwarded with `gws gmail +forward` when she needs
the message itself), never answered here.

## 5.0.0

2026-08-25 (Bhoumik) — **the contact history moved out of `notes.md` and into
the supplier thread's own web panel**, the way rosie's customer threads have
worked since migration 0073. Every direct exchange is now quoted **in full**
to the panel, both directions, headed by subject / sender / Gmail deep link;
`notes.md` keeps only what outlives the exchange (open loops, commitments) and
no longer carries a dated pointer per exchange. A **broadcast** — an
availability drop, price list or newsletter — is not direct communication: it
gets a header-only block (subject link, sender, first line, attachment names)
and no contact record. Everything is internal, **never `--portal`**. Breaking:
the old `gmailThreadId=<id>` note pointer is gone; existing notes are left as
they are. Format lives in `1-agent.md` § *Supplier contact → the web panel*.

## 4.1.2

2026-08-24 (harness 0.10.1). Description rephrased to the tightened spec —
"what's included" is a brief sketch rather than an exhaustive contents list,
and partial applicability moved under "use when". No procedural change.

## 4.1.1

2026-08-23 (Bhoumik) — reply-path paragraph updated for the router rename
(`email-router` → `router`) and the new per-supplier gws rules: a reply may
now land on the supplier thread directly instead of as a router forward; rule
management stays the router's job (`supplier-email-routing` §5).

## 4.1.0

2026-08-23 (Bhoumik, same day as 4.0.0) — the fact-placement section now says
**every supplier quirk lives in `suppliers.notes`**; the
`workspace/suppliers/…/notes.md` working-memory bullet became a read-only
legacy note, and a new "Nowhere" bullet bars persisting task updates, progress
notes and minor observations — only what long-term consistency depends on gets
written down.

## 4.0.0

2026-08-23 (same day as 3.0.0) — Bhoumik dropped the `supplier_messages`
transcript table (migration 0066; rows snapshotted to
`supplier_messages_backup_20260823`) along with the app's Conversation tab and
portal chat. Recording a contact is now a dated pointer (substance + Gmail
thread id) in the supplier thread's `notes.md` plus a daily-note entry — Gmail
holds the full text. The Portal chat section is gone with the feature;
`suppliers.communication_notes` remains the frozen pre-0063 archive nothing
writes.

## 3.0.0

2026-08-23 — Bhoumik's agent restructure plus Chris's 2026-08-20/21 feedback:

- The one-thread-per-supplier convention now names the
  `suppliers.daisy_thread_id` thread (`supplier-<slug>`, one per head branch,
  migration 0064); older `supplier-<id>` threads are history.
- Per-exchange `gws` routing rules retired: a catch-all route pins all inbound
  email to the `email-router` thread, which forwards replies here
  (`supplier-email-routing` skill) — a rule added after the catch-all would
  never fire.
- New sections from Chris's feedback: his email style (2–3 short casual
  lines, never wordy, no Texas mention to Texas-only suppliers), the stored
  Sales & Use Tax permit as an approved-send attachment, and the standing
  **learning mode** (per-supplier go-ahead even for the approved template;
  Chris personally handles gated buyer applications).
- The availability-requests portal-request procedure left Daisy's scope, and
  the supplier-events plugin was dropped with it (to return with rosie); the
  portal-chat reply rule now lives here as its own section — portal messages
  no longer wake Daisy, she answers when pointed at one.

2026-08-21 — Chris approved a reusable, light-touch initial-outreach template
for **Texas wholesale nurseries**. It is stored as
`artifacts/texas-wholesale-nursery-initial-outreach.txt`; it expressly is not
an availability-list demand and does not change the requirement for
supplier-specific Chris/Bhoumik authorization before contact.

## 2.2.0

2026-08-19, same-day follow-up: one chat per supplier — the per-request task
threads are gone. Portal availability events arrive on `supplier-<id>` with
everything else; new transcript rows leave `availability_request_id` NULL.

## 2.1.0

2026-08-19, the ownership settled: **availability requests are rosie's** — the
portal is not daisy's surface. The short-lived daisy `availability-requests`
skill is deleted; this skill's portal references now point at rosie. The
transcript, thread convention and instruction handling are unchanged from
2.0.0.

## 2.1.0

2026-08-19, from Bhoumik: the portal is not standing-authorized per request
after all — **raising an availability request needs Chris's go-ahead**, like
every other first contact; only replying within an already-open request thread
stays approval-free. The authorization section's parenthetical now says so and
points at `availability-requests` 1.1.0, which carries the rule in full along
with its sibling: nothing is marked or relayed as available before the
supplier confirms or Chris explicitly says so.

## 2.0.0

2026-08-19, superseding 1.2.0 the same day: **the log is gone; the transcript
is the record.** `suppliers.communication_notes` was retired by migration 0063
(entries migrated into `supplier_messages` as internal notes; the column is a
frozen archive) — every supplier exchange is now `supplier_messages` rows in
both directions, with `internal` notes for what the supplier never sees. New
one-thread-per-supplier convention (`supplier-<id>`; availability requests on
its task threads); the app's chat-view instructions arrive there via the new
`supplier-events` plugin; gws routing rules point replies at the supplier
thread. The portal channel is standing-authorized and lives in the new
`availability-requests` skill.

## 1.2.0

2026-08-19, alongside migration 0062 (supplier portal). Sourcing exchanges —
an availability/price question about a job request and the supplier's answer —
are now also mirrored into `supplier_messages` (one row per message,
`sender`/`sender_name`/`channel`), so the app's per-supplier conversation
thread is complete for non-onboarded suppliers too. `communication_notes`
keeps its prose log unchanged; exchanges with no job request behind them stay
notes-only.

## 1.1.1

2026-08-18. **Description rewritten short** — coverage in a clause or two, then
when to use it. No change to the procedure.

## 1.1.0

2026-08-15 — adds *Routing the supplier's reply back to this thread*, migrated
out of `knowledge/memory.md` (that file is for episodic facts; procedures are
skills). A `gws` routing rule for supplier correspondence must be keyed on the
Gmail thread id; a sender-wide rule swallows every future mail from that
supplier, including their next availability drop. Remove the rule when the
exchange closes. Also records the dates behind the send-as-Chris and 250px-logo
rules, which moved here from memory.

## 1.0.0

- Initial version: merges `supplier-communication-log` (v1.0.0) and
  `supplier-email-reply` (v1.0.0) into one skill, since replying to a supplier
  and logging that contact are always the same task. Both are retired.
- New rule: a routine availability drop is **not** a contact event — don't append
  it to `suppliers.communication_notes`; log only the correspondence around it.
- Absorbs the never-reply-unbidden authorization rule, which previously also sat
  in `system_prompts/1-agent.md`.
