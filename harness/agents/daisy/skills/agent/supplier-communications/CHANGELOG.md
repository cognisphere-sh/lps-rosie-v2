# supplier-communications — changelog

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
