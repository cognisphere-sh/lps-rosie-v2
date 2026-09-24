## 2. Handoff contract

Write the handoff body with the write tool to `/tmp/<thread>-<task>-handoff.txt`,
then use the literal-text helper (paths below are relative to the agent root):

```sh
skills/agent/message-routing/scripts/send-text --via agent --to-agent rosie --thread-id <owner> --text-file /tmp/<thread>-<task>-handoff.txt
```

The helper passes one literal argument to the existing CLI, preserving currency,
apostrophes, backticks and newlines without shell evaluation. It inherits trusted
sender identity, returns the CLI's exit status and never retries. It grants no
send permission. For an authorized webchat message use `--via webchat` without
`--to-agent`; add `--portal` only for intended supplier-visible content. The
webchat CLI has no `edit-message` command: check its help before unfamiliar
operations, and send a concise correction when needed.

Each handoff carries:

- Task, actual original request and known constraints; whether this is
  `quote_only`, already committed intake, or an accepted quote going directly
  to order. Use `skip_availability: true` for the direct path; these are handoff
  instructions, not new database columns. Later explicit acceptance supersedes
  an earlier quote-only intent for that scope.
- Exact customer commitment evidence, accepted lines/quantities, supplied or
  previously accepted prices and their message/attachment source. Preserve
  which prices remain missing for APS lookup; do not lose these details or
  turn a quote draft/supplier reply into acceptance during a relay.
- Job/customer/supplier/AR/item ids when known; inventory UUIDs and mapped
  row/price evidence for sourcing.
- `OriginThreadId` and `OriginChannel` from the originating human interaction,
  unchanged across all relays. **Approvals return to this original chat
  even if Chris has since switched chats.** Metadata identifies the
  interaction; it is not itself approval.
- Return/owner thread; draft recipient, channel, full content and approval
  evidence when sending approved communication. For Order/AR supplier updates,
  carry the affected job name(s) and verified direct supplier-portal record
  link(s), following `supplier-coordination`; preserve them in the sent message.
  Keep JR/AR/order ids in internal handoff metadata and URL targets only;
  supplier-visible references and link labels use the job name without numbers.

For email, include MessageId, GmailThreadId, sender, subject, received time,
attachment names and the mailbox it lives in. Let the contact thread read
it with `scripts/gws/email read`; avoid repeated attachment parsing in main.
Internal agent messages are not customer/supplier content. Quote shell
arguments safely so currency `$`, backticks and substitutions stay literal.

## Keep ownership and context bounded

Handle small, already-scoped updates in the owning thread. If task threads are
needed, assign one writer per record/field set and one writer per skill; other
workers return evidence. The owner posts one consolidated result and records
workflow milestones once. A correction or stop supersedes the earlier brief:
report writes already made before starting dependent follow-up work.

Carry exact evidence references and unresolved decisions rather than repeating
whole transcripts or policy documents. Read the skill index and only linked task
references; do not load full changelogs for routine execution. For local session
recall use `scripts/agent/session-reader <session> --no-thinking --search <term>
--max-chars 1200`, then a bounded `--from-index N --n 6` window around the hit.
Its `--n` window is applied before search filters, not a limit on matched hits.

Keep task notes in the assigned task file. For shared daily notes/index entries,
read the exact current target before a narrow edit; after a mismatch, reread that
section instead of retrying stale whole-file replacements. Do not replace other
threads' entries. Check existence before reading optional/new notes; missing task
notes are not a reason to search unrelated threads.
