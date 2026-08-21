# supplier-communications — changelog

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
